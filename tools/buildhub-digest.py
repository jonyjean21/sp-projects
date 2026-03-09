#!/usr/bin/env python3
"""
BuildHub 日次ダイジェスト生成・投稿
Firebase /claude-tips-queue → Gemini要約 → BuildHub WP投稿
"""

import os, json, re, base64, urllib.request
from datetime import datetime, timezone, timedelta

FIREBASE_URL = "https://viisi-master-app-default-rtdb.firebaseio.com"
QUEUE_PATH = "/claude-tips-queue"
DIGEST_LOG_PATH = "/claude-tips-digest-log"
BUILDHUB_URL = "https://www.buildhub.jp"
CLAUDE_CODE_CATEGORY_ID = 2
JST = timezone(timedelta(hours=9))

SOURCE_LABELS = {
    'reddit-claudeai': 'Reddit r/ClaudeAI',
    'reddit-claudecode': 'Reddit r/ClaudeCode',
    'hn': 'Hacker News',
    'zenn': 'Zenn',
    'qiita': 'Qiita',
    'dev-to': 'dev.to'
}


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
    return sorted(items, key=lambda x: x.get('score') or 0, reverse=True)[:n]


def summarize(items, api_key):
    article_list = "\n\n".join([
        f"[{i+1}] タイトル: {item['title']}\nURL: {item['url']}\nソース: {item.get('source','')}\n概要: {(item.get('content_preview') or '')[:300]}"
        for i, item in enumerate(items)
    ])

    prompt = f"""以下のClaude Code関連記事を日本語でまとめてください。
各記事について以下のJSONを返してください。配列形式で全件返すこと。

{{"items": [{{"index": 1, "title_ja": "日本語タイトル", "summary": "要点を2〜3文で日本語説明", "url": "元のURL", "source": "ソース名"}}]}}

記事リスト:
{article_list}

注意: title_jaは自然な日本語に翻訳。summaryはエンジニア向けに実用的に。JSONのみ返すこと。"""

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3}
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
    return json.loads(match.group())['items']


def build_html(summaries, date_str):
    html = "<p>Claude Codeに関する本日の注目記事をまとめました。海外・国内の最新情報をお届けします。</p>\n\n"
    for item in summaries:
        label = SOURCE_LABELS.get(item.get('source', ''), item.get('source', ''))
        html += f"<h2>{item['title_ja']}</h2>\n"
        html += f"<p><strong>ソース:</strong> {label}</p>\n"
        html += f"<p>{item['summary']}</p>\n"
        html += f'<p><a href="{item["url"]}" target="_blank" rel="noopener">記事を読む →</a></p>\n'
        html += "<hr>\n\n"
    html += f"<p><small>このまとめはAIが自動生成しています。{date_str}時点の情報です。</small></p>"
    return html


def post_to_wp(title, content, user, password):
    creds = base64.b64encode(f"{user}:{password}".encode()).decode()
    slug = f"claude-code-{datetime.now(JST).strftime('%Y%m%d')}"
    payload = json.dumps({
        "title": title, "content": content, "status": "publish",
        "slug": slug, "categories": [CLAUDE_CODE_CATEGORY_ID]
    }).encode()
    req = urllib.request.Request(
        f"{BUILDHUB_URL}/wp-json/wp/v2/posts", data=payload,
        headers={"Authorization": f"Basic {creds}", "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())['id']


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
    gemini_key = os.environ.get('GEMINI_API_KEY')
    wp_user    = os.environ.get('BUILDHUB_WP_USER')
    wp_pass    = os.environ.get('BUILDHUB_WP_APP_PASS')

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

    summaries = summarize(top, gemini_key)
    print("Gemini要約完了")

    date_str = datetime.now(JST).strftime('%Y/%m/%d')
    title = f"Claude Code 最新情報まとめ【{date_str}】"
    content = build_html(summaries, date_str)

    post_id = post_to_wp(title, content, wp_user, wp_pass)
    print(f"WP投稿完了: ID={post_id}")

    mark_published(top, post_id)
    write_log(date_str, post_id, len(top))
    print(f"完了: {len(top)}件 → {BUILDHUB_URL}/?p={post_id}")


if __name__ == '__main__':
    main()
