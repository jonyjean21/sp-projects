# バックオフィス部長 — 議事録・大会情報・GA4・ルーチン管理

## 概要
チャプチェ会議事録、大会情報収集、GA4分析、月次ルーチンなど、
定型業務の自動化と運用を統括する部長AI。既に最も自動化が進んでいる部門。

## 使い方
- `/backoffice-director <指示>` — バックオフィス関連の指示を受けて分解・実行
- `/backoffice-director queue` — 全キューの未処理状況を確認
- `/backoffice-director monthly` — 月次ルーチンを一括実行
- `/backoffice-director analytics` — GA4/Search Console分析レポート生成

## 配下の社員AI（既存スキル活用）

| 役割 | 使用スキル | 担当 |
|------|----------|------|
| 議事録担当 | `/chapche-minutes` | Google Meet → 議事録 → Notion |
| 大会情報担当 | `/tournament` | RSS → Firebase → WP投稿 |

## 管轄範囲

### 1. チャプチェ会議事録（自動化済み）
- パイプライン: Google Meet → Gemini文字起こし → GAS → Firebase → Claude → Notion
- キュー: `https://viisi-master-app-default-rtdb.firebaseio.com/chapche-queue`
- スキル: `/chapche-minutes`
- GAS: `gas/chapche-auto/main.gs`

### 2. 大会情報収集（自動化済み）
- パイプライン: RSS(molkky.jp + Kokuchpro) → GAS → Firebase → Claude → WP
- キュー: `https://viisi-master-app-default-rtdb.firebaseio.com/tournament-queue`
- スキル: `/tournament`
- GAS: `gas/tournament-collector/`

### 3. GA4分析（半自動）
- GAS: `scripts/ga4-monthly-export.gs`
- ダッシュボード: `hub-dashboard/index.html`
- セットアップ: `docs/setup-guides/01-ga4-export-setup.md`

### 4. 月次ルーチン
参照: `tasks/current.md` の「月次ルーチン」セクション

## キュー確認（`/backoffice-director queue`）

Firebase の全キューを一括チェック:
```bash
# チャプチェ会キュー
curl -s "https://viisi-master-app-default-rtdb.firebaseio.com/chapche-queue.json?orderBy=%22status%22&equalTo=%22pending%22"

# 大会情報キュー
curl -s "https://viisi-master-app-default-rtdb.firebaseio.com/tournament-queue.json?orderBy=%22status%22&equalTo=%22pending%22"
```

結果を以下の形式で報告:
```
■ キュー状況（{日時}）
├── チャプチェ会: {N}件 未処理
│   └── {日付}: {タイトル}
├── 大会情報: {N}件 未処理
│   └── {大会名}: {日程}
└── 合計: {N}件
```

## 月次ルーチン（`/backoffice-director monthly`）

毎月初に以下を一括実行:

### Step 1: GA4データ取得
- チャネル別セッション数
- Search Console クエリTOP20
- 主要ページ表示回数TOP5

### Step 2: 分析レポート作成
```
# {YYYY年M月} MOLKKY HUB 月次レポート

## トラフィック
| チャネル | セッション | 前月比 |
|---------|----------|--------|
| Organic Search | {数} | {+/-}% |
| Organic Social | {数} | {+/-}% |
| Direct | {数} | {+/-}% |

## 検索パフォーマンス
| キーワード | 表示回数 | クリック数 | CTR | 順位 |
|-----------|---------|----------|-----|------|

## 推奨アクション
1. {アクション}（根拠: {データ}）
```

### Step 3: tasks/current.md 更新
- 完了タスクを `tasks/done.md` に移動
- 新しいアクションアイテムを追加

## 注意
- Firebase RTDB: viisi-master-app プロジェクト
- Notion投稿時は NOTION_TOKEN を `.env` から読み取り
- GA4データは公開しない（内部管理用）
- session-start.sh が未処理キューを自動検知するので、このスキルは補完的に使う
