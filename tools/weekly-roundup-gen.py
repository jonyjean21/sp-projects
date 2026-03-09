#!/usr/bin/env python3
"""
週間大会まとめ記事 全自動生成スクリプト
- WP APIから今週の大会データ取得
- 記事HTML生成
- アイキャッチ画像生成・アップロード
- WP記事を自動公開（publish）
- IFTTT経由Xポスト予約

Usage:
  python3 tools/weekly-roundup-gen.py              # 今週分を生成・公開
  python3 tools/weekly-roundup-gen.py --dry-run     # プレビューのみ（投稿しない）
  python3 tools/weekly-roundup-gen.py --week-offset 1  # 来週分を生成
"""

import argparse
import calendar
import datetime
import json
import os
import subprocess
import sys
import urllib.request

# 共通ライブラリ
sys.path.insert(0, os.path.dirname(__file__))
from lib.wp_api import load_env, wp_get as wp_api_get, wp_post as wp_api_post, wp_upload_media

# === 設定 ===
EYECATCH_SCRIPT = os.path.join(os.path.dirname(__file__), 'eyecatch-gen.py')
DAYS_JP = {0: '月', 1: '火', 2: '水', 3: '木', 4: '金', 5: '土', 6: '日'}
CATEGORY_WEEKLY = 139
CATEGORY_TOURNAMENT = 8


def get_week_number(date):
    """月の第N週を計算"""
    return (date.day - 1) // 7 + 1


def fetch_tournaments(env, start_date, end_date):
    """指定期間の大会を取得"""
    tournaments = []
    page = 1
    while True:
        data = wp_api_get(env, 'tournament', {
            'status': 'publish',
            'per_page': 100,
            'page': page,
            '_fields': 'id,title,acf,link'
        })
        if not data:
            break
        for t in data:
            acf = t.get('acf', {})
            ed = acf.get('event_date', '')
            if not ed or len(ed) != 8:
                continue
            try:
                d = datetime.date(int(ed[:4]), int(ed[4:6]), int(ed[6:8]))
            except (ValueError, IndexError):
                continue
            if start_date <= d <= end_date:
                tournaments.append({
                    'id': t['id'],
                    'title': t['title']['rendered'],
                    'date': d,
                    'location': acf.get('location', ''),
                    'organizer': acf.get('organizer', ''),
                    'sns_link': acf.get('sns_link', ''),
                    'detail_link': acf.get('detail_link', ''),
                    'beginner_friendly': acf.get('beginner_friendly', False),
                })
        if len(data) < 100:
            break
        page += 1
    tournaments.sort(key=lambda x: x['date'])
    return tournaments


def group_by_date(tournaments):
    """日別にグループ化"""
    groups = {}
    for t in tournaments:
        key = t['date']
        if key not in groups:
            groups[key] = []
        groups[key].append(t)
    return dict(sorted(groups.items()))


def generate_link_html(t):
    """大会のリンクHTMLを生成"""
    link = t.get('sns_link') or t.get('detail_link') or ''
    if link:
        return f' <a href="{link}" target="_blank" rel="noopener">詳細を見る →</a>'
    return ' <span style="color:#999;">（情報が入り次第更新）</span>'


def generate_article_html(this_week, next_week, monday, sunday):
    """記事HTMLを生成"""
    html_parts = []

    # CTA冒頭
    html_parts.append(
        '<div style="background:#fff8e1;border-left:4px solid #ffd700;padding:16px 20px;margin-bottom:32px;border-radius:0 8px 8px 0;">'
        '📅 <strong>全ての大会情報は<a href="https://molkky-hub.com/event/tournament/">大会情報一覧ページ</a>で確認できます。</strong>'
        'エリア別に探せます！'
        '</div>'
    )

    # 今週の大会
    grouped = group_by_date(this_week)
    total = len(this_week)

    html_parts.append(
        f'<p>今週（{monday.month}/{monday.day}〜{sunday.month}/{sunday.day}）は'
        f'全国<strong>{total}件</strong>のモルック大会・イベントが開催されます。</p>'
    )

    for date, tournaments in grouped.items():
        dow = DAYS_JP[date.weekday()]
        html_parts.append(f'<h2>{date.month}/{date.day}（{dow}）の大会</h2>')

        for t in tournaments:
            beginner = ' 🔰' if t.get('beginner_friendly') else ''
            location = f'（{t["location"]}）' if t['location'] else ''
            organizer = f'<br><small>主催: {t["organizer"]}</small>' if t['organizer'] else ''
            link_html = generate_link_html(t)

            html_parts.append(
                f'<div style="background:#f9f9f9;padding:16px;margin-bottom:12px;border-radius:8px;border-left:3px solid #ffd700;">'
                f'<strong>{t["title"]}</strong>{location}{beginner}'
                f'{organizer}'
                f'<br>{link_html}'
                f'</div>'
            )

    # 来週以降のプレビュー
    if next_week:
        html_parts.append('<h2>来週以降の注目大会</h2>')
        html_parts.append('<ul>')
        for t in next_week[:7]:
            dow = DAYS_JP[t['date'].weekday()]
            location = f'（{t["location"]}）' if t['location'] else ''
            html_parts.append(
                f'<li>{t["date"].month}/{t["date"].day}（{dow}）'
                f'{t["title"]}{location}</li>'
            )
        html_parts.append('</ul>')

    # CTA末尾
    html_parts.append(
        '<div style="background:#1a1a2e;color:#fff;padding:24px;margin-top:32px;border-radius:8px;text-align:center;">'
        '<p style="font-size:1.1em;margin-bottom:12px;">🎯 モルック大会をもっと探す</p>'
        '<a href="https://molkky-hub.com/event/tournament/" '
        'style="display:inline-block;background:#ffd700;color:#1a1a2e;padding:12px 32px;'
        'border-radius:6px;text-decoration:none;font-weight:bold;">大会情報一覧ページへ →</a>'
        '</div>'
    )

    return '\n\n'.join(html_parts)


def generate_tweet_text(this_week, monday, sunday, article_url):
    """Xポスト用テキストを生成"""
    total = len(this_week)
    mon_dow = DAYS_JP[monday.weekday()]
    sun_dow = DAYS_JP[sunday.weekday()]

    # 注目大会を最大3件ピック
    highlights = []
    for t in this_week:
        if len(highlights) >= 3:
            break
        loc = f'（{t["location"]}）' if t['location'] else ''
        highlights.append(f'{t["title"]}{loc}')

    highlight_text = '\n'.join(highlights)
    if len(this_week) > 3:
        highlight_text += '\nほか全国各地で開催！'

    tweet = (
        f'📝 記事更新！【今週のモルック大会】\n'
        f'\n'
        f'{monday.month}/{monday.day}（{mon_dow}）〜{sunday.month}/{sunday.day}（{sun_dow}）'
        f'は全国{total}件のモルック大会が開催🎯\n'
        f'\n'
        f'{highlight_text}\n'
        f'\n'
        f'詳しくはモルハブでチェック👇\n'
        f'{article_url}\n'
        f'\n'
        f'#モルック #molkky'
    )
    return tweet


def check_duplicate(env, slug):
    """同じslugの記事が既にあるか確認"""
    try:
        posts = wp_api_get(env, 'posts', {'slug': slug, '_fields': 'id,title,status'})
        if posts:
            return posts[0]
    except Exception:
        pass
    return None


def main():
    parser = argparse.ArgumentParser(description='週間大会まとめ記事 全自動生成')
    parser.add_argument('--dry-run', action='store_true', help='プレビューのみ')
    parser.add_argument('--week-offset', type=int, default=0, help='0=今週, 1=来週')
    parser.add_argument('--no-tweet', action='store_true', help='Xポスト予約をスキップ')
    args = parser.parse_args()

    env = load_env()

    # 今週の月曜〜日曜を計算
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday()) + datetime.timedelta(weeks=args.week_offset)
    sunday = monday + datetime.timedelta(days=6)
    next_monday = monday + datetime.timedelta(days=7)
    next_sunday = next_monday + datetime.timedelta(days=6)
    further_end = next_sunday + datetime.timedelta(days=14)

    week_num = get_week_number(monday)

    print(f'📅 対象期間: {monday} ({DAYS_JP[monday.weekday()]}) 〜 {sunday} ({DAYS_JP[sunday.weekday()]})')
    print(f'📅 {monday.year}年{monday.month}月第{week_num}週')

    # Step 1: 大会データ取得
    print('\n🔍 大会データ取得中...')
    this_week = fetch_tournaments(env, monday, sunday)
    next_week = fetch_tournaments(env, next_monday, further_end)
    print(f'  今週: {len(this_week)}件')
    print(f'  来週以降: {len(next_week)}件')

    if len(this_week) == 0:
        print('⚠️ 今週の大会が0件。記事生成をスキップします。')
        sys.exit(0)

    # Step 2: 記事コンテンツ生成
    mon_dow = DAYS_JP[monday.weekday()]
    sun_dow = DAYS_JP[sunday.weekday()]
    title = f'【今週のモルック大会】{monday.month}/{monday.day}〜{sunday.month}/{sunday.day}の全国大会情報まとめ｜{monday.year}年{monday.month}月第{week_num}週'
    slug = f'weekly-molkky-{monday.strftime("%Y%m%d")}'
    excerpt = (
        f'今週（{monday.month}/{monday.day}〜{sunday.month}/{sunday.day}）は'
        f'全国{len(this_week)}件のモルック大会が開催。'
    )
    # excerptに注目大会を追加
    locations = set(t['location'] for t in this_week if t['location'])
    if locations:
        excerpt += ''.join(list(locations)[:5]) + 'など各地で開催されます。'

    content = generate_article_html(this_week, next_week, monday, sunday)

    print(f'\n📝 記事プレビュー:')
    print(f'  タイトル: {title}')
    print(f'  slug: {slug}')
    print(f'  excerpt: {excerpt}')
    print(f'  今週の大会: {len(this_week)}件')
    print(f'  来週以降: {len(next_week)}件')

    if args.dry_run:
        print('\n--- DRY RUN: 記事HTML ---')
        print(content[:500] + '...')
        print('\n--- DRY RUN: 終了 ---')
        return

    # Step 3: 重複チェック
    existing = check_duplicate(env, slug)
    if existing:
        print(f'\n⚠️ 同じslugの記事が既に存在: ID:{existing["id"]} ({existing.get("title",{}).get("rendered","")}) [{existing.get("status","")}]')
        print('  → スキップします。強制上書きしたい場合は手動で削除してください。')
        sys.exit(0)

    # Step 4: アイキャッチ画像生成
    print('\n🎨 アイキャッチ画像生成中...')
    date_label = f'{monday.month}/{monday.day}（{mon_dow}）〜 {sunday.month}/{sunday.day}（{sun_dow}）'
    week_label = f'{monday.year}年{monday.month}月第{week_num}週'
    eyecatch_path = f'/tmp/eyecatch_weekly_{slug}.jpg'

    subprocess.run([
        'python3', EYECATCH_SCRIPT,
        '--type', 'weekly',
        '--date', date_label,
        '--count', str(len(this_week)),
        '--week', week_label,
        '--output', eyecatch_path
    ], check=True)

    # Step 5: アイキャッチをWPにアップロード
    print('📤 アイキャッチアップロード中...')
    media = wp_upload_media(env, eyecatch_path, f'{slug}.jpg')
    media_id = media['id']
    print(f'  メディアID: {media_id}')

    # Step 6: 記事を公開
    print('📤 記事を公開中...')
    post_data = {
        'title': title,
        'content': content,
        'status': 'publish',
        'slug': slug,
        'categories': [CATEGORY_WEEKLY, CATEGORY_TOURNAMENT],
        'excerpt': excerpt,
        'featured_media': media_id,
    }
    post = wp_api_post(env, 'posts', post_data)
    post_id = post['id']
    post_url = post['link']
    print(f'  ✅ 公開完了! Post ID: {post_id}')
    print(f'  URL: {post_url}')

    # Step 7: Xポスト予約
    if not args.no_tweet:
        tweet_text = generate_tweet_text(this_week, monday, sunday, post_url)
        print(f'\n🐦 Xポスト予約中...')
        print(f'--- ポスト内容 ---')
        print(tweet_text)
        print(f'--- ここまで ---')

        ifttt_key = env.get('IFTTT_WEBHOOK_KEY', '')
        if ifttt_key:
            tweet_data = json.dumps({'value1': tweet_text}).encode()
            req = urllib.request.Request(
                f'https://maker.ifttt.com/trigger/post_tweet/with/key/{ifttt_key}',
                data=tweet_data,
                method='POST'
            )
            req.add_header('Content-Type', 'application/json')
            with urllib.request.urlopen(req) as resp:
                print(f'  ✅ Xポスト送信完了: {resp.read().decode()[:100]}')
        else:
            print('  ⚠️ IFTTT_WEBHOOK_KEY が未設定。Xポストをスキップ。')

    # 完了サマリ
    print(f'\n🎉 全自動処理完了!')
    print(f'  記事: {post_url}')
    print(f'  Post ID: {post_id}')
    print(f'  大会数: {len(this_week)}件')
    print(f'  アイキャッチ: メディアID {media_id}')


if __name__ == '__main__':
    main()
