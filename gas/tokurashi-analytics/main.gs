/**
 * トクラシ Analytics Sync
 * GA4 + Search Console → Firebase（REST API直接呼び出し版）
 *
 * 【セットアップ】
 * 1. clasp push 済み（コードは自動反映）
 * 2. Script Properties に設定:
 *    - GA4_PROPERTY_ID: GA4のプロパティID（数値）
 *      → GA4管理画面 → 管理 → プロパティ設定 → プロパティID
 * 3. setup() を1回手動実行（トリガー自動作成 + 初回同期）
 *    → 初回実行時にGoogle認証の許可ダイアログが出るので許可する
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const FIREBASE_PATH = '/tokurashi-analytics';
const SITE_URL = 'https://www.tokurashi.com';

function syncAll() {
  const props = PropertiesService.getScriptProperties();
  const ga4PropertyId = props.getProperty('GA4_PROPERTY_ID');

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
    data.ga4 = { error: 'GA4_PROPERTY_ID が未設定。setup()実行時に自動取得を試みます。' };
  }

  // Search Console
  try {
    data.gsc = fetchGSCData();
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
    position_7d: data.gsc.position_7d || 0
  });

  Logger.log('Firebase 保存完了');
}

// ============================================
// GA4 Data API (REST)
// ============================================

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
  const endDate = fmtDate(new Date());
  const startDate = fmtDate(daysAgo(days));

  const payload = {
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'totalUsers' },
      { name: 'sessions' }
    ]
  };

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const response = gapiPost(url, payload);

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
  const payload = {
    dateRanges: [{ startDate: fmtDate(daysAgo(days)), endDate: fmtDate(new Date()) }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'totalUsers' }
    ],
    limit: 20,
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }]
  };

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const response = gapiPost(url, payload);

  if (!response.rows) return [];

  return response.rows.map(row => ({
    path: row.dimensionValues[0].value,
    pv: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0
  }));
}

// ============================================
// Search Console API (REST)
// ============================================

function fetchGSCData() {
  const result = {};

  // 過去7日間のサマリー
  const summary7d = getGSCSummary(7);
  result.clicks_7d = summary7d.clicks;
  result.impressions_7d = summary7d.impressions;
  result.ctr_7d = summary7d.ctr;
  result.position_7d = summary7d.position;

  // 過去28日間のサマリー
  const summary28d = getGSCSummary(28);
  result.clicks_28d = summary28d.clicks;
  result.impressions_28d = summary28d.impressions;
  result.ctr_28d = summary28d.ctr;
  result.position_28d = summary28d.position;

  // トップクエリ（過去28日）
  result.top_queries = getGSCTopQueries(28);

  // トップページ（過去28日）
  result.top_pages = getGSCTopPages(28);

  return result;
}

function getGSCSummary(days) {
  const endDate = fmtDate(daysAgo(3)); // GSCは3日前までのデータ
  const startDate = fmtDate(daysAgo(days + 3));

  const payload = {
    startDate: startDate,
    endDate: endDate,
    dimensions: [],
    rowLimit: 1
  };

  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;

  try {
    const response = gapiPost(url, payload);
    if (!response.rows || response.rows.length === 0) {
      return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    }
    const row = response.rows[0];
    return {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,
      position: Math.round((row.position || 0) * 10) / 10
    };
  } catch (e) {
    Logger.log('GSC Summary エラー: ' + e.message);
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
}

function getGSCTopQueries(days) {
  const payload = {
    startDate: fmtDate(daysAgo(days + 3)),
    endDate: fmtDate(daysAgo(3)),
    dimensions: ['query'],
    rowLimit: 20
  };

  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;

  try {
    const response = gapiPost(url, payload);
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

function getGSCTopPages(days) {
  const payload = {
    startDate: fmtDate(daysAgo(days + 3)),
    endDate: fmtDate(daysAgo(3)),
    dimensions: ['page'],
    rowLimit: 20
  };

  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;

  try {
    const response = gapiPost(url, payload);
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

// ============================================
// GA4 Property ID 自動取得
// ============================================

function findGA4PropertyId() {
  const url = 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries';
  try {
    const response = gapiGet(url);
    if (!response.accountSummaries) {
      Logger.log('GA4アカウントが見つかりません');
      return null;
    }

    for (const account of response.accountSummaries) {
      if (!account.propertySummaries) continue;
      for (const prop of account.propertySummaries) {
        // tokurashi を含むプロパティを探す
        const displayName = (prop.displayName || '').toLowerCase();
        const propertyId = prop.property.replace('properties/', '');
        Logger.log(`Found: ${prop.displayName} (ID: ${propertyId})`);

        if (displayName.includes('tokurashi') || displayName.includes('トクラシ')) {
          Logger.log(`→ トクラシのプロパティを発見: ${propertyId}`);
          return propertyId;
        }
      }
    }

    // 見つからなければ全プロパティをログに出して手動選択
    Logger.log('「tokurashi」を含むプロパティが見つかりませんでした。');
    Logger.log('上のリストからプロパティIDを確認し、Script Properties に GA4_PROPERTY_ID として設定してください。');
    return null;
  } catch (e) {
    Logger.log('GA4 Admin API エラー: ' + e.message);
    return null;
  }
}

// ============================================
// セットアップ & ユーティリティ
// ============================================

/**
 * 初期セットアップ: 1回だけ手動実行
 */
function setup() {
  const props = PropertiesService.getScriptProperties();

  // GA4 Property ID 自動取得
  let ga4Id = props.getProperty('GA4_PROPERTY_ID');
  if (!ga4Id) {
    Logger.log('GA4_PROPERTY_ID が未設定。自動取得を試みます...');
    ga4Id = findGA4PropertyId();
    if (ga4Id) {
      props.setProperty('GA4_PROPERTY_ID', ga4Id);
      Logger.log('GA4_PROPERTY_ID を自動設定: ' + ga4Id);
    } else {
      Logger.log('⚠️ GA4_PROPERTY_ID の自動取得に失敗。手動設定してください。');
      Logger.log('手順: Script Properties → GA4_PROPERTY_ID → GA4管理画面のプロパティID（数値）');
    }
  } else {
    Logger.log('GA4_PROPERTY_ID: ' + ga4Id + '（設定済み）');
  }

  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncAll') {
      ScriptApp.deleteTrigger(t);
      Logger.log('既存トリガー削除');
    }
  });

  // 毎日6時JSTのトリガー作成
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  Logger.log('✅ トリガー作成: 毎日6時にsyncAll()を実行');

  // 初回実行
  Logger.log('初回同期を実行中...');
  syncAll();
  Logger.log('✅ セットアップ完了！');
}

/**
 * Google API ヘルパー
 */
function gapiPost(url, payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error(`API error ${code}: ${res.getContentText().substring(0, 200)}`);
  }
  return JSON.parse(res.getContentText());
}

function gapiGet(url) {
  const options = {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };
  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error(`API error ${code}: ${res.getContentText().substring(0, 200)}`);
  }
  return JSON.parse(res.getContentText());
}

function firebasePut(path, data) {
  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(FIREBASE_URL + path, options);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function fmtDate(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * テスト: 手動実行で動作確認
 */
function testSync() {
  syncAll();
  const res = UrlFetchApp.fetch(FIREBASE_URL + FIREBASE_PATH + '/latest.json');
  Logger.log(res.getContentText());
}
