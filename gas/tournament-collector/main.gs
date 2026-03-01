/**
 * 大会情報 RSS コレクター
 * molkky.jp + kokuchpro を毎日巡回 → Firebase /tournament-queue に push
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const QUEUE_PATH = '/tournament-queue';

const FEEDS = [
  {
    name: 'JMA公式',
    url: 'https://molkky.jp/tournament/feed/',
    filter: null // 全件対象（モルック専門サイト）
  },
  {
    name: 'こくちーず',
    url: 'https://kokuchpro.com/feature/%E3%83%A2%E3%83%AB%E3%83%83%E3%82%AF/.rss',
    filter: /モルック|mölkky|molkky/i // タイトルフィルタ
  }
];

/**
 * メイン処理: 全フィードを巡回して新規エントリをキューに追加
 */
function collectTournaments() {
  const seen = getSeenUrls_();
  let totalNew = 0;

  FEEDS.forEach(feed => {
    try {
      const entries = fetchRSS_(feed);
      let newCount = 0;

      entries.forEach(entry => {
        if (seen.has(entry.link)) return;
        if (feed.filter && !feed.filter.test(entry.title)) return;

        pushToQueue_(entry.title, entry.link, feed.name);
        markSeen_(seen, entry.link);
        newCount++;
      });

      Logger.log(`${feed.name}: ${entries.length}件中 ${newCount}件が新規`);
      totalNew += newCount;
    } catch (e) {
      Logger.log(`${feed.name} エラー: ${e.message}`);
    }
  });

  saveSeenUrls_(seen);
  Logger.log(`完了: 合計 ${totalNew}件の新規エントリをキューに追加`);
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

// === 重複チェック（PropertiesService） ===

const MAX_SEEN = 500;

function getSeenUrls_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('SEEN_URLS');
  return new Set(raw ? JSON.parse(raw) : []);
}

function markSeen_(seenSet, url) {
  seenSet.add(url);
}

function saveSeenUrls_(seenSet) {
  const arr = Array.from(seenSet);
  // FIFO: 古いものから削除して500件以内に
  const trimmed = arr.length > MAX_SEEN ? arr.slice(arr.length - MAX_SEEN) : arr;
  PropertiesService.getScriptProperties().setProperty('SEEN_URLS', JSON.stringify(trimmed));
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
 * 記録済みURL一覧を確認（デバッグ用）
 */
function showSeenUrls() {
  const seen = getSeenUrls_();
  Logger.log(`記録済みURL: ${seen.size}件`);
  seen.forEach(url => Logger.log(`  ${url}`));
}
