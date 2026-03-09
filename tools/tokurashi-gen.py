#!/usr/bin/env python3
"""
トクラシ記事生成スクリプト（WordPress REST API版）
Usage:
  python3 tools/tokurashi-gen.py --topic "ふるさと納税の始め方" [--category ふるさと納税]
  python3 tools/tokurashi-gen.py --post-existing   # articles.jsonの既存記事をWPに投稿
"""

import argparse
import base64
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote

JST = timezone(timedelta(hours=9))
VERCEL_API = 'https://vercel-api-orpin-one.vercel.app'
ARTICLES_FILE = os.path.join(os.path.dirname(__file__), '..', 'tokurashi', 'articles.json')

# .env から読み込み
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

CATEGORIES = ['ポイ活', 'ふるさと納税', '旅行', '買い物', '節約', '副業']

# PR表示 + 免責事項テンプレート
PR_HEADER = '<p style="background:#f0f0f0;color:#666;font-size:13px;font-weight:700;padding:6px 14px;border-radius:4px;display:inline-block;margin-bottom:16px;">PR</p>'

DISCLAIMER = """<div style="background:#f8f8f8;border:1px solid #e5e5e5;border-radius:8px;padding:14px 16px;margin-top:32px;font-size:13px;color:#666;line-height:1.7;">
※ 当サイトはアフィリエイトプログラムに参加しています。記事内のリンクから商品を購入された場合、当サイトに報酬が支払われることがあります。<br>
※ 記載の情報は記事公開時点のものです。最新の情報は各公式サイトでご確認ください。<br>
※ 当サイトの情報を参考にした結果について、当サイトは一切の責任を負いません。
</div>"""

SYSTEM_PROMPT = """あなたはアフィリエイトブログ「トクラシ」のライターです。
「お得な暮らし」をテーマに、読者が実際に役立つ情報をわかりやすく書いてください。

## 必須ルール（景品表示法・薬機法遵守）
- 具体的な金額（年会費、還元率、利率、価格）は書かない。「詳しくは公式サイトでご確認ください」に統一
- 「日本一」「最強」「絶対」「必ず儲かる」等の根拠なき最上級表現・断定表現は使わない
- 「おすすめ」「人気」は使ってOKだが、根拠を示すか「筆者の意見」と明記
- 投資・金融商品の勧誘にあたる表現は禁止
- 健康食品・サプリメントの効果効能の断定は禁止
- ステルスマーケティングに該当する表現は禁止

## 文体・構成
- 2000〜3000字程度
- H2見出しを4〜6個使い、読みやすく構成する
- 口語すぎず、堅すぎない「です・ます調」
- 導入文（リード）→ 本文（見出しごと）→ まとめ の構成
- 具体的なテクニックやステップを含める
- 読者が「この記事を読んで得した」と感じる内容にする

## 出力形式
以下のJSON形式で出力してください。bodyはHTML（h2, h3, p, ul, li, blockquote, a タグ使用可）。
{
  "title": "記事タイトル（30字以内）",
  "excerpt": "記事の要約（80字以内）",
  "body": "<h2>見出し1</h2><p>本文...</p>..."
}
"""


def api_post(url, data, timeout=90):
    body = json.dumps(data).encode()
    req = Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def wp_post(endpoint, data):
    """WordPress REST API POST"""
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    auth = base64.b64encode(f'{WP_USER}:{WP_PASS}'.encode()).decode()
    req = Request(url, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Basic {auth}',
    })
    try:
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        err_body = e.read().decode()
        print(f'WP API Error {e.code}: {err_body}')
        raise


def wp_get(endpoint):
    """WordPress REST API GET"""
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    auth = base64.b64encode(f'{WP_USER}:{WP_PASS}'.encode()).decode()
    req = Request(url, headers={'Authorization': f'Basic {auth}'})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def get_or_create_category(name):
    """WPカテゴリを取得、なければ作成"""
    cats = wp_get(f'categories?search={quote(name)}&per_page=10')
    for c in cats:
        if c['name'] == name:
            return c['id']
    # 作成
    result = wp_post('categories', {'name': name})
    return result['id']


def call_gemini(topic, category):
    prompt = f"""以下のトピックについて、カテゴリ「{category}」の記事を書いてください。

トピック: {topic}

{SYSTEM_PROMPT}"""

    result = api_post(f'{VERCEL_API}/api/gemini', {
        'prompt': prompt,
        'temperature': 0.7,
        'json_mode': True,
    })

    text = (result.get('candidates', [{}])[0]
            .get('content', {})
            .get('parts', [{}])[0]
            .get('text', '{}'))

    # Strip markdown code fences if present
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    return json.loads(text)


def post_to_wp(title, body, excerpt, category, status='draft'):
    """記事をWordPressに投稿"""
    cat_id = get_or_create_category(category)

    # PR表示 + 本文 + 免責事項
    full_body = f'{PR_HEADER}\n{body}\n{DISCLAIMER}'

    post_data = {
        'title': title,
        'content': full_body,
        'excerpt': excerpt,
        'status': status,
        'categories': [cat_id],
    }

    result = wp_post('posts', post_data)
    return result


def load_articles():
    try:
        with open(ARTICLES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def post_existing_articles():
    """articles.jsonの既存記事をWPに一括投稿"""
    articles = load_articles()
    if not articles:
        print('articles.json に記事がありません')
        return

    print(f'{len(articles)} 記事をWPに投稿します...\n')
    for i, a in enumerate(articles):
        title = a['title']
        body = a['body']
        excerpt = a.get('excerpt', '')
        category = a.get('category', 'ポイ活')
        print(f'[{i+1}/{len(articles)}] {title}')
        try:
            result = post_to_wp(title, body, excerpt, category, status='draft')
            print(f'  → ID: {result["id"]}, URL: {result["link"]}')
        except Exception as e:
            print(f'  → ERROR: {e}')
    print(f'\n完了！ {len(articles)} 記事を下書きとして投稿しました')


def main():
    parser = argparse.ArgumentParser(description='トクラシ記事生成（WP投稿）')
    parser.add_argument('--topic', help='記事のトピック')
    parser.add_argument('--category', default=None, help=f'カテゴリ: {", ".join(CATEGORIES)}')
    parser.add_argument('--dry-run', action='store_true', help='生成のみ（投稿しない）')
    parser.add_argument('--init', action='store_true', help='初期構築モード（1日2記事制限を無視）')
    parser.add_argument('--post-existing', action='store_true', help='articles.jsonの既存記事をWPに投稿')
    parser.add_argument('--publish', action='store_true', help='下書きではなく公開として投稿')
    args = parser.parse_args()

    # 既存記事の一括投稿モード
    if args.post_existing:
        post_existing_articles()
        return

    if not args.topic:
        parser.error('--topic は必須です（--post-existing 以外）')

    # Auto-detect category from topic if not specified
    category = args.category
    if not category:
        for c in CATEGORIES:
            if c in args.topic:
                category = c
                break
        if not category:
            category = 'ポイ活'  # default

    if category not in CATEGORIES:
        print(f'Error: カテゴリは {", ".join(CATEGORIES)} から選択してください')
        sys.exit(1)

    # Check daily limit (WPの投稿数で判定)
    if not args.init and not args.dry_run:
        today = datetime.now(JST).strftime('%Y-%m-%dT00:00:00')
        try:
            today_posts = wp_get(f'posts?after={today}&per_page=100&status=draft,publish')
            if len(today_posts) >= 2:
                print(f'Error: 1日2記事の上限に達しています（本日 {len(today_posts)} 記事投稿済み）')
                sys.exit(1)
        except Exception:
            pass  # API取得失敗時はスキップ

    print(f'Generating: {args.topic} [{category}]')
    print('Calling Gemini API...')

    result = call_gemini(args.topic, category)

    title = result.get('title', args.topic)
    excerpt = result.get('excerpt', '')
    body = result.get('body', '')

    if len(body) < 500:
        print(f'Warning: 生成された本文が短すぎます（{len(body)}字）')

    print(f'\nTitle: {title}')
    print(f'Category: {category}')
    print(f'Excerpt: {excerpt}')
    print(f'Body length: {len(body)} chars')

    if args.dry_run:
        print('\n[DRY RUN] 投稿をスキップしました')
        return

    # WPに投稿
    status = 'publish' if args.publish else 'draft'
    print(f'\nWPに投稿中（{status}）...')
    wp_result = post_to_wp(title, body, excerpt, category, status=status)
    print(f'投稿完了！ ID: {wp_result["id"]}, URL: {wp_result["link"]}')


if __name__ == '__main__':
    main()
