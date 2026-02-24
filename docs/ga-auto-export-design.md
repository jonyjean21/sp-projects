# GA4 データ自動エクスポート 設計メモ

> 作成日: 2026-02-24

## 目的

GA4のデータを毎月自動でスプレッドシートに出力し、チャットベースで状況確認・分析できるようにする。

## 現状の課題

- GA4のデータを確認するには毎回GAの管理画面にログインする必要がある
- PC時間が限られている → データ確認だけで時間を取られたくない
- チャットで「先月どうだった？」と聞いたときに即答できる状態にしたい

## 構成

```
GA4（molkky-hub.com）
  │
  ▼ GAS（毎月1日にトリガー実行）
  │
  ├── GA4 Data API でデータ取得
  │   ├── チャネル別セッション数
  │   ├── 主要ページ別表示回数
  │   ├── 検索クエリTOP20（Search Console連携）
  │   └── イベント数・コンバージョン
  │
  ▼
Google スプレッドシート（月別シートに自動記録）
  │
  ▼
チャットでSPさんがデータを共有 → 分析・提案
```

## 出力先スプレッドシート

https://docs.google.com/spreadsheets/d/1z9bmgRvXAlWFLoARZSM7mAiosrEuy7jkSF6jh82T1So/

## 取得するデータ

### シート1: 月次サマリー

| 列 | 内容 |
|----|------|
| A | 年月 |
| B | 総セッション |
| C | 総表示回数（PV） |
| D | 総イベント数 |
| E | Organic Social セッション |
| F | Google Organic セッション |
| G | Bing Organic セッション |
| H | Direct セッション |
| I | 前月比（自動計算） |

### シート2: ページ別表示回数

| 列 | 内容 |
|----|------|
| A | 年月 |
| B | ページパス |
| C | ページタイトル |
| D | 表示回数 |
| E | セッション |
| F | 前月比（自動計算） |

### シート3: 検索クエリ（Search Console）

| 列 | 内容 |
|----|------|
| A | 年月 |
| B | クエリ |
| C | 表示回数 |
| D | クリック数 |
| E | CTR |
| F | 平均掲載順位 |

## GAS スクリプトの概要

```javascript
// === 設定 ===
const GA4_PROPERTY_ID = 'XXXXXXXXX'; // GA4のプロパティID
const SPREADSHEET_ID = '1z9bmgRvXAlWFLoARZSM7mAiosrEuy7jkSF6jh82T1So';

// === メイン関数（毎月1日にトリガー実行） ===
function monthlyExport() {
  const lastMonth = getLastMonthRange();

  // 1. チャネル別セッション
  exportChannelSessions(lastMonth);

  // 2. ページ別表示回数
  exportPageViews(lastMonth);

  // 3. Search Console クエリ（別途 Search Console API が必要）
  // exportSearchQueries(lastMonth);
}

// === GA4 Data API でチャネル別セッション取得 ===
function exportChannelSessions(dateRange) {
  const request = AnalyticsData.newRunReportRequest();
  request.dateRanges = [dateRange];
  request.dimensions = [{ name: 'sessionDefaultChannelGroup' }];
  request.metrics = [
    { name: 'sessions' },
    { name: 'screenPageViews' },
    { name: 'eventCount' }
  ];

  const report = AnalyticsData.Properties.runReport(request, 'properties/' + GA4_PROPERTY_ID);
  // → スプレッドシートに書き込み
}

// === 月1回のトリガー設定 ===
function createMonthlyTrigger() {
  ScriptApp.newTrigger('monthlyExport')
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .create();
}
```

## 導入手順

### Step 1: GASプロジェクト作成（15分）

1. スプレッドシートを開く → 拡張機能 → Apps Script
2. 上記コードを貼り付け
3. GA4のプロパティIDを入力

### Step 2: GA4 Data API を有効化（10分）

1. Apps Script エディタ → サービス → 「Google Analytics Data API」を追加
2. 初回実行時にOAuth認証を承認

### Step 3: トリガー設定（5分）

1. `createMonthlyTrigger()` を1回実行
2. 毎月1日の朝6時に自動実行される

### Step 4: 動作確認（10分）

1. `monthlyExport()` を手動実行してデータが出力されるか確認
2. スプレッドシートに月次データが記録されていればOK

## Search Console 連携（オプション）

GA4 Data APIだけではSearch Consoleのクエリデータは取れない。
Search Console APIも併用する場合:

1. GASで「Search Console API」サービスを追加
2. `Webmasters.Searchanalytics.query()` でクエリデータを取得
3. 同じスプレッドシートの別シートに出力

→ まずはGA4データだけで始めて、必要に応じてSC連携を追加する方が現実的。

## コスト

無料（GA4 Data API、GAS、Google スプレッドシートすべて無料）

## 次のアクション

- [ ] GA4 のプロパティIDを確認（GA管理画面 → プロパティ設定）
- [ ] スプレッドシートに月次サマリー用のシートを準備
- [ ] GAS スクリプトを作成・設定
- [ ] 毎月1日のトリガーを設定
- [ ] 初回手動実行で動作確認
