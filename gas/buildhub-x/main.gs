/**
 * BuildHub X自動投稿 GAS
 *
 * 1日2投稿（朝9時・夜20時）
 * Gemini でClaude Code/AI開発Tipsを生成 → IFTTT → @buildhub_jp に投稿
 *
 * Script Properties:
 *   GEMINI_API_KEY    — Google AI Studio の API キー
 *   IFTTT_WEBHOOK_KEY — IFTTT Webhook キー（molkkyhub@gmail.comのPro）
 *   IFTTT_EVENT_NAME  — IFTTT イベント名（例: buildhub_tweet）
 */

const BH_CONFIG = {
  persona: 'BuildHub編集部。Claude Code・AI開発ツールの最新情報を発信。実際に使って試した知見をシェア。',
  categories: [
    {
      name: 'Claude Code Tips',
      weight: 4,
      themes: [
        'CLAUDE.mdの書き方', 'サブエージェント活用', 'ツール許可設定',
        'コスト削減テクニック', 'プロンプトの書き方', 'セッション管理',
        'フック（hooks）活用', 'MCP連携', 'git worktree',
      ]
    },
    {
      name: 'AI開発ツール',
      weight: 3,
      themes: [
        'Cursor vs Claude Code', 'GitHub Copilot比較', 'Windsurf活用',
        'Gemini CLI', 'AI駆動開発のコツ', 'vibe coding入門',
        'LLMのコスト比較', 'ローカルLLM活用',
      ]
    },
    {
      name: 'BuildHub記事から',
      weight: 2,
      themes: [
        '今週のAIニュース', 'Anthropicアップデート', 'Claude新機能',
        'AI開発者が使うツール', 'OSS AI特集',
      ]
    },
    {
      name: '実践ノウハウ',
      weight: 2,
      themes: [
        'GAS×AI自動化', 'Firebase×AI', 'WordPress自動投稿',
        'AIで副業実験', 'CI/CDとAI', 'ノーコード×AI',
      ]
    },
  ],
  maxTweetLength: 270, // URLが入ることを考慮してやや短めに
};

function generateAndPost() {
  const props = PropertiesService.getScriptProperties();
  const geminiKey = props.getProperty('GEMINI_API_KEY');
  const iftttKey = props.getProperty('IFTTT_WEBHOOK_KEY');
  const iftttEvent = props.getProperty('IFTTT_EVENT_NAME');

  if (!geminiKey || !iftttKey || !iftttEvent) {
    Logger.log('必須プロパティ未設定: GEMINI_API_KEY / IFTTT_WEBHOOK_KEY / IFTTT_EVENT_NAME');
    return;
  }

  // jitter（0〜15分）
  const jitterMs = Math.floor(Math.random() * 15 * 60 * 1000);
  Utilities.sleep(jitterMs);

  const category = pickCategory_();
  const theme = category.themes[Math.floor(Math.random() * category.themes.length)];

  const tweet = callGemini_(geminiKey, category.name, theme);
  if (!tweet) { Logger.log('生成失敗'); return; }

  const ok = postToX_(iftttKey, iftttEvent, tweet);
  Logger.log(`[${ok ? 'OK' : 'NG'}] [${category.name}/${theme}] ${tweet.substring(0, 60)}...`);
}

function pickCategory_() {
  const cats = BH_CONFIG.categories;
  const total = cats.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of cats) { r -= c.weight; if (r <= 0) return c; }
  return cats[cats.length - 1];
}

function callGemini_(apiKey, categoryName, theme) {
  const prompt = `あなたは${BH_CONFIG.persona}

## 今回のお題
カテゴリ: ${categoryName}
テーマ: ${theme}

## 条件
- ${BH_CONFIG.maxTweetLength}文字以内（厳守）
- Claude CodeやAI開発ツールの実用的なTipsや知見
- 「試してみた」「やってみたら」等、実体験ベースの語り口
- エンジニアや個人開発者が「役に立つ」と感じる具体的な内容
- ハッシュタグ末尾に1〜2個（#ClaudeCode #AI開発 #個人開発 から選択）
- 絵文字は0〜1個（多用しない）
- AI臭い定型文禁止（「いかがでしたか」「〜ですよね」の連発NG）
- アフィリエイトや宣伝は入れない

ツイート本文のみ出力（説明不要）。`;

  try {
    const res = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 400 }
        }),
        muteHttpExceptions: true
      }
    );
    const json = JSON.parse(res.getContentText());
    if (json.error) { Logger.log('Gemini error: ' + json.error.message); return null; }
    let text = json.candidates[0].content.parts[0].text.trim().replace(/^["「]|["」]$/g, '');
    if (text.length > BH_CONFIG.maxTweetLength) text = text.substring(0, BH_CONFIG.maxTweetLength - 1) + '…';
    return text;
  } catch (e) {
    Logger.log('Gemini exception: ' + e.message);
    return null;
  }
}

function postToX_(iftttKey, eventName, tweetText) {
  try {
    const res = UrlFetchApp.fetch(
      `https://maker.ifttt.com/trigger/${eventName}/with/key/${iftttKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ value1: tweetText }),
        muteHttpExceptions: true
      }
    );
    return res.getResponseCode() === 200;
  } catch (e) {
    Logger.log('IFTTT exception: ' + e.message);
    return false;
  }
}

/** トリガー設定: 朝9時・夜20時 */
function createTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'generateAndPost')
    .forEach(t => ScriptApp.deleteTrigger(t));

  [9, 20].forEach(h => {
    ScriptApp.newTrigger('generateAndPost')
      .timeBased().atHour(h).nearMinute(0).everyDays(1).create();
  });
  Logger.log('トリガー設定完了: 9:00, 20:00 JST');
}

/** テスト: 生成のみ（投稿しない） */
function testGeminiOnly() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) { Logger.log('GEMINI_API_KEY未設定'); return; }
  const cat = pickCategory_();
  const theme = cat.themes[Math.floor(Math.random() * cat.themes.length)];
  Logger.log(`[${cat.name}] ${theme}`);
  Logger.log(callGemini_(key, cat.name, theme) || '失敗');
}
