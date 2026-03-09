# Todoist + Claude Code 連携セットアップ

> SPが1回だけやる手動作業（10分）

## Step 1: Todoist アカウント作成（持ってなければ）
- https://todoist.com で無料アカウント作成
- スマホアプリもインストール

## Step 2: Todoist のプロジェクト構成

以下のプロジェクトを作成:

| プロジェクト名 | 用途 |
|-------------|------|
| Inbox | ふとしたメモ全部ここ（デフォルト） |
| MOLKKY HUB | HUB関連タスク |
| マルタ村 | マルタ村/MACHAP関連 |
| 収益化 | BOOTH/note/Crowdworks等 |
| 開発 | GitHub Pages/GAS/Vercel |
| SPクローン | AI秘書システム自体の改善 |

## Step 3: Claude Code に MCP サーバー追加

ターミナルで以下を実行:
```bash
claude mcp add --transport http todoist https://ai.todoist.net/mcp
```

初回のみブラウザ認証が開く。許可すれば完了。

## Step 4: スマホの設定

### ウィジェット追加（1タップ入力）
- iOS: ホーム画面長押し → ウィジェット → Todoist → 「タスクを追加」
- Android: 同様にウィジェット追加

### Ramble（音声入力）設定
- Todoist アプリ内の Quick Add で波形アイコンをタップ
- 話すだけでタスク化される
- 無料プラン: 月10回。足りなければ Pro（月$4〜5）

## Step 5: 自然言語入力のコツ

Todoist は自然言語を理解する:
```
明日 記事の構成案作る #MOLKKYHUB p1
→ 明日期限、MOLKKY HUBプロジェクト、優先度1 でタスク作成

来週月曜 パートナー連絡 #収益化
→ 来週月曜期限、収益化プロジェクト

毎週金曜 週次レポート確認 #SPクローン
→ 繰り返しタスク
```

## 使い方（セットアップ後）

```
1. ふと思いついたら → スマホで Todoist に入力（3秒）
2. PC開いたら → Claude Code セッション開始
3. /secretary → Todoist の Inbox を自動取得 → 分類・タスク化
4. 作業 → 完了したらClaude Code が Todoist のタスクも完了に
```

## コスト

| 項目 | 料金 |
|------|------|
| Todoist 無料プラン | ¥0 |
| MCP連携 | ¥0 |
| Ramble（音声）10回/月 | ¥0 |
| Pro にアップグレード（任意） | 月¥500〜700 |
