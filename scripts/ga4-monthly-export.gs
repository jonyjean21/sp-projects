// ============================================================
// GA4 月次データ自動エクスポート for MOLKKY HUB
// ============================================================
// 【設定手順】
// 1. スプレッドシートを開く → 拡張機能 → Apps Script
// 2. このコードを全部貼り付け
// 3. 下の GA4_PROPERTY_ID を自分のものに書き換える
// 4. 左メニュー「サービス」→「+」→「Google Analytics Data API」を追加
// 5. setupTrigger() を1回実行（毎月1日朝7時に自動実行される）
// 6. monthlyExport() を手動実行して動作確認
// ============================================================

// === 設定（ここだけ書き換える） ===
const GA4_PROPERTY_ID = 'XXXXXXXXX'; // ← GA4のプロパティIDを入れる（数字のみ）
// 確認方法: GA管理画面 → 管理（左下の歯車）→ プロパティ設定 → プロパティID

// === メイン関数 ===
function monthlyExport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lastMonth = getLastMonthRange();
  const label = lastMonth.label; // 例: "2026-01"

  Logger.log('=== ' + label + ' のデータをエクスポート開始 ===');

  // 1. 月次サマリー
  exportMonthlySummary(ss, lastMonth);

  // 2. チャネル別セッション
  exportChannelSessions(ss, lastMonth);

  // 3. ページ別表示回数
  exportPageViews(ss, lastMonth);

  Logger.log('=== エクスポート完了 ===');
}

// === 先月の日付範囲を取得 ===
function getLastMonthRange() {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1);

  const format = function(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  return {
    startDate: format(firstOfLastMonth),
    endDate: format(lastOfLastMonth),
    label: firstOfLastMonth.getFullYear() + '-' + String(firstOfLastMonth.getMonth() + 1).padStart(2, '0')
  };
}

// === 1. 月次サマリー ===
function exportMonthlySummary(ss, dateRange) {
  var sheet = ss.getSheetByName('月次サマリー');
  if (!sheet) {
    sheet = ss.insertSheet('月次サマリー');
    sheet.appendRow(['年月', '総セッション', '総PV', '総イベント数', '新規ユーザー', 'エンゲージメント率']);
  }

  try {
    var report = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'eventCount' },
        { name: 'newUsers' },
        { name: 'engagementRate' }
      ]
    }, 'properties/' + GA4_PROPERTY_ID);

    if (report.rows && report.rows.length > 0) {
      var row = report.rows[0];
      sheet.appendRow([
        dateRange.label,
        Number(row.metricValues[0].value),
        Number(row.metricValues[1].value),
        Number(row.metricValues[2].value),
        Number(row.metricValues[3].value),
        (Number(row.metricValues[4].value) * 100).toFixed(1) + '%'
      ]);
      Logger.log('月次サマリー: OK');
    }
  } catch (e) {
    Logger.log('月次サマリーでエラー: ' + e.message);
  }
}

// === 2. チャネル別セッション ===
function exportChannelSessions(ss, dateRange) {
  var sheet = ss.getSheetByName('チャネル別');
  if (!sheet) {
    sheet = ss.insertSheet('チャネル別');
    sheet.appendRow(['年月', 'チャネル', 'セッション', 'PV', '新規ユーザー']);
  }

  try {
    var report = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'newUsers' }
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10
    }, 'properties/' + GA4_PROPERTY_ID);

    if (report.rows) {
      report.rows.forEach(function(row) {
        sheet.appendRow([
          dateRange.label,
          row.dimensionValues[0].value,
          Number(row.metricValues[0].value),
          Number(row.metricValues[1].value),
          Number(row.metricValues[2].value)
        ]);
      });
      Logger.log('チャネル別: ' + report.rows.length + '行');
    }
  } catch (e) {
    Logger.log('チャネル別でエラー: ' + e.message);
  }
}

// === 3. ページ別表示回数 ===
function exportPageViews(ss, dateRange) {
  var sheet = ss.getSheetByName('ページ別');
  if (!sheet) {
    sheet = ss.insertSheet('ページ別');
    sheet.appendRow(['年月', 'ページパス', 'ページタイトル', '表示回数', 'セッション']);
  }

  try {
    var report = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' }
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 30
    }, 'properties/' + GA4_PROPERTY_ID);

    if (report.rows) {
      report.rows.forEach(function(row) {
        sheet.appendRow([
          dateRange.label,
          row.dimensionValues[0].value,
          row.dimensionValues[1].value,
          Number(row.metricValues[0].value),
          Number(row.metricValues[1].value)
        ]);
      });
      Logger.log('ページ別: ' + report.rows.length + '行');
    }
  } catch (e) {
    Logger.log('ページ別でエラー: ' + e.message);
  }
}

// === トリガー設定（1回だけ実行すればOK） ===
function setupTrigger() {
  // 既存のトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'monthlyExport') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 毎月1日 朝7時に実行
  ScriptApp.newTrigger('monthlyExport')
    .timeBased()
    .onMonthDay(1)
    .atHour(7)
    .create();

  Logger.log('トリガー設定完了: 毎月1日 7:00 に monthlyExport() を実行');
}

// === 手動実行用: 今月のデータを取得（テスト用） ===
function testExportCurrentMonth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const format = function(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };

  const dateRange = {
    startDate: format(firstOfMonth),
    endDate: format(now),
    label: now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '(途中)'
  };

  Logger.log('=== 今月のデータをテスト取得 ===');
  exportMonthlySummary(ss, dateRange);
  exportChannelSessions(ss, dateRange);
  exportPageViews(ss, dateRange);
  Logger.log('=== テスト完了 ===');
}
