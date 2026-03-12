/**
 * BuildHub X (@buildhub_jp) 自動投稿 GAS
 *
 * 1日2投稿（朝9時・夜20時）
 * Gemini でClaude Code/AI開発Tipsを生成 → X API v2 で直接投稿
 *
 * Script Properties:
 *   GEMINI_API_KEY          — Google AI Studio の API キー
 *   X_API_KEY               — Consumer Key
 *   X_API_SECRET            — Consumer Secret
 *   X_ACCESS_TOKEN          — Access Token (@buildhub_jp)
 *   X_ACCESS_TOKEN_SECRET   — Access Token Secret (@buildhub_jp)
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
        'フック（hooks）活用', 'MCP連携', 'git worktree活用',
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
      name: '実践ノウハウ',
      weight: 2,
      themes: [
        'GAS×AI自動化', 'Firebase×AI', 'WordPress自動投稿',
        'AIで副業実験', 'CI/CDとAI', 'ノーコード×AI',
      ]
    },
    {
      name: 'BuildHub記事から',
      weight: 1,
      themes: [
        '今週のAIニュース', 'Anthropicアップデート', 'Claude新機能',
        'AI開発者が使うツール', 'OSS AI特集',
      ]
    },
  ],
  maxTweetLength: 270,
};

// ===== メイン =====

function generateAndPost() {
  const props = PropertiesService.getScriptProperties();
  const geminiKey = props.getProperty('GEMINI_API_KEY');
  const apiKey    = props.getProperty('X_API_KEY');
  const apiSecret = props.getProperty('X_API_SECRET');
  const token     = props.getProperty('X_ACCESS_TOKEN');
  const tokenSecret = props.getProperty('X_ACCESS_TOKEN_SECRET');

  if (!geminiKey || !apiKey || !apiSecret || !token || !tokenSecret) {
    Logger.log('ERROR: 必須プロパティ未設定');
    return;
  }

  // jitter（0〜15分）
  Utilities.sleep(Math.floor(Math.random() * 15 * 60 * 1000));

  const category = pickCategory_();
  const theme = category.themes[Math.floor(Math.random() * category.themes.length)];

  const tweet = callGemini_(geminiKey, category.name, theme);
  if (!tweet) { Logger.log('Gemini生成失敗'); return; }

  const result = postTweet_(apiKey, apiSecret, token, tokenSecret, tweet);
  if (result) {
    Logger.log(`✅ 投稿完了: [${category.name}/${theme}]\n${tweet}`);
  } else {
    Logger.log(`❌ 投稿失敗: [${category.name}/${theme}]`);
  }
}

// ===== X API v2 投稿（OAuth 1.0a） =====

function postTweet_(apiKey, apiSecret, token, tokenSecret, text) {
  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';
  const body = JSON.stringify({ text: text });

  const authHeader = buildOAuth1Header_(method, url, apiKey, apiSecret, token, tokenSecret);

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      payload: body,
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    Logger.log(`X API response: ${code} ${res.getContentText()}`);
    return code === 201;
  } catch (e) {
    Logger.log('X API exception: ' + e.message);
    return false;
  }
}

// ===== OAuth 1.0a 署名生成 =====

function buildOAuth1Header_(method, url, consumerKey, consumerSecret, token, tokenSecret) {
  const nonce = Utilities.base64Encode(Utilities.getUuid()).replace(/[^a-zA-Z0-9]/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0',
  };

  // シグネチャ生成
  const signature = buildSignature_(method, url, oauthParams, consumerSecret, tokenSecret);
  oauthParams['oauth_signature'] = signature;

  // Authorizationヘッダー組み立て
  const headerParts = Object.keys(oauthParams).sort().map(k =>
    `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
  );

  return 'OAuth ' + headerParts.join(', ');
}

function buildSignature_(method, url, oauthParams, consumerSecret, tokenSecret) {
  // パラメータを辞書順にソートしてエンコード
  const sortedParams = Object.keys(oauthParams).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`
  ).join('&');

  // シグネチャベース文字列
  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // 署名キー
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // HMAC-SHA1署名
  const signature = Utilities.computeHmacSha1Signature(baseString, signingKey);
  return Utilities.base64Encode(signature);
}

// ===== Gemini API =====

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
- 絵文字は0〜1個
- AI臭い定型文禁止
- 宣伝は入れない

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

// ===== カテゴリ重み付き選択 =====

function pickCategory_() {
  const cats = BH_CONFIG.categories;
  const total = cats.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of cats) { r -= c.weight; if (r <= 0) return c; }
  return cats[cats.length - 1];
}

// ===== トリガー設定: 朝9時・夜20時 =====

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

// ===== テスト: 生成のみ（投稿しない） =====

function testGeminiOnly() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) { Logger.log('GEMINI_API_KEY未設定'); return; }
  const cat = pickCategory_();
  const theme = cat.themes[Math.floor(Math.random() * cat.themes.length)];
  Logger.log(`[${cat.name}] ${theme}`);
  Logger.log(callGemini_(key, cat.name, theme) || '失敗');
}

// ===== テスト: 実際に1件投稿 =====

function testPost() {
  generateAndPost();
}
