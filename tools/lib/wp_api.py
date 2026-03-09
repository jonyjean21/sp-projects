"""
MOLKKY HUB WordPress API 共通ライブラリ
認証情報は .env から読み取る（ハードコードしない）
"""

import base64
import json
import os
import urllib.request
import urllib.parse

ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
WP_SITE = 'https://molkky-hub.com'


def load_env(env_path=None):
    """Load .env file and return dict"""
    path = env_path or ENV_PATH
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            key, _, val = line.partition('=')
            env[key.strip()] = val.strip()
    return env


def _auth_header(env):
    """Generate Basic auth header"""
    cred = f"{env['WP_USER']}:{env['WP_APP_PASSWORD']}"
    return f"Basic {base64.b64encode(cred.encode()).decode()}"


def wp_get(env, endpoint, params=None):
    """WP REST API GET request"""
    url = f"{WP_SITE}/wp-json/wp/v2/{endpoint}"
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)
    req.add_header('Authorization', _auth_header(env))
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def wp_post(env, endpoint, data):
    """WP REST API POST request"""
    url = f"{WP_SITE}/wp-json/wp/v2/{endpoint}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Authorization', _auth_header(env))
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def wp_upload_media(env, filepath, filename):
    """Upload image to WP media library"""
    url = f"{WP_SITE}/wp-json/wp/v2/media"
    with open(filepath, 'rb') as f:
        img_data = f.read()
    req = urllib.request.Request(url, data=img_data, method='POST')
    req.add_header('Authorization', _auth_header(env))
    req.add_header('Content-Type', 'image/jpeg')
    req.add_header('Content-Disposition', f'attachment; filename="{filename}"')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())
