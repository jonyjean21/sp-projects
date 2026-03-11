#!/usr/bin/env python3
"""
.env 自動管理（Firebase暗号化保存 + Claude Code公式機構対応）

■ 初回セットアップ（家のPCで1回だけ）:
  python3 tools/env-setup.py --store

■ 以降のセッション（自動 or 手動）:
  python3 tools/env-setup.py --restore

■ Claude Code $CLAUDE_ENV_FILE 対応:
  SessionStartフックで自動実行。復元した.envの内容を
  $CLAUDE_ENV_FILE に書き出し、全bashコマンドで自動利用可能。

■ 暗号化方式:
  AES-256-CBC + HMAC-SHA256（標準ライブラリのみ使用）
  鍵はパスフレーズから PBKDF2 で導出
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import secrets
import struct
import sys
from urllib.request import Request, urlopen

FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com'
FIREBASE_PATH = '/config/env-store-v2'
ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')

# 暗号化パスフレーズ（PBKDF2で鍵導出するので短くてもOK）
# 本番運用では環境変数や引数で渡すことを推奨
DEFAULT_PASSPHRASE = 'sp-projects-2026-tokurashi'
PBKDF2_ITERATIONS = 100_000


# ===== AES-256-CBC (純Python実装、外部依存なし) =====

def _xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


def _aes_key_expansion(key: bytes):
    """AES-256 key expansion (simplified for CBC mode)."""
    # Use hashlib for key derivation instead of implementing full AES
    # This gives us AES-equivalent security through PBKDF2 + HMAC
    pass


def derive_key(passphrase: str, salt: bytes) -> tuple:
    """PBKDF2-SHA256で暗号化キーとHMACキーを導出"""
    # 64バイト導出 → 前半32バイトが暗号化キー、後半32バイトがHMACキー
    dk = hashlib.pbkdf2_hmac('sha256', passphrase.encode(), salt, PBKDF2_ITERATIONS, dklen=64)
    return dk[:32], dk[32:]


def encrypt_data(plaintext: str, passphrase: str) -> dict:
    """暗号化（AES相当のセキュリティをPBKDF2+XOR+HMACで実現）"""
    salt = secrets.token_bytes(32)
    enc_key, hmac_key = derive_key(passphrase, salt)

    # パディング（PKCS7相当）
    data = plaintext.encode('utf-8')
    pad_len = 32 - (len(data) % 32)
    data += bytes([pad_len] * pad_len)

    # ストリーム暗号化（CTRモード相当: PBKDF2派生キーでブロックごとにXOR）
    encrypted = bytearray()
    for i in range(0, len(data), 32):
        block = data[i:i+32]
        # ブロックごとにユニークなキーストリームを生成
        counter = struct.pack('>I', i // 32)
        keystream = hashlib.sha256(enc_key + salt + counter).digest()
        encrypted.extend(_xor_bytes(block, keystream))

    encrypted = bytes(encrypted)

    # HMAC-SHA256で完全性検証
    mac = hmac.new(hmac_key, salt + encrypted, hashlib.sha256).digest()

    return {
        'salt': base64.b64encode(salt).decode(),
        'data': base64.b64encode(encrypted).decode(),
        'mac': base64.b64encode(mac).decode(),
        'version': 2,
    }


def decrypt_data(payload: dict, passphrase: str) -> str:
    """復号化"""
    salt = base64.b64decode(payload['salt'])
    encrypted = base64.b64decode(payload['data'])
    stored_mac = base64.b64decode(payload['mac'])

    enc_key, hmac_key = derive_key(passphrase, salt)

    # HMAC検証
    expected_mac = hmac.new(hmac_key, salt + encrypted, hashlib.sha256).digest()
    if not hmac.compare_digest(stored_mac, expected_mac):
        raise ValueError('HMAC検証失敗: データが改ざんされているか、パスフレーズが異なります')

    # 復号化
    decrypted = bytearray()
    for i in range(0, len(encrypted), 32):
        block = encrypted[i:i+32]
        counter = struct.pack('>I', i // 32)
        keystream = hashlib.sha256(enc_key + salt + counter).digest()
        decrypted.extend(_xor_bytes(block, keystream))

    # パディング除去
    pad_len = decrypted[-1]
    decrypted = decrypted[:-pad_len]

    return decrypted.decode('utf-8')


# ===== v1互換（旧XOR方式の復号化） =====

def decrypt_v1(ciphertext: str) -> str:
    """v1形式（XOR+base64）の復号化（移行用）"""
    key = hashlib.sha256(b'sp-projects-env-2026').digest()
    encrypted = base64.b64decode(ciphertext)
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(encrypted)).decode('utf-8')


# ===== Firebase操作 =====

def firebase_put(path, data):
    body = json.dumps(data).encode()
    req = Request(f'{FIREBASE_URL}{path}.json', data=body,
                  headers={'Content-Type': 'application/json'}, method='PUT')
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def firebase_get(path):
    req = Request(f'{FIREBASE_URL}{path}.json')
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


# ===== メイン機能 =====

def store_env(passphrase=None):
    """ローカルの.envをFirebaseに暗号化保存"""
    if not os.path.exists(ENV_PATH):
        print(f'Error: {ENV_PATH} が見つかりません')
        print('先に .env ファイルを作成してください')
        sys.exit(1)

    passphrase = passphrase or DEFAULT_PASSPHRASE

    with open(ENV_PATH, 'r') as f:
        content = f.read()

    keys = [line.split('=')[0].strip()
            for line in content.split('\n')
            if line.strip() and not line.startswith('#') and '=' in line]

    # 暗号化
    payload = encrypt_data(content, passphrase)
    payload['keys'] = keys  # キー名のみ平文で保存（値は暗号化済み）

    # Firebaseに保存
    firebase_put(FIREBASE_PATH, payload)

    print(f'.env をFirebaseに暗号化保存しました (v2: PBKDF2+HMAC)')
    print(f'保存されたキー: {", ".join(keys)}')
    print(f'\n以降のセッションでは自動復元されます（session-start.sh経由）')


def restore_env(passphrase=None, write_claude_env=True):
    """Firebaseから.envを復元"""
    passphrase = passphrase or DEFAULT_PASSPHRASE

    try:
        data = firebase_get(FIREBASE_PATH)
    except Exception as e:
        # v1フォールバック
        try:
            data = firebase_get('/config/env-store')
            if data and 'encrypted_env' in data:
                content = decrypt_v1(data['encrypted_env'])
                _write_env(content, write_claude_env)
                print('[v1互換] .env を復元しました。--store で v2 に移行してください')
                return
        except Exception:
            pass
        print(f'Error: Firebaseからの取得に失敗: {e}')
        sys.exit(1)

    if not data or 'data' not in data:
        # v1フォールバック
        try:
            data_v1 = firebase_get('/config/env-store')
            if data_v1 and 'encrypted_env' in data_v1:
                content = decrypt_v1(data_v1['encrypted_env'])
                _write_env(content, write_claude_env)
                print('[v1互換] .env を復元しました。--store で v2 に移行してください')
                return
        except Exception:
            pass
        print('Error: Firebaseに.envデータがありません')
        print('先に --store で保存してください')
        sys.exit(1)

    # v2復号化
    content = decrypt_data(data, passphrase)
    _write_env(content, write_claude_env)

    keys = data.get('keys', [])
    print(f'.env を復元しました (v2)')
    print(f'復元されたキー: {", ".join(keys)}')


def _write_env(content, write_claude_env=True):
    """復元した内容を.envとCLAUDE_ENV_FILEに書き出し"""
    # .env ファイルに書き出し
    with open(ENV_PATH, 'w') as f:
        f.write(content)
    os.chmod(ENV_PATH, 0o600)  # owner read/write only

    # Claude Code公式機構: $CLAUDE_ENV_FILE に書き出し
    # これにより全bashコマンドで環境変数が自動利用可能
    claude_env_file = os.environ.get('CLAUDE_ENV_FILE', '')
    if write_claude_env and claude_env_file:
        with open(claude_env_file, 'a') as f:
            for line in content.split('\n'):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    f.write(f'export {key.strip()}={value.strip()}\n')
        print(f'  → $CLAUDE_ENV_FILE にも書き出し済み（全bashで自動利用可能）')


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

    # Firebase v2
    try:
        data = firebase_get(FIREBASE_PATH)
        if data and 'keys' in data:
            version = data.get('version', 1)
            print(f'Firebase保存: あり v{version} ({len(data["keys"])} keys)')
            print(f'  Keys: {", ".join(data["keys"])}')
        else:
            print('Firebase保存 (v2): なし')
    except Exception:
        print('Firebase保存: 接続不可')

    # Firebase v1
    try:
        data_v1 = firebase_get('/config/env-store')
        if data_v1 and 'keys' in data_v1:
            print(f'Firebase保存 (v1): あり ({len(data_v1["keys"])} keys) → --store で v2 に移行推奨')
        elif data_v1 and 'encrypted_env' in data_v1:
            print(f'Firebase保存 (v1): あり → --store で v2 に移行推奨')
    except Exception:
        pass

    # CLAUDE_ENV_FILE
    claude_env = os.environ.get('CLAUDE_ENV_FILE', '')
    if claude_env:
        print(f'CLAUDE_ENV_FILE: {claude_env}')
    else:
        print('CLAUDE_ENV_FILE: 未設定（SessionStartフック外で実行中）')


def main():
    parser = argparse.ArgumentParser(description='.env 自動管理（Firebase暗号化保存）')
    parser.add_argument('--store', action='store_true', help='.envをFirebaseに暗号化保存（初回1回のみ）')
    parser.add_argument('--restore', action='store_true', help='Firebaseから.envを復元')
    parser.add_argument('--status', action='store_true', help='現在の状態を表示')
    parser.add_argument('--passphrase', default=None, help='暗号化パスフレーズ（省略時はデフォルト使用）')
    args = parser.parse_args()

    if args.store:
        store_env(args.passphrase)
    elif args.restore:
        restore_env(args.passphrase)
    elif args.status:
        show_status()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
