#!/usr/bin/env python3
"""
BuildHub アイキャッチ画像ジェネレーター
Pexels写真 + テキストオーバーレイ → WPアップロード
Usage: python3 tools/buildhub-eyecatch.py "記事タイトル" "pexels search query"
"""
import sys, os, io, requests, base64, textwrap
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WP_SITE    = "https://buildhub.jp"
WP_USER    = os.environ.get("BUILDHUB_WP_USER", "buildhub260309")
WP_APP_PASS= os.environ.get("BUILDHUB_WP_APP_PASS", "")
PEXELS_KEY = os.environ.get("PEXELS_API_KEY", "")

# BuildHub カラー
BH_BLUE  = "#0073aa"
BH_DARK  = "#0a0a1a"
W, H     = 1200, 630

# フォント（日本語対応）
FONT_PATHS = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

def get_font(size):
    for path in FONT_PATHS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def fetch_pexels(query):
    r = requests.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": PEXELS_KEY},
        params={"query": query, "per_page": 5, "orientation": "landscape"}
    )
    photos = r.json().get("photos", [])
    if not photos:
        return None, None
    photo = photos[0]
    return photo["src"]["large2x"], photo["photographer"]

def make_eyecatch(title: str, pexels_query: str, tag: str = "") -> bytes:
    """タイトルとPexelsクエリからアイキャッチ画像を生成してPNGバイト列を返す"""

    # --- ベース画像 ---
    base = Image.new("RGB", (W, H), hex_to_rgb(BH_DARK))

    # Pexels背景写真
    if PEXELS_KEY:
        img_url, photographer = fetch_pexels(pexels_query)
        if img_url:
            img_data = requests.get(img_url).content
            photo = Image.open(io.BytesIO(img_data)).convert("RGB")
            # クロップして1200x630に
            pw, ph = photo.size
            scale = max(W / pw, H / ph)
            nw, nh = int(pw * scale), int(ph * scale)
            photo = photo.resize((nw, nh), Image.LANCZOS)
            ox, oy = (nw - W) // 2, (nh - H) // 2
            photo = photo.crop((ox, oy, ox + W, oy + H))
            # ぼかし軽め
            photo = photo.filter(ImageFilter.GaussianBlur(2))
            base.paste(photo)

    draw = ImageDraw.Draw(base)

    # --- グラデーションオーバーレイ（下→上）---
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(H):
        alpha = int(200 * (y / H) ** 0.6 + 80)  # 上は薄く、下は濃く
        od.line([(0, y), (W, y)], fill=(5, 5, 20, min(alpha, 220)))
    base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(base)

    # --- 左サイドバー（アクセントライン）---
    bar_w = 8
    draw.rectangle([(0, 0), (bar_w, H)], fill=hex_to_rgb(BH_BLUE))

    # --- BuildHub ロゴ（左上）---
    logo_font = get_font(28)
    draw.text((bar_w + 28, 36), "BuildHub", font=logo_font, fill=hex_to_rgb(BH_BLUE))

    # ロゴ右に細い下線
    lw = draw.textlength("BuildHub", font=logo_font)
    draw.rectangle([(bar_w + 28, 36 + 34), (bar_w + 28 + lw, 36 + 36)], fill=hex_to_rgb(BH_BLUE))

    # --- タグ（あれば）---
    tag_y = 100
    if tag:
        tag_font = get_font(22)
        tag_pad = 12
        tw = draw.textlength(tag, font=tag_font)
        draw.rectangle(
            [(bar_w + 28 - tag_pad, tag_y - 6), (bar_w + 28 + tw + tag_pad, tag_y + 28)],
            fill=hex_to_rgb(BH_BLUE)
        )
        draw.text((bar_w + 28, tag_y), tag, font=tag_font, fill=(255, 255, 255))
        tag_y += 52

    # --- メインタイトル ---
    title_font_size = 56
    title_font = get_font(title_font_size)
    margin_x = bar_w + 28
    max_width = W - margin_x - 60

    # 折り返し
    lines = []
    words = list(title)  # 日本語は1文字ずつ
    line = ""
    for ch in title:
        test = line + ch
        if draw.textlength(test, font=title_font) > max_width:
            lines.append(line)
            line = ch
        else:
            line = test
    if line:
        lines.append(line)

    # 最大3行
    lines = lines[:3]
    if len(lines) == 3 and title_font_size > 44:
        title_font_size = 44
        title_font = get_font(title_font_size)

    title_h = title_font_size * 1.4 * len(lines)
    title_y = H - 120 - title_h

    for i, line in enumerate(lines):
        y = title_y + i * title_font_size * 1.4
        # シャドウ
        draw.text((margin_x + 2, y + 2), line, font=title_font, fill=(0, 0, 0, 180))
        draw.text((margin_x, y), line, font=title_font, fill=(255, 255, 255))

    # --- 下部バー ---
    draw.rectangle([(0, H - 52), (W, H)], fill=(0, 0, 0, 180))
    small_font = get_font(20)
    draw.text((bar_w + 28, H - 38), "AI開発ツール情報メディア | buildhub.jp", font=small_font, fill=(160, 160, 180))

    buf = io.BytesIO()
    base.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def upload_to_wp(png_bytes: bytes, filename: str, alt: str) -> int | None:
    token = base64.b64encode(f"{WP_USER}:{WP_APP_PASS}".encode()).decode()
    r = requests.post(
        f"{WP_SITE}/wp-json/wp/v2/media",
        headers={
            "Authorization": f"Basic {token}",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "image/png"
        },
        data=png_bytes
    )
    if r.status_code in (200, 201):
        media_id = r.json()["id"]
        requests.post(
            f"{WP_SITE}/wp-json/wp/v2/media/{media_id}",
            headers={"Authorization": f"Basic {token}", "Content-Type": "application/json"},
            json={"alt_text": alt}
        )
        return media_id
    print(f"WPアップロードエラー: {r.status_code} {r.text[:200]}")
    return None

def generate_and_upload(title: str, pexels_query: str, filename: str = "eyecatch.png", tag: str = "") -> int | None:
    """アイキャッチを生成してWPにアップロード、media_idを返す"""
    print(f"  アイキャッチ生成: {title[:30]}...")
    png = make_eyecatch(title, pexels_query, tag)
    media_id = upload_to_wp(png, filename, title)
    if media_id:
        print(f"  アイキャッチ完了: media_id={media_id}")
    return media_id

if __name__ == "__main__":
    # 単体テスト
    title  = sys.argv[1] if len(sys.argv) > 1 else "Claude Codeで全自動メディアを作った話"
    query  = sys.argv[2] if len(sys.argv) > 2 else "developer coding terminal"
    tag    = sys.argv[3] if len(sys.argv) > 3 else "Claude Code"

    png = make_eyecatch(title, query, tag)
    out = "/tmp/buildhub_eyecatch_test.png"
    with open(out, "wb") as f:
        f.write(png)
    print(f"生成完了: {out}")
    os.system(f"open {out}")
