#!/usr/bin/env python3
"""
アイキャッチ画像ジェネレーター
- モルハブブランドカラーで統一されたOGP画像を自動生成
- 週間まとめ記事や各種記事に使い回せるテンプレート

使い方:
  python3 tools/eyecatch-gen.py --type weekly --date "3/7-3/8" --count 12 --week "2026年3月第1週"
  python3 tools/eyecatch-gen.py --type article --title "モルックの戦術解説"
  python3 tools/eyecatch-gen.py --type tournament --title "日本選手権2026"
"""

import argparse
from PIL import Image, ImageDraw, ImageFont
import os

# Brand colors
GOLD = "#ffd700"
DARK = "#1a1a2e"
WHITE = "#ffffff"
LIGHT_BG = "#f8f6f0"
GRAY = "#888888"
ACCENT_DARK = "#222222"

# Fonts
FONT_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"
FONT_MEDIUM = "/System/Library/Fonts/ヒラギノ角ゴシック W5.ttc"
FONT_REGULAR = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"

WIDTH = 1200
HEIGHT = 675


def hex_to_rgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0+radius, y0, x1-radius, y1], fill=fill)
    draw.rectangle([x0, y0+radius, x1, y1-radius], fill=fill)
    draw.pieslice([x0, y0, x0+2*radius, y0+2*radius], 180, 270, fill=fill)
    draw.pieslice([x1-2*radius, y0, x1, y0+2*radius], 270, 360, fill=fill)
    draw.pieslice([x0, y1-2*radius, x0+2*radius, y1], 90, 180, fill=fill)
    draw.pieslice([x1-2*radius, y1-2*radius, x1, y1], 0, 90, fill=fill)


def generate_weekly(date_range, count, week_label, output_path):
    """週間大会まとめ用アイキャッチ"""
    img = Image.new('RGB', (WIDTH, HEIGHT), hex_to_rgb(DARK))
    draw = ImageDraw.Draw(img)

    # Gold accent bar at top
    draw.rectangle([0, 0, WIDTH, 6], fill=hex_to_rgb(GOLD))

    # Gold accent line left
    draw.rectangle([60, 160, 68, 420], fill=hex_to_rgb(GOLD))

    # "MOLKKY HUB" brand mark top-right
    font_brand = ImageFont.truetype(FONT_BOLD, 22)
    draw.text((WIDTH - 220, 30), "MOLKKY HUB", fill=hex_to_rgb(GOLD), font=font_brand)

    # Category badge
    font_badge = ImageFont.truetype(FONT_MEDIUM, 20)
    badge_text = "週間大会まとめ"
    bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
    bw = bbox[2] - bbox[0] + 40
    draw_rounded_rect(draw, (90, 80, 90 + bw, 120), 4, hex_to_rgb(GOLD))
    draw.text((110, 84), badge_text, fill=hex_to_rgb(DARK), font=font_badge)

    # Main title - "今週末のモルック大会"
    font_title = ImageFont.truetype(FONT_BOLD, 52)
    draw.text((90, 170), "今週末の", fill=hex_to_rgb(WHITE), font=font_title)
    draw.text((90, 235), "モルック大会", fill=hex_to_rgb(WHITE), font=font_title)

    # Date range
    font_date = ImageFont.truetype(FONT_MEDIUM, 36)
    draw.text((90, 320), date_range, fill=hex_to_rgb(GOLD), font=font_date)

    # Count badge
    font_count = ImageFont.truetype(FONT_BOLD, 80)
    font_count_label = ImageFont.truetype(FONT_MEDIUM, 28)

    # Count circle on right side
    cx, cy = 950, 300
    r = 90
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=hex_to_rgb(GOLD))
    count_text = str(count)
    bbox = draw.textbbox((0, 0), count_text, font=font_count)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw//2, cy - 55), count_text, fill=hex_to_rgb(DARK), font=font_count)
    draw.text((cx - 14, cy + 30), "件", fill=hex_to_rgb(DARK), font=font_count_label)

    # Week label at bottom
    font_week = ImageFont.truetype(FONT_REGULAR, 22)
    draw.text((90, 400), week_label, fill=hex_to_rgb(GRAY), font=font_week)

    # Bottom bar
    draw.rectangle([0, HEIGHT - 6, WIDTH, HEIGHT], fill=hex_to_rgb(GOLD))

    # Decorative dots
    for i in range(5):
        x = 750 + i * 40
        draw.ellipse([x, 500, x+8, 508], fill=hex_to_rgb("#333355"))

    img.save(output_path, quality=95)
    print(f"✅ Generated: {output_path} ({os.path.getsize(output_path)} bytes)")
    return output_path


def generate_article(title, subtitle="", output_path="/tmp/eyecatch_article.jpg"):
    """汎用記事用アイキャッチ"""
    img = Image.new('RGB', (WIDTH, HEIGHT), hex_to_rgb(LIGHT_BG))
    draw = ImageDraw.Draw(img)

    # Gold accent bar at top
    draw.rectangle([0, 0, WIDTH, 6], fill=hex_to_rgb(GOLD))

    # Brand mark
    font_brand = ImageFont.truetype(FONT_BOLD, 20)
    draw.text((WIDTH - 200, HEIGHT - 40), "MOLKKY HUB", fill=hex_to_rgb(GRAY), font=font_brand)

    # Gold left bar
    draw.rectangle([80, 200, 88, 440], fill=hex_to_rgb(GOLD))

    # Title (auto-wrap if long)
    font_title = ImageFont.truetype(FONT_BOLD, 48)
    # Simple line wrapping
    max_chars = 16
    lines = []
    remaining = title
    while remaining:
        if len(remaining) <= max_chars:
            lines.append(remaining)
            break
        lines.append(remaining[:max_chars])
        remaining = remaining[max_chars:]

    y = 220
    for line in lines[:3]:
        draw.text((110, y), line, fill=hex_to_rgb(ACCENT_DARK), font=font_title)
        y += 65

    if subtitle:
        font_sub = ImageFont.truetype(FONT_REGULAR, 24)
        draw.text((110, y + 20), subtitle, fill=hex_to_rgb(GRAY), font=font_sub)

    # Bottom bar
    draw.rectangle([0, HEIGHT - 6, WIDTH, HEIGHT], fill=hex_to_rgb(GOLD))

    img.save(output_path, quality=95)
    print(f"✅ Generated: {output_path} ({os.path.getsize(output_path)} bytes)")
    return output_path


def generate_tournament(title, date="", location="", output_path="/tmp/eyecatch_tournament.jpg"):
    """大会特集用アイキャッチ"""
    img = Image.new('RGB', (WIDTH, HEIGHT), hex_to_rgb(DARK))
    draw = ImageDraw.Draw(img)

    # Gold top bar
    draw.rectangle([0, 0, WIDTH, 6], fill=hex_to_rgb(GOLD))

    # Brand
    font_brand = ImageFont.truetype(FONT_BOLD, 20)
    draw.text((WIDTH - 200, 30), "MOLKKY HUB", fill=hex_to_rgb(GOLD), font=font_brand)

    # Badge
    font_badge = ImageFont.truetype(FONT_MEDIUM, 18)
    draw_rounded_rect(draw, (80, 120, 230, 155), 4, hex_to_rgb(GOLD))
    draw.text((95, 124), "大会情報", fill=hex_to_rgb(DARK), font=font_badge)

    # Gold left bar
    draw.rectangle([60, 190, 68, 420], fill=hex_to_rgb(GOLD))

    # Title
    font_title = ImageFont.truetype(FONT_BOLD, 44)
    max_chars = 18
    lines = []
    remaining = title
    while remaining:
        if len(remaining) <= max_chars:
            lines.append(remaining)
            break
        lines.append(remaining[:max_chars])
        remaining = remaining[max_chars:]

    y = 200
    for line in lines[:3]:
        draw.text((90, y), line, fill=hex_to_rgb(WHITE), font=font_title)
        y += 60

    # Date & location
    if date or location:
        font_info = ImageFont.truetype(FONT_MEDIUM, 26)
        info = f"{date}　{location}" if date and location else (date or location)
        draw.text((90, y + 20), info, fill=hex_to_rgb(GOLD), font=font_info)

    # Bottom bar
    draw.rectangle([0, HEIGHT - 6, WIDTH, HEIGHT], fill=hex_to_rgb(GOLD))

    img.save(output_path, quality=95)
    print(f"✅ Generated: {output_path} ({os.path.getsize(output_path)} bytes)")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="モルハブ アイキャッチ画像ジェネレーター")
    parser.add_argument("--type", choices=["weekly", "article", "tournament"], required=True)
    parser.add_argument("--title", default="")
    parser.add_argument("--subtitle", default="")
    parser.add_argument("--date", default="")
    parser.add_argument("--count", type=int, default=0)
    parser.add_argument("--week", default="")
    parser.add_argument("--location", default="")
    parser.add_argument("--output", default="")

    args = parser.parse_args()

    if args.type == "weekly":
        out = args.output or "/tmp/eyecatch_weekly.jpg"
        generate_weekly(args.date, args.count, args.week, out)
    elif args.type == "article":
        out = args.output or "/tmp/eyecatch_article.jpg"
        generate_article(args.title, args.subtitle, out)
    elif args.type == "tournament":
        out = args.output or "/tmp/eyecatch_tournament.jpg"
        generate_tournament(args.title, args.date, args.location, out)
