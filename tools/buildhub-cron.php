<?php
/**
 * BuildHub 日次ダイジェスト生成
 * ConoHa WING cron で毎朝7時JST実行
 * 配置場所: /home/{user}/public_html/buildhub.jp/buildhub-cron.php
 *
 * ConoHa WING クーロン設定:
 *   コマンド: /usr/local/bin/php /home/{user}/public_html/buildhub.jp/buildhub-cron.php
 *   時刻: 毎日 07:00 JST
 *
 * 記事構成:
 *   - 今日のメイン（海外バズ記事を1本フル翻訳・詳細解説）
 *   - その他の注目（残り記事を要約）
 *   - BuildHub編集部より（今日の総評）
 */

define('FIREBASE_URL',   'https://viisi-master-app-default-rtdb.firebaseio.com');
define('QUEUE_PATH',     '/claude-tips-queue');
define('DIGEST_LOG',     '/claude-tips-digest-log');
define('CATEGORY_ID',    2);

// WordPress を読み込む
define('SHORTINIT', false);
require_once __DIR__ . '/wp-load.php';

// APIキーをwp-config.php で定義 (BUILDHUB_GEMINI_KEY) またはwp_optionsから取得
if (!defined('GEMINI_API_KEY')) {
    $gemini_key = defined('BUILDHUB_GEMINI_KEY') ? BUILDHUB_GEMINI_KEY : get_option('buildhub_gemini_key', '');
    if (empty($gemini_key)) {
        echo "ERROR: GEMINI_API_KEY未設定。wp-config.phpに define('BUILDHUB_GEMINI_KEY', 'your-key'); を追加してください。\n";
        exit(1);
    }
    define('GEMINI_API_KEY', $gemini_key);
}

date_default_timezone_set('Asia/Tokyo');
$today = date('Y/m/d');
echo "[{$today}] BuildHub Digest 開始\n";

// 1. Firebase から pending アイテム取得
$queue_data = firebase_get(QUEUE_PATH . '.json');
if (!$queue_data) {
    echo "pendingアイテムなし。終了。\n";
    exit(0);
}

$cutoff = date('c', strtotime('-48 hours'));
$items = [];
foreach ($queue_data as $id => $item) {
    if (!is_array($item)) continue;
    if (($item['status'] ?? '') !== 'pending') continue;
    if (isset($item['collected_at']) && $item['collected_at'] < $cutoff) continue;
    $item['_id'] = $id;
    $items[] = $item;
}

if (empty($items)) {
    echo "対象アイテムなし。終了。\n";
    exit(0);
}
echo "取得: " . count($items) . "件\n";

// 2. スコア順にソート → 海外ソース優遇 + コード含有ボーナス
usort($items, function($a, $b) {
    $bonus_a  = in_array($a['source'] ?? '', ['hn', 'reddit-claudeai', 'reddit-claudecode']) ? 50 : 0;
    $bonus_a += !empty($a['has_code'])   ? 20 : 0; // コード含有ボーナス
    $bonus_a += !empty($a['github_url']) ? 15 : 0; // GitHub URLボーナス
    $bonus_b  = in_array($b['source'] ?? '', ['hn', 'reddit-claudeai', 'reddit-claudecode']) ? 50 : 0;
    $bonus_b += !empty($b['has_code'])   ? 20 : 0;
    $bonus_b += !empty($b['github_url']) ? 15 : 0;
    return (($b['score'] ?? 0) + $bonus_b) <=> (($a['score'] ?? 0) + $bonus_a);
});
$top = array_slice($items, 0, 7);
echo "選択: " . count($top) . "件\n";

// 3. Gemini で日本語訳・要約・編集部コメントを一括生成
$result = summarize_with_gemini($top);
if (!$result) {
    echo "Gemini要約失敗。終了。\n";
    exit(1);
}
echo "Gemini要約完了\n";

// 4. WP 記事投稿
$title   = "Claude Code 海外バズ翻訳まとめ【{$today}】";
$content = build_html($result, $today, $top);
$excerpt = $result['excerpt'] ?? "今日のClaude Code最新情報。{$result['items'][0]['title_ja']}など{count($top)}本。";
$slug    = 'claude-code-' . date('Ymd');

// タグID取得（ソースに対応するタグを自動付与）
$source_tag_map = [
    'hn'                => 7,   // Hacker News
    'reddit-claudeai'   => 8,   // Reddit
    'reddit-claudecode' => 8,
    'zenn'              => 9,   // Zenn
    'qiita'             => 10,  // Qiita
    'dev-to'            => 11,  // dev.to
];
$tag_ids = [6, 12]; // Claude Code, AI開発 は常に付与
foreach ($top as $item) {
    $src = $item['source'] ?? '';
    if (isset($source_tag_map[$src])) {
        $tag_ids[] = $source_tag_map[$src];
    }
}
$tag_ids = array_unique($tag_ids);

$post_id = wp_insert_post([
    'post_title'    => $title,
    'post_content'  => $content,
    'post_excerpt'  => $excerpt,
    'post_status'   => 'publish',
    'post_name'     => $slug,
    'post_category' => [CATEGORY_ID],
    'tags_input'    => $tag_ids,
], true);

if (is_wp_error($post_id)) {
    echo "WP投稿エラー: " . $post_id->get_error_message() . "\n";
    exit(1);
}
echo "WP投稿完了: ID={$post_id}\n";

// 5. Firebase ステータス更新
foreach ($top as $item) {
    firebase_patch(QUEUE_PATH . '/' . $item['_id'] . '.json', [
        'status'  => 'published',
        'post_id' => $post_id,
    ]);
}

// 6. ログ記録
firebase_post(DIGEST_LOG . '.json', [
    'date'      => $today,
    'postId'    => $post_id,
    'itemCount' => count($top),
]);

echo "完了: " . count($top) . "件 → 投稿ID={$post_id}\n";


// ===== ヘルパー関数 =====

function firebase_get($path) {
    $url = FIREBASE_URL . $path;
    $ctx = stream_context_create(['http' => ['method' => 'GET']]);
    $res = @file_get_contents($url, false, $ctx);
    return $res ? json_decode($res, true) : null;
}

function firebase_post($path, $data) {
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/json',
        'content' => json_encode($data),
    ]]);
    @file_get_contents(FIREBASE_URL . $path, false, $ctx);
}

function firebase_patch($path, $data) {
    $ctx = stream_context_create(['http' => [
        'method'  => 'PATCH',
        'header'  => 'Content-Type: application/json',
        'content' => json_encode($data),
    ]]);
    @file_get_contents(FIREBASE_URL . $path, false, $ctx);
}

/**
 * Gemini API で翻訳・要約・編集部コメントを一括生成
 * 戻り値: { items: [...], editor_comment: "...", excerpt: "..." }
 */
function summarize_with_gemini($items) {
    $list = '';
    foreach ($items as $i => $item) {
        $n = $i + 1;
        $preview  = mb_substr($item['content_preview'] ?? '', 0, 400);
        $score    = $item['score'] ?? 0;
        $note = !empty($item['_note']) ? "\n補足: {$item['_note']}" : '';
    $list .= "[{$n}] タイトル: {$item['title']}\nURL: {$item['url']}\nソース: {$item['source']} (スコア:{$score}){$note}\n本文: {$preview}\n\n";
    }

    $main_source = $items[0]['source'] ?? '';
    $is_overseas = in_array($main_source, ['hn', 'reddit-claudeai', 'reddit-claudecode']);
    $main_hint   = $is_overseas
        ? "記事[1]は海外で最もバズった記事です。500文字以上の詳しい日本語解説を書いてください。"
        : "記事[1]は本日の注目記事です。400文字程度の詳しい日本語解説を書いてください。";

    // コード・GitHub情報をプロンプトに追加
    foreach ($items as $i => &$item) {
        if (!empty($item['github_url'])) {
            $item['_note'] = "GitHubリポジトリあり: {$item['github_url']}";
        } elseif (!empty($item['has_code'])) {
            $item['_note'] = "コード例あり";
        }
    }
    unset($item);

    $prompt = <<<PROMPT
あなたはClaude Code・AI開発ツール専門の日本語メディア「BuildHub」の編集者です。
以下の記事リストを読んで、日本のエンジニア向けにまとめてください。

{$main_hint}
記事[2]以降は2〜3文の要約で構いません。

以下のJSON形式で返してください（JSONのみ、説明文不要）:

{
  "excerpt": "記事全体の1文要約（100文字以内、SEO用）",
  "editor_comment": "BuildHub編集部として今日の注目ポイントを2〜3文でコメント。エンジニアが実際に使える視点で。",
  "items": [
    {
      "index": 1,
      "title_ja": "自然な日本語タイトル（英語は翻訳、日本語はそのまま）",
      "is_main": true,
      "summary": "詳しい日本語解説（記事[1]は500文字以上）。以下の構成で書くこと：\n①何が問題で何を解決しているか（150字）\n②どう動くか・核心の実装アプローチ（コードがある場合は核心部分10〜20行をコードブロックで示し、直後に「このコードでやっていること」を3〜5文で日本語解説）\n③日本のエンジニアへの示唆・応用アイデア（150字）\nGitHubリポジトリがある場合は「何ができるか」を1文で必ず明記。",
      "score_label": "HN 234 points" または "Reddit 456 upvotes" または "",
      "url": "元のURL",
      "source": "ソース名"
    },
    {
      "index": 2,
      "title_ja": "日本語タイトル",
      "is_main": false,
      "summary": "要点を2〜3文で日本語説明",
      "score_label": "",
      "url": "元のURL",
      "source": "ソース名"
    }
  ]
}

記事リスト:
{$list}
PROMPT;

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 4096],
    ]);

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/json',
        'content' => $payload,
    ]]);
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GEMINI_API_KEY;
    $res = @file_get_contents($url, false, $ctx);
    if (!$res) return null;

    $data = json_decode($res, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    preg_match('/\{[\s\S]*\}/u', $text, $m);
    if (!$m) return null;
    $decoded = json_decode($m[0], true);
    return $decoded ?: null;
}

/**
 * WP記事HTMLを生成（バズ翻訳メディア構成）
 */
function build_html($result, $date, $raw_items) {
    $labels = [
        'reddit-claudeai'   => 'Reddit r/ClaudeAI',
        'reddit-claudecode' => 'Reddit r/ClaudeCode',
        'hn'                => 'Hacker News',
        'zenn'              => 'Zenn',
        'qiita'             => 'Qiita',
        'dev-to'            => 'dev.to',
    ];

    $items          = $result['items'] ?? [];
    $editor_comment = $result['editor_comment'] ?? '';

    // ソース内訳
    $source_counts = [];
    foreach ($raw_items as $ri) {
        $src = $labels[$ri['source'] ?? ''] ?? ($ri['source'] ?? '');
        $source_counts[$src] = ($source_counts[$src] ?? 0) + 1;
    }
    $source_summary = implode(' / ', array_map(
        fn($s, $c) => "{$s} {$c}件",
        array_keys($source_counts),
        $source_counts
    ));

    // リード文
    $html  = "<p>本日の注目記事 " . count($items) . "本をお届けします。";
    $html .= "（{$source_summary}）</p>\n\n";

    foreach ($items as $item) {
        $label       = $labels[$item['source'] ?? ''] ?? ($item['source'] ?? '');
        $url         = esc_url($item['url']);
        $score_label = !empty($item['score_label']) ? " <small>({$item['score_label']})</small>" : '';

        if (!empty($item['is_main'])) {
            // ===== メイン記事（フル翻訳） =====
            $html .= "<div style=\"border-left:4px solid #0073aa;padding:12px 16px;margin:24px 0;background:#f0f7ff;\">\n";
            $html .= "<p style=\"margin:0 0 4px;\"><strong>📌 今日のメイン</strong></p>\n";
            $html .= "</div>\n\n";
            $html .= "<h2>{$item['title_ja']}{$score_label}</h2>\n";
            $html .= "<p><strong>ソース:</strong> {$label}</p>\n";
            $html .= "<div style=\"line-height:1.8;\">{$item['summary']}</div>\n";
            $html .= "<p><a href=\"{$url}\" target=\"_blank\" rel=\"noopener\">元記事を読む（英語）→</a></p>\n";
            $html .= "<hr style=\"margin:32px 0;\">\n\n";
            $html .= "<h2>その他の注目記事</h2>\n\n";
        } else {
            // ===== その他記事（要約） =====
            $html .= "<h3>{$item['title_ja']}{$score_label}</h3>\n";
            $html .= "<p><strong>ソース:</strong> {$label}</p>\n";
            $html .= "<p>{$item['summary']}</p>\n";
            $html .= "<p><a href=\"{$url}\" target=\"_blank\" rel=\"noopener\">記事を読む →</a></p>\n\n";
        }
    }

    // 編集部コメント
    if ($editor_comment) {
        $html .= "<hr style=\"margin:32px 0;\">\n\n";
        $html .= "<div style=\"background:#f9f9f9;border:1px solid #ddd;padding:16px;border-radius:4px;\">\n";
        $html .= "<p style=\"margin:0 0 8px;\"><strong>💬 BuildHub編集部より</strong></p>\n";
        $html .= "<p style=\"margin:0;\">{$editor_comment}</p>\n";
        $html .= "</div>\n\n";
    }

    $html .= "<p><small>このまとめはAIが自動生成しています。{$date}時点の情報です。</small></p>";
    return $html;
}
