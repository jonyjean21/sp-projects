#!/usr/bin/env python3
"""Google Drive共有フォルダから最新の文字起こしファイル一覧を取得・ダウンロード"""
import subprocess
import re
import sys
import os
import json

DRIVE_FOLDER = "https://drive.google.com/drive/u/1/folders/1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "meet_transcripts")

def list_files():
    """gdownでフォルダ内のファイル一覧を取得"""
    result = subprocess.run(
        ["gdown", "--folder", DRIVE_FOLDER, "-O", "/tmp/gdrive_list", "--remaining-ok"],
        capture_output=True, text=True, timeout=60
    )
    output = result.stdout + result.stderr

    files = []
    for line in output.split('\n'):
        match = re.search(r'Processing file (\S+)\s+(.+)', line)
        if match:
            file_id = match.group(1)
            filename = match.group(2).strip()
            # 日時を抽出
            date_match = re.search(r'(\d{4}[/-]\d{2}[/-]\d{2})\s+(\d{2}[:-]\d{2})', filename)
            if date_match:
                date = date_match.group(1).replace('/', '-')
                time = date_match.group(2).replace('-', ':')
                files.append({
                    'id': file_id,
                    'filename': filename,
                    'date': date,
                    'time': time,
                    'is_pdf': filename.endswith('.pdf')
                })
    return files

def download_file(file_id, output_path):
    """Google DocをテキストとしてDL"""
    url = f"https://docs.google.com/document/d/{file_id}/export?format=txt"
    result = subprocess.run(
        ["curl", "-sL", url, "-o", output_path],
        capture_output=True, text=True, timeout=30
    )
    return os.path.exists(output_path) and os.path.getsize(output_path) > 100

def get_latest(n=5):
    """最新n件のファイルを取得"""
    files = list_files()
    # Google Docs only (PDFはスキップ)
    docs = [f for f in files if not f['is_pdf']]
    # 日付順ソート
    docs.sort(key=lambda x: x['date'] + x['time'], reverse=True)
    return docs[:n]

if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'list'

    if action == 'list':
        files = list_files()
        docs = [f for f in files if not f['is_pdf']]
        docs.sort(key=lambda x: x['date'] + x['time'], reverse=True)
        for f in docs[:20]:
            print(f"{f['date']} {f['time']} | {f['id']} | {f['filename']}")

    elif action == 'download':
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        latest = get_latest(n)
        for f in latest:
            out = os.path.join(OUTPUT_DIR, f"meeting_{f['date']}.txt")
            if os.path.exists(out):
                print(f"  SKIP {f['date']} (already exists)")
                continue
            ok = download_file(f['id'], out)
            status = "OK" if ok else "FAIL"
            print(f"  {status} {f['date']} -> {out}")

    elif action == 'download-id':
        file_id = sys.argv[2]
        date = sys.argv[3] if len(sys.argv) > 3 else 'unknown'
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        out = os.path.join(OUTPUT_DIR, f"meeting_{date}.txt")
        ok = download_file(file_id, out)
        print(f"{'OK' if ok else 'FAIL'} -> {out}")
