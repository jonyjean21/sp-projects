#!/usr/bin/env python3
"""
トクラシ キラーページ（成約記事）自動生成
Usage:
  python3 tools/tokurashi-killer.py --program premium_water
  python3 tools/tokurashi-killer.py --program premium_water --dry-run
  python3 tools/tokurashi-killer.py --list  # 生成可能なキラーページ一覧
"""

import argparse
import base64
import json
import os
import re
import sys
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

AFFILIATES_FILE = os.path.join(os.path.dirname(__file__), 'tokurashi-affiliates.json')


# キラーページのテンプレート定義
KILLER_TEMPLATES = {
    'premium_water': {
        'topic': 'ウォーターサーバー選び',
        'slug': 'water-server-guide',
        'category': '買い物',
        'seo_title': '【2026年】子育て家庭のウォーターサーバー選び完全ガイド',
        'prompt_extra': '''
## この記事の目的
プレミアムウォーターへの申し込みを促す成約記事。ただし押し売りにならず、読者が自然に「これいいな」と思える構成にする。

## 必須の構成要素
1. 導入: 筆者の実体験（子育て中に水道水が気になった→ウォーターサーバーを検討した話）
2. ウォーターサーバーが子育て家庭に向いている理由（ミルク作り、時短、安全性）
3. 選ぶときのチェックポイント（天然水 vs RO水、サーバーサイズ、費用感）
4. 「筆者が選んだ理由」としてプレミアムウォーターの特徴を自然に紹介
5. こんな人におすすめ / こんな人には不要 の正直な切り分け
6. まとめ + CTA

## アフィリエイトCTA
記事の中盤と末尾の2箇所に「{{CTA_PLACEHOLDER}}」を挿入してください（後で実際のCTAに置換します）。

## 注意
- 具体的な月額料金は書かない（「詳しくは公式サイトで」）
- 他社の悪口は書かない
- 「筆者の場合は〜」という主観ベースで紹介
''',
        'pexels_query': 'baby bottle water family kitchen',
    },
    'hoken_minaoshi': {
        'topic': '子育て世帯の保険見直し',
        'slug': 'insurance-review-guide',
        'category': '節約',
        'seo_title': '【子育て世帯向け】保険の見直しで年間数万円の節約に？無料相談のすすめ',
        'prompt_extra': '''
## この記事の目的
保険見直しラボへの無料相談申し込みを促す成約記事。

## 必須の構成要素
1. 導入: 筆者の体験（子どもが生まれて保険を見直そうと思ったきっかけ）
2. 子育て世帯が保険を見直すべきタイミング
3. 自分で見直す vs プロに相談する のメリット・デメリット
4. 無料相談サービスの選び方
5. 「筆者が使ってみた感想」として自然に紹介
6. まとめ + CTA

## アフィリエイトCTA
記事の中盤と末尾の2箇所に「{{CTA_PLACEHOLDER}}」を挿入。
''',
        'pexels_query': 'family planning document insurance',
    },
    'money_doctor': {
        'topic': '家計相談で節約',
        'slug': 'money-consultation-guide',
        'category': '節約',
        'seo_title': '【体験談】お金の専門家に無料相談したら家計の無駄が見えてきた話',
        'prompt_extra': '''
## この記事の目的
マネードクターへの無料相談申し込みを促す成約記事。

## 必須の構成要素
1. 導入: 漠然としたお金の不安を抱えていた筆者の話
2. 家計の見直しを「プロに頼る」メリット
3. マネードクターのサービス概要（FPに無料相談できる）
4. 実際に相談して気づいたこと（体験談風）
5. こんな人におすすめ
6. まとめ + CTA
''',
        'pexels_query': 'financial planning calculator budget',
    },
    'smcc_nl': {
        'topic': 'ポイ活最強クレカ比較',
        'slug': 'best-credit-card-poikatsu',
        'category': 'ポイ活',
        'seo_title': '【2026年】ポイ活におすすめのクレジットカード比較｜主婦が選ぶならコレ',
        'prompt_extra': '''
## この記事の目的
三井住友カード(NL)への申し込みを促す成約記事。

## 必須の構成要素
1. 導入: ポイ活を始めた筆者がクレカ選びで迷った話
2. ポイ活向けクレカの選び方（還元率だけじゃないポイント）
3. 主要カードの比較（一般論として。具体的な還元率は書かない）
4. 「筆者が三井住友カード(NL)を選んだ理由」
5. ポイ活との組み合わせテクニック
6. まとめ + CTA
''',
        'pexels_query': 'credit card payment shopping cashless',
    },
}

KILLER_SYSTEM_PROMPT = """あなたはアフィリエイトブログ「トクラシ」のライターです。
ペルソナ「ゆうこ」（32歳、時短勤務主婦、夫+3歳の子ども、世帯年収600万）の目線で書きます。

## 必須ルール（景品表示法・薬機法遵守）
- 具体的な金額（年会費、還元率、利率、価格）は書かない。「詳しくは公式サイトでご確認ください」に統一
- 「日本一」「最強」「絶対」「必ず」等の断定表現は使わない
- 他社の悪口・ネガティブ比較は書かない

## AI臭を消す文体ルール
- 「〜ではないでしょうか」は最大1回
- 語尾バリエーション：「〜ですね」「〜なんです」「〜ですよ」「〜してみてください」を混ぜる
- 冒頭に筆者の具体的体験談を2〜3文
- 「それでは」「いかがでしたか」は使わない
- 3000〜4000字で書く（キラーページは通常記事より長め）

## 出力形式
以下のJSON形式で出力してください。bodyはHTML。
{
  "title": "SEOタイトル（35字以内）",
  "excerpt": "メタディスクリプション（120字以内）",
  "body": "<h2>見出し</h2><p>本文...</p>..."
}
"""

PR_HEADER = '<p style="background:#f0f0f0;color:#666;font-size:13px;font-weight:700;padding:6px 14px;border-radius:4px;display:inline-block;margin-bottom:16px;">PR</p>'
DISCLAIMER = """<div style="background:#f8f8f8;border:1px solid #e5e5e5;border-radius:8px;padding:14px 16px;margin-top:32px;font-size:13px;color:#666;line-height:1.7;">
※ 当サイトはアフィリエイトプログラムに参加しています。記事内のリンクから商品を購入された場合、当サイトに報酬が支払われることがあります。<br>
※ 記載の情報は記事公開時点のものです。最新の情報は各公式サイトでご確認ください。<br>
※ 当サイトの情報を参考にした結果について、当サイトは一切の責任を負いません。
</div>"""


def load_affiliates():
    with open(AFFILIATES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def wp_auth():
    return base64.b64encode(f'{WP_USER}:{WP_PASS}'.encode()).decode()


def wp_post_json(endpoint, data):
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = Request(url, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Basic {wp_auth()}',
    })
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def wp_get(endpoint):
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    req = Request(url, headers={'Authorization': f'Basic {wp_auth()}'})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_post(url, data, timeout=120):
    body = json.dumps(data).encode()
    req = Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


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
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def get_or_create_category(name):
    cats = wp_get(f'categories?search={quote(name)}&per_page=10')
    for c in cats:
        if c['name'] == name:
            return c['id']
    result = wp_post_json('categories', {'name': name})
    return result['id']


def build_cta_html(program, config):
    template = config['cta_style']
    return (template
            .replace('{{description}}', program['cta_description'])
            .replace('{{link}}', program['a8_link'])
            .replace('{{cta_text}}', program['cta_text']))


def main():
    parser = argparse.ArgumentParser(description='トクラシ キラーページ自動生成')
    parser.add_argument('--program', help='プログラムキー（例: premium_water）')
    parser.add_argument('--list', action='store_true', help='生成可能なキラーページ一覧')
    parser.add_argument('--dry-run', action='store_true', help='生成のみ（投稿しない）')
    parser.add_argument('--publish', action='store_true', help='公開として投稿')
    args = parser.parse_args()

    if args.list:
        print('生成可能なキラーページ一覧:\n')
        config = load_affiliates()
        for key, tmpl in KILLER_TEMPLATES.items():
            prog = config['programs'].get(key, {})
            status = prog.get('status', 'unknown')
            has_link = '✅' if prog.get('a8_link') else '❌'
            print(f'  {key}:')
            print(f'    タイトル: {tmpl["seo_title"]}')
            print(f'    ASP: {status} / リンク: {has_link}')
            print()
        return

    if not args.program:
        parser.error('--program は必須です（--list で一覧表示）')

    if args.program not in KILLER_TEMPLATES:
        print(f'Error: "{args.program}" は未定義。--list で確認してください')
        sys.exit(1)

    tmpl = KILLER_TEMPLATES[args.program]
    config = load_affiliates()
    prog = config['programs'].get(args.program, {})

    if not prog.get('a8_link'):
        print(f'WARNING: {prog.get("name", args.program)} のa8_linkが未設定')
        print(f'  CTAはプレースホルダーのまま生成します')
        print(f'  → tools/tokurashi-affiliates.json の "{args.program}" > "a8_link" を設定後、WPで編集してください')

    # Geminiでキラーページ生成
    prompt = f"""{KILLER_SYSTEM_PROMPT}

{tmpl['prompt_extra']}

トピック: {tmpl['topic']}
SEOタイトル候補: {tmpl['seo_title']}
"""

    print(f'Generating killer page: {tmpl["seo_title"]}')
    print('Calling Gemini API...')
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

    article = json.loads(text)
    title = article.get('title', tmpl['seo_title'])
    excerpt = article.get('excerpt', '')
    body = article.get('body', '')

    # CTAプレースホルダーを実際のCTAに置換
    if prog.get('a8_link'):
        cta_html = build_cta_html(prog, config)
    else:
        cta_html = f'<!-- CTA: {args.program} (a8_link未設定) -->'
    body = body.replace('{{CTA_PLACEHOLDER}}', cta_html)

    print(f'\nTitle: {title}')
    print(f'Excerpt: {excerpt}')
    print(f'Body: {len(body)} chars')

    if args.dry_run:
        print('\n[DRY RUN] 投稿をスキップ')
        print(f'\n--- BODY PREVIEW ---\n{body[:500]}...')
        return

    # アイキャッチ画像
    eyecatch_id = None
    if PEXELS_KEY:
        print('\nFetching eyecatch from Pexels...')
        photos = pexels_search(tmpl['pexels_query'], per_page=3)
        if photos:
            photo = photos[0]
            img_url = photo.get('src', {}).get('medium', '')
            if img_url:
                img_data = download_image(img_url)
                result_img = wp_upload_image(img_data, f'tokurashi-killer-{args.program}.jpg')
                if result_img:
                    eyecatch_id = result_img['id']
                    print(f'  → Eyecatch uploaded: ID={eyecatch_id}')

    # WPに投稿
    cat_id = get_or_create_category(tmpl['category'])
    full_body = f'{PR_HEADER}\n{body}\n{DISCLAIMER}'
    status = 'publish' if args.publish else 'draft'

    post_data = {
        'title': title,
        'content': full_body,
        'excerpt': excerpt,
        'slug': tmpl['slug'],
        'status': status,
        'categories': [cat_id],
    }
    if eyecatch_id:
        post_data['featured_media'] = eyecatch_id

    print(f'\nPosting to WP ({status})...')
    wp_result = wp_post_json('posts', post_data)
    print(f'投稿完了！ ID: {wp_result["id"]}, URL: {wp_result["link"]}')


if __name__ == '__main__':
    main()
