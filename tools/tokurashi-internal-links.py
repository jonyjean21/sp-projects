#!/usr/bin/env python3
"""
トクラシ 内部リンク自動最適化
既存の集客記事からキラーページへの導線を自動挿入する。

Usage:
  python3 tools/tokurashi-internal-links.py --dry-run     # 対象を確認
  python3 tools/tokurashi-internal-links.py --execute      # 実行
"""

import argparse
import base64
import json
import os
import re
import time
from urllib.request import Request, urlopen


def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    try:
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env


ENV = load_env()
WP_SITE = ENV.get('TOKURASHI_WP_SITE', 'https://www.tokurashi.com')
WP_USER = ENV.get('TOKURASHI_WP_USER', '')
WP_PASS = ENV.get('TOKURASHI_WP_APP_PASSWORD', '')

# キラーページ（成約記事）の定義
# slug → {title, keywords（この記事にリンクすべきキーワード）}
KILLER_PAGES = {
    'water-server-guide': {
        'title': 'ウォーターサーバー選び完全ガイド',
        'keywords': ['ウォーターサーバー', '水', 'ミルク', '赤ちゃん', '天然水', '飲料水'],
        'link_text': 'ウォーターサーバーの選び方はこちら',
    },
    'insurance-review-guide': {
        'title': '保険の見直しガイド',
        'keywords': ['保険', '見直し', '生命保険', '医療保険', '保障'],
        'link_text': '保険の見直しについて詳しくはこちら',
    },
    'money-consultation-guide': {
        'title': 'お金の無料相談ガイド',
        'keywords': ['家計', 'ライフプラン', 'FP', 'お金の相談', '貯蓄'],
        'link_text': 'お金の専門家への無料相談について',
    },
    'best-credit-card-poikatsu': {
        'title': 'ポイ活におすすめのクレジットカード',
        'keywords': ['クレジットカード', 'クレカ', 'ポイント還元', 'キャッシュレス'],
        'link_text': 'ポイ活に最適なクレカの選び方',
    },
}

# 内部リンクボックスのHTMLテンプレート
LINK_BOX_TEMPLATE = """<div style="background:#f0f4ff;border:2px solid #667eea;border-radius:10px;padding:16px 20px;margin:20px 0;">
<p style="margin:0;font-size:15px;line-height:1.6;">
<span style="color:#667eea;font-weight:700;">▶ 関連記事:</span>
<a href="{url}" style="color:#333;text-decoration:underline;">{link_text}</a>
</p>
</div>"""


def wp_auth():
    return base64.b64encode(f'{WP_USER}:{WP_PASS}'.encode()).decode()


def wp_get(endpoint):
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    req = Request(url, headers={'Authorization': f'Basic {wp_auth()}'})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def wp_update(post_id, data):
    url = f'{WP_SITE}/wp-json/wp/v2/posts/{post_id}'
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = Request(url, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Basic {wp_auth()}',
    }, method='POST')
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def find_killer_page_urls():
    """キラーページのURL（slug）を取得"""
    urls = {}
    try:
        for slug in KILLER_PAGES:
            posts = wp_get(f'posts?slug={slug}&_fields=id,link,slug')
            if posts:
                urls[slug] = posts[0]['link']
                print(f'  Found: {slug} → {posts[0]["link"]}')
    except Exception as e:
        print(f'  WP API unavailable: {e}')
        # Fallback: construct URL from slug
        for slug in KILLER_PAGES:
            urls[slug] = f'{WP_SITE}/{slug}/'
            print(f'  Fallback: {slug} → {urls[slug]}')
    return urls


def should_link(content, title, killer_slug, killer_config):
    """この記事にキラーページへのリンクを入れるべきか判定"""
    text = (title + ' ' + content).lower()

    # 自分自身へのリンクは不要
    if killer_slug in content:
        return False

    # 既にリンクボックスが入っている
    if '関連記事:' in content and killer_config['link_text'] in content:
        return False

    # キーワードマッチ
    for kw in killer_config['keywords']:
        if kw.lower() in text:
            return True
    return False


def insert_internal_link(content, link_html):
    """記事の最後のH2の前に内部リンクボックスを挿入"""
    # 最後のH2を探す
    h2_positions = [m.start() for m in re.finditer(r'<h2', content)]

    if len(h2_positions) >= 2:
        # 最後のH2の前に挿入
        pos = h2_positions[-1]
        return content[:pos] + link_html + '\n' + content[pos:]
    else:
        # H2が1つ以下なら免責事項の前に挿入
        disclaimer_match = re.search(r'<div[^>]*>※ 当サイトは', content)
        if disclaimer_match:
            pos = disclaimer_match.start()
            return content[:pos] + link_html + '\n' + content[pos:]
        return content + '\n' + link_html


def main():
    parser = argparse.ArgumentParser(description='トクラシ 内部リンク自動最適化')
    parser.add_argument('--dry-run', action='store_true', help='変更せず対象を表示')
    parser.add_argument('--execute', action='store_true', help='実行')
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        parser.print_help()
        return

    if not WP_USER:
        print('Error: WP認証情報が .env に設定されていません')
        print('必要な環境変数: TOKURASHI_WP_USER, TOKURASHI_WP_APP_PASSWORD')
        return

    print('キラーページのURL確認...')
    killer_urls = find_killer_page_urls()
    print()

    # 全記事を取得
    posts = wp_get('posts?per_page=100&status=publish&_fields=id,title,content,slug')
    posts = [p for p in posts if 'Hello world' not in p['title']['rendered']]

    # キラーページ自体は除外
    killer_slugs = set(KILLER_PAGES.keys())
    posts = [p for p in posts if p['slug'] not in killer_slugs]

    print(f'対象記事: {len(posts)} 件\n')

    updates = []
    for post in posts:
        post_id = post['id']
        title = post['title']['rendered']
        content = post['content']['rendered']
        slug = post['slug']

        for killer_slug, killer_config in KILLER_PAGES.items():
            if killer_slug not in killer_urls:
                continue
            if not should_link(content, title, killer_slug, killer_config):
                continue

            url = killer_urls[killer_slug]
            link_html = LINK_BOX_TEMPLATE.format(url=url, link_text=killer_config['link_text'])

            print(f'  [ID:{post_id}] {title}')
            print(f'    → リンク先: {killer_config["title"]}')

            if not args.dry_run:
                new_content = insert_internal_link(content, link_html)
                updates.append((post_id, new_content, title, killer_config['title']))

    if args.dry_run:
        print(f'\n{len(updates) if updates else "上記の"}件の内部リンクを追加予定')
        print('実行するには: --execute オプションを使用')
        return

    if not updates:
        print('追加する内部リンクはありません')
        return

    print(f'\n{len(updates)} 記事を更新中...\n')
    for post_id, new_content, title, killer_title in updates:
        print(f'  Updating [ID:{post_id}] {title} → {killer_title}')
        wp_update(post_id, {'content': new_content})
        print(f'  → 完了')
        time.sleep(10)  # SiteGuard対策

    print(f'\n全{len(updates)}件の内部リンク追加完了！')


if __name__ == '__main__':
    main()
