/**
 * モルハブ向上委員会ダッシュボード — GAS Data Sync
 *
 * GA4 Data API + Search Console API からデータを取得し、
 * Web App として JSON を返す。ダッシュボードが直接フェッチする。
 *
 * セットアップ:
 *   1. GASエディタで「サービス」→ AnalyticsData (Google Analytics Data API) を追加
 *   2. スクリプトプロパティに GA4_PROPERTY_ID を設定
 *      （findMyGA4Property() を実行すると自動で特定してくれる）
 *   3.「デプロイ」→「ウェブアプリ」→ 実行: 自分 / アクセス: 全員
 *   4. デプロイURLをダッシュボードの GAS_ENDPOINT に設定
 */

const SC_SITE_URL = 'https://molkky-hub.com/';
const MEASUREMENT_ID = 'G-6DV28MW59Z';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

// ===== Web App Entry =====

function doGet(e) {
  try {
    const forceRefresh = e && e.parameter && e.parameter.refresh === '1';
    const data = getDashboardData_(forceRefresh);
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== Cache (PropertiesService — persistent) =====

function getDashboardData_(forceRefresh) {
  const props = PropertiesService.getScriptProperties();

  if (!forceRefresh) {
    const cached = props.getProperty('DASHBOARD_CACHE');
    const ts = parseInt(props.getProperty('DASHBOARD_CACHE_TS') || '0');
    if (cached && (Date.now() - ts) < CACHE_TTL) {
      return JSON.parse(cached);
    }
  }

  const data = buildDashboardData_();
  const json = JSON.stringify(data);

  // PropertiesService: max 9KB per property
  if (json.length < 9000) {
    props.setProperty('DASHBOARD_CACHE', json);
    props.setProperty('DASHBOARD_CACHE_TS', String(Date.now()));
  }

  return data;
}

// ===== Timed Trigger (keeps cache warm) =====

function refreshCache() {
  const data = buildDashboardData_();
  const json = JSON.stringify(data);
  const props = PropertiesService.getScriptProperties();
  if (json.length < 9000) {
    props.setProperty('DASHBOARD_CACHE', json);
    props.setProperty('DASHBOARD_CACHE_TS', String(Date.now()));
  }
  Logger.log('Cache refreshed: ' + json.length + ' bytes');
}

// ===== Data Builder =====

function buildDashboardData_() {
  const now = new Date();
  const result = {
    lastUpdated: Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
    traffic: { months: [] },
    searchConsole: { months: [], topQueries: [] },
    sns: getSNSData_()
  };

  // GA4
  try {
    result.traffic = fetchGA4Traffic_();
  } catch (err) {
    Logger.log('GA4 error: ' + err.message);
    result.traffic.error = err.message;
  }

  // Search Console
  try {
    result.searchConsole = fetchSearchConsoleData_();
  } catch (err) {
    Logger.log('SC error: ' + err.message);
    result.searchConsole.error = err.message;
  }

  return result;
}

// ===== GA4 Data API =====

function fetchGA4Traffic_() {
  const propertyId = getPropertyId_();

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startDate = Utilities.formatDate(sixMonthsAgo, 'Asia/Tokyo', 'yyyy-MM-dd');
  const endDate = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

  const request = AnalyticsData.newRunReportRequest();
  request.dateRanges = [AnalyticsData.newDateRange()];
  request.dateRanges[0].startDate = startDate;
  request.dateRanges[0].endDate = endDate;

  request.dimensions = [AnalyticsData.newDimension()];
  request.dimensions[0].name = 'yearMonth';

  request.metrics = [
    Object.assign(AnalyticsData.newMetric(), { name: 'sessions' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'screenPageViews' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'totalUsers' })
  ];

  request.orderBys = [AnalyticsData.newOrderBy()];
  request.orderBys[0].dimension = AnalyticsData.newDimensionOrderBy();
  request.orderBys[0].dimension.dimensionName = 'yearMonth';

  const response = AnalyticsData.Properties.runReport(
    request, 'properties/' + propertyId
  );

  const months = [];
  if (response.rows) {
    response.rows.forEach(row => {
      const ym = row.dimensionValues[0].value; // "202602"
      months.push({
        month: ym.substring(0, 4) + '-' + ym.substring(4, 6),
        sessions: parseInt(row.metricValues[0].value),
        pv: parseInt(row.metricValues[1].value),
        users: parseInt(row.metricValues[2].value)
      });
    });
  }

  return { months };
}

// ===== Search Console API =====

function fetchSearchConsoleData_() {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startDate = Utilities.formatDate(sixMonthsAgo, 'Asia/Tokyo', 'yyyy-MM-dd');
  // SC data has ~3 day delay
  const endDate = Utilities.formatDate(
    new Date(now.getTime() - 3 * 86400000), 'Asia/Tokyo', 'yyyy-MM-dd'
  );

  const token = ScriptApp.getOAuthToken();
  const encodedUrl = encodeURIComponent(SC_SITE_URL);
  const baseUrl = 'https://searchconsole.googleapis.com/webmasters/v3/sites/'
    + encodedUrl + '/searchAnalytics/query';

  // Monthly data (by date, then aggregate)
  const monthlyRes = UrlFetchApp.fetch(baseUrl, {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      startDate: startDate,
      endDate: endDate,
      dimensions: ['date'],
      rowLimit: 25000
    })
  });

  const monthlyData = JSON.parse(monthlyRes.getContentText());
  const monthMap = {};

  if (monthlyData.rows) {
    monthlyData.rows.forEach(row => {
      const month = row.keys[0].substring(0, 7); // "2026-02"
      if (!monthMap[month]) {
        monthMap[month] = { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 };
      }
      monthMap[month].clicks += row.clicks;
      monthMap[month].impressions += row.impressions;
      monthMap[month].ctrSum += row.ctr;
      monthMap[month].posSum += row.position;
      monthMap[month].count++;
    });
  }

  const months = Object.keys(monthMap).sort().map(m => ({
    month: m,
    clicks: monthMap[m].clicks,
    impressions: monthMap[m].impressions,
    ctr: parseFloat((monthMap[m].ctrSum / monthMap[m].count * 100).toFixed(1)),
    position: parseFloat((monthMap[m].posSum / monthMap[m].count).toFixed(1))
  }));

  // Top queries (last 28 days)
  const queryRes = UrlFetchApp.fetch(baseUrl, {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      startDate: Utilities.formatDate(
        new Date(now.getTime() - 28 * 86400000), 'Asia/Tokyo', 'yyyy-MM-dd'
      ),
      endDate: endDate,
      dimensions: ['query'],
      rowLimit: 10
    })
  });

  const queryData = JSON.parse(queryRes.getContentText());
  const topQueries = (queryData.rows || []).map(row => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions
  }));

  return { months, topQueries };
}

// ===== SNS (manual — Script Properties) =====

function getSNSData_() {
  const p = PropertiesService.getScriptProperties();
  return {
    xFollowers: parseInt(p.getProperty('X_FOLLOWERS') || '0'),
    xFollowersPrev: parseInt(p.getProperty('X_FOLLOWERS_PREV') || '0'),
    xImpressions: parseInt(p.getProperty('X_IMPRESSIONS') || '0'),
    xImpressionsPrev: parseInt(p.getProperty('X_IMPRESSIONS_PREV') || '0')
  };
}

// ===== Config =====

function getPropertyId_() {
  const p = PropertiesService.getScriptProperties();
  let id = p.getProperty('GA4_PROPERTY_ID');
  if (!id) {
    // Auto-discover on first access
    Logger.log('GA4_PROPERTY_ID 未設定 — 自動検出を試行');
    id = autoDiscoverPropertyId_();
    if (!id) throw new Error('GA4プロパティが見つかりません。手動でGA4_PROPERTY_IDを設定してください');
  }
  return id;
}

function autoDiscoverPropertyId_() {
  try {
    const summaries = AnalyticsAdmin.AccountSummaries.list();
    if (!summaries.accountSummaries) return null;

    for (const account of summaries.accountSummaries) {
      for (const prop of (account.propertySummaries || [])) {
        try {
          const streams = AnalyticsAdmin.Properties.DataStreams.list(prop.property);
          for (const stream of (streams.dataStreams || [])) {
            if (stream.webStreamData &&
                stream.webStreamData.measurementId === MEASUREMENT_ID) {
              const id = prop.property.replace('properties/', '');
              PropertiesService.getScriptProperties().setProperty('GA4_PROPERTY_ID', id);
              Logger.log('GA4_PROPERTY_ID 自動設定: ' + id + ' (' + prop.displayName + ')');
              return id;
            }
          }
        } catch (e) { /* skip inaccessible */ }
      }
    }
  } catch (e) {
    Logger.log('Auto-discover failed: ' + e.message);
  }
  return null;
}

// ===== Setup Helpers =====

/**
 * GA4プロパティIDを自動検索する。
 * 実行すると、アクセス可能な全GA4プロパティを表示。
 * 測定ID G-6DV28MW59Z に対応するプロパティを自動設定する。
 *
 * 事前準備: GASエディタで「サービス」→ AnalyticsAdmin (v1alpha) を追加
 */
function findMyGA4Property() {
  try {
    const summaries = AnalyticsAdmin.AccountSummaries.list();
    if (!summaries.accountSummaries) {
      Logger.log('GA4アカウントが見つかりません');
      return;
    }

    Logger.log('=== GA4 プロパティ一覧 ===');
    let foundId = null;

    summaries.accountSummaries.forEach(account => {
      Logger.log('Account: ' + account.displayName);
      (account.propertySummaries || []).forEach(prop => {
        const id = prop.property.replace('properties/', '');
        Logger.log('  ' + prop.displayName + ' — ID: ' + id);

        // Check measurement ID
        try {
          const streams = AnalyticsAdmin.Properties.DataStreams.list(prop.property);
          (streams.dataStreams || []).forEach(stream => {
            if (stream.webStreamData &&
                stream.webStreamData.measurementId === MEASUREMENT_ID) {
              Logger.log('  >>> 測定ID ' + MEASUREMENT_ID + ' に一致！ <<<');
              foundId = id;
            }
          });
        } catch (e) {
          // Skip if no access
        }
      });
    });

    if (foundId) {
      PropertiesService.getScriptProperties().setProperty('GA4_PROPERTY_ID', foundId);
      Logger.log('');
      Logger.log('GA4_PROPERTY_ID を自動設定しました: ' + foundId);
    } else {
      Logger.log('');
      Logger.log('測定ID ' + MEASUREMENT_ID + ' に対応するプロパティが見つかりません');
      Logger.log('手動で GA4_PROPERTY_ID をスクリプトプロパティに設定してください');
    }
  } catch (e) {
    Logger.log('AnalyticsAdmin サービスが追加されていない可能性があります');
    Logger.log('GASエディタ → サービス → Google Analytics Admin API (v1alpha) を追加してください');
    Logger.log('エラー: ' + e.message);
  }
}

/**
 * トリガーを設定する（6時間ごとにキャッシュ更新）
 */
function createTrigger() {
  // 既存トリガーを削除
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'refreshCache') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('refreshCache')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('6時間ごとのキャッシュ更新トリガーを設定しました');
}

/**
 * SNSデータを更新する（手動実行用）
 */
function updateSNS(followers, followersPrev, impressions, impressionsPrev) {
  const p = PropertiesService.getScriptProperties();
  if (followers) p.setProperty('X_FOLLOWERS', String(followers));
  if (followersPrev) p.setProperty('X_FOLLOWERS_PREV', String(followersPrev));
  if (impressions) p.setProperty('X_IMPRESSIONS', String(impressions));
  if (impressionsPrev) p.setProperty('X_IMPRESSIONS_PREV', String(impressionsPrev));
  Logger.log('SNSデータ更新完了');
}
