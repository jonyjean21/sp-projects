#!/usr/bin/env python3
"""Todoist重複タスク検出・削除スクリプト"""

import os
import json
import urllib.request
import urllib.error
from collections import defaultdict

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ[key.strip()] = val.strip()

def api_get(endpoint, token):
    req = urllib.request.Request(
        f'https://api.todoist.com/rest/v2/{endpoint}',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def api_delete(endpoint, token):
    req = urllib.request.Request(
        f'https://api.todoist.com/rest/v2/{endpoint}',
        method='DELETE',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status

def main():
    load_env()
    token = os.environ.get('TODOIST_API_TOKEN')
    if not token:
        print("ERROR: TODOIST_API_TOKEN not found in .env")
        return

    # Get all projects for name mapping
    projects = api_get('projects', token)
    proj_map = {p['id']: p['name'] for p in projects}

    # Get all active tasks
    tasks = api_get('tasks', token)
    print(f"Total active tasks: {len(tasks)}\n")

    # Group by content (task name)
    by_content = defaultdict(list)
    for t in tasks:
        by_content[t['content']].append(t)

    # Find duplicates
    duplicates = {k: v for k, v in by_content.items() if len(v) > 1}

    if not duplicates:
        print("No duplicates found!")
        return

    print(f"Found {len(duplicates)} duplicate groups:\n")

    to_delete = []
    for content, task_list in sorted(duplicates.items()):
        print(f"  [{len(task_list)}x] {content}")
        # Sort by created_at, keep the oldest
        task_list.sort(key=lambda t: t.get('created_at', ''))
        for i, t in enumerate(task_list):
            proj_name = proj_map.get(t.get('project_id', ''), 'Unknown')
            marker = "KEEP" if i == 0 else "DELETE"
            print(f"       {marker}: id={t['id']} project={proj_name} created={t.get('created_at','?')}")
            if i > 0:
                to_delete.append(t)

    print(f"\nWill delete {len(to_delete)} duplicate tasks.")

    # Delete duplicates
    deleted = 0
    for t in to_delete:
        try:
            api_delete(f"tasks/{t['id']}", token)
            deleted += 1
            print(f"  Deleted: {t['content']} (id={t['id']})")
        except urllib.error.HTTPError as e:
            print(f"  Failed to delete {t['id']}: {e}")

    print(f"\nDone! Deleted {deleted}/{len(to_delete)} duplicates.")

if __name__ == '__main__':
    main()
