#!/usr/bin/env python3
"""
トクラシ記事生成スクリプト（WordPress REST API版 + Pexels画像自動設定）
Usage:
  python3 tools/tokurashi-gen.py --topic "ふるさと納税の始め方" [--category ふるさと納税]
  python3 tools/tokurashi-gen.py --post-existing       # articles.jsonの既存記事をWPに投稿
  python3 tools/tokurashi-gen.py --add-eyecatch        # 既存WP記事にアイキャッチを一括設定
"""

import argparse
import base64
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote

JST = timezone(timedelta(hours=9))
VERCEL_API = 'https://vercel-api-orpin-one.vercel.app'
ARTICLES_FILE = os.path.join(os.path.dirname(__file__), '..', 'tokurashi', 'articles.json')


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
PEXELS_KEY = ENV.get('PEXELS_API_KEY', '')

CATEGORIES = ['ポイ活', 'ふるさと納税', '旅行', '買い物', '節約', '副業']

# カテゴリ → Pexels検索キーワード（英語の方が結果が良い）
CATEGORY_SEARCH = {
    'ポイ活': 'smartphone shopping cashback',
    'ふるさと納税': 'japanese local food gift',
    '旅行': 'japan travel suitcase',
    '買い物': 'online shopping delivery',
    '節約': 'piggy bank saving money',
    '副業': 'laptop work from home freelance',
}

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

## AI臭を消す文体ルール（重要）
- 「〜ではないでしょうか」「〜と言えるでしょう」を多用しない。最大1回まで
- 語尾のバリエーションを豊富に：「〜ですね」「〜なんです」「〜ですよ」「〜してみてください」を混ぜる
- 冒頭に筆者の軽い体験談・エピソードを1〜2文入れる（例:「私も最初は半信半疑でした」）
- 箇条書きの羅列だけで終わらせず、箇条書きの前後に補足説明を入れる
- 「それでは」「それでは早速」「いかがでしたか」は使わない
- 読者に語りかけるような自然な口調を心がける

## 文体・構成
- 2000〜3000字程度
- H2見出しを4〜6個使い、読みやすく構成する
- 「です・ます調」ベースだが、ときどき「〜ですよね」「〜なんです」でくだけさせる
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


# ===== HTTP helpers =====

def api_post(url, data, timeout=90):
    body = json.dumps(data).encode()
    req = Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def wp_auth_header():
    return base64.b64encode(f'{WP_USER}:{WP_PASS}'.encode()).decode()


def wp_post_json(endpoint, data):
    """WordPress REST API POST (JSON)"""
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = Request(url, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Basic {wp_auth_header()}',
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
    req = Request(url, headers={'Authorization': f'Basic {wp_auth_header()}'})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def wp_upload_image(image_data, filename, mime='image/jpeg'):
    """画像をWP Media Libraryにアップロード"""
    url = f'{WP_SITE}/wp-json/wp/v2/media'
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'

    # multipart/form-data を手動構築（SiteGuardがContent-Dispositionをブロックする可能性があるためシンプルに）
    req = Request(url, data=image_data, headers={
        'Content-Type': mime,
        'Content-Disposition': f'attachment; filename="{filename}"',
        'Authorization': f'Basic {wp_auth_header()}',
    })
    try:
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        err_body = e.read().decode()
        print(f'  WP Upload Error {e.code}: {err_body[:200]}')
        raise


# ===== Pexels API =====

def pexels_search(query, per_page=5):
    """Pexels APIで画像検索"""
    if not PEXELS_KEY:
        return []
    url = f'https://api.pexels.com/v1/search?query={quote(query)}&per_page={per_page}&orientation=landscape'
    req = Request(url, headers={
        'Authorization': PEXELS_KEY,
        'User-Agent': 'TokurashiGen/1.0',
    })
    try:
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            return data.get('photos', [])
    except Exception as e:
        print(f'  Pexels API Error: {e}')
        return []


def download_image(url):
    """画像をダウンロードしてバイト列で返す"""
    req = Request(url, headers={'User-Agent': 'TokurashiGen/1.0'})
    with urlopen(req, timeout=30) as resp:
        return resp.read()


def fetch_and_upload_images(category, count=3):
    """カテゴリに合った画像をPexelsから取得してWPにアップロード"""
    if not PEXELS_KEY:
        print('  PEXELS_API_KEY未設定 → 画像スキップ')
        return []

    query = CATEGORY_SEARCH.get(category, 'lifestyle saving money')
    photos = pexels_search(query, per_page=count + 2)  # 余分に取得

    uploaded = []
    for i, photo in enumerate(photos[:count]):
        img_url = photo.get('src', {}).get('medium', '') or photo.get('src', {}).get('large', '')
        if not img_url:
            continue
        photographer = photo.get('photographer', 'Pexels')
        photo_url = photo.get('url', '')
        filename = f'tokurashi-{photo["id"]}.jpg'

        print(f'  Downloading image {i+1}: {photographer}')
        try:
            img_data = download_image(img_url)
            result = wp_upload_image(img_data, filename)
            uploaded.append({
                'id': result['id'],
                'url': result['source_url'],
                'alt': f'{category}のイメージ画像（Photo by {photographer}）',
                'photographer': photographer,
                'photo_url': photo_url,
            })
            print(f'  → Uploaded: ID={result["id"]}')
        except Exception as e:
            print(f'  → Upload failed: {e}')
    return uploaded


def insert_images_in_body(body, images):
    """H2見出しの直後に画像を挿入"""
    if not images:
        return body

    h2_pattern = re.compile(r'(</h2>)')
    matches = list(h2_pattern.finditer(body))

    # 各H2の後に画像を1枚ずつ挿入（先頭のH2は除く=アイキャッチと被るため）
    offset = 0
    img_idx = 1  # 0番目はアイキャッチ用、1番目以降を記事内に
    for i, match in enumerate(matches):
        if i == 0:
            continue  # 最初のH2はスキップ
        if img_idx >= len(images):
            break
        img = images[img_idx]
        img_html = f'\n<figure class="wp-block-image"><img src="{img["url"]}" alt="{img["alt"]}" /><figcaption>{img["alt"]}</figcaption></figure>\n'
        pos = match.end() + offset
        body = body[:pos] + img_html + body[pos:]
        offset += len(img_html)
        img_idx += 1

    return body


# ===== WP Category =====

def get_or_create_category(name):
    cats = wp_get(f'categories?search={quote(name)}&per_page=10')
    for c in cats:
        if c['name'] == name:
            return c['id']
    result = wp_post_json('categories', {'name': name})
    return result['id']


# ===== Gemini =====

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

    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    return json.loads(text)


# ===== WP Post =====

def post_to_wp(title, body, excerpt, category, status='draft', images=None):
    """記事をWordPressに投稿（画像付き）"""
    cat_id = get_or_create_category(category)

    # 画像を記事内に挿入
    if images and len(images) > 1:
        body = insert_images_in_body(body, images)

    # PR表示 + 本文 + 免責事項
    full_body = f'{PR_HEADER}\n{body}\n{DISCLAIMER}'

    post_data = {
        'title': title,
        'content': full_body,
        'excerpt': excerpt,
        'status': status,
        'categories': [cat_id],
    }

    # アイキャッチ画像設定
    if images and len(images) > 0:
        post_data['featured_media'] = images[0]['id']

    result = wp_post_json('posts', post_data)
    return result


# ===== Existing articles =====

def load_articles():
    try:
        with open(ARTICLES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def post_existing_articles():
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
    print(f'\n完了！')


def add_eyecatch_to_existing():
    """既存WP記事にアイキャッチ画像を一括設定"""
    if not PEXELS_KEY:
        print('Error: PEXELS_API_KEY が .env に設定されていません')
        sys.exit(1)

    # 公開済み記事を取得
    posts = wp_get('posts?per_page=50&status=publish&_fields=id,title,featured_media,categories')
    # カテゴリID→名前マッピング
    cats = wp_get('categories?per_page=50&_fields=id,name')
    cat_map = {c['id']: c['name'] for c in cats}

    posts_without_eyecatch = [p for p in posts if p.get('featured_media', 0) == 0]
    if not posts_without_eyecatch:
        print('全記事にアイキャッチが設定済みです')
        return

    print(f'{len(posts_without_eyecatch)} 記事にアイキャッチを設定します...\n')
    for p in posts_without_eyecatch:
        title = p['title']['rendered']
        cat_ids = p.get('categories', [])
        cat_name = cat_map.get(cat_ids[0], 'ポイ活') if cat_ids else 'ポイ活'

        print(f'[ID:{p["id"]}] {title} [{cat_name}]')
        images = fetch_and_upload_images(cat_name, count=1)
        if images:
            # アイキャッチを設定
            wp_post_json(f'posts/{p["id"]}', {'featured_media': images[0]['id']})
            print(f'  → アイキャッチ設定完了: {images[0]["url"]}')
        else:
            print(f'  → 画像取得失敗')
    print('\n完了！')


# ===== Main =====

def main():
    parser = argparse.ArgumentParser(description='トクラシ記事生成（WP投稿 + Pexels画像）')
    parser.add_argument('--topic', help='記事のトピック')
    parser.add_argument('--category', default=None, help=f'カテゴリ: {", ".join(CATEGORIES)}')
    parser.add_argument('--dry-run', action='store_true', help='生成のみ（投稿しない）')
    parser.add_argument('--init', action='store_true', help='初期構築モード（1日2記事制限を無視）')
    parser.add_argument('--post-existing', action='store_true', help='articles.jsonの既存記事をWPに投稿')
    parser.add_argument('--publish', action='store_true', help='下書きではなく公開として投稿')
    parser.add_argument('--add-eyecatch', action='store_true', help='既存WP記事にアイキャッチを一括設定')
    parser.add_argument('--no-images', action='store_true', help='画像取得をスキップ')
    args = parser.parse_args()

    if args.post_existing:
        post_existing_articles()
        return

    if args.add_eyecatch:
        add_eyecatch_to_existing()
        return

    if not args.topic:
        parser.error('--topic は必須です')

    # Auto-detect category
    category = args.category
    if not category:
        for c in CATEGORIES:
            if c in args.topic:
                category = c
                break
        if not category:
            category = 'ポイ活'

    if category not in CATEGORIES:
        print(f'Error: カテゴリは {", ".join(CATEGORIES)} から選択してください')
        sys.exit(1)

    # Check daily limit
    if not args.init and not args.dry_run:
        today = datetime.now(JST).strftime('%Y-%m-%dT00:00:00')
        try:
            today_posts = wp_get(f'posts?after={today}&per_page=100&status=draft,publish')
            if len(today_posts) >= 2:
                print(f'Error: 1日2記事の上限に達しています（本日 {len(today_posts)} 記事投稿済み）')
                sys.exit(1)
        except Exception:
            pass

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

    # 画像取得
    images = []
    if not args.dry_run and not args.no_images and PEXELS_KEY:
        print('\nFetching images from Pexels...')
        images = fetch_and_upload_images(category, count=3)
        print(f'  {len(images)} images uploaded')

    if args.dry_run:
        print('\n[DRY RUN] 投稿をスキップしました')
        return

    # WPに投稿
    status = 'publish' if args.publish else 'draft'
    print(f'\nWPに投稿中（{status}）...')
    wp_result = post_to_wp(title, body, excerpt, category, status=status, images=images)
    print(f'投稿完了！ ID: {wp_result["id"]}, URL: {wp_result["link"]}')


if __name__ == '__main__':
    main()
