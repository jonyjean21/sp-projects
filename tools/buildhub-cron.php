<?php
/**
 * BuildHub 日次ダイジェスト生成
 * ConoHa WING cron で毎朝7時JST実行
 * 配置場所: /home/{user}/public_html/buildhub.jp/buildhub-cron.php
 *
 * ConoHa WING クーロン設定:
 *   コマンド: /usr/local/bin/php /home/{user}/public_html/buildhub.jp/buildhub-cron.php
 *   時刻: 毎日 07:00 JST
 */

define('GEMINI_API_KEY', 'AIzaSyBWDUJxO0aANmm1KUM3cDtNHIqg2BPOJXg');
define('FIREBASE_URL',   'https://viisi-master-app-default-rtdb.firebaseio.com');
define('QUEUE_PATH',     '/claude-tips-queue');
define('DIGEST_LOG',     '/claude-tips-digest-log');
define('CATEGORY_ID',    2);

// WordPress を読み込む
define('SHORTINIT', false);
require_once __DIR__ . '/wp-load.php';

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

// 2. スコア順に上位7件を選択
usort($items, fn($a, $b) => ($b['score'] ?? 0) <=> ($a['score'] ?? 0));
$top = array_slice($items, 0, 7);
echo "選択: " . count($top) . "件\n";

// 3. Gemini で日本語要約
$summaries = summarize_with_gemini($top);
if (!$summaries) {
    echo "Gemini要約失敗。終了。\n";
    exit(1);
}
echo "Gemini要約完了\n";

// 4. WP 記事投稿
$title   = "Claude Code 最新情報まとめ【{$today}】";
$content = build_html($summaries, $today);
$slug    = 'claude-code-' . date('Ymd');

$post_id = wp_insert_post([
    'post_title'    => $title,
    'post_content'  => $content,
    'post_status'   => 'publish',
    'post_name'     => $slug,
    'post_category' => [CATEGORY_ID],
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

function summarize_with_gemini($items) {
    $list = '';
    foreach ($items as $i => $item) {
        $n = $i + 1;
        $preview = mb_substr($item['content_preview'] ?? '', 0, 300);
        $list .= "[{$n}] タイトル: {$item['title']}\nURL: {$item['url']}\nソース: {$item['source']}\n概要: {$preview}\n\n";
    }

    $prompt = <<<PROMPT
以下のClaude Code関連記事を日本語でまとめてください。
各記事について以下のJSONを返してください。配列形式で全件返すこと。

{"items": [{"index": 1, "title_ja": "日本語タイトル", "summary": "要点を2〜3文で日本語説明", "url": "元のURL", "source": "ソース名"}]}

記事リスト:
{$list}

注意: title_jaは自然な日本語に翻訳。summaryはエンジニア向けに実用的に。JSONのみ返すこと。
PROMPT;

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.3],
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
    preg_match('/\{[\s\S]*\}/', $text, $m);
    if (!$m) return null;
    return json_decode($m[0], true)['items'] ?? null;
}

function build_html($summaries, $date) {
    $labels = [
        'reddit-claudeai'  => 'Reddit r/ClaudeAI',
        'reddit-claudecode' => 'Reddit r/ClaudeCode',
        'hn'               => 'Hacker News',
        'zenn'             => 'Zenn',
        'qiita'            => 'Qiita',
        'dev-to'           => 'dev.to',
    ];

    $html = "<p>Claude Codeに関する本日の注目記事をまとめました。海外・国内の最新情報をお届けします。</p>\n\n";
    foreach ($summaries as $item) {
        $label = $labels[$item['source'] ?? ''] ?? ($item['source'] ?? '');
        $url   = esc_url($item['url']);
        $html .= "<h2>{$item['title_ja']}</h2>\n";
        $html .= "<p><strong>ソース:</strong> {$label}</p>\n";
        $html .= "<p>{$item['summary']}</p>\n";
        $html .= "<p><a href=\"{$url}\" target=\"_blank\" rel=\"noopener\">記事を読む →</a></p>\n";
        $html .= "<hr>\n\n";
    }
    $html .= "<p><small>このまとめはAIが自動生成しています。{$date}時点の情報です。</small></p>";
    return $html;
}
