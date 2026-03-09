<?php
/**
 * BuildHub SWELL 初期設定スクリプト
 * 配置: /home/{user}/public_html/buildhub.jp/buildhub-swell-init.php
 * 実行: ブラウザで https://www.buildhub.jp/buildhub-swell-init.php にアクセス
 * 実行後: このファイルを削除すること（自動削除される）
 */

// 簡易認証トークン（ブラウザアクセス時にURLパラメータで確認）
define('SECRET', 'buildhub2026init');
if (!isset($_GET['token']) || $_GET['token'] !== SECRET) {
    http_response_code(403);
    die('403 Forbidden');
}

define('SHORTINIT', false);
require_once __DIR__ . '/wp-load.php';

$results = [];

// ===== 1. SWELLカラー設定 =====
$color_settings = [
    // メインカラー（ボタン・リンク・見出し下線等）
    'color_main'       => '#0073aa',
    // テキストリンク色
    'color_link'       => '#0073aa',
    // 見出し色
    'color_htag'       => '#0073aa',
    // ヘッダー背景色
    'color_header_bg'  => '#0073aa',
    // ヘッダー文字色
    'color_header_text'=> '#ffffff',
    // フッター背景色
    'color_footer_bg'  => '#222222',
    // フッター文字色
    'color_footer_text'=> '#cccccc',
    // サイト背景
    'color_bg'         => '#fdfdfd',
];

foreach ($color_settings as $key => $value) {
    $old = get_theme_mod($key, '(未設定)');
    set_theme_mod($key, $value);
    $results[] = "✅ {$key}: {$old} → {$value}";
}

// ===== 2. フッターテキスト（SWELL設定に応じて調整が必要な場合あり） =====
$footer_text_keys = [
    'footer_copyright' => '© 2026 BuildHub | Claude Code・AI開発ツール情報メディア',
    'footer_text'      => '© 2026 BuildHub | Claude Code・AI開発ツール情報メディア',
];
foreach ($footer_text_keys as $key => $value) {
    $old = get_theme_mod($key, '(未設定)');
    if ($old === '(未設定)' || empty($old)) {
        set_theme_mod($key, $value);
        $results[] = "✅ {$key}: 設定完了";
    } else {
        $results[] = "ℹ️ {$key}: 既に設定済み ({$old})";
    }
}

// ===== 3. 著者情報・目次設定 =====
$misc_settings = [
    'show_author_info'     => false,  // 著者情報非表示
    'toc_show_auto'        => true,   // 目次自動表示
    'toc_min_heading'      => 3,      // h2が3つ以上で目次表示
];
foreach ($misc_settings as $key => $value) {
    $old = get_theme_mod($key, '(未設定)');
    set_theme_mod($key, $value);
    $results[] = "✅ {$key}: 設定完了";
}

// ===== 4. 現在の全theme_modsを出力（デバッグ用） =====
$all_mods = get_theme_mods();

// ===== キャッシュクリア =====
if (function_exists('swell_delete_all_caches')) {
    swell_delete_all_caches();
    $results[] = "✅ SWELLキャッシュクリア完了";
}

// ===== 自己削除 =====
$self = __FILE__;

?>
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>BuildHub SWELL Init</title>
<style>body{font-family:monospace;padding:20px;background:#f5f5f5;}
.ok{color:green;}.info{color:blue;}.mod{background:#fff;padding:10px;border-radius:4px;margin-top:20px;}
</style></head>
<body>
<h1>BuildHub SWELL 初期設定</h1>
<h2>実行結果</h2>
<ul>
<?php foreach ($results as $r): ?>
    <li class="ok"><?= htmlspecialchars($r) ?></li>
<?php endforeach; ?>
</ul>

<h2>現在の全theme_mods（カラー関連）</h2>
<div class="mod">
<?php
$color_mods = array_filter($all_mods, fn($k) => str_contains($k, 'color') || str_contains($k, 'footer') || str_contains($k, 'header'), ARRAY_FILTER_USE_KEY);
foreach ($color_mods as $k => $v) {
    echo htmlspecialchars("{$k} = " . (is_string($v) ? $v : json_encode($v))) . "<br>\n";
}
?>
</div>

<p style="color:red;margin-top:30px;">⚠️ このファイルは実行後に自動削除されました。次回アクセス時は404になります。</p>
<p>SWELL管理画面でカスタマイズを確認してください: <a href="/wp-admin/customize.php">カスタマイズ画面を開く</a></p>

<?php
// 自己削除
if (file_exists($self)) {
    unlink($self);
}
?>
</body>
</html>
