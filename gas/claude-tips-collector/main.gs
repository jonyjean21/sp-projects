/**
 * Claude Code Tips コレクター
 * 各ソースのAPIからClaude Code関連記事を収集 → Firebase /claude-tips-queue に push
 *
 * セットアップ:
 *   1. createTrigger() を1回実行してトリガー登録（6時間おき）
 *
 * 収集データ拡張（v2）:
 *   - content_preview: 800文字（コード含有記事は価値高いため増量）
 *   - has_code: コードブロックを含むか（true/false）
 *   - github_url: GitHubリポジトリURLがあれば抽出
 *   - score: HN points / Reddit upvotes / Zenn liked_count / dev.to reactions
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const QUEUE_PATH = '/claude-tips-queue';
const LOG_PATH = '/claude-tips-collector-log';

// === IFTTT受け口 ===
// IFTTTから「X Claude Code バズ投稿」が POST されてきたときの受け口
// IFTTT Webhook Action: POST https://viisi-master-app-default-rtdb.firebaseio.com/claude-tips-queue.json
// Body: {"url":"{{LinkToTweet}}","title":"{{Text}}","source":"x-twitter","score":{{FavoriteCount}},
//        "content_preview":"{{Text}}","status":"pending","collected_at":"{{CreatedAt}}"}
// → Firebaseに直接pushされるためGAS処理不要。ただし重複チェックはない。
// IFTTT設定手順: data/buildhub/IFTTT_X_SETUP.md を参照

/**
 * メイン処理: 全ソースから収集してキューに追加
 */
function collectAll() {
  const startTime = new Date();
  let totalNew = 0;
  let totalSkipped = 0;

  const existingUrls = getExistingUrls_();

  const collectors = [
    { fn: collectReddit_,        name: 'reddit-claudeai',   sub: 'ClaudeAI' },
    { fn: collectReddit_,        name: 'reddit-claudecode', sub: 'ClaudeCode' },
    { fn: collectHN_,            name: 'hn' },
    { fn: collectZenn_,          name: 'zenn' },
    { fn: collectQiita_,         name: 'qiita' },
    { fn: collectDevTo_,         name: 'dev-to' },
    { fn: collectGithubReleases_, name: 'github-releases' }
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
 * コードブロック・GitHub URLの検出
 */
function detectCode_(text) {
  if (!text) return { has_code: false, github_url: null };
  const has_code = /```[\s\S]*?```|<code[\s\S]*?<\/code>|\$\s+[a-z]/i.test(text);
  const ghMatch = text.match(/https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/);
  return {
    has_code,
    github_url: ghMatch ? ghMatch[0] : null
  };
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
    .map(p => {
      const selftext = (p.selftext || '').substring(0, 800);
      const { has_code, github_url } = detectCode_(selftext);
      // self postはRedditのURL、外部リンクはそのURL
      const url = p.is_self
        ? `https://www.reddit.com${p.permalink}`
        : p.url;
      return {
        url,
        title: p.title,
        content_preview: selftext,
        score: p.score,
        has_code,
        github_url,
        published_at: new Date(p.created_utc * 1000).toISOString()
      };
    });
}

/**
 * Hacker News (hnrss.org - points >= 10)
 * Show HNなどコード系が多いため github_url 検出を重視
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
 * タイトルから「実装」「作ってみた」「コード」を含む記事はスコアボーナス
 */
function collectZenn_() {
  const res = UrlFetchApp.fetch(
    'https://zenn.dev/api/articles?topic_name=claudecode&order=liked_count&count=30',
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);

  const data = JSON.parse(res.getContentText());
  const techKeywords = /実装|作って|コード|試して|使って|ツール|自動化|スクリプト|設定|CLAUDE\.md|hook/i;

  return (data.articles || [])
    .filter(a => a.liked_count >= 5)
    .map(a => {
      const isTech = techKeywords.test(a.title);
      return {
        url: `https://zenn.dev${a.path}`,
        title: a.title,
        content_preview: '',
        score: a.liked_count + (isTech ? 10 : 0), // 技術系はボーナス
        has_code: isTech, // タイトルから推定
        github_url: null,
        published_at: a.published_at
      };
    });
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
    .map(a => {
      const preview = (a.description || '').substring(0, 800);
      const { has_code, github_url } = detectCode_(preview);
      return {
        url: a.url,
        title: a.title,
        content_preview: preview,
        score: a.positive_reactions_count,
        has_code,
        github_url,
        published_at: a.published_at
      };
    });
}

/**
 * GitHub anthropics/claude-code releases (Atom)
 * 公式リリースノートを収集。バージョン更新情報はBuildhubの差別化コンテンツ
 */
function collectGithubReleases_() {
  const res = UrlFetchApp.fetch(
    'https://github.com/anthropics/claude-code/releases.atom',
    { muteHttpExceptions: true, headers: { 'User-Agent': 'claude-tips-collector/1.0' } }
  );
  if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);

  const entries = parseRss_(res.getContentText(), 'github-releases');
  // リリースノートはコード記事として扱う。score=60固定（HN/Redditの高スコア記事より下位、低スコア記事より上位）
  return entries.map(e => ({ ...e, score: 60, has_code: true }));
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
      const rawContent = contentEl ? contentEl.getValue() : '';
      const content = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 800);
      const { has_code, github_url } = detectCode_(rawContent);

      // HNのスコアをcommentsフィールドから取得試行
      let score = null;
      try {
        const commentsEl = entry.getChild('comments', ns);
        if (commentsEl) {
          const pointsMatch = commentsEl.getValue().match(/(\d+)\s*point/i);
          if (pointsMatch) score = parseInt(pointsMatch[1]);
        }
      } catch(e) {}

      entries.push({
        url,
        title: (entry.getChildText('title', ns) || '').replace(/<[^>]+>/g, '').trim(),
        content_preview: content,
        score,
        has_code,
        github_url,
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
    const rawContent = desc ? desc.getValue() : '';
    const content = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 800);
    const { has_code, github_url } = detectCode_(rawContent);

    // HN RSS: points を comments欄から抽出
    let score = null;
    const commentsText = item.getChildText('comments') || '';
    const pointsMatch = commentsText.match(/(\d+)\s*point/i) || content.match(/(\d+)\s*point/i);
    if (pointsMatch) score = parseInt(pointsMatch[1]);

    entries.push({
      url,
      title: (item.getChildText('title') || '').trim(),
      content_preview: content,
      score,
      has_code,
      github_url,
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
