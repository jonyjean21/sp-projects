#!/usr/bin/env python3
"""Google Meet Gemini メモからノート部分（まとめ+詳細+次のステップ）を抽出する"""
import sys
import re

def extract_notes(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 「📖 文字起こし」の前までがノート部分
    markers = ['📖 文字起こし', '📖\u3000文字起こし']
    for marker in markers:
        idx = content.find(marker)
        if idx != -1:
            return content[:idx].strip()

    # マーカーが見つからない場合はそのまま返す（短いメモかも）
    return content.strip()

def extract_meeting_date(content):
    """会議日時を抽出"""
    match = re.search(r'会議\s+(\d{4}年\d{1,2}月\d{1,2}日)\s+(\d{1,2}:\d{2})\s+JST', content)
    if match:
        return match.group(1), match.group(2)
    return None, None

def extract_sections(content):
    """まとめ・詳細・次のステップに分割"""
    sections = {}

    # まとめ
    summary_match = re.search(r'まとめ\n(.+?)(?=\n\n詳細|\n詳細)', content, re.DOTALL)
    if summary_match:
        sections['summary'] = summary_match.group(1).strip()

    # 詳細
    detail_match = re.search(r'詳細\n(.+?)(?=\n\n推奨される次のステップ|\n推奨される次のステップ)', content, re.DOTALL)
    if detail_match:
        sections['details'] = detail_match.group(1).strip()

    # 推奨される次のステップ
    steps_match = re.search(r'推奨される次のステップ\n(.+?)(?=\n\nGemini|\Z)', content, re.DOTALL)
    if steps_match:
        sections['next_steps'] = steps_match.group(1).strip()

    return sections

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python extract_meeting_notes.py <filepath> [section]")
        print("  section: all (default), summary, details, next_steps")
        sys.exit(1)

    filepath = sys.argv[1]
    section = sys.argv[2] if len(sys.argv) > 2 else 'all'

    notes = extract_notes(filepath)

    if section == 'all':
        print(notes)
    else:
        sections = extract_sections(notes)
        if section in sections:
            print(sections[section])
        else:
            print(f"Section '{section}' not found. Available: {list(sections.keys())}")
