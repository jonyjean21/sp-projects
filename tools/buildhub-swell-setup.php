<?php
/**
 * BuildHub SWELL セットアップ（一回だけ実行）
 * 1. MOLKKY HUBのSWELLテーマをBuildhubにコピー
 * 2. SWELLを有効化
 * 3. このファイル自身を削除
 *
 * 使い方:
 *   ConoHaファイルマネージャーで buildhub.jp/ 直下にアップロード
 *   ブラウザで https://www.buildhub.jp/buildhub-swell-setup.php にアクセス
 *   完了後、ファイルは自動削除されます
 */

// セキュリティ: 直接アクセスのみ許可（念のためトークン確認）
if (!isset($_GET['run']) || $_GET['run'] !== 'go') {
    die('Usage: ?run=go');
}

define('SHORTINIT', false);
require_once __DIR__ . '/wp-load.php';

echo "<pre>\n";

// ===== 1. SWELLのソースパスを探す =====
$search_bases = [
    '/home/ad60s_c7787698/public_html/www.molkkyhub.com',
    '/home/ad60s_c7787698/public_html/molkkyhub.com',
    '/home/ad60s_c7787698/public_html/molkky-hub.com',
    '/home/ad60s_c7787698/public_html/www.molkky-hub.com',
];

$swell_src = null;
$swell_child_src = null;

foreach ($search_bases as $base) {
    $candidate = $base . '/wp-content/themes/swell';
    if (is_dir($candidate)) {
        $swell_src = $candidate;
        $child = $base . '/wp-content/themes/swell_child';
        if (is_dir($child)) $swell_child_src = $child;
        echo "SWELL発見: {$candidate}\n";
        break;
    }
}

if (!$swell_src) {
    die("ERROR: SWELLテーマが見つかりません。MOLKKY HUBのパスを確認してください。\n");
}

// ===== 2. BuildHubのテーマディレクトリにコピー =====
$themes_dir = get_theme_root(); // /home/.../buildhub.jp/wp-content/themes
echo "コピー先: {$themes_dir}\n";

function copy_dir($src, $dst) {
    if (!is_dir($dst)) mkdir($dst, 0755, true);
    $iter = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($src, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    $count = 0;
    foreach ($iter as $item) {
        $target = $dst . '/' . $iter->getSubPathname();
        if ($item->isDir()) {
            if (!is_dir($target)) mkdir($target, 0755, true);
        } else {
            copy($item->getPathname(), $target);
            $count++;
        }
    }
    return $count;
}

// SWELLコピー
$dst_swell = $themes_dir . '/swell';
if (is_dir($dst_swell)) {
    echo "swell: 既に存在（スキップ）\n";
} else {
    $n = copy_dir($swell_src, $dst_swell);
    echo "swell コピー完了: {$n}ファイル\n";
}

// 子テーマコピー
if ($swell_child_src) {
    $dst_child = $themes_dir . '/swell_child';
    if (is_dir($dst_child)) {
        echo "swell_child: 既に存在（スキップ）\n";
    } else {
        $n = copy_dir($swell_child_src, $dst_child);
        echo "swell_child コピー完了: {$n}ファイル\n";
    }
}

// ===== 3. SWELLを有効化 =====
$theme_to_activate = is_dir($themes_dir . '/swell_child') ? 'swell_child' : 'swell';
switch_theme($theme_to_activate);
echo "テーマ有効化: {$theme_to_activate}\n";

// ===== 4. 基本設定 =====
// サイトタイトル・キャッチフレーズ
update_option('blogname', 'BuildHub');
update_option('blogdescription', 'Claude Code・AI開発ツールの最新情報を毎日お届け');
echo "サイト情報設定完了\n";

// Hello worldを削除
$hw = get_page_by_path('hello-world', OBJECT, 'post');
if ($hw) {
    wp_delete_post($hw->ID, true);
    echo "Hello world! 削除\n";
}

// サンプルページ削除
$sample = get_page_by_path('sample-page', OBJECT, 'page');
if ($sample) {
    wp_delete_post($sample->ID, true);
    echo "サンプルページ削除\n";
}

echo "\n✅ セットアップ完了！\n";
echo "このファイルを削除してください（自動削除を試みます）\n";

// ===== 5. 自己削除 =====
echo "</pre>\n";
flush();

@unlink(__FILE__);
