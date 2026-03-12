#!/usr/bin/env python3
"""
Todoist Inbox 自動トリアージ
macOS launchd から2時間おきに実行される

ルール:
  「メモ: 〜」→ sp-brain/inbox/に転記 → Todoistから削除
  それ以外   → 内容でGemini判定 → 適切なプロジェクトへ移動
"""

import os
import json
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

# .envから読み込み
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

TODOIST_TOKEN = os.environ.get('TODOIST_API_TOKEN', '')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY', '')
TODOIST_API = 'https://api.todoist.com/api/v1'

PROJECTS = {
    'inbox':      '6g7xmMQrRh4RGGhv',
    'molkkyhub':  '6g7xrVCJ96gjVC3J',
    'machap':     '6g7xrfqpFqqHfGHW',
    'spprojects': '6g7xrh6J8p2HWxX4',
    'daily':      '6g7xwp87wwvvcR9W',
}

def todoist_get(path):
    req = urllib.request.Request(
        f'{TODOIST_API}{path}',
        headers={'Authorization': f'Bearer {TODOIST_TOKEN}'}
    )
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
        return data.get('results', data) if isinstance(data, dict) else data

INBOX_DIR = Path(__file__).parent.parent / 'sp-brain' / 'inbox'
MEMO_PREFIXES = ('メモ:', 'メモ：', 'memo:', 'MEMO:')

def is_memo(content):
    return any(content.startswith(p) for p in MEMO_PREFIXES)

def save_memo(content, description=''):
    """sp-brain/inbox/にメモを保存"""
    body = content
    for p in MEMO_PREFIXES:
        if body.startswith(p):
            body = body[len(p):].strip()
            break
    date = datetime.now().strftime('%Y%m%d-%H%M')
    slug = body[:20].replace(' ', '-').replace('/', '-')
    filename = f'memo-{date}-{slug}.md'
    text = f'# {body}\n\n{description}\n' if description else f'# {body}\n'
    (INBOX_DIR / filename).write_text(text, encoding='utf-8')
    return filename

def todoist_delete(task_id):
    req = urllib.request.Request(
        f'{TODOIST_API}/tasks/{task_id}',
        headers={'Authorization': f'Bearer {TODOIST_TOKEN}'},
        method='DELETE'
    )
    with urllib.request.urlopen(req) as r:
        return r.status

def todoist_move(task_id, project_id):
    body = json.dumps({'project_id': project_id}).encode()
    req = urllib.request.Request(
        f'{TODOIST_API}/tasks/{task_id}/move',
        data=body,
        headers={
            'Authorization': f'Bearer {TODOIST_TOKEN}',
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def classify(content, description=''):
    prompt = f"""タスクを分類してください。

タスク: {content}
説明: {description or 'なし'}

選択肢（いずれか1つのみ返す）:
- molkkyhub: モルック・大会・チーム・MOLKKY HUB関連
- machap: MACHAP・チームライド・マルタ村・コミュニティアプリ関連
- spprojects: 開発・AI・BuildHub・自動化・GAS・Claude・副業実験関連
- daily: 日常・個人・買い物・用事・家族・食事・その他

キーワード1つのみ:"""

    body = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'maxOutputTokens': 10, 'temperature': 0},
    }).encode()
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}',
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())
    label = (result.get('candidates', [{}])[0]
             .get('content', {}).get('parts', [{}])[0]
             .get('text', '').strip().lower())
    # 余分な文字を除去
    for key in PROJECTS:
        if key in label:
            return key
    return 'daily'

def main():
    if not TODOIST_TOKEN or not GEMINI_KEY:
        print('ERROR: TODOIST_API_TOKEN or GEMINI_API_KEY が未設定')
        return

    tasks = todoist_get(f'/tasks?project_id={PROJECTS["inbox"]}')
    if not tasks:
        print('Inbox: 空')
        return

    print(f'Inbox: {len(tasks)}件を処理')
    for task in tasks:
        content = task.get('content', '')
        description = task.get('description', '')
        try:
            if is_memo(content):
                filename = save_memo(content, description)
                todoist_delete(task['id'])
                print(f'📝 メモ保存: {filename}')
            else:
                key = classify(content, description)
                project_id = PROJECTS[key]
                todoist_move(task['id'], project_id)
                print(f'✓ 「{content}」→ {key}')
        except Exception as e:
            print(f'✗ 「{content}」エラー: {e}')

if __name__ == '__main__':
    main()
