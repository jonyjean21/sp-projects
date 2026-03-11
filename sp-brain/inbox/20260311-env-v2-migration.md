# .env v2暗号化への移行タスク

## やること
家のPCで1回だけ実行:
```bash
python3 tools/env-setup.py --store
```

## 背景
- env-setup.py をXOR暗号→PBKDF2+HMAC(v2)に改修済み
- 現在Firebaseにはv1形式のデータしかない
- --storeを実行するとv2形式で再暗号化保存される
- 以降のセッションではv2で自動復元 + $CLAUDE_ENV_FILE対応

## 優先度
低め（v1フォールバックがあるので急がない。次に家で作業する時でOK）
