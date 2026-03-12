<?php
/**
 * トクラシ 自動記事生成・投稿
 * ConoHa WING cron で水・土 8:00 JST実行
 * 配置場所: /home/{user}/public_html/tokurashi.com/tokurashi-cron.php
 *
 * ConoHa WING クーロン設定:
 *   コマンド: /usr/local/bin/php /home/{user}/public_html/tokurashi.com/tokurashi-cron.php
 *   時刻: 水曜・土曜 08:00 JST
 *
 * ドライラン: ?dry_run=1 をURLに付けて実行（WP投稿・Firebase更新なし）
 */

define('FIREBASE_URL',  'https://viisi-master-app-default-rtdb.firebaseio.com');
define('QUEUE_PATH',    '/tokurashi-article-queue');

// WordPress を読み込む
define('SHORTINIT', false);
require_once __DIR__ . '/wp-load.php';

// APIキー（tokurashi-config.php はgitignore済み・サーバーのみに存在）
require_once __DIR__ . '/tokurashi-config.php';

date_default_timezone_set('Asia/Tokyo');
$today = date('Y/m/d H:i');
$dry_run = isset($_GET['dry_run']) || (isset($argv[1]) && $argv[1] === '--dry-run');
echo "[{$today}] トクラシ記事生成" . ($dry_run ? ' [DRY RUN]' : '') . " 開始\n";

// ===== カテゴリマッピング =====
$CATEGORY_MAP = [
    'ポイ活'       => null,
    'ふるさと納税'  => null,
    '旅行'         => null,
    '買い物'       => null,
    '節約'         => null,
    '副業'         => null,
];

// ===== CTA設定 =====
$CTA_RULES = [
    [
        'name' => 'プレミアムウォーター',
        'categories' => ['*'],  // 全カテゴリ
        'keywords' => [],
        'html' => '<div style="background:#f0f8ff;border:2px solid #4a90d9;border-radius:10px;padding:20px;margin:24px 0;text-align:center;"><p style="font-size:16px;font-weight:bold;color:#333;margin:0 0 8px;">お水代を見直しませんか？</p><p style="color:#666;font-size:14px;margin:0 0 16px;">プレミアムウォーターなら天然水がお得に届きます。詳しくは公式サイトをチェック！</p><a href="https://px.a8.net/svt/ejp?a8mat=3ZN7D5+GKA0KI+2WMI+5YJRM" rel="nofollow" style="display:inline-block;background:#4a90d9;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">公式サイトを見る →</a></div>',
        'position' => 'footer',
    ],
    [
        'name' => '楽天市場',
        'categories' => ['買い物', '節約', 'ポイ活'],
        'keywords' => ['楽天', 'ポイント', 'セール', '買い物'],
        'html' => '<div style="background:#fff5f5;border:2px solid #bf0000;border-radius:10px;padding:20px;margin:24px 0;text-align:center;"><p style="font-size:16px;font-weight:bold;color:#bf0000;margin:0 0 8px;">楽天市場でお得にお買い物</p><p style="color:#666;font-size:14px;margin:0 0 16px;">楽天ポイントが貯まる＆使える！お得なセール情報もチェック。</p><a href="https://rpx.a8.net/svt/ejp?a8mat=3ZN7D5+H1E0U+2HOM+6PXKX&rakession=e8c3e5d2.1741352093.25efc8fc.02e8e09a.95e70ae1" rel="nofollow" style="display:inline-block;background:#bf0000;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">楽天市場を見る →</a><img border="0" width="1" height="1" src="https://www16.a8.net/0.gif?a8mat=3ZN7D5+H1E0U+2HOM+6PXKX" alt=""></div>',
        'position' => 'middle',
    ],
    [
        'name' => '楽天トラベル',
        'categories' => ['旅行'],
        'keywords' => ['旅行', '宿泊', 'ホテル', '温泉', 'GW', '夏休み'],
        'html' => '<div style="background:#f5fff5;border:2px solid #00a960;border-radius:10px;padding:20px;margin:24px 0;text-align:center;"><p style="font-size:16px;font-weight:bold;color:#00a960;margin:0 0 8px;">旅行をもっとお得に</p><p style="color:#666;font-size:14px;margin:0 0 16px;">楽天トラベルでお得な宿泊プランを探しましょう。ポイントも貯まります！</p><a href="https://rpx.a8.net/svt/ejp?a8mat=3ZN7D5+H1E0U+2HOM+HVNAR&rakession=e8c3e5d2.1741352093.25efc8fc.02e8e09a.95e70ae1" rel="nofollow" style="display:inline-block;background:#00a960;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">楽天トラベルを見る →</a><img border="0" width="1" height="1" src="https://www12.a8.net/0.gif?a8mat=3ZN7D5+H1E0U+2HOM+HVNAR" alt=""></div>',
        'position' => 'middle',
    ],
];

// PR表示 + 免責事項
$PR_HEADER = '<p style="background:#f0f0f0;color:#666;font-size:13px;font-weight:700;padding:6px 14px;border-radius:4px;display:inline-block;margin-bottom:16px;">PR</p>';
$DISCLAIMER = '<div style="background:#f8f8f8;border:1px solid #e5e5e5;border-radius:8px;padding:14px 16px;margin-top:32px;font-size:13px;color:#666;line-height:1.7;">※ 当サイトはアフィリエイトプログラムに参加しています。記事内のリンクから商品を購入された場合、当サイトに報酬が支払われることがあります。<br>※ 記載の情報は記事公開時点のものです。最新の情報は各公式サイトでご確認ください。<br>※ 当サイトの情報を参考にした結果について、当サイトは一切の責任を負いません。</div>';

// Pexels カテゴリクエリ（フォールバック用）
$PEXELS_FALLBACK = [
    'ポイ活'       => 'smartphone shopping cashback',
    'ふるさと納税'  => 'japanese local food gift',
    '旅行'         => 'japan travel suitcase',
    '買い物'       => 'online shopping delivery',
    '節約'         => 'piggy bank saving money',
    '副業'         => 'laptop work from home freelance',
];

// 記事生成プロンプト（tokurashi-gen.pyのSYSTEM_PROMPTを移植）
$SYSTEM_PROMPT = <<<'PROMPT'
あなたは「トクラシ編集部」のライターです。
「お得な暮らし」をテーマに、編集部が徹底的に調査・比較した情報をわかりやすく届けてください。

## 名義・トーン
- 名義は「トクラシ編集部」。個人の体験談・感想ではなく、調査・比較・分析の視点で書く
- 「編集部が調べたところ」「比較してみると」「調査した結果」のような表現を使う
- 個人の体験談（「私が使ってみた」「やってみた結果」）は使わない
- 客観的なデータや比較表を重視する。主観的な感想より「〇つの基準で比較した結果」型

## 必須ルール（景品表示法・薬機法遵守）
- 具体的な金額（年会費、還元率、利率、価格）は書かない。「詳しくは公式サイトでご確認ください」に統一
- 「日本一」「最強」「絶対」「必ず儲かる」等の根拠なき最上級表現・断定表現は使わない
- 「おすすめ」「人気」は使ってOKだが、根拠を示すか「編集部の見解」と明記
- 投資・金融商品の勧誘にあたる表現は禁止
- 健康食品・サプリメントの効果効能の断定は禁止
- ステルスマーケティングに該当する表現は禁止

## AI臭を消す文体ルール（重要）
- 「〜ではないでしょうか」「〜と言えるでしょう」を多用しない。最大1回まで
- 語尾のバリエーションを豊富に：「〜ですね」「〜なんです」「〜ですよ」「〜してみてください」を混ぜる
- 冒頭は読者の悩み・疑問への共感から入る
- 箇条書きの羅列だけで終わらせず、箇条書きの前後に補足説明を入れる
- 「それでは」「それでは早速」「いかがでしたか」は使わない
- 読者に語りかけるような自然な口調を心がける

## 文体・構成
- 2000〜3000字程度
- H2見出しを4〜6個使い、読みやすく構成する
- 「です・ます調」ベースだが、ときどき「〜ですよね」「〜なんです」でくだけさせる
- 導入文（読者の悩みへの共感）→ 本文（比較・解説）→ まとめ の構成
- 比較表やチェックリストを積極的に活用する
- 読者が「この記事を読んで得した」と感じる内容にする

## 出力形式
以下のJSON形式で出力してください。bodyはHTML（h2, h3, p, ul, li, blockquote, a タグ使用可）。
{
  "title": "記事タイトル（30字以内）",
  "excerpt": "記事の要約（80字以内）",
  "body": "<h2>見出し1</h2><p>本文...</p>..."
}
PROMPT;


// ============================================
// メイン処理
// ============================================

// 1. Firebase からpendingアイテムを1件取得
$queue_data = firebase_get(QUEUE_PATH . '.json');
if (!$queue_data) {
    echo "キューが空。終了。\n";
    exit(0);
}

$pending = null;
$pending_id = null;
foreach ($queue_data as $id => $item) {
    if (!is_array($item)) continue;
    if (($item['status'] ?? '') === 'pending') {
        $pending = $item;
        $pending_id = $id;
        break;
    }
}

if (!$pending) {
    echo "pendingアイテムなし。終了。\n";
    exit(0);
}

echo "対象: {$pending['title']} [{$pending['category']}]\n";
echo "ソース: {$pending['source']} (スコア: {$pending['score']})\n";

// 2. status → generating
if (!$dry_run) {
    firebase_patch(QUEUE_PATH . '/' . $pending_id . '.json', ['status' => 'generating']);
}

// 3. Gemini で記事生成
$category = $pending['category'] ?? '節約';
$article_prompt = "以下のトピックについて、カテゴリ「{$category}」の記事を書いてください。\n\n"
    . "トピック: {$pending['topic']}\n"
    . "タイトル案: {$pending['title']}\n"
    . "概要: " . ($pending['outline'] ?? '') . "\n\n"
    . $SYSTEM_PROMPT;

echo "Gemini API呼び出し中...\n";
$result = call_gemini($article_prompt);

if (!$result) {
    echo "Gemini生成失敗。リトライ...\n";
    $result = call_gemini($article_prompt);
}

if (!$result) {
    echo "Gemini生成2回失敗。ステータスをfailedに更新。\n";
    if (!$dry_run) {
        firebase_patch(QUEUE_PATH . '/' . $pending_id . '.json', [
            'status' => 'failed',
            'error' => 'Gemini generation failed after 2 attempts',
        ]);
    }
    exit(1);
}

$title   = $result['title'] ?? $pending['title'];
$excerpt = $result['excerpt'] ?? '';
$body    = $result['body'] ?? '';

// 4. 品質チェック
$body_len = mb_strlen(strip_tags($body));
$h2_count = preg_match_all('/<h2/i', $body);
echo "品質チェック: {$body_len}文字, H2={$h2_count}個\n";

if ($body_len < 1500 || $h2_count < 3) {
    echo "品質不足（{$body_len}字/H2={$h2_count}）。リトライ...\n";
    $retry_prompt = $article_prompt . "\n\n※重要: 前回の出力が短すぎました。必ず2000字以上、H2見出し4個以上で書いてください。";
    $result2 = call_gemini($retry_prompt);
    if ($result2) {
        $body2_len = mb_strlen(strip_tags($result2['body'] ?? ''));
        if ($body2_len > $body_len) {
            $title   = $result2['title'] ?? $title;
            $excerpt = $result2['excerpt'] ?? $excerpt;
            $body    = $result2['body'] ?? $body;
            $body_len = $body2_len;
            echo "リトライ成功: {$body_len}文字\n";
        }
    }
}

// 5. CTA挿入
$body = insert_ctas($body, $category, $pending['topic'] ?? '');

// 6. PR表示 + 免責事項
$full_body = "{$PR_HEADER}\n{$body}\n{$DISCLAIMER}";

echo "タイトル: {$title}\n";
echo "文字数: {$body_len}\n";

if ($dry_run) {
    echo "\n[DRY RUN] 記事生成完了。WP投稿・Firebase更新はスキップ。\n";
    echo "=== 記事プレビュー ===\n";
    echo "Title: {$title}\n";
    echo "Excerpt: {$excerpt}\n";
    echo "Category: {$category}\n";
    echo "Body (先頭500字): " . mb_substr(strip_tags($body), 0, 500) . "\n";
    exit(0);
}

// 7. wp_insert_post
$cat_id = get_or_create_category($category);
$slug = 'tokurashi-' . date('Ymd') . '-' . sanitize_title(mb_substr($pending['topic'], 0, 20));

// 重複チェック
$existing = get_posts(['name' => $slug, 'post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 1]);
if (!empty($existing)) {
    $slug .= '-' . substr(md5(time()), 0, 4);
}

$post_id = wp_insert_post([
    'post_title'    => $title,
    'post_content'  => $full_body,
    'post_excerpt'  => $excerpt,
    'post_status'   => 'publish',
    'post_name'     => $slug,
    'post_category' => [$cat_id],
], true);

if (is_wp_error($post_id)) {
    echo "WP投稿エラー: " . $post_id->get_error_message() . "\n";
    firebase_patch(QUEUE_PATH . '/' . $pending_id . '.json', [
        'status' => 'failed',
        'error'  => $post_id->get_error_message(),
    ]);
    exit(1);
}
echo "WP投稿完了: ID={$post_id}\n";

// 8. Pexelsアイキャッチ
$pexels_query = $pending['pexels_query'] ?? ($PEXELS_FALLBACK[$category] ?? 'lifestyle saving money');
$pexels_queries = [$pexels_query, $PEXELS_FALLBACK[$category] ?? 'lifestyle'];
foreach ($pexels_queries as $q) {
    if (set_featured_image_from_pexels($post_id, $q)) break;
}

// 9. Firebase ステータス更新
firebase_patch(QUEUE_PATH . '/' . $pending_id . '.json', [
    'status'       => 'published',
    'published_at' => date('c'),
    'post_id'      => $post_id,
    'wp_slug'      => $slug,
]);

echo "完了: {$title} → 投稿ID={$post_id}\n";


// ===== ヘルパー関数 =====

function firebase_get($path) {
    $url = FIREBASE_URL . $path;
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 15]]);
    $res = @file_get_contents($url, false, $ctx);
    return $res ? json_decode($res, true) : null;
}

function firebase_patch($path, $data) {
    $ctx = stream_context_create(['http' => [
        'method'  => 'PATCH',
        'header'  => 'Content-Type: application/json',
        'content' => json_encode($data),
        'timeout' => 15,
    ]]);
    @file_get_contents(FIREBASE_URL . $path, false, $ctx);
}

function firebase_post($path, $data) {
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/json',
        'content' => json_encode($data),
        'timeout' => 15,
    ]]);
    @file_get_contents(FIREBASE_URL . $path, false, $ctx);
}

/**
 * Gemini API で記事生成
 */
function call_gemini($prompt) {
    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 8192],
    ]);

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/json',
        'content' => $payload,
        'timeout' => 120,
    ]]);

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GEMINI_API_KEY;
    $res = @file_get_contents($url, false, $ctx);
    if (!$res) return null;

    $data = json_decode($res, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

    // JSONを抽出
    if (preg_match('/```(?:json)?\s*([\s\S]*?)```/', $text, $m)) {
        $text = $m[1];
    } elseif (preg_match('/\{[\s\S]*\}/u', $text, $m)) {
        $text = $m[0];
    }

    $decoded = json_decode(trim($text), true);
    return $decoded ?: null;
}

/**
 * CTA挿入
 */
function insert_ctas($body, $category, $topic) {
    global $CTA_RULES;

    $footer_ctas = [];
    $middle_ctas = [];

    foreach ($CTA_RULES as $rule) {
        // カテゴリマッチ
        $cat_match = in_array('*', $rule['categories']) || in_array($category, $rule['categories']);
        // キーワードマッチ
        $kw_match = empty($rule['keywords']);
        if (!$kw_match) {
            foreach ($rule['keywords'] as $kw) {
                if (mb_strpos($topic, $kw) !== false || mb_strpos($body, $kw) !== false) {
                    $kw_match = true;
                    break;
                }
            }
        }

        if ($cat_match || $kw_match) {
            if ($rule['position'] === 'footer') {
                $footer_ctas[] = $rule['html'];
            } else {
                $middle_ctas[] = $rule['html'];
            }
        }
    }

    // middle CTAは記事中盤（H2の2-3個目の後）に挿入
    if (!empty($middle_ctas)) {
        $h2_positions = [];
        preg_match_all('/<\/h2>/i', $body, $matches, PREG_OFFSET_CAPTURE);
        foreach ($matches[0] as $m) {
            $h2_positions[] = $m[1] + strlen($m[0]);
        }
        // 2個目のH2の後に挿入
        if (count($h2_positions) >= 2) {
            $insert_pos = $h2_positions[1];
            // 次のpタグの後に入れる
            $next_p = strpos($body, '</p>', $insert_pos);
            if ($next_p !== false) {
                $insert_pos = $next_p + 4;
            }
            $cta_html = "\n" . implode("\n", $middle_ctas) . "\n";
            $body = substr($body, 0, $insert_pos) . $cta_html . substr($body, $insert_pos);
        }
    }

    // footer CTAは末尾に追加
    if (!empty($footer_ctas)) {
        $body .= "\n" . implode("\n", $footer_ctas);
    }

    return $body;
}

/**
 * WPカテゴリ取得or作成
 */
function get_or_create_category($name) {
    $cats = get_categories(['search' => $name, 'hide_empty' => false]);
    foreach ($cats as $c) {
        if ($c->name === $name) return $c->term_id;
    }
    $result = wp_insert_term($name, 'category');
    if (is_wp_error($result)) return 1; // Uncategorized fallback
    return $result['term_id'];
}

/**
 * Pexels から画像を取得して WP アイキャッチに設定
 */
function set_featured_image_from_pexels($post_id, $query) {
    $url = 'https://api.pexels.com/v1/search?query=' . urlencode($query) . '&per_page=3&orientation=landscape';
    $ctx = stream_context_create(['http' => [
        'method'  => 'GET',
        'header'  => "Authorization: " . PEXELS_API_KEY . "\r\nUser-Agent: Tokurashi/1.0\r\n",
        'timeout' => 15,
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
    $upload = wp_upload_bits("tokurashi-{$post_id}.jpg", null, $img_data);
    if (!empty($upload['error'])) { echo "WPアップロードエラー: {$upload['error']}\n"; return false; }

    $attachment_id = wp_insert_attachment([
        'post_mime_type' => 'image/jpeg',
        'post_title'     => "Tokurashi featured {$post_id}",
        'post_status'    => 'inherit',
    ], $upload['file'], $post_id);

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $attach_data = wp_generate_attachment_metadata($attachment_id, $upload['file']);
    wp_update_attachment_metadata($attachment_id, $attach_data);
    set_post_thumbnail($post_id, $attachment_id);
    echo "アイキャッチ設定完了: attachment_id={$attachment_id}\n";
    return true;
}
