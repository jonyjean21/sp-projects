#!/usr/bin/env python3
"""
日報バックフィル: ローカルgit log → 分類 → Gemini AI要約 → Firebase
GitHub APIのレートリミット回避のため、ローカルgitを使用
"""
import json, sys, time, calendar, subprocess, os
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com'
VERCEL_API = 'https://vercel-api-orpin-one.vercel.app'
REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JST = timezone(timedelta(hours=9))

# プロジェクト分類
AREA_MAP = [
    ('viisi-master', '5先王'), ('championship', '日本選手権'),
    ('teamride', 'チームライド'), ('meguri', 'めぐり帳'),
    ('recipe', 'レシピBOX'), ('inbox', 'INBOX'),
    ('machap', 'MACHAP'), ('youtube', 'YouTube'),
    ('molkky-portal', 'MOLKKY HUB Portal'), ('portal', 'SP Portal'),
    ('molkky-admin', 'モルハブ管理'), ('hub-dashboard', 'モルハブ向上委員会'),
    ('partner', 'パートナー'), ('promote', 'Xポスト生成'),
    ('repost', '引用リポスト'), ('tournament', '大会情報'),
    ('naimol', 'ナイモル'), ('report-admin', '日報システム'),
    ('gas/', 'GAS自動化'), ('tools/', 'ツール'),
    ('apps/', 'Appsカタログ'), ('data/', 'データ'),
    ('projects/molkky-dome', 'モルックドーム'), ('.claude', 'Claude設定'),
]

def classify_area(filepath):
    for pattern, area in AREA_MAP:
        if pattern in filepath:
            return area
    return 'その他'

def classify_type(msg):
    lower = msg.lower()
    for prefix in ['feat', 'add']:
        if lower.startswith(prefix + ':') or lower.startswith(prefix + '('):
            return 'feat'
    if lower.startswith('fix:') or lower.startswith('fix('):
        return 'fix'
    if lower.startswith('refactor:') or lower.startswith('refactor('):
        return 'refactor'
    for prefix in ['docs', 'doc']:
        if lower.startswith(prefix + ':') or lower.startswith(prefix + '('):
            return 'docs'
    if lower.startswith('style:') or lower.startswith('style('):
        return 'style'
    if lower.startswith('chore:') or lower.startswith('chore('):
        return 'chore'
    if any(w in msg for w in ['追加', '新規', '作成', '構築', '実装']):
        return 'feat'
    if any(w in msg for w in ['修正', 'バグ']):
        return 'fix'
    if any(w in lower for w in ['リファクタ', '整理', '削除', 'cleanup']):
        return 'refactor'
    return 'feat'

def git_cmd(*args):
    result = subprocess.run(['git'] + list(args), capture_output=True, text=True, cwd=REPO_DIR)
    return result.stdout.strip()

def api_post(url, data):
    body = json.dumps(data).encode()
    req = Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())

def api_put(url, data):
    body = json.dumps(data).encode()
    req = Request(url, data=body, headers={'Content-Type': 'application/json'}, method='PUT')
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

def fetch_commits_local(date_str):
    """ローカルgit logから指定日のコミット取得（4am-4am JST基準）"""
    y, m, d = map(int, date_str.split('-'))
    since_jst = datetime(y, m, d, 4, 0, 0, tzinfo=JST)
    until_jst = since_jst + timedelta(days=1)
    since_iso = since_jst.isoformat()
    until_iso = until_jst.isoformat()

    # git log with custom format: sha|timestamp|message
    log_output = git_cmd(
        'log', '--format=%H|%aI|%s',
        f'--since={since_iso}', f'--until={until_iso}',
        '--reverse'
    )

    if not log_output:
        return []

    commits = []
    for line in log_output.split('\n'):
        if not line.strip():
            continue
        parts = line.split('|', 2)
        if len(parts) < 3:
            continue
        sha, timestamp, message = parts
        commits.append({'sha': sha, 'timestamp': timestamp, 'message': message})

    return commits

def enrich_commit_local(c):
    """ローカルgitからコミット詳細取得"""
    sha = c['sha']
    message = c['message']
    commit_dt = datetime.fromisoformat(c['timestamp'])
    time_jst = commit_dt.astimezone(JST).strftime('%H:%M')

    # numstat for additions/deletions per file
    numstat = git_cmd('show', '--numstat', '--format=', sha)
    files = []
    additions = 0
    deletions = 0

    for line in numstat.split('\n'):
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) >= 3:
            add = int(parts[0]) if parts[0] != '-' else 0
            dele = int(parts[1]) if parts[1] != '-' else 0
            additions += add
            deletions += dele
            files.append(parts[2])

    # エリア判定
    area_counts = {}
    for f in files:
        a = classify_area(f)
        area_counts[a] = area_counts.get(a, 0) + 1
    area = max(area_counts, key=area_counts.get) if area_counts else 'その他'

    return {
        'sha': sha[:7],
        'time': time_jst,
        'type': classify_type(message),
        'message': message,
        'files': files,
        'additions': additions,
        'deletions': deletions,
        'area': area,
    }

def compute_stats(commits):
    types = {}
    areas = {}
    total_add = 0
    total_del = 0
    hours = []

    for c in commits:
        types[c['type']] = types.get(c['type'], 0) + 1
        if c['area'] not in areas:
            areas[c['area']] = {'commits': 0, 'additions': 0, 'deletions': 0}
        areas[c['area']]['commits'] += 1
        areas[c['area']]['additions'] += c['additions']
        areas[c['area']]['deletions'] += c['deletions']
        total_add += c['additions']
        total_del += c['deletions']
        hours.append(int(c['time'].split(':')[0]))

    time_range = {'first': commits[0]['time'], 'last': commits[-1]['time']} if commits else {'first': '-', 'last': '-'}

    return {
        'total_commits': len(commits),
        'total_additions': total_add,
        'total_deletions': total_del,
        'types': types,
        'areas': areas,
        'time_range': time_range,
        'active_hours': len(set(hours)),
    }

def call_gemini(commits, stats, date_display):
    commit_list = '\n'.join(
        f"{c['time']} [{c['type']}] {c['message']} ({c['area']}, +{c['additions']}/-{c['deletions']})"
        for c in commits
    )
    areas_list = '\n'.join(
        f"{name}: {s['commits']}件, +{s['additions']}/-{s['deletions']}"
        for name, s in sorted(stats['areas'].items(), key=lambda x: -x[1]['commits'])
    )

    prompt = f"""あなたはSP（個人開発者）の日報を書くアシスタントです。
以下はSPの{date_display}のgitコミット履歴です。

## コミット一覧（時刻順）
{commit_list}

## プロジェクト別集計
{areas_list}

## 統計
- 合計: {stats['total_commits']}コミット, +{stats['total_additions']}行, -{stats['total_deletions']}行
- 活動時間帯: {stats['time_range']['first']}〜{stats['time_range']['last']}

以下のJSON形式で出力してください:
{{
  "summary": {{
    "headline": "1行の見出し（15文字以内、その日の成果を端的に）",
    "body": "3〜5文のサマリー。何を作り、何を改善したか具体的に",
    "highlights": ["成果1", "成果2", "成果3"],
    "areas_narrative": "プロジェクト別の活動概要を2〜3文で"
  }},
  "exports": {{
    "note_markdown": "note.com記事用のマークダウン。見出し・箇条書き・コードブロックを使い、読みやすく。1000〜1500字。冒頭に日付、末尾に数値サマリー。個人開発者の日報として読み応えのある内容に",
    "x_thread": ["ツイート1（140字以内）", "ツイート2", "ツイート3"]
  }}
}}

## 注意
- SPは日本語話者。日本語で書く
- AI臭い定型文（「いかがでしたか」等）は禁止
- headline はキャッチーに
- x_thread は3〜5ツイートのスレッド。1ツイート140字以内。個人開発の臨場感が伝わるように
- note_markdownはマークダウン形式。## 見出し、- 箇条書きを使う"""

    try:
        result = api_post(f'{VERCEL_API}/api/gemini', {
            'prompt': prompt,
            'temperature': 0.5,
            'json_mode': True,
        })
        text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
        return json.loads(text)
    except Exception as e:
        print(f'  Gemini エラー: {e}')
        return None

def generate_for_date(date_str):
    start = time.time()
    print(f'\n=== {date_str} ===')

    # ローカルgitからコミット取得
    raw_commits = fetch_commits_local(date_str)
    print(f'  コミット数: {len(raw_commits)}')

    if not raw_commits:
        y, m, d = map(int, date_str.split('-'))
        dow = ['月','火','水','木','金','土','日'][calendar.weekday(y, m, d)]
        report = {
            'generated_at': datetime.now(JST).isoformat(),
            'date': date_str,
            'date_display': f'{y}年{m}月{d}日（{dow}）',
            'commits': [],
            'stats': {'total_commits': 0, 'total_additions': 0, 'total_deletions': 0, 'types': {}, 'areas': {}, 'time_range': {'first': '-', 'last': '-'}, 'active_hours': 0},
            'summary': {'headline': 'コミットなし', 'body': '活動なし', 'highlights': [], 'areas_narrative': ''},
            'exports': {'note_markdown': '', 'x_thread': []},
        }
        api_put(f'{FIREBASE_URL}/daily-reports/{date_str}.json', report)
        print(f'  → 0コミット（最小レポート保存）')
        return

    # 詳細取得 & 分類（ローカルなので即時完了）
    enriched = []
    for c in raw_commits:
        enriched.append(enrich_commit_local(c))

    for e in enriched:
        print(f'  {e["time"]} [{e["type"]}] {e["area"]}: {e["message"][:60]}')

    stats = compute_stats(enriched)

    # 日付表示
    y, m, d = map(int, date_str.split('-'))
    dow = ['月','火','水','木','金','土','日'][calendar.weekday(y, m, d)]
    date_display = f'{y}年{m}月{d}日（{dow}）'

    # Gemini AI要約
    print(f'  Gemini 呼び出し中...')
    ai_result = call_gemini(enriched, stats, date_display)

    summary = ai_result.get('summary', {}) if ai_result else {}
    exports = ai_result.get('exports', {}) if ai_result else {}

    if not summary:
        summary = {'headline': f'{stats["total_commits"]}コミット', 'body': '', 'highlights': [], 'areas_narrative': ''}
    if not exports:
        exports = {'note_markdown': '', 'x_thread': []}

    # Firebase書き込み
    report = {
        'generated_at': datetime.now(JST).isoformat(),
        'date': date_str,
        'date_display': date_display,
        'commits': enriched,
        'stats': stats,
        'summary': summary,
        'exports': exports,
    }

    api_put(f'{FIREBASE_URL}/daily-reports/{date_str}.json', report)

    duration = round(time.time() - start)
    print(f'  → 完了！ {len(enriched)}コミット, +{stats["total_additions"]}/-{stats["total_deletions"]} ({duration}秒)')
    print(f'  見出し: {summary.get("headline", "?")}')

    # 実行ログ
    api_post(f'{FIREBASE_URL}/daily-report-log.json', {
        'timestamp': datetime.now(JST).isoformat(),
        'date_processed': date_str,
        'commit_count': len(enriched),
        'status': 'success',
        'duration_sec': duration,
    })

    time.sleep(2)  # Geminiレートリミット対策

def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    print(f'日報バックフィル: 直近{days}日分（ローカルgit使用）')

    now = datetime.now(JST)
    for i in range(1, days + 1):
        d = now - timedelta(days=i)
        generate_for_date(d.strftime('%Y-%m-%d'))

    print(f'\n全{days}日分の処理完了！')
    print(f'管理画面: https://jonyjean21.github.io/sp-projects/report-admin/')

if __name__ == '__main__':
    main()
