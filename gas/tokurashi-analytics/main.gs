/**
 * トクラシ Analytics Sync
 * GA4 + Search Console → Firebase
 *
 * 【セットアップ】
 * 1. script.google.com で新規プロジェクト作成
 * 2. このコードを貼り付け
 * 3. Script Properties に設定:
 *    - GA4_PROPERTY_ID: GA4のプロパティID（数値）
 *      → GA4管理画面 → 管理 → プロパティ設定 → プロパティID
 *    - SITE_URL: https://www.tokurashi.com
 * 4. サービスを追加:
 *    - Google Analytics Data API (AnalyticsData)
 *    - Google Search Console API (SearchConsole)  ← 「Webmasters API」で検索
 * 5. トリガー設定: syncAll() を毎日1回（朝6時など）
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const FIREBASE_PATH = '/tokurashi-analytics';

function syncAll() {
  const props = PropertiesService.getScriptProperties();
  const ga4PropertyId = props.getProperty('GA4_PROPERTY_ID');
  const siteUrl = props.getProperty('SITE_URL') || 'https://www.tokurashi.com';

  const data = {
    updated_at: new Date().toISOString(),
    ga4: {},
    gsc: {}
  };

  // GA4
  if (ga4PropertyId) {
    try {
      data.ga4 = fetchGA4Data(ga4PropertyId);
      Logger.log('GA4 取得完了');
    } catch (e) {
      Logger.log('GA4 エラー: ' + e.message);
      data.ga4 = { error: e.message };
    }
  } else {
    data.ga4 = { error: 'GA4_PROPERTY_ID が未設定' };
  }

  // Search Console
  try {
    data.gsc = fetchGSCData(siteUrl);
    Logger.log('GSC 取得完了');
  } catch (e) {
    Logger.log('GSC エラー: ' + e.message);
    data.gsc = { error: e.message };
  }

  // Firebase に保存
  firebasePut(FIREBASE_PATH + '/latest.json', data);

  // 日次履歴も保存（推移グラフ用）
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  firebasePut(FIREBASE_PATH + '/daily/' + today + '.json', {
    date: today,
    pv_7d: data.ga4.pv_7d || 0,
    pv_30d: data.ga4.pv_30d || 0,
    users_7d: data.ga4.users_7d || 0,
    users_30d: data.ga4.users_30d || 0,
    clicks_7d: data.gsc.clicks_7d || 0,
    impressions_7d: data.gsc.impressions_7d || 0,
    ctr_7d: data.gsc.ctr_7d || 0,
    position_7d: data.gsc.position_7d || 0,
    indexed_pages: data.gsc.indexed_pages || 0
  });

  Logger.log('Firebase 保存完了');
}

/**
 * GA4 Data API
 */
function fetchGA4Data(propertyId) {
  const result = {};

  // 過去7日間
  const res7d = runGA4Report(propertyId, 7);
  result.pv_7d = res7d.pageViews;
  result.users_7d = res7d.users;
  result.sessions_7d = res7d.sessions;

  // 過去30日間
  const res30d = runGA4Report(propertyId, 30);
  result.pv_30d = res30d.pageViews;
  result.users_30d = res30d.users;
  result.sessions_30d = res30d.sessions;

  // トップページ（過去30日）
  result.top_pages = getGA4TopPages(propertyId, 30);

  return result;
}

function runGA4Report(propertyId, days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const request = AnalyticsData.newRunReportRequest();
  request.dateRanges = [AnalyticsData.newDateRange()];
  request.dateRanges[0].startDate = formatDate(startDate);
  request.dateRanges[0].endDate = formatDate(endDate);
  request.metrics = [
    Object.assign(AnalyticsData.newMetric(), { name: 'screenPageViews' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'totalUsers' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'sessions' })
  ];

  const response = AnalyticsData.Properties.runReport(request, 'properties/' + propertyId);

  if (!response.rows || response.rows.length === 0) {
    return { pageViews: 0, users: 0, sessions: 0 };
  }

  const row = response.rows[0];
  return {
    pageViews: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0,
    sessions: parseInt(row.metricValues[2].value) || 0
  };
}

function getGA4TopPages(propertyId, days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const request = AnalyticsData.newRunReportRequest();
  request.dateRanges = [AnalyticsData.newDateRange()];
  request.dateRanges[0].startDate = formatDate(startDate);
  request.dateRanges[0].endDate = formatDate(endDate);
  request.dimensions = [Object.assign(AnalyticsData.newDimension(), { name: 'pagePath' })];
  request.metrics = [
    Object.assign(AnalyticsData.newMetric(), { name: 'screenPageViews' }),
    Object.assign(AnalyticsData.newMetric(), { name: 'totalUsers' })
  ];
  request.limit = 20;
  request.orderBys = [AnalyticsData.newOrderBy()];
  request.orderBys[0].metric = Object.assign(AnalyticsData.newMetricOrderBy(), { metricName: 'screenPageViews' });
  request.orderBys[0].desc = true;

  const response = AnalyticsData.Properties.runReport(request, 'properties/' + propertyId);

  if (!response.rows) return [];

  return response.rows.map(row => ({
    path: row.dimensionValues[0].value,
    pv: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0
  }));
}

/**
 * Search Console API
 */
function fetchGSCData(siteUrl) {
  const result = {};

  // 過去7日間のサマリー
  const summary7d = getGSCSummary(siteUrl, 7);
  result.clicks_7d = summary7d.clicks;
  result.impressions_7d = summary7d.impressions;
  result.ctr_7d = summary7d.ctr;
  result.position_7d = summary7d.position;

  // 過去28日間のサマリー
  const summary28d = getGSCSummary(siteUrl, 28);
  result.clicks_28d = summary28d.clicks;
  result.impressions_28d = summary28d.impressions;
  result.ctr_28d = summary28d.ctr;
  result.position_28d = summary28d.position;

  // トップクエリ（過去28日）
  result.top_queries = getGSCTopQueries(siteUrl, 28);

  // トップページ（過去28日）
  result.top_pages = getGSCTopPages(siteUrl, 28);

  // インデックス数（サイトマップから推定）
  try {
    const sitemaps = SearchConsole.Sitemaps.list(siteUrl);
    if (sitemaps.sitemap && sitemaps.sitemap.length > 0) {
      let total = 0;
      sitemaps.sitemap.forEach(sm => {
        if (sm.contents) {
          sm.contents.forEach(c => { total += (c.submitted || 0); });
        }
      });
      result.indexed_pages = total;
    }
  } catch (e) {
    Logger.log('サイトマップ取得エラー: ' + e.message);
  }

  return result;
}

function getGSCSummary(siteUrl, days) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3); // GSCは3日前までのデータ
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  try {
    const response = SearchConsole.Searchanalytics.query({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: [],
      rowLimit: 1
    }, siteUrl);

    if (!response.rows || response.rows.length === 0) {
      return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    }

    const row = response.rows[0];
    return {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,  // パーセント（小数2桁）
      position: Math.round((row.position || 0) * 10) / 10
    };
  } catch (e) {
    Logger.log('GSC Summary エラー: ' + e.message);
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
}

function getGSCTopQueries(siteUrl, days) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  try {
    const response = SearchConsole.Searchanalytics.query({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['query'],
      rowLimit: 20,
      orderBy: 'clicks',
      orderDirection: 'descending'
    }, siteUrl);

    if (!response.rows) return [];

    return response.rows.map(row => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100,
      position: Math.round(row.position * 10) / 10
    }));
  } catch (e) {
    return [];
  }
}

function getGSCTopPages(siteUrl, days) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  try {
    const response = SearchConsole.Searchanalytics.query({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['page'],
      rowLimit: 20,
      orderBy: 'clicks',
      orderDirection: 'descending'
    }, siteUrl);

    if (!response.rows) return [];

    return response.rows.map(row => ({
      page: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100,
      position: Math.round(row.position * 10) / 10
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Firebase helpers
 */
function firebasePut(path, data) {
  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(FIREBASE_URL + path, options);
}

function formatDate(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * テスト用: 手動実行で動作確認
 */
function testSync() {
  syncAll();
  const res = UrlFetchApp.fetch(FIREBASE_URL + FIREBASE_PATH + '/latest.json');
  Logger.log(res.getContentText());
}
