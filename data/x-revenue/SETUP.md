# X収益実験 セットアップ手順

## SP手動作業（1回だけ）

### 1. Xアカウント作成
- 新規メール: Gmail+エイリアス（例: `sp.xbot+rev1@gmail.com`）
- ハンドル例: `@ai_side_biz` 系（副業×AI感のある名前）
- **プロフ充実必須**（アイコン、ヘッダー、bio）
  - bio例: `AI×自動化で副業を効率化する人 | 実体験ベースで毎日発信 | 副業月5万→独立が目標`
- プロフURLにnote記事のURLを設定（Step 4の後）

### 2. IFTTT設定
- **新規IFTTTアカウント**を作成（既存molkkyhubとは分ける！巻き添え防止）
- Xアカウントを接続
- Applet作成:
  - Trigger: Webhooks → Receive a web request
  - Event Name: `post_tweet_exp`（メモしておく）
  - Action: X → Post a tweet
  - Tweet text: `{{Value1}}`
- Settings → Services → Webhooks → Documentation でキーを確認

### 3. GASデプロイ
1. https://script.google.com で新規プロジェクト作成（名前: X収益実験）
2. `gas/x-revenue/main.gs` の内容をコピペ
3. Google Sheetsで新規スプレッドシート作成（名前: X収益実験ログ）
   - Sheet IDをメモ（URLの `/d/` と `/edit` の間の文字列）
4. Script Properties を設定:
   - `GEMINI_API_KEY` — Google AI Studio で取得
   - `IFTTT_WEBHOOK_KEY` — Step 2で確認したキー
   - `IFTTT_EVENT_NAME` — `post_tweet_exp`
   - `SHEET_ID` — Step 3で作ったSheetのID

### 4. テスト
1. GASエディタで `testGeminiOnly` を実行 → ログにツイートが出ればOK
2. GASエディタで `testPost` を実行 → Sheetsにログが記録されればOK
3. `testPost` 内のコメントアウトを外して再実行 → Xに投稿されればOK

### 5. トリガー設定
- GASエディタで `createTriggers` を実行
- 4トリガーが作成される（07:00, 11:00, 15:00, 19:00 JST）
- 実際の投稿時刻は各時刻から0〜25分ランダムにズレる

### 6. note（ブログ）準備
- note.com で新規アカウント作成
- ジャンル: 副業・フリーランス・AI活用
- 5本程度の記事を下書き:
  1. 「副業を始めるために必要な手続き3つ」
  2. 「AIツールで作業時間を半分にした話」
  3. 「副業初月の売上を公開します」
  4. 「フリーランスの案件獲得、最初の1件の取り方」
  5. 「自動化で不労所得っぽい仕組みを作った方法」
- 記事内にアフィリリンク設置（#PR明記）

### 7. ASP登録
- **A8.net**: https://www.a8.net/ （最大手、案件数No.1）
- **もしもアフィリエイト**: https://af.moshimo.com/ （Amazon/楽天連携、W報酬）
- サイト登録時にnoteのURLを申請

## 運用スケジュール

| 期間 | やること |
|------|---------|
| Week 1 | 自動投稿開始。手動でもいくつかツイート。フォロー/いいねも手動で少し |
| Week 2 | Sheetsのログ確認。テンプレ微調整。凍結チェック |
| Week 3-4 | フォロワー増加ペース確認。note記事追加 |
| Month 2 | ブログ誘導開始（5投稿に1回程度、リプライで） |
| Month 3 | 成果判定。月1万超→拡大、未満→ジャンル変更 or 撤退 |

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| Gemini生成失敗 | API キー確認。無料枠（250RPD）超過なら翌日復旧 |
| IFTTT投稿失敗 | Xアカウント接続切れ→IFTTT側で再接続 |
| アカウント凍結 | 異議申立て。復旧しなければ新アカウントで再開 |
| Sheets書き込みエラー | SHEET_ID確認。シートへのアクセス権限確認 |
