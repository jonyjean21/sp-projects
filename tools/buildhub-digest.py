#!/usr/bin/env python3
"""
BuildHub 日次ダイジェスト生成・投稿
Firebase /claude-tips-queue → Gemini要約 → BuildHub WP投稿

記事構成:
  - 今日のメイン（海外バズ記事を1本フル翻訳・詳細解説）
  - その他の注目（残り記事を要約）
  - BuildHub編集部より（今日の総評）
"""

import os, json, re, base64, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timezone, timedelta

FIREBASE_URL = "https://viisi-master-app-default-rtdb.firebaseio.com"
QUEUE_PATH = "/claude-tips-queue"
DIGEST_LOG_PATH = "/claude-tips-digest-log"
BUILDHUB_URL = "https://www.buildhub.jp"
CLAUDE_CODE_CATEGORY_ID = 2
JST = timezone(timedelta(hours=9))

SOURCE_LABELS = {
    'reddit-claudeai':   'Reddit r/ClaudeAI',
    'reddit-claudecode': 'Reddit r/ClaudeCode',
    'hn':                'Hacker News',
    'zenn':              'Zenn',
    'qiita':             'Qiita',
    'dev-to':            'dev.to',
    'x-twitter':         'X (Twitter)',
}

# ソース → WPタグID（buildhub.jp上のタグ）
SOURCE_TAG_MAP = {
    'hn':                7,
    'reddit-claudeai':   8,
    'reddit-claudecode': 8,
    'zenn':              9,
    'qiita':             10,
    'dev-to':            11,
    'x-twitter':         15,
}
BASE_TAGS = [6, 12]  # Claude Code, AI開発 は常に付与


def fetch_pending_items():
    with urllib.request.urlopen(f"{FIREBASE_URL}{QUEUE_PATH}.json") as res:
        data = json.loads(res.read())
    if not data:
        return []
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    return [
        {'id': k, **v} for k, v in data.items()
        if v and v.get('status') == 'pending'
        and (not v.get('collected_at') or v['collected_at'] >= cutoff)
    ]


def select_top(items, n=7):
    """海外ソース優遇 + コード含有ボーナスでスコアソート"""
    overseas = {'hn', 'reddit-claudeai', 'reddit-claudecode'}
    def score(x):
        base  = x.get('score') or 0
        bonus = 50 if x.get('source') in overseas else 0
        bonus += 20 if x.get('has_code') else 0
        bonus += 15 if x.get('github_url') else 0
        return base + bonus
    return sorted(items, key=score, reverse=True)[:n]


def summarize(items, api_key):
    article_list = "\n\n".join([
        f"[{i+1}] タイトル: {item['title']}\n"
        f"URL: {item['url']}\n"
        f"ソース: {item.get('source','')} (スコア:{item.get('score',0)})\n"
        f"本文: {(item.get('content_preview') or '')[:400]}"
        + (f"\n補足: GitHubリポジトリあり: {item['github_url']}" if item.get('github_url') else "")
        + ("\n補足: コード例あり" if item.get('has_code') and not item.get('github_url') else "")
        for i, item in enumerate(items)
    ])

    main_source = items[0].get('source', '') if items else ''
    is_overseas = main_source in ('hn', 'reddit-claudeai', 'reddit-claudecode')
    main_hint = (
        "記事[1]は海外で最もバズった記事です。500文字以上の詳しい日本語解説を書いてください。"
        if is_overseas else
        "記事[1]は本日の注目記事です。400文字程度の詳しい日本語解説を書いてください。"
    )

    prompt = f"""あなたはClaude Code・AI開発ツール専門の日本語メディア「BuildHub」の編集者です。
以下の記事リストを読んで、日本のエンジニア向けにまとめてください。

{main_hint}
記事[2]以降は2〜3文の要約で構いません。

以下のJSON形式で返してください（JSONのみ、説明文不要）:

{{
  "excerpt": "記事全体の1文要約（100文字以内、SEO用）",
  "editor_comment": "BuildHub編集部として今日の注目ポイントを2〜3文でコメント。エンジニアが実際に使える視点で。",
  "items": [
    {{
      "index": 1,
      "title_ja": "自然な日本語タイトル",
      "is_main": true,
      "summary": "詳しい日本語解説（記事[1]は500文字以上）。以下の構成で書くこと：\n①何が問題で何を解決しているか（150字）\n②どう動くか・核心の実装アプローチ（コードがある場合は核心部分10〜20行をコードブロックで示し、直後に「このコードでやっていること」を3〜5文で日本語解説）\n③日本のエンジニアへの示唆・応用アイデア（150字）\nGitHubリポジトリがある場合は「何ができるか」を1文で必ず明記。",
      "score_label": "HN 234 points または Reddit 456 upvotes または 空文字",
      "url": "元のURL",
      "source": "ソース名"
    }},
    {{
      "index": 2,
      "title_ja": "日本語タイトル",
      "is_main": false,
      "summary": "要点を2〜3文で日本語説明",
      "score_label": "",
      "url": "元のURL",
      "source": "ソース名"
    }}
  ]
}}

記事リスト:
{article_list}"""

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 8192}
    }).encode()

    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        result = json.loads(res.read())

    text = result['candidates'][0]['content']['parts'][0]['text']
    match = re.search(r'\{[\s\S]*\}', text)
    if not match:
        raise ValueError("GeminiレスポンスにJSONなし")
    return json.loads(match.group())


def md_to_html(text):
    """Gemini返却markdownの最低限HTML変換（コードブロック・太字・インラインコード）"""
    import html as html_mod
    # コードブロック: ```lang\n...\n``` → <pre><code>
    def replace_codeblock(m):
        lang = m.group(1).strip() or 'text'
        code = html_mod.escape(m.group(2))
        return f'<pre style="background:#1e1e1e;color:#d4d4d4;padding:16px;overflow-x:auto;border-radius:6px;margin:16px 0;"><code class="language-{lang}">{code}</code></pre>'
    text = re.sub(r'```(\w*)\n([\s\S]*?)```', replace_codeblock, text)
    # 太字: **text** → <strong>
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # インラインコード: `code` → <code>
    text = re.sub(r'`([^`\n]+)`', r'<code style="background:#f4f4f4;padding:2px 6px;border-radius:3px;">\1</code>', text)
    # 段落区切り（①②③ などの箇条書き行）
    text = re.sub(r'\n([①②③④⑤])', r'<br>\1', text)
    return text


def build_html(result, date_str, raw_items):
    items          = result.get('items', [])
    editor_comment = result.get('editor_comment', '')

    # ソース内訳
    source_counts = {}
    for ri in raw_items:
        label = SOURCE_LABELS.get(ri.get('source', ''), ri.get('source', ''))
        source_counts[label] = source_counts.get(label, 0) + 1
    source_summary = ' / '.join(f"{s} {c}件" for s, c in source_counts.items())

    html = f"<p>本日の注目記事 {len(items)}本をお届けします。（{source_summary}）</p>\n\n"

    for item in items:
        label       = SOURCE_LABELS.get(item.get('source', ''), item.get('source', ''))
        url         = item['url']
        score_label = f" <small>({item['score_label']})</small>" if item.get('score_label') else ''

        # GitHubバナー（raw_itemsからgithub_urlを参照）
        raw = next((r for r in raw_items if r.get('url') == item.get('url')), {})
        github_url = raw.get('github_url')

        summary_html = md_to_html(item.get('summary', ''))

        if item.get('is_main'):
            html += '<div style="border-left:4px solid #0073aa;padding:12px 16px;margin:24px 0;background:#f0f7ff;">\n'
            html += '<p style="margin:0 0 4px;"><strong>📌 今日のメイン</strong></p>\n'
            html += '</div>\n\n'
            html += f'<h2>{item["title_ja"]}{score_label}</h2>\n'
            html += f'<p><strong>ソース:</strong> {label}</p>\n'
            if github_url:
                html += f'<p>🔗 <a href="{github_url}" target="_blank" rel="noopener"><strong>GitHubリポジトリを見る</strong></a></p>\n'
            html += f'<div style="line-height:1.8;">{summary_html}</div>\n'
            html += f'<p><a href="{url}" target="_blank" rel="noopener">元記事を読む（英語）→</a></p>\n'
            html += '<hr style="margin:32px 0;">\n\n'
            html += '<h2>その他の注目記事</h2>\n\n'
        else:
            html += f'<h3>{item["title_ja"]}{score_label}</h3>\n'
            html += f'<p><strong>ソース:</strong> {label}</p>\n'
            if github_url:
                html += f'<p>🔗 <a href="{github_url}" target="_blank" rel="noopener">GitHubリポジトリ</a></p>\n'
            html += f'<p>{summary_html}</p>\n'
            html += f'<p><a href="{url}" target="_blank" rel="noopener">記事を読む →</a></p>\n\n'

    if editor_comment:
        html += '<hr style="margin:32px 0;">\n\n'
        html += '<div style="background:#f9f9f9;border:1px solid #ddd;padding:16px;border-radius:4px;">\n'
        html += '<p style="margin:0 0 8px;"><strong>💬 BuildHub編集部より</strong></p>\n'
        html += f'<p style="margin:0;">{editor_comment}</p>\n'
        html += '</div>\n\n'

    html += f"<p><small>このまとめはAIが自動生成しています。{date_str}時点の情報です。</small></p>"
    return html


def post_to_wp(title, content, excerpt, tag_ids, user, password):
    creds = base64.b64encode(f"{user}:{password}".encode()).decode()
    slug  = f"claude-code-{datetime.now(JST).strftime('%Y%m%d')}"
    payload = json.dumps({
        "title": title, "content": content, "excerpt": excerpt,
        "status": "publish", "slug": slug,
        "categories": [CLAUDE_CODE_CATEGORY_ID],
        "tags": tag_ids,
    }).encode()
    req = urllib.request.Request(
        f"{BUILDHUB_URL}/wp-json/wp/v2/posts", data=payload,
        headers={"Authorization": f"Basic {creds}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())['id']
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')[:500]
        raise RuntimeError(f"WP投稿失敗 {e.code}: {body}")


def fetch_pexels_image(query, api_key):
    """Pexels APIで画像URLとカメラマン情報を取得"""
    q = urllib.parse.quote(query)
    req = urllib.request.Request(
        f"https://api.pexels.com/v1/search?query={q}&per_page=3&orientation=landscape",
        headers={
            "Authorization": api_key,
            "User-Agent": "BuildHub/1.0 (+https://www.buildhub.jp)",
        }
    )
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
        photos = data.get('photos', [])
        if not photos:
            return None
        photo = photos[0]
        return {
            'url':           photo['src']['large'],
            'photographer':  photo.get('photographer', ''),
            'pexels_url':    photo.get('url', ''),
        }
    except Exception as e:
        print(f"Pexels取得失敗: {e}")
        return None


def upload_featured_image(post_id, image_info, wp_user, wp_pass):
    """画像をWPメディアにアップロードしてアイキャッチに設定"""
    import urllib.request as _ur
    creds = base64.b64encode(f"{wp_user}:{wp_pass}".encode()).decode()
    auth_header = {"Authorization": f"Basic {creds}"}

    # 画像ダウンロード（User-Agent付き）
    try:
        dl_req = _ur.Request(image_info['url'], headers={"User-Agent": "BuildHub/1.0"})
        with _ur.urlopen(dl_req) as res:
            img_data = res.read()
    except Exception as e:
        print(f"画像DL失敗: {e}")
        return False

    # WPメディアにアップロード
    upload_req = _ur.Request(
        f"{BUILDHUB_URL}/wp-json/wp/v2/media",
        data=img_data,
        headers={
            **auth_header,
            "Content-Disposition": f"attachment; filename=buildhub-{post_id}.jpg",
            "Content-Type": "image/jpeg",
        }
    )
    try:
        with _ur.urlopen(upload_req) as res:
            media = json.loads(res.read())
        media_id = media['id']
    except Exception as e:
        print(f"メディアアップロード失敗: {e}")
        return False

    # アイキャッチ設定（WP REST API: POST to posts/{id}）
    patch_payload = json.dumps({"featured_media": media_id}).encode()
    patch_req = _ur.Request(
        f"{BUILDHUB_URL}/wp-json/wp/v2/posts/{post_id}",
        data=patch_payload,
        headers={**auth_header, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with _ur.urlopen(patch_req) as res:
            pass
        print(f"アイキャッチ設定完了: media_id={media_id}")
        return True
    except Exception as e:
        print(f"アイキャッチ設定失敗: {e}")
        return False


def mark_published(items, post_id):
    for item in items:
        payload = json.dumps({"status": "published", "post_id": post_id}).encode()
        req = urllib.request.Request(
            f"{FIREBASE_URL}{QUEUE_PATH}/{item['id']}.json",
            data=payload, headers={"Content-Type": "application/json"}, method="PATCH"
        )
        urllib.request.urlopen(req)


def write_log(date_str, post_id, count):
    payload = json.dumps({"date": date_str, "postId": post_id, "itemCount": count}).encode()
    req = urllib.request.Request(
        f"{FIREBASE_URL}{DIGEST_LOG_PATH}.json",
        data=payload, headers={"Content-Type": "application/json"}
    )
    urllib.request.urlopen(req)


def main():
    gemini_key  = os.environ.get('GEMINI_API_KEY')
    wp_user     = os.environ.get('BUILDHUB_WP_USER')
    wp_pass     = os.environ.get('BUILDHUB_WP_APP_PASS')
    pexels_key  = os.environ.get('PEXELS_API_KEY')

    if not all([gemini_key, wp_user, wp_pass]):
        print("ERROR: 環境変数未設定 (GEMINI_API_KEY / BUILDHUB_WP_USER / BUILDHUB_WP_APP_PASS)")
        return

    items = fetch_pending_items()
    if not items:
        print("pendingアイテムなし。スキップ。")
        return
    print(f"取得: {len(items)}件")

    top = select_top(items)
    print(f"選択: {len(top)}件")

    result = summarize(top, gemini_key)
    print("Gemini要約完了")

    date_str = datetime.now(JST).strftime('%Y/%m/%d')
    title    = f"Claude Code 海外バズ翻訳まとめ【{date_str}】"
    content  = build_html(result, date_str, top)
    excerpt  = result.get('excerpt', '')

    # タグID
    tag_ids = list(set(BASE_TAGS + [SOURCE_TAG_MAP[i.get('source', '')] for i in top if i.get('source') in SOURCE_TAG_MAP]))

    post_id = post_to_wp(title, content, excerpt, tag_ids, wp_user, wp_pass)
    print(f"WP投稿完了: ID={post_id}")

    # アイキャッチ画像（Pexels）
    if pexels_key:
        main_title = result.get('items', [{}])[0].get('title_ja', 'AI coding terminal')
        # タイトルから英語キーワードを生成（汎用クエリをフォールバック）
        queries = ['AI coding terminal dark', 'developer programming computer', 'artificial intelligence code']
        image_info = None
        for q in queries:
            image_info = fetch_pexels_image(q, pexels_key)
            if image_info:
                break
        if image_info:
            upload_featured_image(post_id, image_info, wp_user, wp_pass)
        else:
            print("Pexels画像取得失敗。アイキャッチなしで続行。")
    else:
        print("PEXELS_API_KEY未設定。アイキャッチスキップ。")

    mark_published(top, post_id)
    write_log(date_str, post_id, len(top))
    print(f"完了: {len(top)}件 → {BUILDHUB_URL}/?p={post_id}")


if __name__ == '__main__':
    main()
