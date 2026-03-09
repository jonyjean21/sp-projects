/**
 * Claude Code Tips 日次ダイジェスト生成
 * 毎朝7時JST: Firebase pending取得 → Gemini翻訳・要約 → BuildHub WP投稿
 *
 * 記事構成:
 *   - 今日のメイン（海外バズ記事を1本フル翻訳・詳細解説）
 *   - その他の注目（残り記事を要約）
 *   - BuildHub編集部より（今日の総評）
 *
 * セットアップ（Script Propertiesに設定）:
 *   GEMINI_API_KEY  : Google AI Studio で取得
 *   BUILDHUB_WP_USER: buildhub260309
 *   BUILDHUB_WP_PASS: アプリケーションパスワード（スペース含む）
 *
 * 初回: createDailyTrigger() を1回実行
 */

const DIGEST_LOG_PATH = '/claude-tips-digest-log';
const BUILDHUB_URL = 'https://www.buildhub.jp';
const CLAUDE_CODE_CATEGORY_ID = 2;

const SOURCE_LABELS = {
  'reddit-claudeai':   'Reddit r/ClaudeAI',
  'reddit-claudecode': 'Reddit r/ClaudeCode',
  'hn':                'Hacker News',
  'zenn':              'Zenn',
  'qiita':             'Qiita',
  'dev-to':            'dev.to',
  'x-twitter':         'X (Twitter)',
};

// ソース → WPタグID
const SOURCE_TAG_MAP = {
  'hn':                7,
  'reddit-claudeai':   8,
  'reddit-claudecode': 8,
  'zenn':              9,
  'qiita':             10,
  'dev-to':            11,
  'x-twitter':         15,
};
const BASE_TAGS = [6, 12]; // Claude Code, AI開発

/**
 * メイン: 日次ダイジェスト生成・投稿
 */
function runDailyDigest() {
  const props = PropertiesService.getScriptProperties();
  const GEMINI_KEY = props.getProperty('GEMINI_API_KEY');
  const WP_USER = props.getProperty('BUILDHUB_WP_USER');
  const WP_PASS = props.getProperty('BUILDHUB_WP_PASS');

  if (!GEMINI_KEY || !WP_USER || !WP_PASS) {
    Logger.log('Script Propertiesが未設定です（GEMINI_API_KEY / BUILDHUB_WP_USER / BUILDHUB_WP_PASS）');
    return;
  }

  // 重複投稿防止: 今日のスラッグが既にある場合はスキップ
  const todaySlug = `claude-code-${getJstDateSlug_()}`;
  const slugCheckRes = UrlFetchApp.fetch(
    `${BUILDHUB_URL}/wp-json/wp/v2/posts?slug=${todaySlug}`,
    { muteHttpExceptions: true }
  );
  if (slugCheckRes.getResponseCode() === 200) {
    const existing = JSON.parse(slugCheckRes.getContentText());
    if (existing.length > 0) {
      Logger.log(`本日の記事（${todaySlug}）は既に投稿済みです。スキップ。`);
      return;
    }
  }

  const items = fetchPendingItems_();
  if (items.length === 0) {
    Logger.log('pendingアイテムなし。スキップ。');
    return;
  }
  Logger.log(`取得: ${items.length}件`);

  const top = selectTopItems_(items, 7);
  Logger.log(`選択: ${top.length}件`);

  const result = summarizeWithGemini_(top, GEMINI_KEY);
  if (!result) {
    Logger.log('Gemini要約失敗。スキップ。');
    return;
  }

  const today = getJstDateString_();
  const title = `Claude Code 海外バズ翻訳まとめ【${today}】`;
  const content = buildHtml_(result, today, top);
  const excerpt = result.excerpt || '';

  // タグID（重複除去）
  const tagIds = [...new Set([
    ...BASE_TAGS,
    ...top.map(i => SOURCE_TAG_MAP[i.source]).filter(Boolean)
  ])];

  const postId = postToWordPress_(title, content, excerpt, tagIds, WP_USER, WP_PASS);
  if (!postId) {
    Logger.log('WP投稿失敗。');
    return;
  }

  markAsPublished_(top, postId);
  writeDigestLog_({ date: today, postId, itemCount: top.length });
  Logger.log(`完了: 投稿ID=${postId}, ${top.length}件`);
}

/**
 * Firebase から過去48hのpendingアイテムを取得
 */
function fetchPendingItems_() {
  const res = UrlFetchApp.fetch(
    `${FIREBASE_URL}${QUEUE_PATH}.json`,
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return [];

  const data = JSON.parse(res.getContentText());
  if (!data) return [];

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  return Object.entries(data)
    .filter(([, v]) => v && v.status === 'pending' && (!v.collected_at || v.collected_at >= cutoff))
    .map(([id, v]) => ({ id, ...v }));
}

/**
 * 海外ソース優遇 + コード含有ボーナスでソートして上位N件を選択
 */
function selectTopItems_(items, n) {
  const overseas = new Set(['hn', 'reddit-claudeai', 'reddit-claudecode']);
  return items
    .sort((a, b) => {
      const scoreA = (a.score || 0) + (overseas.has(a.source) ? 50 : 0) + (a.has_code ? 20 : 0) + (a.github_url ? 15 : 0);
      const scoreB = (b.score || 0) + (overseas.has(b.source) ? 50 : 0) + (b.has_code ? 20 : 0) + (b.github_url ? 15 : 0);
      return scoreB - scoreA;
    })
    .slice(0, n);
}

/**
 * Gemini APIで翻訳・要約・編集部コメントを一括生成
 */
function summarizeWithGemini_(items, apiKey) {
  const articleList = items.map((item, i) =>
    `[${i + 1}] タイトル: ${item.title}\nURL: ${item.url}\nソース: ${item.source} (スコア:${item.score || 0})` +
    (item.github_url ? `\n補足: GitHubリポジトリあり: ${item.github_url}` : '') +
    (item.has_code && !item.github_url ? '\n補足: コード例あり' : '') +
    `\n本文: ${(item.content_preview || '').substring(0, 400)}`
  ).join('\n\n');

  const mainSource = items[0]?.source || '';
  const isOverseas = ['hn', 'reddit-claudeai', 'reddit-claudecode'].includes(mainSource);
  const mainHint = isOverseas
    ? '記事[1]は海外で最もバズった記事です。500文字以上の詳しい日本語解説を書いてください。'
    : '記事[1]は本日の注目記事です。400文字程度の詳しい日本語解説を書いてください。';

  const prompt = `あなたはClaude Code・AI開発ツール専門の日本語メディア「BuildHub」の編集者です。
以下の記事リストを読んで、日本のエンジニア向けにまとめてください。

${mainHint}
記事[2]以降は2〜3文の要約で構いません。

以下のJSON形式で返してください（JSONのみ、説明文不要）:

{
  "excerpt": "記事全体の1文要約（100文字以内、SEO用）",
  "editor_comment": "BuildHub編集部として今日の注目ポイントを2〜3文でコメント。エンジニアが実際に使える視点で。",
  "items": [
    {
      "index": 1,
      "title_ja": "自然な日本語タイトル",
      "is_main": true,
      "summary": "詳しい日本語解説（記事[1]は500文字以上）。以下の構成で書くこと：\\n①何が問題で何を解決しているか（150字）\\n②どう動くか・核心の実装アプローチ（コードがある場合は核心部分10〜20行をコードブロックで示し、直後に「このコードでやっていること」を3〜5文で日本語解説）\\n③日本のエンジニアへの示唆・応用アイデア（150字）\\nGitHubリポジトリがある場合は「何ができるか」を1文で必ず明記。",
      "score_label": "HN 234 points または Reddit 456 upvotes または空文字",
      "url": "元のURL",
      "source": "ソース名"
    },
    {
      "index": 2,
      "title_ja": "日本語タイトル",
      "is_main": false,
      "summary": "要点を2〜3文で日本語説明",
      "score_label": "",
      "url": "元のURL",
      "source": "ソース名"
    }
  ]
}

記事リスト:
${articleList}`;

  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
      }),
      muteHttpExceptions: true
    }
  );

  if (res.getResponseCode() !== 200) {
    Logger.log(`Gemini APIエラー: ${res.getResponseCode()} ${res.getContentText()}`);
    return null;
  }

  try {
    const result = JSON.parse(res.getContentText());
    const text = result.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    Logger.log(`Geminiレスポンスパースエラー: ${e.message}`);
    return null;
  }
}

/**
 * MarkdownをHTML変換（コードブロック・太字・インラインコード）
 */
function mdToHtml_(text) {
  if (!text) return '';
  // コードブロック: ```lang\n...\n``` → <pre><code>
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre style="background:#1e1e1e;color:#d4d4d4;padding:16px;overflow-x:auto;border-radius:6px;margin:16px 0;"><code${langClass}>${escaped}</code></pre>`;
  });
  // 太字
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // インラインコード
  text = text.replace(/`([^`\n]+)`/g, '<code style="background:#f4f4f4;padding:2px 6px;border-radius:3px;">$1</code>');
  // ①②③ の前に改行
  text = text.replace(/\n([①②③④⑤])/g, '<br>$1');
  return text;
}

/**
 * WP記事HTMLを生成（バズ翻訳メディア構成）
 */
function buildHtml_(result, today, rawItems) {
  const items         = result.items || [];
  const editorComment = result.editor_comment || '';

  // ソース内訳
  const sourceCounts = {};
  for (const ri of rawItems) {
    const label = SOURCE_LABELS[ri.source] || ri.source;
    sourceCounts[label] = (sourceCounts[label] || 0) + 1;
  }
  const sourceSummary = Object.entries(sourceCounts).map(([s, c]) => `${s} ${c}件`).join(' / ');

  let html = `<p>本日の注目記事 ${items.length}本をお届けします。（${sourceSummary}）</p>\n\n`;

  for (const item of items) {
    const label      = SOURCE_LABELS[item.source] || item.source;
    const url        = item.url;
    const scorePart  = item.score_label ? ` <small>(${item.score_label})</small>` : '';

    // GitHubバナー用URLをrawItemsから取得
    const rawItem = rawItems.find(r => r.url === item.url) || {};
    const githubUrl = rawItem.github_url || null;

    const summaryHtml = mdToHtml_(item.summary || '');

    if (item.is_main) {
      html += `<div style="border-left:4px solid #0073aa;padding:12px 16px;margin:24px 0;background:#f0f7ff;">\n`;
      html += `<p style="margin:0 0 4px;"><strong>📌 今日のメイン</strong></p>\n`;
      html += `</div>\n\n`;
      html += `<h2>${item.title_ja}${scorePart}</h2>\n`;
      html += `<p><strong>ソース:</strong> ${label}</p>\n`;
      if (githubUrl) html += `<p>🔗 <a href="${githubUrl}" target="_blank" rel="noopener"><strong>GitHubリポジトリを見る</strong></a></p>\n`;
      html += `<div style="line-height:1.8;">${summaryHtml}</div>\n`;
      html += `<p><a href="${url}" target="_blank" rel="noopener">元記事を読む（英語）→</a></p>\n`;
      html += `<hr style="margin:32px 0;">\n\n`;
      html += `<h2>その他の注目記事</h2>\n\n`;
    } else {
      html += `<h3>${item.title_ja}${scorePart}</h3>\n`;
      html += `<p><strong>ソース:</strong> ${label}</p>\n`;
      if (githubUrl) html += `<p>🔗 <a href="${githubUrl}" target="_blank" rel="noopener">GitHubリポジトリ</a></p>\n`;
      html += `<p>${summaryHtml}</p>\n`;
      html += `<p><a href="${url}" target="_blank" rel="noopener">記事を読む →</a></p>\n\n`;
    }
  }

  if (editorComment) {
    html += `<hr style="margin:32px 0;">\n\n`;
    html += `<div style="background:#f9f9f9;border:1px solid #ddd;padding:16px;border-radius:4px;">\n`;
    html += `<p style="margin:0 0 8px;"><strong>💬 BuildHub編集部より</strong></p>\n`;
    html += `<p style="margin:0;">${editorComment}</p>\n`;
    html += `</div>\n\n`;
  }

  html += `<p><small>このまとめはAIが自動生成しています。${today}時点の情報です。</small></p>`;
  return html;
}

/**
 * WordPress REST API に記事を投稿
 */
function postToWordPress_(title, content, excerpt, tagIds, user, pass) {
  const credentials = Utilities.base64Encode(`${user}:${pass}`);

  const res = UrlFetchApp.fetch(`${BUILDHUB_URL}/wp-json/wp/v2/posts`, {
    method: 'post',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      title, content, excerpt,
      status: 'publish',
      slug: `claude-code-${getJstDateSlug_()}`,
      categories: [CLAUDE_CODE_CATEGORY_ID],
      tags: tagIds,
    }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code !== 201) {
    Logger.log(`WP投稿エラー: ${code} ${res.getContentText().substring(0, 200)}`);
    return null;
  }

  return JSON.parse(res.getContentText()).id;
}

/**
 * 処理済みアイテムのstatusをpublishedに更新
 */
function markAsPublished_(items, postId) {
  for (const item of items) {
    UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}/${item.id}.json`, {
      method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify({ status: 'published', post_id: postId }),
      muteHttpExceptions: true
    });
  }
}

function getJstDateString_() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${String(jst.getUTCMonth() + 1).padStart(2, '0')}/${String(jst.getUTCDate()).padStart(2, '0')}`;
}

function getJstDateSlug_() {
  return getJstDateString_().replace(/\//g, '');
}

function writeDigestLog_(entry) {
  UrlFetchApp.fetch(`${FIREBASE_URL}${DIGEST_LOG_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(entry),
    muteHttpExceptions: true
  });
}

// === トリガー管理 ===

function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runDailyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runDailyDigest')
    .timeBased()
    .everyDays(1)
    .atHour(22) // UTC 22:00 = JST 7:00
    .create();
  Logger.log('トリガー作成完了: 毎朝7時JSTに runDailyDigest を実行');
}

function testDigest() {
  Logger.log('=== ダイジェストテスト開始 ===');
  runDailyDigest();
  Logger.log('=== ダイジェストテスト完了 ===');
}
