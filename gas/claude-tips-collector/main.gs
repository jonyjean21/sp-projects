/**
 * Claude Code Tips コレクター
 * RSS/Atom フィードから Claude Code 関連記事を収集 → Firebase /claude-tips-queue に push
 *
 * セットアップ:
 *   1. createTrigger() を1回実行してトリガー登録（6時間おき）
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const QUEUE_PATH = '/claude-tips-queue';
const LOG_PATH = '/claude-tips-collector-log';

const SOURCES = [
  { name: 'reddit-claudeai', url: 'https://www.reddit.com/r/ClaudeAI.rss' },
  { name: 'reddit-claudecode', url: 'https://www.reddit.com/r/ClaudeCode.rss' },
  { name: 'hn', url: 'https://hnrss.org/newest?q=claude+code&points=5' },
  { name: 'zenn', url: 'https://zenn.dev/topics/claudecode/feed' },
  { name: 'qiita', url: 'https://qiita.com/tags/claude-code/feed' },
  { name: 'anthropic-blog', url: 'https://www.anthropic.com/rss.xml' }
];

/**
 * メイン処理: 全ソースから収集してキューに追加
 */
function collectAll() {
  const startTime = new Date();
  let totalNew = 0;
  let totalSkipped = 0;

  // 既存URLをSetで取得（重複チェック用）
  const existingUrls = getExistingUrls_();

  for (const source of SOURCES) {
    try {
      const { newCount, skipped } = collectSource_(source, existingUrls);
      totalNew += newCount;
      totalSkipped += skipped;
      Logger.log(`${source.name}: ${newCount}件追加, ${skipped}件スキップ`);
    } catch (e) {
      Logger.log(`${source.name} エラー: ${e.message}`);
    }
  }

  const durationSec = Math.round((new Date() - startTime) / 1000);

  writeLog_({
    timestamp: startTime.toISOString(),
    durationSec,
    newCount: totalNew,
    skipped: totalSkipped
  });

  Logger.log(`完了: ${totalNew}件追加, ${totalSkipped}件スキップ (${durationSec}秒)`);
}

/**
 * 既存キューのURLをSetで返す
 */
function getExistingUrls_() {
  const res = UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}.json`, {
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return new Set();

  const data = JSON.parse(res.getContentText());
  if (!data) return new Set();

  const urls = new Set();
  for (const key of Object.keys(data)) {
    if (data[key] && data[key].url) {
      urls.add(data[key].url);
    }
  }
  return urls;
}

/**
 * ソースからRSS取得 → 新規エントリをキューに追加
 */
function collectSource_(source, existingUrls) {
  const res = UrlFetchApp.fetch(source.url, {
    muteHttpExceptions: true,
    followRedirects: true
  });

  if (res.getResponseCode() !== 200) {
    throw new Error(`HTTP ${res.getResponseCode()}`);
  }

  const entries = parseRss_(res.getContentText());
  let newCount = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.url) { skipped++; continue; }

    if (existingUrls.has(entry.url)) {
      skipped++;
      continue;
    }

    pushToQueue_({
      url: entry.url,
      title: entry.title || '(no title)',
      content_preview: (entry.content || '').substring(0, 500),
      source: source.name,
      published_at: entry.published_at || new Date().toISOString(),
      collected_at: new Date().toISOString(),
      status: 'pending'
    });

    existingUrls.add(entry.url);
    newCount++;
  }

  return { newCount, skipped };
}

/**
 * RSS/Atom XMLをパースしてエントリ配列を返す
 */
function parseRss_(xml) {
  const doc = XmlService.parse(xml);
  const root = doc.getRootElement();
  const ns = root.getNamespace();
  const entries = [];

  // Atom (feed > entry)
  const atomEntries = root.getChildren('entry', ns);
  if (atomEntries.length > 0) {
    for (const entry of atomEntries) {
      const linkEl = entry.getChildren('link', ns).find(
        el => !el.getAttribute('rel') || el.getAttribute('rel').getValue() === 'alternate'
      );
      const url = linkEl ? (linkEl.getAttribute('href') ? linkEl.getAttribute('href').getValue() : linkEl.getValue()) : null;

      const contentEl = entry.getChild('content', ns) || entry.getChild('summary', ns);
      const rawContent = contentEl ? contentEl.getValue() : '';
      const content = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      entries.push({
        url,
        title: (entry.getChildText('title', ns) || '').replace(/<[^>]+>/g, '').trim(),
        content,
        published_at: entry.getChildText('published', ns) || entry.getChildText('updated', ns)
      });
    }
    return entries;
  }

  // RSS 2.0 (rss > channel > item)
  const channel = root.getChild('channel');
  if (!channel) return entries;

  const items = channel.getChildren('item');
  for (const item of items) {
    const url = item.getChildText('link') || item.getChildText('guid');
    const descEl = item.getChild('description');
    const rawDesc = descEl ? descEl.getValue() : '';
    const content = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    entries.push({
      url,
      title: (item.getChildText('title') || '').trim(),
      content,
      published_at: item.getChildText('pubDate')
    });
  }

  return entries;
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

/**
 * 6時間おきに実行するトリガーを作成（1回だけ実行）
 */
function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'collectAll') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('collectAll')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('トリガー作成完了: 6時間おきに collectAll を実行');
}

/**
 * テスト実行
 */
function testRun() {
  Logger.log('=== テスト実行開始 ===');
  collectAll();
  Logger.log('=== テスト実行完了 ===');
}
