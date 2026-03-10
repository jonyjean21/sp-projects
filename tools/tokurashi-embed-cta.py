#!/usr/bin/env python3
"""
トクラシ既存記事にアフィリエイトCTAを自動埋め込み
Usage: python3 tools/tokurashi-embed-cta.py [--dry-run] [--program premium_water]
"""

import base64
import json
import os
import re
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env


ENV = load_env()
WP_SITE = ENV.get('TOKURASHI_WP_SITE', 'https://www.tokurashi.com')
WP_USER = ENV.get('TOKURASHI_WP_USER', '')
WP_PASS = ENV.get('TOKURASHI_WP_APP_PASSWORD', '')

AFFILIATES_FILE = os.path.join(os.path.dirname(__file__), 'tokurashi-affiliates.json')


def load_affiliates():
    with open(AFFILIATES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


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


def build_cta_html(program, config):
    """CTAブロックのHTMLを生成"""
    template = config['cta_style']
    return (template
            .replace('{{description}}', program['cta_description'])
            .replace('{{link}}', program['a8_link'])
            .replace('{{cta_text}}', program['cta_text']))


def should_embed(post_title, post_content, program):
    """記事にこのアフィリンクを埋め込むべきか判定"""
    text = (post_title + ' ' + post_content).lower()
    # キーワードマッチ（1つでもあればOK）
    for kw in program['target_keywords']:
        if kw.lower() in text:
            return True
    return False


def already_has_cta(content, program_name):
    """既にこのプログラムのCTAが埋め込まれているか"""
    return program_name in content


def insert_cta_before_disclaimer(content, cta_html):
    """免責事項の直前にCTAを挿入"""
    disclaimer_pattern = r'(<div[^>]*>※ 当サイトはアフィリエイトプログラム)'
    match = re.search(disclaimer_pattern, content)
    if match:
        pos = match.start()
        return content[:pos] + cta_html + '\n' + content[pos:]
    # 免責事項がない場合は末尾に追加
    return content + '\n' + cta_html


def main():
    import argparse
    parser = argparse.ArgumentParser(description='既存記事にアフィリエイトCTAを埋め込み')
    parser.add_argument('--dry-run', action='store_true', help='変更せず対象記事を表示')
    parser.add_argument('--program', default=None, help='特定のプログラムのみ（例: premium_water）')
    args = parser.parse_args()

    config = load_affiliates()
    programs = config['programs']

    # 対象プログラムをフィルタ
    targets = {}
    for key, prog in programs.items():
        if args.program and key != args.program:
            continue
        if prog['status'] != 'approved':
            continue
        if not prog['a8_link']:
            print(f'WARNING: {prog["name"]} のa8_linkが未設定 → スキップ')
            print(f'  → tools/tokurashi-affiliates.json の "{key}" > "a8_link" を設定してください')
            continue
        targets[key] = prog

    if not targets:
        print('埋め込み対象のプログラムがありません')
        print('tokurashi-affiliates.json で status=approved かつ a8_link を設定してください')
        return

    # WP記事を取得
    posts = wp_get('posts?per_page=100&status=publish&_fields=id,title,content,categories')
    cats = wp_get('categories?per_page=50&_fields=id,name')
    cat_map = {c['id']: c['name'] for c in cats}

    posts = [p for p in posts if 'Hello world' not in p['title']['rendered']]

    print(f'対象プログラム: {", ".join(t["name"] for t in targets.values())}')
    print(f'対象記事数: {len(posts)}\n')

    updated = 0
    for post in posts:
        post_id = post['id']
        title = post['title']['rendered']
        content = post['content']['rendered']
        cat_ids = post.get('categories', [])
        cat_name = cat_map.get(cat_ids[0], '') if cat_ids else ''

        for key, prog in targets.items():
            # カテゴリマッチ or キーワードマッチ
            cat_match = cat_name in prog['target_categories']
            kw_match = should_embed(title, content, prog)

            if not (cat_match or kw_match):
                continue

            if already_has_cta(content, prog['name']):
                continue

            print(f'[ID:{post_id}] {title} ← {prog["name"]}')

            if args.dry_run:
                print(f'  (dry-run) 埋め込み対象')
                continue

            cta_html = build_cta_html(prog, config)
            new_content = insert_cta_before_disclaimer(content, cta_html)
            wp_update(post_id, {'content': new_content})
            print(f'  → CTA埋め込み完了')
            updated += 1
            time.sleep(10)  # SiteGuard対策

    print(f'\n完了！ {updated} 記事を更新しました')


if __name__ == '__main__':
    main()
