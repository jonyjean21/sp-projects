/**
 * Claude Code Tips 日次ダイジェスト生成
 * 毎朝7時JST: Firebase pending取得 → Gemini日本語要約 → BuildHub WP投稿
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

  // 1. Firebase から過去48hのpendingを取得
  const items = fetchPendingItems_();
  if (items.length === 0) {
    Logger.log('pendingアイテムなし。スキップ。');
    return;
  }

  // 2. スコアでソートして上位7件を選択
  const top = selectTopItems_(items, 7);
  Logger.log(`選択: ${top.length}件 (全${items.length}件中)`);

  // 3. Geminiで日本語要約
  const summaries = summarizeWithGemini_(top, GEMINI_KEY);
  if (!summaries) {
    Logger.log('Gemini要約失敗。スキップ。');
    return;
  }

  // 4. WP記事HTML生成
  const today = getJstDateString_();
  const title = `Claude Code 最新情報まとめ【${today}】`;
  const content = buildHtml_(summaries, today);

  // 5. BuildHub WPに投稿
  const postId = postToWordPress_(title, content, WP_USER, WP_PASS);
  if (!postId) {
    Logger.log('WP投稿失敗。');
    return;
  }

  // 6. 処理済みアイテムのstatusを更新
  markAsPublished_(top, postId);

  // 7. ログ記録
  writeDigestLog_({ date: today, postId, itemCount: top.length });
  Logger.log(`完了: 投稿ID=${postId}, ${top.length}件`);
}

/**
 * Firebase から過去48hのpendingアイテムを取得（全件取得してGAS側でフィルタ）
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
 * スコア順で上位N件を選択
 */
function selectTopItems_(items, n) {
  return items
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, n);
}

/**
 * Gemini APIで日本語要約
 */
function summarizeWithGemini_(items, apiKey) {
  const articleList = items.map((item, i) =>
    `[${i + 1}] タイトル: ${item.title}\nURL: ${item.url}\nソース: ${item.source}\n概要: ${item.content_preview || '(なし)'}`
  ).join('\n\n');

  const prompt = `以下のClaude Code関連記事を日本語でまとめてください。
各記事について以下のJSONを返してください。配列形式で全件返すこと。

{
  "items": [
    {
      "index": 1,
      "title_ja": "日本語タイトル",
      "summary": "記事の要点を2〜3文で日本語で説明",
      "url": "元のURL",
      "source": "ソース名"
    }
  ]
}

記事リスト:
${articleList}

注意:
- title_jaは自然な日本語に翻訳（英語タイトルは翻訳、日本語はそのまま）
- summaryはエンジニア向けに実用的な情報を含めること
- JSONのみ返すこと（説明文不要）`;

  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
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
    return JSON.parse(jsonMatch[0]).items;
  } catch (e) {
    Logger.log(`Geminiレスポンスパースエラー: ${e.message}`);
    return null;
  }
}

/**
 * WP記事HTMLを生成
 */
function buildHtml_(summaries, today) {
  const sourceLabels = {
    'reddit-claudeai': 'Reddit r/ClaudeAI',
    'reddit-claudecode': 'Reddit r/ClaudeCode',
    'hn': 'Hacker News',
    'zenn': 'Zenn',
    'qiita': 'Qiita',
    'dev-to': 'dev.to'
  };

  let html = `<p>Claude Codeに関する本日の注目記事をまとめました。海外・国内の最新情報をお届けします。</p>\n\n`;

  for (const item of summaries) {
    const sourceLabel = sourceLabels[item.source] || item.source;
    html += `<h2>${item.title_ja}</h2>\n`;
    html += `<p><strong>ソース:</strong> ${sourceLabel}</p>\n`;
    html += `<p>${item.summary}</p>\n`;
    html += `<p><a href="${item.url}" target="_blank" rel="noopener">記事を読む →</a></p>\n`;
    html += `<hr>\n\n`;
  }

  html += `<p><small>このまとめはAIが自動生成しています。${today}時点の情報です。</small></p>`;
  return html;
}

/**
 * WordPress REST API に記事を投稿
 */
function postToWordPress_(title, content, user, pass) {
  const credentials = Utilities.base64Encode(`${user}:${pass}`);

  const res = UrlFetchApp.fetch(`${BUILDHUB_URL}/wp-json/wp/v2/posts`, {
    method: 'post',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      title,
      content,
      status: 'publish',
      slug: `claude-code-${getJstDateSlug_()}`,
      categories: [CLAUDE_CODE_CATEGORY_ID]
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

/**
 * JST日付文字列を返す（例: 2026/03/09）
 */
function getJstDateString_() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${String(jst.getUTCMonth() + 1).padStart(2, '0')}/${String(jst.getUTCDate()).padStart(2, '0')}`;
}

/**
 * スラッグ用JST日付文字列（例: 20260309）
 */
function getJstDateSlug_() {
  return getJstDateString_().replace(/\//g, '');
}

/**
 * ダイジェストログをFirebaseに記録
 */
function writeDigestLog_(entry) {
  UrlFetchApp.fetch(`${FIREBASE_URL}${DIGEST_LOG_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(entry),
    muteHttpExceptions: true
  });
}

// === トリガー管理 ===

/**
 * 毎朝7時JSTのトリガーを作成（1回だけ実行）
 * GASのタイムゾーンはAmerica/New_Yorkのため22:00 UTC前日 = 7:00 JST
 */
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

/**
 * テスト実行（実際にWP投稿する）
 */
function testDigest() {
  Logger.log('=== ダイジェストテスト開始 ===');
  runDailyDigest();
  Logger.log('=== ダイジェストテスト完了 ===');
}
