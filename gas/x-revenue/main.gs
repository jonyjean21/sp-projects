/**
 * X収益実験 — 自動投稿 GAS
 *
 * 1日4投稿（4時間おき）、ランダムjitter付き
 * Gemini 2.5 Flash でテキスト生成 → Sheets にログ → IFTTT Webhook で X 投稿
 *
 * Script Properties:
 *   GEMINI_API_KEY   — Google AI Studio の API キー
 *   IFTTT_WEBHOOK_KEY — IFTTT Webhook キー（実験用アカウント）
 *   IFTTT_EVENT_NAME  — IFTTT イベント名（例: post_tweet_exp）
 *   SHEET_ID          — ログ用スプレッドシートID
 */

// ===== 設定 =====
const CONFIG = {
  genre: '副業・フリーランス',
  persona: 'AI×自動化で副業を効率化する個人開発者。実体験ベースで発信。',
  categories: [
    { name: '副業の始め方', weight: 2, themes: ['開業届の出し方', '確定申告の基礎', '副業バレ対策', '時間管理術'] },
    { name: 'AI活用術', weight: 3, themes: ['Claude活用法', 'ChatGPT仕事術', 'AI画像生成', 'AI×ライティング', 'AI×プログラミング'] },
    { name: '自動化・効率化', weight: 3, themes: ['GAS自動化', 'ノーコードツール', 'タスク自動化', 'API連携', 'bot構築'] },
    { name: 'フリーランス実践', weight: 2, themes: ['案件獲得', '単価交渉', 'ポートフォリオ', 'クライアント対応', '契約書の基本'] },
    { name: '収益化のリアル', weight: 2, themes: ['初月の売上', 'アフィリエイト体験談', '失敗談', '月5万達成まで'] },
    { name: 'マインドセット', weight: 1, themes: ['継続のコツ', '本業との両立', 'モチベ管理', '情報発信の意義'] },
  ],
  postsPerDay: 4,
  maxTweetLength: 280,  // 日本語は1文字=1カウント扱い（X仕様）
};

// ===== メイン: 投稿生成＆投稿 =====

function generateAndPost() {
  const props = PropertiesService.getScriptProperties();
  const geminiKey = props.getProperty('GEMINI_API_KEY');
  const iftttKey = props.getProperty('IFTTT_WEBHOOK_KEY');
  const iftttEvent = props.getProperty('IFTTT_EVENT_NAME');
  const sheetId = props.getProperty('SHEET_ID');

  if (!geminiKey || !iftttKey || !iftttEvent) {
    Logger.log('必須プロパティ未設定: GEMINI_API_KEY, IFTTT_WEBHOOK_KEY, IFTTT_EVENT_NAME');
    return;
  }

  // ランダムjitter（0〜25分待機）→ bot検出回避
  const jitterMs = Math.floor(Math.random() * 25 * 60 * 1000);
  Utilities.sleep(jitterMs);
  Logger.log(`Jitter: ${Math.round(jitterMs / 60000)}分待機`);

  // カテゴリ選択（重み付きランダム）
  const category = pickWeightedCategory_();
  const theme = category.themes[Math.floor(Math.random() * category.themes.length)];

  // 最近の投稿を取得（重複回避）
  const recentPosts = getRecentPosts_(sheetId, 10);

  // Gemini でツイート生成
  const tweet = callGemini_(geminiKey, category.name, theme, recentPosts);
  if (!tweet) {
    Logger.log('Gemini生成失敗');
    logToSheet_(sheetId, { status: 'error', error: 'gemini_failed', category: category.name, theme });
    return;
  }

  // IFTTT Webhook で投稿
  const postResult = postToX_(iftttKey, iftttEvent, tweet);

  // ログ記録
  logToSheet_(sheetId, {
    status: postResult ? 'posted' : 'error',
    content: tweet,
    category: category.name,
    theme: theme,
    jitter_min: Math.round(jitterMs / 60000),
    error: postResult ? '' : 'ifttt_failed',
  });

  Logger.log(`投稿完了: [${category.name}/${theme}] ${tweet.substring(0, 50)}...`);
}

// ===== カテゴリ重み付き選択 =====

function pickWeightedCategory_() {
  const cats = CONFIG.categories;
  const totalWeight = cats.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const cat of cats) {
    r -= cat.weight;
    if (r <= 0) return cat;
  }
  return cats[cats.length - 1];
}

// ===== Gemini API =====

function callGemini_(apiKey, categoryName, theme, recentPosts) {
  const recentList = recentPosts.length > 0
    ? `\n\n## 最近の投稿（重複を避けること）\n${recentPosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const prompt = `あなたは${CONFIG.persona}
X(Twitter)で「${CONFIG.genre}」ジャンルの有益情報を発信しています。

## 今回のお題
カテゴリ: ${categoryName}
テーマ: ${theme}

## 条件
- 280文字以内（厳守）
- 読んだ人が「へぇ、ためになる」と思う具体的な情報
- 実体験っぽい語り口（「〜してみたら」「〜だった」）
- 絵文字は0〜2個（多用しない）
- ハッシュタグは末尾に1〜2個（#副業 #AI活用 #フリーランス #自動化 から選択）
- アフィリエイトリンクや宣伝は絶対に入れない
- AI臭い定型文（「いかがでしたか」「〜ですよね」の連発）は禁止
- 改行は1〜2回まで（読みやすく）
${recentList}

ツイート本文のみを出力してください（JSON不要、説明不要）。`;

  try {
    const resp = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 500 }
        }),
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(resp.getContentText());
    if (result.error) {
      Logger.log('Gemini error: ' + result.error.message);
      return null;
    }

    let text = result.candidates[0].content.parts[0].text.trim();

    // 前後の引用符を除去
    text = text.replace(/^["「]|["」]$/g, '');

    // 280文字制限
    if (text.length > CONFIG.maxTweetLength) {
      text = text.substring(0, CONFIG.maxTweetLength - 1) + '…';
    }

    return text;
  } catch (e) {
    Logger.log('Gemini exception: ' + e.message);
    return null;
  }
}

// ===== IFTTT Webhook =====

function postToX_(iftttKey, eventName, tweetText) {
  try {
    const resp = UrlFetchApp.fetch(
      `https://maker.ifttt.com/trigger/${eventName}/with/key/${iftttKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ value1: tweetText }),
        muteHttpExceptions: true
      }
    );
    const code = resp.getResponseCode();
    if (code === 200) {
      Logger.log('IFTTT投稿成功');
      return true;
    } else {
      Logger.log(`IFTTT error: ${code} ${resp.getContentText()}`);
      return false;
    }
  } catch (e) {
    Logger.log('IFTTT exception: ' + e.message);
    return false;
  }
}

// ===== Sheets ログ =====

function getRecentPosts_(sheetId, count) {
  if (!sheetId) return [];
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('ログ');
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const startRow = Math.max(2, lastRow - count + 1);
    const numRows = lastRow - startRow + 1;
    // content は B列
    const values = sheet.getRange(startRow, 2, numRows, 1).getValues();
    return values.map(r => r[0]).filter(v => v);
  } catch (e) {
    Logger.log('Sheets read error: ' + e.message);
    return [];
  }
}

function logToSheet_(sheetId, data) {
  if (!sheetId) {
    Logger.log('SHEET_ID未設定 → ログスキップ');
    return;
  }
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName('ログ');
    if (!sheet) {
      sheet = ss.insertSheet('ログ');
      sheet.appendRow(['timestamp', 'content', 'category', 'theme', 'status', 'jitter_min', 'error']);
      // ヘッダー書式
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    }
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      now,
      data.content || '',
      data.category || '',
      data.theme || '',
      data.status || '',
      data.jitter_min || 0,
      data.error || '',
    ]);
  } catch (e) {
    Logger.log('Sheets write error: ' + e.message);
  }
}

// ===== トリガー管理 =====

/**
 * 4時間おきトリガーを設定（07:00, 11:00, 15:00, 19:00 JST目安）
 * 実際の投稿時刻はjitterで ±25分ズレる
 */
function createTriggers() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'generateAndPost') ScriptApp.deleteTrigger(t);
  });

  // 4時間おき
  const hours = [7, 11, 15, 19];
  hours.forEach(h => {
    ScriptApp.newTrigger('generateAndPost')
      .timeBased()
      .atHour(h)
      .nearMinute(0)
      .everyDays(1)
      .create();
  });

  Logger.log(`トリガー設定完了: ${hours.map(h => h + ':00').join(', ')} JST`);
}

/**
 * テスト用: 1回だけ生成＆投稿（jitterなし）
 */
function testPost() {
  // jitterをスキップするためにカスタム実行
  const props = PropertiesService.getScriptProperties();
  const geminiKey = props.getProperty('GEMINI_API_KEY');
  const iftttKey = props.getProperty('IFTTT_WEBHOOK_KEY');
  const iftttEvent = props.getProperty('IFTTT_EVENT_NAME');
  const sheetId = props.getProperty('SHEET_ID');

  const category = pickWeightedCategory_();
  const theme = category.themes[Math.floor(Math.random() * category.themes.length)];
  const recentPosts = getRecentPosts_(sheetId, 10);

  Logger.log(`テスト: [${category.name}] ${theme}`);

  const tweet = callGemini_(geminiKey, category.name, theme, recentPosts);
  if (tweet) {
    Logger.log(`生成: ${tweet}`);

    // 投稿はコメントアウト（テスト時は生成のみ確認したい場合）
    // const result = postToX_(iftttKey, iftttEvent, tweet);

    logToSheet_(sheetId, {
      status: 'test',
      content: tweet,
      category: category.name,
      theme: theme,
      jitter_min: 0,
    });
  } else {
    Logger.log('生成失敗');
  }
}

/**
 * Geminiのみテスト（IFTTT/Sheets不要）
 */
function testGeminiOnly() {
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!geminiKey) { Logger.log('GEMINI_API_KEY未設定'); return; }

  const category = pickWeightedCategory_();
  const theme = category.themes[Math.floor(Math.random() * category.themes.length)];

  Logger.log(`テスト: [${category.name}] ${theme}`);
  const tweet = callGemini_(geminiKey, category.name, theme, []);
  Logger.log(tweet || '生成失敗');
}
