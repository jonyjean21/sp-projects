#!/usr/bin/env python3
"""
トクラシ Pinterest ピン画像自動生成 + 投稿
Usage:
  python3 tools/tokurashi-pinterest.py --generate          # WP記事からピン画像を一括生成
  python3 tools/tokurashi-pinterest.py --generate --post-id 123  # 特定記事のみ
  python3 tools/tokurashi-pinterest.py --post              # 生成済み画像をPinterestに投稿
  python3 tools/tokurashi-pinterest.py --list              # 生成済みピン一覧
"""

import argparse
import base64
import json
import os
import re
import struct
import sys
import zlib
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
PINS_DIR = os.path.join(os.path.dirname(__file__), '..', 'tokurashi', 'pins')
PINS_META = os.path.join(PINS_DIR, 'pins-meta.json')

# ピンデザイン設定（1000x1500px推奨）
PIN_WIDTH = 1000
PIN_HEIGHT = 1500

# カテゴリ別配色
CATEGORY_COLORS = {
    'ポイ活':     {'bg': (102, 126, 234), 'accent': (118, 75, 162), 'text': (255, 255, 255)},
    'ふるさと納税': {'bg': (34, 139, 34),   'accent': (0, 100, 0),    'text': (255, 255, 255)},
    '旅行':       {'bg': (0, 150, 199),   'accent': (0, 105, 148),  'text': (255, 255, 255)},
    '買い物':     {'bg': (255, 107, 107),  'accent': (200, 60, 60),  'text': (255, 255, 255)},
    '節約':       {'bg': (46, 204, 113),   'accent': (39, 174, 96),  'text': (255, 255, 255)},
    '副業':       {'bg': (155, 89, 182),   'accent': (142, 68, 173), 'text': (255, 255, 255)},
}
DEFAULT_COLORS = {'bg': (52, 73, 94), 'accent': (44, 62, 80), 'text': (255, 255, 255)}


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
PINTEREST_TOKEN = ENV.get('PINTEREST_ACCESS_TOKEN', '')


def wp_auth():
    return base64.b64encode(f'{WP_USER}:{WP_PASS}'.encode()).decode()


def wp_get(endpoint):
    url = f'{WP_SITE}/wp-json/wp/v2/{endpoint}'
    req = Request(url, headers={'Authorization': f'Basic {wp_auth()}'})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# ===== Pure Python PNG Generator (no PIL dependency) =====

def create_png(width, height, pixels):
    """Create a PNG file from raw pixel data (list of (r,g,b) tuples, row by row)."""
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))

    raw = b''
    idx = 0
    for y in range(height):
        raw += b'\x00'  # filter byte
        for x in range(width):
            r, g, b = pixels[idx]
            raw += struct.pack('BBB', r, g, b)
            idx += 1

    compressed = zlib.compress(raw, 9)
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend


def draw_filled_rect(pixels, w, x1, y1, x2, y2, color):
    """Fill a rectangle with a solid color."""
    for y in range(y1, min(y2, len(pixels) // w)):
        for x in range(x1, min(x2, w)):
            pixels[y * w + x] = color


def draw_rounded_rect(pixels, w, h, x1, y1, x2, y2, radius, color):
    """Draw a filled rounded rectangle."""
    for y in range(y1, min(y2, h)):
        for x in range(x1, min(x2, w)):
            # Check corners
            in_rect = True
            # Top-left corner
            if x < x1 + radius and y < y1 + radius:
                if (x - (x1 + radius))**2 + (y - (y1 + radius))**2 > radius**2:
                    in_rect = False
            # Top-right corner
            elif x > x2 - radius and y < y1 + radius:
                if (x - (x2 - radius))**2 + (y - (y1 + radius))**2 > radius**2:
                    in_rect = False
            # Bottom-left corner
            elif x < x1 + radius and y > y2 - radius:
                if (x - (x1 + radius))**2 + (y - (y2 - radius))**2 > radius**2:
                    in_rect = False
            # Bottom-right corner
            elif x > x2 - radius and y > y2 - radius:
                if (x - (x2 - radius))**2 + (y - (y2 - radius))**2 > radius**2:
                    in_rect = False
            if in_rect:
                pixels[y * w + x] = color


# Simple bitmap font (5x7 pixel characters for ASCII, larger blocks for Japanese)
def draw_text_block(pixels, w, h, text, x_start, y_start, char_w, char_h, color, max_width=None):
    """Draw text as colored blocks (placeholder for real font rendering).
    For actual deployment, use Pillow or a font rendering library.
    This creates a simple visual representation."""
    x = x_start
    y = y_start
    line_height = char_h + 8

    if max_width is None:
        max_width = w - x_start * 2

    for char in text:
        # Line break
        if char == '\n' or (x + char_w > x_start + max_width):
            x = x_start
            y += line_height
            if char == '\n':
                continue

        if y + char_h > h:
            break

        # Draw character as a block
        for dy in range(char_h):
            for dx in range(char_w):
                px = x + dx
                py = y + dy
                if 0 <= px < w and 0 <= py < h:
                    pixels[py * w + px] = color

        x += char_w + 4  # character spacing


def generate_pin_image(title, category, excerpt=''):
    """Generate a Pinterest pin image (1000x1500 PNG)."""
    colors = CATEGORY_COLORS.get(category, DEFAULT_COLORS)
    bg = colors['bg']
    accent = colors['accent']
    text_color = colors['text']

    # Initialize pixels
    pixels = [bg] * (PIN_WIDTH * PIN_HEIGHT)

    # Top accent bar
    draw_filled_rect(pixels, PIN_WIDTH, 0, 0, PIN_WIDTH, 80, accent)

    # "トクラシ" branding area
    draw_filled_rect(pixels, PIN_WIDTH, 60, 20, 240, 60, text_color)

    # Category badge
    badge_color = (255, 255, 255, 180)
    draw_rounded_rect(pixels, PIN_WIDTH, PIN_HEIGHT, 60, 120, 280, 180, 20, text_color)

    # Main title area (large text block)
    title_y = 250
    char_size = 36
    draw_text_block(pixels, PIN_WIDTH, PIN_HEIGHT, title, 80, title_y,
                    char_size, char_size, text_color, max_width=840)

    # Divider line
    draw_filled_rect(pixels, PIN_WIDTH, 80, 700, 920, 704, text_color)

    # Excerpt area
    if excerpt:
        draw_text_block(pixels, PIN_WIDTH, PIN_HEIGHT, excerpt, 80, 740,
                        20, 20, text_color, max_width=840)

    # Bottom CTA area
    cta_bg = (255, 255, 255)
    draw_rounded_rect(pixels, PIN_WIDTH, PIN_HEIGHT, 200, 1300, 800, 1400, 30, cta_bg)
    draw_text_block(pixels, PIN_WIDTH, PIN_HEIGHT, '詳しくはこちら', 320, 1330,
                    24, 24, accent, max_width=400)

    # Bottom branding
    draw_filled_rect(pixels, PIN_WIDTH, 0, 1440, PIN_WIDTH, 1500, accent)
    draw_text_block(pixels, PIN_WIDTH, PIN_HEIGHT, 'tokurashi.com', 380, 1460,
                    12, 12, text_color, max_width=400)

    return create_png(PIN_WIDTH, PIN_HEIGHT, pixels)


def load_pins_meta():
    try:
        with open(PINS_META, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'pins': []}


def save_pins_meta(meta):
    os.makedirs(PINS_DIR, exist_ok=True)
    with open(PINS_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


def generate_pins(post_id=None):
    """WP記事からピン画像を生成"""
    if not WP_USER:
        print('WARNING: WP認証情報なし → サンプルピンを生成します')
        # サンプル生成
        os.makedirs(PINS_DIR, exist_ok=True)
        sample_categories = ['ポイ活', '節約', 'ふるさと納税', '買い物']
        sample_titles = [
            'ポイ活初心者が3ヶ月で1万円貯めた方法',
            '子育て家庭の節約術 水道光熱費を見直そう',
            'ふるさと納税で絶対もらいたい返礼品',
            'ネットショッピングでポイント3重取りのコツ',
        ]
        meta = load_pins_meta()
        for i, (title, cat) in enumerate(zip(sample_titles, sample_categories)):
            filename = f'pin-sample-{i+1}.png'
            filepath = os.path.join(PINS_DIR, filename)
            print(f'  Generating: {filename} [{cat}]')
            png_data = generate_pin_image(title, cat)
            with open(filepath, 'wb') as f:
                f.write(png_data)
            meta['pins'].append({
                'file': filename,
                'title': title,
                'category': cat,
                'post_id': None,
                'post_url': '',
                'generated': datetime.now(JST).isoformat(),
                'posted_to_pinterest': False,
            })
            print(f'  → {filepath} ({len(png_data)} bytes)')
        save_pins_meta(meta)
        print(f'\n{len(sample_titles)} サンプルピンを生成しました')
        print(f'出力先: {PINS_DIR}/')
        return

    # WP記事を取得
    endpoint = 'posts?per_page=100&status=publish&_fields=id,title,excerpt,categories,link'
    if post_id:
        endpoint = f'posts/{post_id}?_fields=id,title,excerpt,categories,link'

    result = wp_get(endpoint)
    posts = [result] if post_id else result

    cats = wp_get('categories?per_page=50&_fields=id,name')
    cat_map = {c['id']: c['name'] for c in cats}

    posts = [p for p in posts if 'Hello world' not in p['title']['rendered']]

    meta = load_pins_meta()
    existing_ids = {p['post_id'] for p in meta['pins']}

    os.makedirs(PINS_DIR, exist_ok=True)
    generated = 0

    for post in posts:
        pid = post['id']
        if pid in existing_ids and not post_id:
            continue

        title = re.sub(r'<[^>]+>', '', post['title']['rendered'])
        excerpt = re.sub(r'<[^>]+>', '', post.get('excerpt', {}).get('rendered', ''))
        cat_ids = post.get('categories', [])
        cat_name = cat_map.get(cat_ids[0], 'ポイ活') if cat_ids else 'ポイ活'
        post_url = post.get('link', '')

        filename = f'pin-{pid}.png'
        filepath = os.path.join(PINS_DIR, filename)

        print(f'  [ID:{pid}] {title} [{cat_name}]')
        png_data = generate_pin_image(title, cat_name, excerpt[:60])
        with open(filepath, 'wb') as f:
            f.write(png_data)

        meta['pins'] = [p for p in meta['pins'] if p['post_id'] != pid]
        meta['pins'].append({
            'file': filename,
            'title': title,
            'category': cat_name,
            'post_id': pid,
            'post_url': post_url,
            'generated': datetime.now(JST).isoformat(),
            'posted_to_pinterest': False,
        })
        generated += 1
        print(f'  → {filepath}')

    save_pins_meta(meta)
    print(f'\n{generated} ピンを生成しました')


def post_to_pinterest():
    """生成済みピンをPinterestに投稿"""
    if not PINTEREST_TOKEN:
        print('Error: PINTEREST_ACCESS_TOKEN が .env に設定されていません')
        print()
        print('Pinterest API セットアップ手順:')
        print('1. https://developers.pinterest.com/ でアプリ作成')
        print('2. OAuth 2.0 でアクセストークン取得')
        print('3. .env に PINTEREST_ACCESS_TOKEN=xxx を追加')
        print('4. .env に PINTEREST_BOARD_ID=xxx を追加（ボードID）')
        return

    board_id = ENV.get('PINTEREST_BOARD_ID', '')
    if not board_id:
        print('Error: PINTEREST_BOARD_ID が .env に設定されていません')
        return

    meta = load_pins_meta()
    unposted = [p for p in meta['pins'] if not p['posted_to_pinterest']]

    if not unposted:
        print('投稿するピンがありません')
        return

    print(f'{len(unposted)} ピンをPinterestに投稿します\n')

    for pin in unposted:
        filepath = os.path.join(PINS_DIR, pin['file'])
        if not os.path.exists(filepath):
            print(f'  SKIP: {pin["file"]} が見つかりません')
            continue

        # Read image and base64 encode
        with open(filepath, 'rb') as f:
            img_b64 = base64.b64encode(f.read()).decode()

        pin_data = {
            'board_id': board_id,
            'title': pin['title'][:100],
            'description': f'{pin["title"]} | トクラシ - お得な暮らしの情報サイト #{"#".join(["トクラシ", pin["category"], "お得"])}',
            'link': pin['post_url'],
            'media_source': {
                'source_type': 'base64',
                'content_type': 'image/png',
                'data': img_b64,
            }
        }

        print(f'  Posting: {pin["title"][:40]}...')
        try:
            body = json.dumps(pin_data).encode()
            req = Request('https://api.pinterest.com/v5/pins', data=body, headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {PINTEREST_TOKEN}',
            })
            with urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read())
                print(f'  → 投稿完了: {result.get("id", "?")}')
                pin['posted_to_pinterest'] = True
                pin['pinterest_id'] = result.get('id', '')
        except HTTPError as e:
            err = e.read().decode()
            print(f'  → Error {e.code}: {err[:200]}')

    save_pins_meta(meta)
    posted = sum(1 for p in meta['pins'] if p['posted_to_pinterest'])
    print(f'\n完了！ {posted}/{len(meta["pins"])} ピンが投稿済み')


def list_pins():
    """生成済みピン一覧"""
    meta = load_pins_meta()
    if not meta['pins']:
        print('ピンがありません。--generate で生成してください')
        return

    print(f'ピン一覧 ({len(meta["pins"])} 件):\n')
    for p in meta['pins']:
        status = 'Pinterest済' if p['posted_to_pinterest'] else '未投稿'
        print(f'  [{status}] {p["file"]} | {p["title"][:40]} [{p["category"]}]')


def main():
    parser = argparse.ArgumentParser(description='トクラシ Pinterest自動化')
    parser.add_argument('--generate', action='store_true', help='ピン画像を生成')
    parser.add_argument('--post', action='store_true', help='Pinterestに投稿')
    parser.add_argument('--post-id', type=int, help='特定のWP記事IDのみ')
    parser.add_argument('--list', action='store_true', help='生成済みピン一覧')
    args = parser.parse_args()

    if args.list:
        list_pins()
    elif args.generate:
        generate_pins(post_id=args.post_id)
    elif args.post:
        post_to_pinterest()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
