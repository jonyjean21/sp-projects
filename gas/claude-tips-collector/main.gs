/**
 * Claude Code Tips コレクター
 * 各ソースのAPIからClaude Code関連記事を収集 → Firebase /claude-tips-queue に push
 *
 * セットアップ:
 *   1. createTrigger() を1回実行してトリガー登録（6時間おき）
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const QUEUE_PATH = '/claude-tips-queue';
const LOG_PATH = '/claude-tips-collector-log';

/**
 * メイン処理: 全ソースから収集してキューに追加
 */
function collectAll() {
  const startTime = new Date();
  let totalNew = 0;
  let totalSkipped = 0;

  const existingUrls = getExistingUrls_();

  const collectors = [
    { fn: collectReddit_, name: 'reddit-claudeai', sub: 'ClaudeAI' },
    { fn: collectReddit_, name: 'reddit-claudecode', sub: 'ClaudeCode' },
    { fn: collectHN_, name: 'hn' },
    { fn: collectZenn_, name: 'zenn' },
    { fn: collectQiita_, name: 'qiita' },
    { fn: collectDevTo_, name: 'dev-to' }
  ];

  for (const c of collectors) {
    try {
      const entries = c.fn(c.sub || null);
      let newCount = 0, skipped = 0;

      for (const entry of entries) {
        if (!entry.url || existingUrls.has(entry.url)) { skipped++; continue; }
        pushToQueue_({ ...entry, source: c.name, collected_at: new Date().toISOString(), status: 'pending' });
        existingUrls.add(entry.url);
        newCount++;
      }

      totalNew += newCount;
      totalSkipped += skipped;
      Logger.log(`${c.name}: ${newCount}件追加, ${skipped}件スキップ`);
    } catch (e) {
      Logger.log(`${c.name} エラー: ${e.message}`);
    }
  }

  const durationSec = Math.round((new Date() - startTime) / 1000);
  writeLog_({ timestamp: startTime.toISOString(), durationSec, newCount: totalNew, skipped: totalSkipped });
  Logger.log(`完了: ${totalNew}件追加, ${totalSkipped}件スキップ (${durationSec}秒)`);
}

/**
 * Reddit JSON API (hot posts)
 */
function collectReddit_(subreddit) {
  const res = UrlFetchApp.fetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
    { muteHttpExceptions: true, headers: { 'User-Agent': 'claude-tips-collector/1.0' } }
  );
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);

  const data = JSON.parse(res.getContentText());
  return data.data.children
    .map(c => c.data)
    .filter(p => p.score >= 10 && !p.stickied)
    .map(p => ({
      url: p.url.startsWith('https://www.reddit.com') ? `https://www.reddit.com${p.permalink}` : p.url,
      title: p.title,
      content_preview: (p.selftext || '').substring(0, 500),
      score: p.score,
      published_at: new Date(p.created_utc * 1000).toISOString()
    }));
}

/**
 * Hacker News RSS (points >= 10)
 */
function collectHN_() {
  const res = UrlFetchApp.fetch(
    'https://hnrss.org/newest?q=claude+code&points=10',
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);
  return parseRss_(res.getContentText(), 'hn');
}

/**
 * Zenn JSON API (liked_count >= 5)
 */
function collectZenn_() {
  const res = UrlFetchApp.fetch(
    'https://zenn.dev/api/articles?topic_name=claudecode&order=liked_count&count=30',
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);

  const data = JSON.parse(res.getContentText());
  return (data.articles || [])
    .filter(a => a.liked_count >= 5)
    .map(a => ({
      url: `https://zenn.dev${a.path}`,
      title: a.title,
      content_preview: '',
      score: a.liked_count,
      published_at: a.published_at
    }));
}

/**
 * Qiita RSS
 */
function collectQiita_() {
  const res = UrlFetchApp.fetch(
    'https://qiita.com/tags/claude-code/feed',
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);
  return parseRss_(res.getContentText(), 'qiita');
}

/**
 * dev.to JSON API (reactions >= 5)
 */
function collectDevTo_() {
  const res = UrlFetchApp.fetch(
    'https://dev.to/api/articles?tag=claudecode&top=7',
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);

  const articles = JSON.parse(res.getContentText());
  return articles
    .filter(a => a.positive_reactions_count >= 5)
    .map(a => ({
      url: a.url,
      title: a.title,
      content_preview: (a.description || '').substring(0, 500),
      score: a.positive_reactions_count,
      published_at: a.published_at
    }));
}

/**
 * RSS/Atom XMLをパースしてエントリ配列を返す
 */
function parseRss_(xml, sourceName) {
  const doc = XmlService.parse(xml);
  const root = doc.getRootElement();
  const ns = root.getNamespace();
  const entries = [];

  // Atom
  const atomEntries = root.getChildren('entry', ns);
  if (atomEntries.length > 0) {
    for (const entry of atomEntries) {
      const linkEl = entry.getChildren('link', ns).find(
        el => !el.getAttribute('rel') || el.getAttribute('rel').getValue() === 'alternate'
      );
      const url = linkEl
        ? (linkEl.getAttribute('href') ? linkEl.getAttribute('href').getValue() : linkEl.getValue())
        : null;
      const contentEl = entry.getChild('content', ns) || entry.getChild('summary', ns);
      const content = contentEl ? contentEl.getValue().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
      entries.push({
        url,
        title: (entry.getChildText('title', ns) || '').replace(/<[^>]+>/g, '').trim(),
        content_preview: content.substring(0, 500),
        score: null,
        published_at: entry.getChildText('published', ns) || entry.getChildText('updated', ns)
      });
    }
    return entries;
  }

  // RSS 2.0
  const channel = root.getChild('channel');
  if (!channel) return entries;
  for (const item of channel.getChildren('item')) {
    const url = item.getChildText('link') || item.getChildText('guid');
    const desc = item.getChild('description');
    const content = desc ? desc.getValue().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    entries.push({
      url,
      title: (item.getChildText('title') || '').trim(),
      content_preview: content.substring(0, 500),
      score: null,
      published_at: item.getChildText('pubDate')
    });
  }
  return entries;
}

/**
 * 既存キューのURLをSetで返す
 */
function getExistingUrls_() {
  const res = UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}.json`, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return new Set();
  const data = JSON.parse(res.getContentText());
  if (!data) return new Set();
  return new Set(Object.values(data).filter(v => v && v.url).map(v => v.url));
}

/**
 * Firebase キューに追加
 */
function pushToQueue_(payload) {
  UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * 実行ログをFirebaseに記録
 */
function writeLog_(logEntry) {
  UrlFetchApp.fetch(`${FIREBASE_URL}${LOG_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(logEntry),
    muteHttpExceptions: true
  });
}

// === トリガー管理 ===

function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'collectAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('collectAll').timeBased().everyHours(6).create();
  Logger.log('トリガー作成完了: 6時間おきに collectAll を実行');
}

function testRun() {
  Logger.log('=== テスト実行開始 ===');
  collectAll();
  Logger.log('=== テスト実行完了 ===');
}
