#!/usr/bin/env python3
"""
トクラシ X(Twitter) 自動投稿
記事公開時にXに自動ポストする。

Usage:
  python3 tools/tokurashi-x-post.py --latest              # 最新記事を投稿
  python3 tools/tokurashi-x-post.py --post-id 123         # 特定記事を投稿
  python3 tools/tokurashi-x-post.py --bulk                 # 未投稿記事を一括投稿
  python3 tools/tokurashi-x-post.py --dry-run --latest     # 投稿内容を確認
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import time
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.parse import quote, urlencode

JST = timezone(timedelta(hours=9))
POSTED_FILE = os.path.join(os.path.dirname(__file__), '..', 'tokurashi', 'x-posted.json')

# カテゴリ別ハッシュタグ
CATEGORY_TAGS = {
    'ポイ活':     '#ポイ活 #ポイント #お得',
    'ふるさと納税': '#ふるさと納税 #節税 #返礼品',
    '旅行':       '#旅行 #お得旅 #旅行術',
    '買い物':     '#お買い物 #ネットショッピング #お得',
    '節約':       '#節約 #家計管理 #貯金',
    '副業':       '#副業 #在宅ワーク #お小遣い稼ぎ',
}


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

# X (Twitter) API v2 credentials
X_API_KEY = ENV.get('X_API_KEY', '')
X_API_SECRET = ENV.get('X_API_SECRET', '')
X_ACCESS_TOKEN = ENV.get('X_ACCESS_TOKEN', '')
X_ACCESS_SECRET = ENV.get('X_ACCESS_TOKEN_SECRET', '')

VERCEL_API = 'https://vercel-api-orpin-one.vercel.app'


def wp_auth():
    return base64.b64encode(f'{WP_USER}:{WP_PASS}'.encode()).decode()


def wp_get(endpoint):
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    req = Request(url, headers={'Authorization': f'Basic {wp_auth()}'})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def load_posted():
    try:
        with open(POSTED_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'posted_ids': []}


def save_posted(data):
    os.makedirs(os.path.dirname(POSTED_FILE), exist_ok=True)
    with open(POSTED_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def generate_tweet_text(title, url, category, excerpt=''):
    """ツイートテキストを生成"""
    tags = CATEGORY_TAGS.get(category, '#トクラシ #お得')

    # Geminiで魅力的なツイートを生成（APIがあれば）
    # フォールバック: テンプレートベース
    templates = [
        f'📝 新着記事\n\n{title}\n\n{excerpt[:60]}...\n\n{url}\n\n{tags} #トクラシ',
        f'💡 {title}\n\n知ってるだけで得する情報をまとめました👇\n\n{url}\n\n{tags} #トクラシ',
        f'✨ {title}\n\nお得に暮らすヒント、まとめてます📖\n\n{url}\n\n{tags} #トクラシ',
    ]

    # ローテーション（記事IDベースで決定）
    import hashlib
    idx = int(hashlib.md5(title.encode()).hexdigest(), 16) % len(templates)
    tweet = templates[idx]

    # 280文字制限（日本語は2文字換算だが、Xは実質140文字程度）
    if len(tweet) > 270:
        tweet = f'{title[:50]}\n\n{url}\n\n{tags}'

    return tweet


def oauth1_header(method, url, params=None):
    """OAuth 1.0a ヘッダーを生成"""
    import secrets
    oauth_params = {
        'oauth_consumer_key': X_API_KEY,
        'oauth_nonce': secrets.token_hex(16),
        'oauth_signature_method': 'HMAC-SHA1',
        'oauth_timestamp': str(int(time.time())),
        'oauth_token': X_ACCESS_TOKEN,
        'oauth_version': '1.0',
    }

    all_params = {**oauth_params}
    if params:
        all_params.update(params)

    param_string = '&'.join(f'{quote(k, safe="")}={quote(str(v), safe="")}'
                           for k, v in sorted(all_params.items()))
    base_string = f'{method}&{quote(url, safe="")}&{quote(param_string, safe="")}'
    signing_key = f'{quote(X_API_SECRET, safe="")}&{quote(X_ACCESS_SECRET, safe="")}'

    signature = base64.b64encode(
        hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()
    ).decode()

    oauth_params['oauth_signature'] = signature
    auth_header = 'OAuth ' + ', '.join(
        f'{quote(k, safe="")}="{quote(v, safe="")}"'
        for k, v in sorted(oauth_params.items())
    )
    return auth_header


def post_tweet(text):
    """X API v2 でツイート投稿"""
    if not all([X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET]):
        print('Error: X API認証情報が .env に設定されていません')
        print()
        print('必要な環境変数:')
        print('  X_API_KEY=xxx')
        print('  X_API_SECRET=xxx')
        print('  X_ACCESS_TOKEN=xxx')
        print('  X_ACCESS_TOKEN_SECRET=xxx')
        print()
        print('取得方法: https://developer.twitter.com/en/portal/dashboard')
        return None

    url = 'https://api.twitter.com/2/tweets'
    data = json.dumps({'text': text}).encode()
    auth = oauth1_header('POST', url)

    req = Request(url, data=data, headers={
        'Content-Type': 'application/json',
        'Authorization': auth,
    })

    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f'  X API Error: {e}')
        return None


def main():
    parser = argparse.ArgumentParser(description='トクラシ X自動投稿')
    parser.add_argument('--latest', action='store_true', help='最新記事を投稿')
    parser.add_argument('--post-id', type=int, help='特定記事を投稿')
    parser.add_argument('--bulk', action='store_true', help='未投稿記事を一括投稿')
    parser.add_argument('--dry-run', action='store_true', help='投稿せず内容を確認')
    args = parser.parse_args()

    if not any([args.latest, args.post_id, args.bulk]):
        parser.print_help()
        return

    if not WP_USER:
        print('Error: WP認証情報が .env に設定されていません')
        return

    # カテゴリマップ
    cats = wp_get('categories?per_page=50&_fields=id,name')
    cat_map = {c['id']: c['name'] for c in cats}

    posted_data = load_posted()
    posted_ids = set(posted_data['posted_ids'])

    # 対象記事を決定
    if args.post_id:
        posts = [wp_get(f'posts/{args.post_id}?_fields=id,title,excerpt,link,categories')]
    elif args.latest:
        posts = wp_get('posts?per_page=1&status=publish&orderby=date&order=desc&_fields=id,title,excerpt,link,categories')
    else:  # bulk
        posts = wp_get('posts?per_page=100&status=publish&_fields=id,title,excerpt,link,categories')
        posts = [p for p in posts if p['id'] not in posted_ids]

    posts = [p for p in posts if 'Hello world' not in p['title']['rendered']]

    if not posts:
        print('投稿対象の記事がありません')
        return

    print(f'{len(posts)} 記事をXに投稿します\n')

    for post in posts:
        pid = post['id']
        title = re.sub(r'<[^>]+>', '', post['title']['rendered'])
        excerpt = re.sub(r'<[^>]+>', '', post.get('excerpt', {}).get('rendered', ''))
        url = post['link']
        cat_ids = post.get('categories', [])
        cat_name = cat_map.get(cat_ids[0], 'お得') if cat_ids else 'お得'

        tweet = generate_tweet_text(title, url, cat_name, excerpt)

        print(f'[ID:{pid}] {title}')
        print(f'  Tweet:')
        for line in tweet.split('\n'):
            print(f'    {line}')

        if args.dry_run:
            print(f'  (dry-run)\n')
            continue

        result = post_tweet(tweet)
        if result and 'data' in result:
            tweet_id = result['data']['id']
            print(f'  → 投稿完了: https://x.com/i/status/{tweet_id}\n')
            posted_data['posted_ids'].append(pid)
            save_posted(posted_data)
        else:
            print(f'  → 投稿失敗\n')

        time.sleep(5)  # レートリミット

    print('完了！')


if __name__ == '__main__':
    main()
