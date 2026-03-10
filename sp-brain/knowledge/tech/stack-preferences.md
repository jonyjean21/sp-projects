# 技術スタック好み

## メインスタック
- フロントエンド: バニラ HTML/CSS/JS（ダーク/サイバーパンク風デザイン）
- ホスティング: GitHub Pages（mainブランチ / sp-projects）
- バックエンド: Vercel Serverless (Node.js)
- データベース: Firebase Realtime DB
- CMS: WordPress + SWELL（molkky-hub.com @ ConoHa）
- 自動化: Google Apps Script
- AI: Claude API (Sonnet/Opus)

## 使わないもの
- React/Vue/Angular（マルタ村は中さんがReactで開発。SPはバニラ）
- TypeScript（バニラJSで十分）
- Docker/Kubernetes（オーバーキル）
- 有料CI/CDツール（GitHub Actionsの無料枠で十分）

## 設計方針
- 1ファイル1アプリが理想
- 管理画面は必ず作る
- Firebase Realtime DBでデータ管理
- Vercel APIでWebhook/プロキシ
- GASで定期実行・外部連携
