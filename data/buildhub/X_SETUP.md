# BuildHub X (@buildhub_jp) セットアップ手順

## ステップ1: Xアカウント作成（5分）

1. https://x.com → 「アカウントを作成」
2. メールアドレス: **buildhub.jp@gmail.com** を新規作成（または既存で管理しやすいもの）
3. ハンドル: `@buildhub_jp`（取れなければ `@buildhub_jp_` 等）
4. プロフィール設定:
   - 名前: **BuildHub編集部**
   - Bio: `Claude Code・AI開発ツールの最前線を毎日お届け｜自動化・個人開発者向け情報メディア｜buildhub.jp`
   - ウェブサイト: `https://www.buildhub.jp`
   - アイコン: BuildHubロゴ（メディア ID=29 のやつ）

## ステップ2: IFTTTでBuildhub記事→X自動投稿（5分）

**目的**: 毎朝7時に記事が公開されると自動でXにポスト

1. https://ifttt.com (molkkyhub@gmail.com でログイン済み)
2. 「Create」→ 「If This」→ 「RSS Feed」→ 「New feed item」
   - Feed URL: `https://www.buildhub.jp/feed/`
3. 「Then That」→ 「X (Twitter)」→ `@buildhub_jp` を連携
   - 「Post a tweet」を選択
   - Tweet text:
     ```
     📰 {{EntryTitle}}

     {{EntryUrl}}

     #ClaudeCode #AI開発
     ```
4. Applet名: `BuildHub記事→X自動投稿`
5. 保存

## ステップ3: GASデプロイ（10分）

**目的**: 1日2回（9時・20時）AIツールTipsを自動生成してX投稿

1. https://script.google.com → 新規プロジェクト
2. プロジェクト名: `BuildHub X自動投稿`
3. `main.gs` の内容を `gas/buildhub-x/main.gs` からコピペ
4. スクリプトプロパティを設定（プロジェクト設定→スクリプトプロパティ）:
   | キー | 値 |
   |------|-----|
   | `GEMINI_API_KEY` | .envの値 |
   | `IFTTT_WEBHOOK_KEY` | .envの`IFTTT_WEBHOOK_KEY` |
   | `IFTTT_EVENT_NAME` | `buildhub_tweet`（次のステップで作るIFTTT eventと合わせる） |
5. `testGeminiOnly()` を実行して生成確認
6. `createTriggers()` を1回実行してトリガー登録

## ステップ4: IFTTTでGAS→X Webhookを追加（3分）

1. IFTTT → 「Create」→ 「If This」→ 「Webhooks」→ 「Receive a web request」
   - Event Name: `buildhub_tweet`
2. 「Then That」→ 「X (Twitter)」→ `@buildhub_jp`
   - 「Post a tweet」→ テキスト: `{{Value1}}`
3. 保存

---

## 完成後の自動フロー

```
毎朝7時  ConoHa WING cron → BuildHub記事公開
              ↓
         IFTTT RSS検知 → @buildhub_jp に記事ポスト

毎日9時・20時  GAS → Gemini でTips生成
              ↓
         IFTTT Webhook → @buildhub_jp に投稿
```

1日3ポスト（記事1 + Tips2）の安定発信体制になります。
