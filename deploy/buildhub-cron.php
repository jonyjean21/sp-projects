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
 *   - 今日のメイン（海外バズ記事を1本ピックアップ・要約解説）
 *   - その他の注目（残り記事を要約）
 *   - BuildHub編集部より（今日の総評）
 */

define('FIREBASE_URL',   'https://viisi-master-app-default-rtdb.firebaseio.com');
define('QUEUE_PATH',     '/claude-tips-queue');
define('DIGEST_LOG',     '/claude-tips-digest-log');
define('CATEGORY_ID',        2); // Claude Code
define('DIGEST_CATEGORY_ID', 1); // まとめ記事

// WordPress を読み込む
define('SHORTINIT', false);
require_once __DIR__ . '/wp-load.php';

// APIキーは buildhub-config.php から読み込む（gitignore済み・サーバー上にのみ存在）
require_once __DIR__ . '/buildhub-config.php';

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
$title   = "Claude Code 海外バズ注目まとめ【{$today}】";
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
    'x-twitter'         => 15,  // X (Twitter)
    'github-releases'   => 16,  // GitHub
];
$tag_ids = [6, 12]; // Claude Code, AI開発 は常に付与
foreach ($top as $item) {
    $src = $item['source'] ?? '';
    if (isset($source_tag_map[$src])) {
        $tag_ids[] = $source_tag_map[$src];
    }
}
$tag_ids = array_unique($tag_ids);

// 重複投稿防止
$existing = get_posts(['name' => $slug, 'post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 1]);
if (!empty($existing)) {
    echo "本日の記事（{$slug}）は既に投稿済みです。スキップ。\n";
    exit(0);
}

$post_id = wp_insert_post([
    'post_title'    => $title,
    'post_content'  => $content,
    'post_excerpt'  => $excerpt,
    'post_status'   => 'publish',
    'post_name'     => $slug,
    'post_category' => [CATEGORY_ID, DIGEST_CATEGORY_ID],
    'tags_input'    => $tag_ids,
], true);

if (is_wp_error($post_id)) {
    echo "WP投稿エラー: " . $post_id->get_error_message() . "\n";
    exit(1);
}
echo "WP投稿完了: ID={$post_id}\n";

// 4.5. Pexels アイキャッチ設定（メイン記事タイトルから英語クエリ生成）
$pexels_queries = ['AI coding terminal dark', 'developer programming computer', 'artificial intelligence code'];
foreach ($pexels_queries as $q) {
    if (set_featured_image_from_pexels($post_id, $q)) break;
}

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
 * Gemini API で要約・解説・編集部コメントを一括生成
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
    $is_release  = $main_source === 'github-releases';

    if ($is_release) {
        $main_hint = "記事[1]はClaude Codeの公式リリースノートです。主な変更点を3〜5点の箇条書きでまとめ、「エンジニアが今すぐ試せること」を1文で添えてください。";
    } elseif ($is_overseas) {
        $main_hint = "記事[1]は海外で最もバズった記事です。500文字以上の詳しい日本語解説を書いてください。";
    } else {
        $main_hint = "記事[1]は本日の注目記事です。400文字程度の詳しい日本語解説を書いてください。";
    }

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

【タイトル生成のルール】
- バージョン番号のみのタイトル（例：v2.1.71）は「Claude Code v2.1.71 — [主な追加機能の一言]」形式で日本語タイトルを生成
- 英語タイトルは自然な日本語に意訳（直訳ではなく内容を反映した日本語）
- 既に日本語のタイトルはそのまま使用可（微調整は可）

{$main_hint}
記事[2]以降は要点を2〜3文で（github-releases の場合は主な変更点を2〜3点箇条書きで）。

以下のJSON形式で返してください（JSONのみ、説明文不要）:

{
  "excerpt": "記事全体の1文要約（100文字以内、SEO用）",
  "editor_comment": "BuildHub編集部として今日の注目ポイントを2〜3文でコメント。「〜という問題に悩んでいるエンジニアには特に参考になる」「〜を試してみる価値あり」など実際に使える視点で。AI臭い定型文（〜を一歩踏み込んで等）はNG。",
  "items": [
    {
      "index": 1,
      "title_ja": "自然な日本語タイトル",
      "is_main": true,
      "summary": "詳しい日本語解説（記事[1]は500文字以上）。以下の構成で書くこと：\n①何が問題で何を解決しているか（150字）\n②どう動くか・核心の実装アプローチ（コードがある場合は核心部分10〜20行をコードブロックで示し、直後に「このコードでやっていること」を3〜5文で日本語解説）\n③日本のエンジニアへの示唆・応用アイデア（150字）\nGitHubリポジトリがある場合は「何ができるか」を1文で必ず明記。\ngithub-releases の場合は主な変更点を<ul><li>形式の箇条書きで列挙。",
      "score_label": "HN 234 points または Reddit 456 upvotes または空文字",
      "url": "元のURL",
      "source": "ソース名"
    },
    {
      "index": 2,
      "title_ja": "日本語タイトル",
      "is_main": false,
      "summary": "要点を2〜3文で日本語説明（github-releasesなら主な変更点を2〜3点箇条書き）",
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
        'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 8192],
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
 * Pexels から画像を取得して WP アイキャッチに設定
 */
function set_featured_image_from_pexels($post_id, $query) {
    $url = 'https://api.pexels.com/v1/search?query=' . urlencode($query) . '&per_page=3&orientation=landscape';
    $ctx = stream_context_create(['http' => [
        'method' => 'GET',
        'header' => "Authorization: " . PEXELS_API_KEY . "\r\nUser-Agent: BuildHub/1.0\r\n",
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    if (!$res) { echo "Pexels取得失敗\n"; return false; }

    $data   = json_decode($res, true);
    $photos = $data['photos'] ?? [];
    if (empty($photos)) { echo "Pexels画像なし\n"; return false; }

    $img_url = $photos[0]['src']['large'];
    $img_data = @file_get_contents($img_url);
    if (!$img_data) { echo "画像DL失敗\n"; return false; }

    // WPメディアとして保存
    $upload = wp_upload_bits("buildhub-{$post_id}.jpg", null, $img_data);
    if (!empty($upload['error'])) { echo "WPアップロードエラー: {$upload['error']}\n"; return false; }

    $attachment_id = wp_insert_attachment([
        'post_mime_type' => 'image/jpeg',
        'post_title'     => "BuildHub featured {$post_id}",
        'post_status'    => 'inherit',
    ], $upload['file'], $post_id);

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $attach_data = wp_generate_attachment_metadata($attachment_id, $upload['file']);
    wp_update_attachment_metadata($attachment_id, $attach_data);
    set_post_thumbnail($post_id, $attachment_id);
    echo "アイキャッチ設定完了: attachment_id={$attachment_id}\n";
    return true;
}

/**
 * Markdown → HTML 変換（コードブロック・太字・インラインコード）
 */
function md_to_html($text) {
    // コードブロック
    $text = preg_replace_callback('/```(\w*)\n([\s\S]*?)```/', function($m) {
        $lang    = $m[1] ?: 'text';
        $escaped = htmlspecialchars($m[2], ENT_QUOTES, 'UTF-8');
        return "<pre style=\"background:#1e1e1e;color:#d4d4d4;padding:16px;overflow-x:auto;border-radius:6px;margin:16px 0;\"><code class=\"language-{$lang}\">{$escaped}</code></pre>";
    }, $text);
    // 太字
    $text = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $text);
    // インラインコード
    $text = preg_replace('/`([^`\n]+)`/', '<code style="background:#f4f4f4;padding:2px 6px;border-radius:3px;">$1</code>', $text);
    // ①②③ の前改行
    $text = preg_replace('/\n([①②③④⑤])/', '<br>$1', $text);
    return $text;
}

/**
 * WP記事HTMLを生成（バズ注目まとめメディア構成）
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

        $summary_html = md_to_html($item['summary'] ?? '');

        if (!empty($item['is_main'])) {
            // ===== メイン記事（ピックアップ・要約解説） =====
            $html .= "<div style=\"border-left:4px solid #0073aa;padding:12px 16px;margin:24px 0;background:#f0f7ff;\">\n";
            $html .= "<p style=\"margin:0 0 4px;\"><strong>📌 今日のメイン</strong></p>\n";
            $html .= "</div>\n\n";
            $html .= "<h2>{$item['title_ja']}{$score_label}</h2>\n";
            $html .= "<p><strong>ソース:</strong> {$label}</p>\n";
            $html .= "<div style=\"line-height:1.8;\">{$summary_html}</div>\n";
            $html .= "<p><a href=\"{$url}\" target=\"_blank\" rel=\"noopener\">元記事を読む（英語）→</a></p>\n";
            $html .= "<hr style=\"margin:32px 0;\">\n\n";
            $html .= "<h2>その他の注目記事</h2>\n\n";
        } else {
            // ===== その他記事（要約） =====
            $html .= "<h3>{$item['title_ja']}{$score_label}</h3>\n";
            $html .= "<p><strong>ソース:</strong> {$label}</p>\n";
            $html .= "<p>{$summary_html}</p>\n";
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
    $html .= "\n<div style=\"background:#1a1a1a;border-radius:10px;padding:28px 24px;margin:32px 0;text-align:center;\"><p style=\"color:#c8a06a;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;\">Newsletter</p><p style=\"color:#f2ede6;font-size:18px;font-weight:800;margin:0 0 6px;\">BuildHub Newsletter</p><p style=\"color:#888;font-size:13px;margin:0 0 20px;line-height:1.7;\">Claude Code・AI開発ツールの最新情報を週次でお届け。無料で購読できます。</p><a href=\"https://buildhub.beehiiv.com/subscribe\" target=\"_blank\" rel=\"noopener\" style=\"display:inline-block;background:#c8a06a;color:#1a1a1a;font-size:14px;font-weight:800;padding:12px 32px;border-radius:6px;text-decoration:none;\">無料で購読する →</a></div>\n";
    return $html;
}
