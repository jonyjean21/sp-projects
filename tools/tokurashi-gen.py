#!/usr/bin/env python3
"""
トクラシ記事生成スクリプト
Usage: python3 tools/tokurashi-gen.py --topic "ふるさと納税の始め方" [--category ふるさと納税]
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen

JST = timezone(timedelta(hours=9))
VERCEL_API = 'https://vercel-api-orpin-one.vercel.app'
ARTICLES_FILE = os.path.join(os.path.dirname(__file__), '..', 'tokurashi', 'articles.json')

CATEGORIES = ['ポイ活', 'ふるさと納税', '旅行', '買い物', '節約', '副業']

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


def make_slug(title):
    """Generate a URL-safe slug from Japanese title"""
    # Use simple transliteration for common words, otherwise use hash
    slug = title.lower().strip()
    # Remove special chars, keep alphanumeric and hyphens
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    # If slug is too long or mostly non-ascii, use a shorter version
    if len(slug) > 60:
        slug = slug[:60].rstrip('-')
    return slug


def load_articles():
    try:
        with open(ARTICLES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_articles(articles):
    with open(ARTICLES_FILE, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description='トクラシ記事生成')
    parser.add_argument('--topic', required=True, help='記事のトピック')
    parser.add_argument('--category', default=None, help=f'カテゴリ: {", ".join(CATEGORIES)}')
    parser.add_argument('--dry-run', action='store_true', help='生成のみ（保存しない）')
    parser.add_argument('--init', action='store_true', help='初期構築モード（1日2記事制限を無視）')
    args = parser.parse_args()

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

    # Check daily limit
    articles = load_articles()
    today = datetime.now(JST).strftime('%Y-%m-%d')
    today_count = sum(1 for a in articles if a.get('date') == today)
    if today_count >= 2 and not args.dry_run and not args.init:
        print(f'Error: 1日2記事の上限に達しています（本日 {today_count} 記事生成済み）')
        sys.exit(1)

    # Check slug conflict
    slug_base = make_slug(args.topic)
    existing_slugs = {a['slug'] for a in articles}

    print(f'Generating: {args.topic} [{category}]')
    print('Calling Gemini API...')

    result = call_gemini(args.topic, category)

    title = result.get('title', args.topic)
    excerpt = result.get('excerpt', '')
    body = result.get('body', '')

    if len(body) < 500:
        print(f'Warning: 生成された本文が短すぎます（{len(body)}字）')

    slug = make_slug(title)
    if not slug or slug in existing_slugs:
        slug = slug_base
    # Ensure unique
    counter = 2
    original_slug = slug
    while slug in existing_slugs:
        slug = f'{original_slug}-{counter}'
        counter += 1

    article = {
        'slug': slug,
        'title': title,
        'category': category,
        'excerpt': excerpt,
        'date': today,
        'body': body,
    }

    print(f'\nTitle: {title}')
    print(f'Slug: {slug}')
    print(f'Category: {category}')
    print(f'Excerpt: {excerpt}')
    print(f'Body length: {len(body)} chars')

    if args.dry_run:
        print('\n[DRY RUN] 保存をスキップしました')
        return

    # Save
    articles.insert(0, article)  # newest first
    save_articles(articles)
    print(f'\narticles.json に保存しました（全 {len(articles)} 記事）')


if __name__ == '__main__':
    main()
