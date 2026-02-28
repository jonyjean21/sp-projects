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

// ===== Cache (Split into multiple properties for 9KB limit) =====

function saveToCache_(data) {
  const props = PropertiesService.getScriptProperties();
  const parts = {
    'DASH_TRAFFIC': JSON.stringify(data.traffic || {}),
    'DASH_SC': JSON.stringify(data.searchConsole || {}),
    'DASH_PAGES': JSON.stringify(data.topPages || []),
    'DASH_SOURCES': JSON.stringify(data.trafficSources || []),
    'DASH_SNS': JSON.stringify(data.sns || {}),
    'DASH_SUMMARY': data.weeklySummary || '',
    'DASH_META_UPDATED': data.lastUpdated || '',
    'DASH_META_TS': String(Date.now())
  };
  for (var key in parts) {
    var val = parts[key];
    if (val.length < 9000) {
      props.setProperty(key, val);
    } else {
      Logger.log('WARNING: ' + key + ' exceeds 9KB (' + val.length + ' bytes), skipped');
    }
  }
}

function loadFromCache_() {
  var props = PropertiesService.getScriptProperties();
  var ts = parseInt(props.getProperty('DASH_META_TS') || '0');
  if ((Date.now() - ts) >= CACHE_TTL) return null;
  try {
    return {
      lastUpdated: props.getProperty('DASH_META_UPDATED') || '',
      traffic: JSON.parse(props.getProperty('DASH_TRAFFIC') || '{"months":[]}'),
      searchConsole: JSON.parse(props.getProperty('DASH_SC') || '{"months":[],"topQueries":[]}'),
      topPages: JSON.parse(props.getProperty('DASH_PAGES') || '[]'),
      trafficSources: JSON.parse(props.getProperty('DASH_SOURCES') || '[]'),
      weeklySummary: props.getProperty('DASH_SUMMARY') || '',
      sns: JSON.parse(props.getProperty('DASH_SNS') || '{}')
    };
  } catch (e) {
    Logger.log('Cache parse error: ' + e.message);
    return null;
  }
}

function getDashboardData_(forceRefresh) {
  if (!forceRefresh) {
    var cached = loadFromCache_();
    if (cached) return cached;
  }
  var data = buildDashboardData_();
  saveToCache_(data);
  return data;
}

// ===== Timed Trigger (keeps cache warm) =====

function refreshCache() {
  var data = buildDashboardData_();
  saveToCache_(data);
  Logger.log('Cache refreshed');
}

// ===== Data Builder =====

function buildDashboardData_() {
  var now = new Date();
  var result = {
    lastUpdated: Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
    traffic: { months: [] },
    searchConsole: { months: [], topQueries: [] },
    topPages: [],
    trafficSources: [],
    weeklySummary: '',
    sns: getSNSData_()
  };

  // GA4 Monthly Traffic
  try {
    result.traffic = fetchGA4Traffic_();
  } catch (err) {
    Logger.log('GA4 traffic error: ' + err.message);
    result.traffic.error = err.message;
  }

  // GA4 Top Pages
  try {
    result.topPages = fetchGA4TopPages_();
  } catch (err) {
    Logger.log('GA4 top pages error: ' + err.message);
  }

  // GA4 Traffic Sources
  try {
    result.trafficSources = fetchGA4TrafficSources_();
  } catch (err) {
    Logger.log('GA4 sources error: ' + err.message);
  }

  // Search Console
  try {
    result.searchConsole = fetchSearchConsoleData_();
  } catch (err) {
    Logger.log('SC error: ' + err.message);
    result.searchConsole.error = err.message;
  }

  // Weekly summary (read from stored, don't regenerate every time)
  var props = PropertiesService.getScriptProperties();
  result.weeklySummary = props.getProperty('DASH_SUMMARY') || '';

  return result;
}

// ===== GA4 Data API: Monthly Traffic =====

function fetchGA4Traffic_() {
  var propertyId = getPropertyId_();

  var now = new Date();
  var sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  var startDate = Utilities.formatDate(sixMonthsAgo, 'Asia/Tokyo', 'yyyy-MM-dd');
  var endDate = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

  var request = AnalyticsData.newRunReportRequest();
  request.dateRanges = [AnalyticsData.newDateRange()];
  request.dateRanges[0].startDate = startDate;
  request.dateRanges[0].endDate = endDate;

  request.dimensions = [AnalyticsData.newDimension()];
  request.dimensions[0].name = 'yearMonth';

  request.metrics = [
    Object.assign(AnalyticsData.newMetric(), { name: 'sessions' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'screenPageViews' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'totalUsers' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'bounceRate' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'averageSessionDuration' })
  ];

  request.orderBys = [AnalyticsData.newOrderBy()];
  request.orderBys[0].dimension = AnalyticsData.newDimensionOrderBy();
  request.orderBys[0].dimension.dimensionName = 'yearMonth';

  var response = AnalyticsData.Properties.runReport(
    request, 'properties/' + propertyId
  );

  var months = [];
  if (response.rows) {
    response.rows.forEach(function(row) {
      var ym = row.dimensionValues[0].value;
      months.push({
        month: ym.substring(0, 4) + '-' + ym.substring(4, 6),
        sessions: parseInt(row.metricValues[0].value),
        pv: parseInt(row.metricValues[1].value),
        users: parseInt(row.metricValues[2].value),
        bounceRate: parseFloat(parseFloat(row.metricValues[3].value).toFixed(1)),
        avgDuration: parseInt(parseFloat(row.metricValues[4].value))
      });
    });
  }

  return { months: months };
}

// ===== GA4 Data API: Top 10 Pages (last 30 days) =====

function fetchGA4TopPages_() {
  var propertyId = getPropertyId_();

  var request = AnalyticsData.newRunReportRequest();
  request.dateRanges = [AnalyticsData.newDateRange()];
  request.dateRanges[0].startDate = '30daysAgo';
  request.dateRanges[0].endDate = 'today';

  request.dimensions = [AnalyticsData.newDimension()];
  request.dimensions[0].name = 'pagePath';

  request.metrics = [
    Object.assign(AnalyticsData.newMetric(), { name: 'screenPageViews' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'totalUsers' })
  ];

  request.orderBys = [AnalyticsData.newOrderBy()];
  request.orderBys[0].metric = AnalyticsData.newMetricOrderBy();
  request.orderBys[0].metric.metricName = 'screenPageViews';
  request.orderBys[0].desc = true;

  request.limit = 15;

  var response = AnalyticsData.Properties.runReport(
    request, 'properties/' + propertyId
  );

  return (response.rows || []).map(function(row) {
    return {
      path: row.dimensionValues[0].value,
      pv: parseInt(row.metricValues[0].value),
      users: parseInt(row.metricValues[1].value)
    };
  });
}

// ===== GA4 Data API: Traffic Sources (current month) =====

function fetchGA4TrafficSources_() {
  var propertyId = getPropertyId_();
  var now = new Date();
  var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  var request = AnalyticsData.newRunReportRequest();
  request.dateRanges = [AnalyticsData.newDateRange()];
  request.dateRanges[0].startDate = Utilities.formatDate(firstOfMonth, 'Asia/Tokyo', 'yyyy-MM-dd');
  request.dateRanges[0].endDate = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

  request.dimensions = [AnalyticsData.newDimension()];
  request.dimensions[0].name = 'sessionDefaultChannelGroup';

  request.metrics = [
    Object.assign(AnalyticsData.newMetric(), { name: 'sessions' })
  ];

  request.orderBys = [AnalyticsData.newOrderBy()];
  request.orderBys[0].metric = AnalyticsData.newMetricOrderBy();
  request.orderBys[0].metric.metricName = 'sessions';
  request.orderBys[0].desc = true;

  var response = AnalyticsData.Properties.runReport(
    request, 'properties/' + propertyId
  );

  return (response.rows || []).map(function(row) {
    return {
      source: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value)
    };
  });
}

// ===== Search Console API =====

function fetchSearchConsoleData_() {
  var now = new Date();
  var sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  var startDate = Utilities.formatDate(sixMonthsAgo, 'Asia/Tokyo', 'yyyy-MM-dd');
  var endDate = Utilities.formatDate(
    new Date(now.getTime() - 3 * 86400000), 'Asia/Tokyo', 'yyyy-MM-dd'
  );

  var token = ScriptApp.getOAuthToken();
  var encodedUrl = encodeURIComponent(SC_SITE_URL);
  var baseUrl = 'https://searchconsole.googleapis.com/webmasters/v3/sites/'
    + encodedUrl + '/searchAnalytics/query';

  // Monthly data (by date, then aggregate)
  var monthlyRes = UrlFetchApp.fetch(baseUrl, {
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

  var monthlyData = JSON.parse(monthlyRes.getContentText());
  var monthMap = {};

  if (monthlyData.rows) {
    monthlyData.rows.forEach(function(row) {
      var month = row.keys[0].substring(0, 7);
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

  var months = Object.keys(monthMap).sort().map(function(m) {
    return {
      month: m,
      clicks: monthMap[m].clicks,
      impressions: monthMap[m].impressions,
      ctr: parseFloat((monthMap[m].ctrSum / monthMap[m].count * 100).toFixed(1)),
      position: parseFloat((monthMap[m].posSum / monthMap[m].count).toFixed(1))
    };
  });

  // Top queries (last 28 days) — expanded to 20
  var queryRes = UrlFetchApp.fetch(baseUrl, {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      startDate: Utilities.formatDate(
        new Date(now.getTime() - 28 * 86400000), 'Asia/Tokyo', 'yyyy-MM-dd'
      ),
      endDate: endDate,
      dimensions: ['query'],
      rowLimit: 20
    })
  });

  var queryData = JSON.parse(queryRes.getContentText());
  var topQueries = (queryData.rows || []).map(function(row) {
    return {
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      position: parseFloat(row.position.toFixed(1))
    };
  });

  return { months: months, topQueries: topQueries };
}

// ===== Weekly Summary Generator =====

function generateWeeklySummary_() {
  var propertyId = getPropertyId_();

  // This week (last 7 days)
  var reqThis = AnalyticsData.newRunReportRequest();
  reqThis.dateRanges = [AnalyticsData.newDateRange()];
  reqThis.dateRanges[0].startDate = '7daysAgo';
  reqThis.dateRanges[0].endDate = 'today';
  reqThis.metrics = [
    Object.assign(AnalyticsData.newMetric(), { name: 'sessions' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'screenPageViews' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'totalUsers' })
  ];
  var resThis = AnalyticsData.Properties.runReport(reqThis, 'properties/' + propertyId);

  // Previous week (8-14 days ago)
  var reqPrev = AnalyticsData.newRunReportRequest();
  reqPrev.dateRanges = [AnalyticsData.newDateRange()];
  reqPrev.dateRanges[0].startDate = '14daysAgo';
  reqPrev.dateRanges[0].endDate = '8daysAgo';
  reqPrev.metrics = reqThis.metrics;
  var resPrev = AnalyticsData.Properties.runReport(reqPrev, 'properties/' + propertyId);

  var thisRow = resThis.rows ? resThis.rows[0] : null;
  var prevRow = resPrev.rows ? resPrev.rows[0] : null;

  var lines = [];
  if (thisRow && prevRow) {
    var s = parseInt(thisRow.metricValues[0].value);
    var sp = parseInt(prevRow.metricValues[0].value);
    var pv = parseInt(thisRow.metricValues[1].value);
    var pvp = parseInt(prevRow.metricValues[1].value);
    var u = parseInt(thisRow.metricValues[2].value);
    var up = parseInt(prevRow.metricValues[2].value);

    function pct(a, b) { return b > 0 ? ((a - b) / b * 100).toFixed(1) : '—'; }
    function arrow(a, b) { return a >= b ? '↑' : '↓'; }

    lines.push('セッション: ' + s + ' ' + arrow(s, sp) + pct(s, sp) + '%');
    lines.push('PV: ' + pv + ' ' + arrow(pv, pvp) + pct(pv, pvp) + '%');
    lines.push('ユーザー: ' + u + ' ' + arrow(u, up) + pct(u, up) + '%');
  } else {
    lines.push('データ不足（比較不可）');
  }

  lines.push('更新: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MM/dd HH:mm'));

  var summary = lines.join('\n');
  PropertiesService.getScriptProperties().setProperty('DASH_SUMMARY', summary);
  Logger.log('Weekly summary generated:\n' + summary);
  return summary;
}

function refreshWeeklySummary() {
  generateWeeklySummary_();
  refreshCache();
}

// ===== SNS (PropertiesService — 手動 or updateSNS() で更新) =====

function getSNSData_() {
  var p = PropertiesService.getScriptProperties();
  return {
    xFollowers: parseInt(p.getProperty('X_FOLLOWERS') || '0'),
    xFollowersPrev: parseInt(p.getProperty('X_FOLLOWERS_PREV') || '0'),
    xImpressions: parseInt(p.getProperty('X_IMPRESSIONS') || '0'),
    xImpressionsPrev: parseInt(p.getProperty('X_IMPRESSIONS_PREV') || '0')
  };
}

// ===== Config =====

function getPropertyId_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('GA4_PROPERTY_ID');
  if (!id) {
    Logger.log('GA4_PROPERTY_ID 未設定 — 自動検出を試行');
    id = autoDiscoverPropertyId_();
    if (!id) throw new Error('GA4プロパティが見つかりません。手動でGA4_PROPERTY_IDを設定してください');
  }
  return id;
}

function autoDiscoverPropertyId_() {
  try {
    var summaries = AnalyticsAdmin.AccountSummaries.list();
    if (!summaries.accountSummaries) return null;

    for (var a = 0; a < summaries.accountSummaries.length; a++) {
      var account = summaries.accountSummaries[a];
      var props = account.propertySummaries || [];
      for (var p = 0; p < props.length; p++) {
        try {
          var streams = AnalyticsAdmin.Properties.DataStreams.list(props[p].property);
          for (var s = 0; s < (streams.dataStreams || []).length; s++) {
            var stream = streams.dataStreams[s];
            if (stream.webStreamData &&
                stream.webStreamData.measurementId === MEASUREMENT_ID) {
              var id = props[p].property.replace('properties/', '');
              PropertiesService.getScriptProperties().setProperty('GA4_PROPERTY_ID', id);
              Logger.log('GA4_PROPERTY_ID 自動設定: ' + id + ' (' + props[p].displayName + ')');
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

function findMyGA4Property() {
  try {
    var summaries = AnalyticsAdmin.AccountSummaries.list();
    if (!summaries.accountSummaries) {
      Logger.log('GA4アカウントが見つかりません');
      return;
    }

    Logger.log('=== GA4 プロパティ一覧 ===');
    var foundId = null;

    summaries.accountSummaries.forEach(function(account) {
      Logger.log('Account: ' + account.displayName);
      (account.propertySummaries || []).forEach(function(prop) {
        var id = prop.property.replace('properties/', '');
        Logger.log('  ' + prop.displayName + ' — ID: ' + id);
        try {
          var streams = AnalyticsAdmin.Properties.DataStreams.list(prop.property);
          (streams.dataStreams || []).forEach(function(stream) {
            if (stream.webStreamData &&
                stream.webStreamData.measurementId === MEASUREMENT_ID) {
              Logger.log('  >>> 測定ID ' + MEASUREMENT_ID + ' に一致！ <<<');
              foundId = id;
            }
          });
        } catch (e) { /* skip */ }
      });
    });

    if (foundId) {
      PropertiesService.getScriptProperties().setProperty('GA4_PROPERTY_ID', foundId);
      Logger.log('GA4_PROPERTY_ID を自動設定しました: ' + foundId);
    } else {
      Logger.log('測定ID ' + MEASUREMENT_ID + ' に対応するプロパティが見つかりません');
    }
  } catch (e) {
    Logger.log('AnalyticsAdmin サービスが追加されていない可能性があります');
    Logger.log('エラー: ' + e.message);
  }
}

function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'refreshCache') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshCache')
    .timeBased().everyHours(6).create();
  Logger.log('6時間ごとのキャッシュ更新トリガーを設定しました');
}

function createWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'refreshWeeklySummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshWeeklySummary')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log('毎週月曜8時のサマリー更新トリガーを設定しました');
}

function updateSNS(followers, followersPrev, impressions, impressionsPrev) {
  var p = PropertiesService.getScriptProperties();
  if (followers) p.setProperty('X_FOLLOWERS', String(followers));
  if (followersPrev) p.setProperty('X_FOLLOWERS_PREV', String(followersPrev));
  if (impressions) p.setProperty('X_IMPRESSIONS', String(impressions));
  if (impressionsPrev) p.setProperty('X_IMPRESSIONS_PREV', String(impressionsPrev));
  Logger.log('SNSデータ更新完了');
}
