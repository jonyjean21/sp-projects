# GitHub Secrets 設定（AI Clone 稼働開始に必要）

**優先度**: 高（これやらないとAI Cloneが動かない）
**所要時間**: 2分

## やること

GitHub → Settings → Secrets and variables → Actions で2つ追加:

1. `ANTHROPIC_API_KEY` → Anthropic ConsoleのAPIキー
2. `FIREBASE_URL` → `https://viisi-master-app-default-rtdb.firebaseio.com`

## 設定したら

翌朝8:00 JSTからAI Cloneが自動稼働開始。
手動テストしたい場合: Actions → 「SP Clone - Daily Auto Tasks」→ Run workflow → morning-review
