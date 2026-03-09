#!/usr/bin/env python3
"""
エリア別大会まとめ記事 自動生成パイプライン
Usage:
  python3 tools/area-article-gen.py              # 全エリア一覧表示
  python3 tools/area-article-gen.py --top 10     # 上位10エリアの記事を下書き生成
  python3 tools/area-article-gen.py --area hyogo  # 指定エリアのみ生成
  python3 tools/area-article-gen.py --dry-run     # 生成内容をプレビュー（WP投稿しない）
"""

import json
import sys
import os
import argparse
from datetime import datetime

# 共通ライブラリ
sys.path.insert(0, os.path.dirname(__file__))
from lib.wp_api import load_env, wp_get, wp_post, WP_SITE

_env = load_env()

CATEGORY_TOURNAMENT = 8  # 大会情報カテゴリ

# 地方ブロック定義（近隣リンク用）
REGION_MAP = {
    "北海道・東北": ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima"],
    "関東": ["ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa"],
    "中部": ["niigata", "yamanashi", "nagano", "gifu", "shizuoka", "aichi", "mie", "toyama", "ishikawa", "fukui"],
    "近畿": ["shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama"],
    "中国": ["tottori", "shimane", "okayama", "hiroshima", "yamaguchi"],
    "四国": ["tokushima", "kagawa", "ehime", "kochi"],
    "九州・沖縄": ["fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa"],
}

# 重複エリアのマージ（slug → 名前統一）
SLUG_MERGE = {
    "hokkaido2": "hokkaido",
    "okinawa2": "okinawa",
}

def wp_request(endpoint, data=None, method="GET"):
    if data:
        return wp_post(_env, endpoint, data)
    return wp_get(_env, endpoint)


def get_areas():
    """エリア一覧を取得してマージ"""
    areas = wp_request("area?per_page=100&_fields=id,name,slug,count")
    # Merge duplicates
    merged = {}
    for a in areas:
        slug = SLUG_MERGE.get(a["slug"], a["slug"])
        if slug in merged:
            merged[slug]["count"] += a["count"]
            merged[slug]["ids"].append(a["id"])
        else:
            merged[slug] = {
                "name": a["name"],
                "slug": slug,
                "count": a["count"],
                "ids": [a["id"]],
            }
    return sorted(merged.values(), key=lambda x: -x["count"])


def get_tournaments_for_area(area_ids, limit=10):
    """指定エリアの大会を取得"""
    # area taxonomy supports comma-separated IDs
    ids_str = ",".join(str(i) for i in area_ids)
    tournaments = wp_request(
        f"tournament?area={ids_str}&per_page={limit}&orderby=date&order=desc"
        f"&_fields=id,title,link,date,acf"
    )
    return tournaments


def get_region_for_slug(slug):
    """slugから地方ブロック名を返す"""
    for region, slugs in REGION_MAP.items():
        if slug in slugs:
            return region
    return None


def get_neighbors(slug, all_areas):
    """同じ地方ブロック内の近隣エリアを返す"""
    region = get_region_for_slug(slug)
    if not region:
        return []
    area_map = {a["slug"]: a for a in all_areas}
    neighbors = []
    for s in REGION_MAP[region]:
        if s != slug and s in area_map and area_map[s]["count"] > 0:
            neighbors.append(area_map[s])
    return sorted(neighbors, key=lambda x: -x["count"])


def format_event_date(date_str):
    """ACF event_date (YYYYMMDD) → 読みやすい形式"""
    if not date_str or len(str(date_str)) != 8:
        return "日程未定"
    try:
        d = datetime.strptime(str(date_str), "%Y%m%d")
        return d.strftime("%Y年%-m月%-d日")
    except ValueError:
        return str(date_str)


def generate_article(area, tournaments, neighbors):
    """Gutenbergブロックマークアップの記事を生成"""
    name = area["name"]
    count = area["count"]
    slug = area["slug"]

    # --- Title ---
    title = f"{name}のモルック大会情報まとめ｜開催一覧・日程・参加方法"

    # --- Content ---
    blocks = []

    # Intro
    blocks.append(f"""<!-- wp:paragraph -->
<p>{name}で開催されるモルック大会の情報をまとめています。MOLKKY HUBでは、{name}エリアで<strong>{count}件以上</strong>の大会情報を掲載中。初心者歓迎の体験会から本格的な公式戦まで、{name}のモルック大会を探すならこのページをチェックしてください。</p>
<!-- /wp:paragraph -->""")

    # Tournament archive link
    blocks.append(f"""<!-- wp:buttons {{"layout":{{"type":"flex","justifyContent":"center"}},"style":{{"spacing":{{"margin":{{"top":"16px","bottom":"24px"}}}}}}}} -->
<div class="wp-block-buttons" style="margin-top:16px;margin-bottom:24px">
<!-- wp:button {{"style":{{"color":{{"background":"#005f73","text":"#ffffff"}},"border":{{"radius":"4px"}}}}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-color has-background" href="/area/{slug}/" style="color:#ffffff;background-color:#005f73;border-radius:4px">{name}の大会一覧を見る →</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->""")

    # Recent tournaments section
    if tournaments:
        blocks.append(f"""<!-- wp:heading -->
<h2 class="wp-block-heading">{name}の最近のモルック大会</h2>
<!-- /wp:heading -->""")

        blocks.append(f"""<!-- wp:paragraph -->
<p>直近で掲載された{name}エリアの大会情報です。</p>
<!-- /wp:paragraph -->""")

        # Tournament list as HTML table
        rows = []
        for t in tournaments[:10]:
            acf = t.get("acf", {})
            event_date = format_event_date(acf.get("event_date", ""))
            organizer = acf.get("organizer", "")
            beginner = "初心者歓迎" if acf.get("beginner_friendly") else ""
            title_text = t["title"]["rendered"]
            link = t["link"]
            rows.append(f'<tr><td>{event_date}</td><td><a href="{link}">{title_text}</a></td><td>{organizer}</td><td>{beginner}</td></tr>')

        table_html = f"""<!-- wp:html -->
<table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
<thead><tr style="background:#f1f1f5;"><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">日程</th><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">大会名</th><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">主催</th><th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">備考</th></tr></thead>
<tbody>
{''.join(rows)}
</tbody>
</table>
<!-- /wp:html -->"""
        blocks.append(table_html)

        blocks.append(f"""<!-- wp:paragraph {{"style":{{"typography":{{"fontSize":"14px"}}}}}} -->
<p style="font-size:14px">※ 最新情報は各大会の詳細ページでご確認ください。掲載情報は投稿時点のものです。</p>
<!-- /wp:paragraph -->""")

    # Beginner info
    blocks.append(f"""<!-- wp:heading -->
<h2 class="wp-block-heading">{name}でモルックを始めるには</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>モルックは年齢や体力を問わず誰でも楽しめるフィンランド発祥のスポーツです。{name}でも体験会や初心者向けの大会が定期的に開催されています。まずは気軽に参加してみましょう。</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><a href="/introduction/">モルックとは？ 基本を知る</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="/rule/">モルックのルール完全ガイド</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="/molkky-official-items/">道具をそろえる（正規品一覧）</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="/molkky-team/">{name}周辺のモルックチームを探す</a></li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->""")

    # Neighbor areas
    if neighbors:
        blocks.append(f"""<!-- wp:heading -->
<h2 class="wp-block-heading">近隣エリアの大会情報</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>{name}の近くのエリアでもモルック大会が開催されています。</p>
<!-- /wp:paragraph -->""")

        neighbor_items = []
        for n in neighbors[:6]:
            neighbor_items.append(
                f'<!-- wp:list-item -->\n'
                f'<li><a href="/area/{n["slug"]}/">{n["name"]}のモルック大会</a>（{n["count"]}件）</li>\n'
                f'<!-- /wp:list-item -->'
            )
        blocks.append(f"""<!-- wp:list -->
<ul class="wp-block-list">{chr(10).join(neighbor_items)}</ul>
<!-- /wp:list -->""")

    # CTA
    blocks.append(f"""<!-- wp:heading -->
<h2 class="wp-block-heading">{name}の大会情報を掲載しませんか？</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>MOLKKY HUBでは、モルック大会の情報掲載を無料で受け付けています。{name}で大会や体験会を開催される方は、ぜひ情報をお寄せください。</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {{"layout":{{"type":"flex","justifyContent":"center"}}}} -->
<div class="wp-block-buttons">
<!-- wp:button {{"style":{{"color":{{"background":"#ffd700","text":"#333333"}},"border":{{"radius":"4px"}}}}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-color has-background" href="/forms/" style="color:#333333;background-color:#ffd700;border-radius:4px">情報提供フォームはこちら</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->""")

    content = "\n\n".join(blocks)

    # Meta description
    meta_desc = f"{name}で開催されるモルック大会情報を{count}件以上掲載。初心者歓迎の体験会から公式戦まで、{name}のモルック大会を探すならMOLKKY HUB。"

    return {
        "title": title,
        "slug": f"molkky-tournament-{slug}",
        "content": content,
        "excerpt": meta_desc,
        "categories": [CATEGORY_TOURNAMENT],
        "status": "draft",
    }


def main():
    parser = argparse.ArgumentParser(description="エリア別大会まとめ記事生成")
    parser.add_argument("--top", type=int, help="上位N件のエリアで記事生成")
    parser.add_argument("--area", type=str, help="指定エリアslugのみ生成")
    parser.add_argument("--min-count", type=int, default=5, help="最低大会数（デフォルト: 5）")
    parser.add_argument("--dry-run", action="store_true", help="WP投稿せずプレビュー")
    args = parser.parse_args()

    all_areas = get_areas()

    if not args.top and not args.area:
        # 一覧表示モード
        print(f"{'#':>3} {'エリア':<6} {'件数':>4} {'slug':<15}")
        print("-" * 35)
        for i, a in enumerate(all_areas, 1):
            marker = " ★" if a["count"] >= 10 else ""
            print(f"{i:>3} {a['name']:<6} {a['count']:>4} {a['slug']:<15}{marker}")
        print(f"\n★ = 10件以上（記事生成推奨）")
        print(f"全{len(all_areas)}エリア / 10件以上: {sum(1 for a in all_areas if a['count'] >= 10)}エリア")
        return

    # 対象エリアを決定
    if args.area:
        targets = [a for a in all_areas if a["slug"] == args.area]
        if not targets:
            print(f"Error: Area '{args.area}' not found")
            return
    elif args.top:
        targets = [a for a in all_areas if a["count"] >= args.min_count][:args.top]
    else:
        targets = []

    print(f"対象エリア: {len(targets)}件")
    print("=" * 50)

    created = []
    for area in targets:
        print(f"\n▶ {area['name']} ({area['count']}件)")

        # Fetch tournaments
        tournaments = get_tournaments_for_area(area["ids"], limit=10)
        print(f"  大会データ: {len(tournaments)}件取得")

        # Get neighbors
        neighbors = get_neighbors(area["slug"], all_areas)
        print(f"  近隣エリア: {len(neighbors)}件")

        # Generate article
        article = generate_article(area, tournaments, neighbors)
        print(f"  タイトル: {article['title']}")
        print(f"  スラッグ: {article['slug']}")
        print(f"  コンテンツ長: {len(article['content'])} chars")

        if args.dry_run:
            print(f"  [DRY-RUN] WP投稿スキップ")
            # Show first 500 chars of content
            print(f"  プレビュー:\n{article['content'][:500]}...")
        else:
            try:
                result = wp_request("posts", article)
                print(f"  ✅ WP投稿成功: ID:{result['id']} (draft)")
                created.append({
                    "id": result["id"],
                    "area": area["name"],
                    "slug": article["slug"],
                })
            except Exception as e:
                print(f"  ❌ WP投稿失敗: {e}")

    if created:
        print(f"\n{'=' * 50}")
        print(f"生成完了: {len(created)}記事（すべてdraft）")
        for c in created:
            print(f"  ID:{c['id']} | {c['area']} | /{c['slug']}/")
        print(f"\nSPに確認後、公開してください。")


if __name__ == "__main__":
    main()
