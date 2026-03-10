#!/usr/bin/env python3
"""
トクラシ既存記事リライト + 記事内画像挿入
Usage: python3 tools/tokurashi-rewrite.py
"""

import base64
import json
import os
import re
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote


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
VERCEL_API = 'https://vercel-api-orpin-one.vercel.app'

CATEGORY_SEARCH = {
    'ポイ活': ['smartphone payment app', 'loyalty card rewards'],
    'ふるさと納税': ['japanese local specialty food', 'countryside japan village'],
    '旅行': ['japan travel scenery', 'hotel room vacation'],
    '買い物': ['online shopping cart', 'delivery box package'],
    '節約': ['piggy bank coins saving', 'household budget planning'],
    '副業': ['laptop coffee home office', 'freelancer workspace desk'],
}

REWRITE_PROMPT = """以下のブログ記事をリライトしてください。内容は維持しつつ、以下の問題を修正してください。

## 修正すべきAI臭い特徴
1. 「〜ではないでしょうか」「〜と言えるでしょう」の多用 → 最大1回に減らす
2. 全文が均一な「です・ます」 → 「〜ですよね」「〜なんです」「〜してみてください」「〜かもしれません」を混ぜる
3. 冒頭が説明調 → 筆者の体験談・具体的エピソードで始める（例:「先月ポイントだけで3000円分の日用品を買えた時は、正直嬉しかったです」）
4. 「それでは」「それでは早速」「いかがでしたか」 → 削除
5. 同じ構文の繰り返し → 文の長さ・構造にバリエーションを持たせる
6. 「〜することができます」 → 「〜できます」に短縮
7. 箇条書きの前後に血の通った補足コメントを1文追加
8. まとめセクションが教科書的 → 読者への語りかけ調に

## 追加すべき要素
- 冒頭に筆者の具体的体験談を2〜3文
- 途中に「筆者の場合は〜」「個人的には〜」という主観コメントを2箇所程度
- 「ここだけの話」「意外と知られていないのが」等のフック表現を1〜2箇所

## 絶対に変えないもの
- H2見出しの数と順番
- 記事の主旨・情報の正確性
- 法令遵守ルール（具体的金額を出さない等）

## 出力
リライト後のHTML本文のみを出力してください（h2, h3, p, ul, li, blockquote タグ）。
JSON形式ではなく、HTMLのみで。

---
元の記事:
"""


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


def call_gemini(prompt):
    result = json.loads(json.dumps({'prompt': prompt, 'temperature': 0.8}).encode())
    body = json.dumps(result).encode()
    req = Request(f'{VERCEL_API}/api/gemini', data=body, headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    text = (data.get('candidates', [{}])[0]
            .get('content', {})
            .get('parts', [{}])[0]
            .get('text', ''))
    # Strip code fences
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:html)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        text = text.strip()
    # Handle JSON-wrapped responses (e.g. {"rewritten_html": "..."})
    if text.startswith('{') and '"' in text[:50]:
        try:
            parsed = json.loads(text)
            for key in ('rewritten_html', 'html', 'html_body', 'content', 'body'):
                if key in parsed:
                    text = parsed[key]
                    break
        except (json.JSONDecodeError, ValueError):
            pass
    # Clean literal \n that Gemini sometimes returns
    text = text.replace('\\n', '\n')
    # Remove empty lines/tags
    text = re.sub(r'<p>\s*</p>', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def pexels_search(query, per_page=3):
    if not PEXELS_KEY:
        return []
    url = f'https://api.pexels.com/v1/search?query={quote(query)}&per_page={per_page}&orientation=landscape'
    req = Request(url, headers={'Authorization': PEXELS_KEY, 'User-Agent': 'TokurashiGen/1.0'})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()).get('photos', [])
    except Exception as e:
        print(f'  Pexels error: {e}')
        return []


def download_image(url):
    req = Request(url, headers={'User-Agent': 'TokurashiGen/1.0'})
    with urlopen(req, timeout=30) as resp:
        return resp.read()


def wp_upload_image(image_data, filename):
    url = f'{WP_SITE}/wp-json/wp/v2/media'
    req = Request(url, data=image_data, headers={
        'Content-Type': 'image/jpeg',
        'Content-Disposition': f'attachment; filename="{filename}"',
        'Authorization': f'Basic {wp_auth()}',
    })
    try:
        with urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except HTTPError:
        return None


def fetch_images_for_category(cat_name, count=2):
    """カテゴリに合った画像をアップロード"""
    queries = CATEGORY_SEARCH.get(cat_name, ['lifestyle money saving'])
    uploaded = []
    for q in queries:
        if len(uploaded) >= count:
            break
        photos = pexels_search(q, per_page=2)
        for photo in photos:
            if len(uploaded) >= count:
                break
            img_url = photo.get('src', {}).get('medium', '')
            if not img_url:
                continue
            photographer = photo.get('photographer', 'Pexels')
            filename = f'tokurashi-{photo["id"]}.jpg'
            try:
                img_data = download_image(img_url)
                result = wp_upload_image(img_data, filename)
                if result:
                    uploaded.append({
                        'url': result['source_url'],
                        'alt': f'Photo by {photographer} on Pexels',
                    })
            except Exception:
                pass
    return uploaded


def insert_images_after_h2(body, images):
    """2番目以降のH2の後に画像を挿入"""
    if not images:
        return body
    h2_ends = [(m.end()) for m in re.finditer(r'</h2>', body)]
    if len(h2_ends) < 2:
        return body

    offset = 0
    img_idx = 0
    for i, pos in enumerate(h2_ends):
        if i == 0:
            continue  # 最初のH2はスキップ
        if img_idx >= len(images):
            break
        img = images[img_idx]
        img_html = f'\n<figure class="wp-block-image"><img src="{img["url"]}" alt="{img["alt"]}" style="width:100%;height:auto;border-radius:8px;" /><figcaption style="text-align:center;font-size:12px;color:#999;">{img["alt"]}</figcaption></figure>\n'
        insert_pos = pos + offset
        body = body[:insert_pos] + img_html + body[insert_pos:]
        offset += len(img_html)
        img_idx += 1

    return body


PR_HEADER = '<p style="background:#f0f0f0;color:#666;font-size:13px;font-weight:700;padding:6px 14px;border-radius:4px;display:inline-block;margin-bottom:16px;">PR</p>'
DISCLAIMER = """<div style="background:#f8f8f8;border:1px solid #e5e5e5;border-radius:8px;padding:14px 16px;margin-top:32px;font-size:13px;color:#666;line-height:1.7;">
※ 当サイトはアフィリエイトプログラムに参加しています。記事内のリンクから商品を購入された場合、当サイトに報酬が支払われることがあります。<br>
※ 記載の情報は記事公開時点のものです。最新の情報は各公式サイトでご確認ください。<br>
※ 当サイトの情報を参考にした結果について、当サイトは一切の責任を負いません。
</div>"""


def main():
    # 公開済み記事を取得
    posts = wp_get('posts?per_page=50&status=publish&_fields=id,title,content,categories')
    cats = wp_get('categories?per_page=50&_fields=id,name')
    cat_map = {c['id']: c['name'] for c in cats}

    # Hello Worldを除外
    posts = [p for p in posts if 'Hello world' not in p['title']['rendered']]

    print(f'{len(posts)} 記事をリライトします\n')

    for i, post in enumerate(posts):
        post_id = post['id']
        title = post['title']['rendered']
        content = post['content']['rendered']
        cat_ids = post.get('categories', [])
        cat_name = cat_map.get(cat_ids[0], 'ポイ活') if cat_ids else 'ポイ活'

        # PR/免責事項を除去して本文だけ取り出す
        body = content
        body = re.sub(r'<p[^>]*>PR</p>', '', body)
        body = re.sub(r'<div[^>]*>※ 当サイトは.*?</div>', '', body, flags=re.DOTALL)

        print(f'[{i+1}/{len(posts)}] ID:{post_id} {title} [{cat_name}]')

        # Step 1: Geminiでリライト
        print('  Rewriting with Gemini...')
        rewritten = call_gemini(REWRITE_PROMPT + body)

        if len(rewritten) < 500:
            print(f'  WARNING: リライト結果が短すぎる（{len(rewritten)}字）→ スキップ')
            continue

        # Step 2: 記事内画像を取得・挿入
        print(f'  Fetching images for [{cat_name}]...')
        images = fetch_images_for_category(cat_name, count=2)
        print(f'  → {len(images)} images')

        if images:
            rewritten = insert_images_after_h2(rewritten, images)

        # Step 3: PR + 本文 + 免責事項で再構成
        full_body = f'{PR_HEADER}\n{rewritten}\n{DISCLAIMER}'

        # Step 4: WPを更新
        print('  Updating WP post...')
        wp_update(post_id, {'content': full_body})
        print(f'  → 完了！')

        # レートリミット回避（SiteGuard WAF対策: 10秒間隔）
        time.sleep(10)

    print(f'\n全{len(posts)}記事のリライト完了！')


if __name__ == '__main__':
    main()
