#!/usr/bin/env python3
"""
.env ファイルのセットアップ（Firebase経由で自動復元）

初回: python3 tools/env-setup.py --store   # .envをFirebaseに暗号化保存
以降: python3 tools/env-setup.py --restore  # Firebaseから.envを復元

暗号化にはXOR + base64を使用（簡易暗号化。機密性が必要な場合はAES推奨）
"""

import argparse
import base64
import hashlib
import json
import os
import sys
from urllib.request import Request, urlopen

FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com'
FIREBASE_PATH = '/config/env-store'
ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')

# 暗号化キー（リポジトリ名+固定salt。本格運用ならユーザー入力のパスフレーズに変更）
ENCRYPT_KEY = hashlib.sha256(b'sp-projects-env-2026').digest()


def xor_crypt(data: bytes, key: bytes) -> bytes:
    """XOR暗号化/復号化"""
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def encrypt(plaintext: str) -> str:
    """文字列を暗号化してbase64エンコード"""
    encrypted = xor_crypt(plaintext.encode('utf-8'), ENCRYPT_KEY)
    return base64.b64encode(encrypted).decode('ascii')


def decrypt(ciphertext: str) -> str:
    """base64デコードして復号化"""
    encrypted = base64.b64decode(ciphertext)
    return xor_crypt(encrypted, ENCRYPT_KEY).decode('utf-8')


def store_env():
    """ローカルの.envをFirebaseに暗号化保存"""
    if not os.path.exists(ENV_PATH):
        print(f'Error: {ENV_PATH} が見つかりません')
        print('先に .env ファイルを作成してください')
        sys.exit(1)

    with open(ENV_PATH, 'r') as f:
        content = f.read()

    # 暗号化
    encrypted = encrypt(content)

    # Firebaseに保存
    data = json.dumps({
        'encrypted_env': encrypted,
        'keys': [line.split('=')[0].strip()
                 for line in content.split('\n')
                 if line.strip() and not line.startswith('#') and '=' in line],
    }).encode()

    req = Request(f'{FIREBASE_URL}{FIREBASE_PATH}.json', data=data,
                  headers={'Content-Type': 'application/json'}, method='PUT')
    with urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())

    keys = [line.split('=')[0].strip()
            for line in content.split('\n')
            if line.strip() and not line.startswith('#') and '=' in line]

    print(f'.env をFirebaseに暗号化保存しました')
    print(f'保存されたキー: {", ".join(keys)}')
    print(f'\n以降のセッションでは以下で復元できます:')
    print(f'  python3 tools/env-setup.py --restore')


def restore_env():
    """Firebaseから.envを復元"""
    try:
        req = Request(f'{FIREBASE_URL}{FIREBASE_PATH}.json')
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f'Error: Firebaseからの取得に失敗: {e}')
        print('先に --store で保存してください')
        sys.exit(1)

    if not data or 'encrypted_env' not in data:
        print('Error: Firebaseに.envデータがありません')
        print('先に --store で保存してください')
        sys.exit(1)

    # 復号化
    content = decrypt(data['encrypted_env'])

    # .envに書き出し
    with open(ENV_PATH, 'w') as f:
        f.write(content)

    keys = data.get('keys', [])
    print(f'.env を復元しました')
    print(f'復元されたキー: {", ".join(keys)}')


def show_status():
    """現在の状態を表示"""
    # ローカル.env
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, 'r') as f:
            lines = [l for l in f.readlines() if l.strip() and not l.startswith('#') and '=' in l]
        keys = [l.split('=')[0].strip() for l in lines]
        print(f'ローカル .env: あり ({len(keys)} keys)')
        print(f'  Keys: {", ".join(keys)}')
    else:
        print('ローカル .env: なし')

    # Firebase
    try:
        req = Request(f'{FIREBASE_URL}{FIREBASE_PATH}.json')
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        if data and 'keys' in data:
            print(f'Firebase保存: あり ({len(data["keys"])} keys)')
            print(f'  Keys: {", ".join(data["keys"])}')
        else:
            print('Firebase保存: なし')
    except Exception:
        print('Firebase保存: 確認不可')


def main():
    parser = argparse.ArgumentParser(description='.env セットアップ（Firebase経由）')
    parser.add_argument('--store', action='store_true', help='.envをFirebaseに暗号化保存')
    parser.add_argument('--restore', action='store_true', help='Firebaseから.envを復元')
    parser.add_argument('--status', action='store_true', help='現在の状態を表示')
    args = parser.parse_args()

    if args.store:
        store_env()
    elif args.restore:
        restore_env()
    elif args.status:
        show_status()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
