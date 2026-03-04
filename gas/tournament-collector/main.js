/**
 * 大会情報 RSS コレクター
 * molkky.jp + kokuchpro を毎日巡回 → Firebase /tournament-queue に push
 * 重複チェック: Firebase /tournament-queue の全URLと照合
 * 実行ログ: Firebase /tournament-collector-log に記録
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const QUEUE_PATH = '/tournament-queue';
const LOG_PATH = '/tournament-collector-log';

const FEEDS = [
  {
    name: 'JMA公式',
    url: 'https://molkky.jp/tournament/feed/',
    filter: null // 全件対象（モルック専門サイト）
  },
  {
    name: 'こくちーず',
    url: 'https://www.kokuchpro.com/feature/%E3%83%A2%E3%83%AB%E3%83%83%E3%82%AF/.rss',
    filter: /モルック|mölkky|molkky/i // タイトルフィルタ
  }
];

/**
 * メイン処理: 全フィードを巡回して新規エントリをキューに追加
 */
function collectTournaments() {
  const startTime = new Date();
  const seenUrls = getSeenUrlsFromFirebase_();
  let totalNew = 0;
  let totalSkipped = 0;
  const feedResults = [];

  FEEDS.forEach(feed => {
    const result = { name: feed.name, entries: 0, newCount: 0, skipped: 0, error: null };
    try {
      const entries = fetchRSS_(feed);
      result.entries = entries.length;

      entries.forEach(entry => {
        if (seenUrls.has(entry.link)) {
          result.skipped++;
          return;
        }
        if (feed.filter && !feed.filter.test(entry.title)) {
          result.skipped++;
          return;
        }

        pushToQueue_(entry.title, entry.link, feed.name);
        seenUrls.add(entry.link);
        result.newCount++;
      });

      totalNew += result.newCount;
      totalSkipped += result.skipped;
      Logger.log(`${feed.name}: ${entries.length}件中 ${result.newCount}件が新規, ${result.skipped}件スキップ`);
    } catch (e) {
      result.error = e.message;
      Logger.log(`${feed.name} エラー: ${e.message}`);
    }
    feedResults.push(result);
  });

  const endTime = new Date();
  const durationSec = Math.round((endTime - startTime) / 1000);

  // 実行ログをFirebaseに記録
  writeLog_({
    timestamp: startTime.toISOString(),
    durationSec: durationSec,
    totalNew: totalNew,
    totalSkipped: totalSkipped,
    feeds: feedResults
  });

  Logger.log(`完了: 合計 ${totalNew}件の新規エントリをキューに追加 (${durationSec}秒)`);
}

/**
 * RSS/Atomフィードを取得してパース
 */
function fetchRSS_(feed) {
  const resp = UrlFetchApp.fetch(feed.url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': 'MolkkyHub-RSS-Collector/1.0' }
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error(`HTTP ${resp.getResponseCode()}`);
  }

  const xml = XmlService.parse(resp.getContentText());
  const root = xml.getRootElement();
  const entries = [];

  // RSS 2.0 (<rss><channel><item>)
  const ns = root.getNamespace();
  const channel = root.getChild('channel', ns);
  if (channel) {
    const items = channel.getChildren('item', ns);
    items.forEach(item => {
      const title = item.getChildText('title', ns) || '';
      const link = item.getChildText('link', ns) || '';
      const pubDate = item.getChildText('pubDate', ns) || '';
      if (link) entries.push({ title: title.trim(), link: link.trim(), pubDate });
    });
    return entries;
  }

  // Atom (<feed><entry>)
  const atomNs = XmlService.getNamespace('http://www.w3.org/2005/Atom');
  const atomEntries = root.getChildren('entry', atomNs);
  if (atomEntries.length > 0) {
    atomEntries.forEach(entry => {
      const title = entry.getChildText('title', atomNs) || '';
      const linkEl = entry.getChildren('link', atomNs).find(l =>
        l.getAttribute('rel')?.getValue() === 'alternate' || !l.getAttribute('rel')
      );
      const link = linkEl ? linkEl.getAttribute('href')?.getValue() || '' : '';
      const updated = entry.getChildText('updated', atomNs) || '';
      if (link) entries.push({ title: title.trim(), link: link.trim(), pubDate: updated });
    });
    return entries;
  }

  Logger.log(`${feed.name}: パース失敗（RSS/Atom形式を検出できず）`);
  return entries;
}

/**
 * Firebase /tournament-queue に新規エントリを追加
 */
function pushToQueue_(title, url, source) {
  const payload = {
    url: url,
    title: title,
    source: 'rss-auto-' + source,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  Logger.log(`  → キュー追加: ${title.substring(0, 50)}`);
}

// === 重複チェック（Firebase /tournament-queue の全URL） ===

function getSeenUrlsFromFirebase_() {
  const resp = UrlFetchApp.fetch(
    `${FIREBASE_URL}${QUEUE_PATH}.json?shallow=true`,
    { muteHttpExceptions: true }
  );

  const keys = JSON.parse(resp.getContentText());
  if (!keys || typeof keys !== 'object') return new Set();

  // 全エントリのURLを取得（バッチで取得）
  const seenUrls = new Set();
  const allKeys = Object.keys(keys);

  // 100件ずつバッチ取得（GAS実行時間制限対策）
  const batchSize = 100;
  for (let i = 0; i < allKeys.length; i += batchSize) {
    const batch = allKeys.slice(i, i + batchSize);
    const requests = batch.map(key => ({
      url: `${FIREBASE_URL}${QUEUE_PATH}/${key}/url.json`,
      muteHttpExceptions: true
    }));

    const responses = UrlFetchApp.fetchAll(requests);
    responses.forEach(r => {
      const url = JSON.parse(r.getContentText());
      if (url) seenUrls.add(url);
    });
  }

  Logger.log(`Firebase既存URL: ${seenUrls.size}件を取得`);
  return seenUrls;
}

// === 実行ログ ===

function writeLog_(logEntry) {
  UrlFetchApp.fetch(`${FIREBASE_URL}${LOG_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(logEntry),
    muteHttpExceptions: true
  });
  Logger.log('実行ログをFirebaseに記録');
}

// === トリガー管理 ===

/**
 * 毎日朝9時に実行するトリガーを作成（1回だけ実行）
 */
function createDailyTrigger() {
  // 既存トリガーを削除
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'collectTournaments') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('collectTournaments')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('トリガー作成完了: 毎日9時に collectTournaments を実行');
}

/**
 * 手動テスト用
 */
function testRun() {
  Logger.log('=== テスト実行開始 ===');
  collectTournaments();
  Logger.log('=== テスト実行完了 ===');
}

/**
 * 直近の実行ログを確認（デバッグ用）
 */
function showRecentLogs() {
  const resp = UrlFetchApp.fetch(
    `${FIREBASE_URL}${LOG_PATH}.json?orderBy=%22timestamp%22&limitToLast=5`,
    { muteHttpExceptions: true }
  );
  const logs = JSON.parse(resp.getContentText());
  if (!logs) {
    Logger.log('ログなし');
    return;
  }
  Object.entries(logs).forEach(([key, log]) => {
    Logger.log(`${log.timestamp}: 新規${log.totalNew}件, スキップ${log.totalSkipped}件 (${log.durationSec}秒)`);
    log.feeds.forEach(f => {
      Logger.log(`  ${f.name}: ${f.entries}件中 ${f.newCount}件新規${f.error ? ' [エラー: ' + f.error + ']' : ''}`);
    });
  });
}
