/**
 * BuildHub X (@buildhub_jp) 自動投稿 GAS
 *
 * フロー:
 *   generateQueue(14) → Firebase /buildhub-x-queue に保存（手動/週次実行）
 *   9:00/20:00 トリガー → キューから最古のpendingを1件投稿
 *
 * Script Properties:
 *   GEMINI_API_KEY          — Google AI Studio の API キー
 *   X_API_KEY               — Consumer Key
 *   X_API_SECRET            — Consumer Secret
 *   X_ACCESS_TOKEN          — Access Token (@buildhub_jp)
 *   X_ACCESS_TOKEN_SECRET   — Access Token Secret (@buildhub_jp)
 */

const FIREBASE_BASE = 'https://viisi-master-app-default-rtdb.firebaseio.com';

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

// ===== メイン: キューから1件取り出して投稿 =====

function generateAndPost() {
  const props = PropertiesService.getScriptProperties();
  const apiKey      = props.getProperty('X_API_KEY');
  const apiSecret   = props.getProperty('X_API_SECRET');
  const token       = props.getProperty('X_ACCESS_TOKEN');
  const tokenSecret = props.getProperty('X_ACCESS_TOKEN_SECRET');

  if (!apiKey || !apiSecret || !token || !tokenSecret) {
    Logger.log('ERROR: X API プロパティ未設定');
    return;
  }

  // jitter（0〜3分）
  Utilities.sleep(Math.floor(Math.random() * 3 * 60 * 1000));

  // キューから最古のpendingを取得
  const item = getNextPending_();
  if (!item) {
    Logger.log('⚠️ キューが空です。GASで generateQueue() を実行してください');
    return;
  }

  Logger.log(`投稿: [${item.category}/${item.theme}]\n${item.text}`);

  const xId = postTweet_(apiKey, apiSecret, token, tokenSecret, item.text);
  if (xId) {
    updateQueueItem_(item.id, {
      status: 'posted',
      posted_at: new Date().toISOString(),
      x_id: xId,
    });
    Logger.log(`✅ 投稿完了: x_id=${xId}`);
  } else {
    Logger.log('❌ 投稿失敗（キューには残ります）');
  }
}

// ===== キュー生成: n件生成してFirebaseに保存 =====

function generateQueue(n) {
  n = n || 14;
  const props = PropertiesService.getScriptProperties();
  const geminiKey = props.getProperty('GEMINI_API_KEY');
  if (!geminiKey) { Logger.log('GEMINI_API_KEY未設定'); return; }

  Logger.log(`${n}件のキュー生成開始...`);
  let saved = 0;

  for (let i = 0; i < n; i++) {
    const category = pickCategory_();
    const theme = category.themes[Math.floor(Math.random() * category.themes.length)];
    const text = callGemini_(geminiKey, category.name, theme);

    if (!text) {
      Logger.log(`[${i+1}/${n}] 生成失敗 [${category.name}/${theme}]`);
      continue;
    }

    saveToQueue_({
      text: text,
      category: category.name,
      theme: theme,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    saved++;
    Logger.log(`[${i+1}/${n}] 保存: [${category.name}/${theme}]\n${text.substring(0, 60)}...`);
    Utilities.sleep(1500); // Gemini API レートリミット対策
  }

  Logger.log(`完了: ${saved}/${n}件 キューに保存`);
}

// ===== Firebase: キュー操作 =====

function getNextPending_() {
  const url = `${FIREBASE_BASE}/buildhub-x-queue.json`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    Logger.log('Firebase取得失敗: ' + res.getResponseCode());
    return null;
  }
  const data = JSON.parse(res.getContentText());
  if (!data) return null;

  let oldest = null;
  for (const [id, item] of Object.entries(data)) {
    if (item.status === 'pending') {
      if (!oldest || item.created_at < oldest.created_at) {
        oldest = { id, ...item };
      }
    }
  }
  return oldest;
}

function saveToQueue_(item) {
  const url = `${FIREBASE_BASE}/buildhub-x-queue.json`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(item),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('Firebase保存失敗: ' + res.getContentText());
  }
}

function updateQueueItem_(id, updates) {
  const url = `${FIREBASE_BASE}/buildhub-x-queue/${id}.json`;
  UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(updates),
    muteHttpExceptions: true,
  });
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
    if (code === 201) {
      const json = JSON.parse(res.getContentText());
      return (json.data && json.data.id) ? json.data.id : 'unknown';
    }
    return null;
  } catch (e) {
    Logger.log('X API exception: ' + e.message);
    return null;
  }
}

// ===== OAuth 1.0a 署名生成 =====

function rfc3986Encode_(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
}

function buildOAuth1Header_(method, url, consumerKey, consumerSecret, token, tokenSecret) {
  const nonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0',
  };

  const signature = buildSignature_(method, url, oauthParams, consumerSecret, tokenSecret);
  oauthParams['oauth_signature'] = signature;

  const headerParts = Object.keys(oauthParams).sort().map(k =>
    `${rfc3986Encode_(k)}="${rfc3986Encode_(oauthParams[k])}"`
  );

  return 'OAuth ' + headerParts.join(', ');
}

function buildSignature_(method, url, oauthParams, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(oauthParams).sort().map(k =>
    `${rfc3986Encode_(k)}=${rfc3986Encode_(oauthParams[k])}`
  ).join('&');

  const baseString = [
    method.toUpperCase(),
    rfc3986Encode_(url),
    rfc3986Encode_(sortedParams),
  ].join('&');

  const signingKey = `${rfc3986Encode_(consumerSecret)}&${rfc3986Encode_(tokenSecret)}`;

  Logger.log('baseString: ' + baseString.substring(0, 100));
  Logger.log('signingKey prefix: ' + signingKey.substring(0, 20));

  const signatureBytes = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    baseString,
    signingKey,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(signatureBytes);
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

// ===== テスト: OAuth署名アルゴリズム検証（ダミー値） =====
// Python期待値: L7E67PHpVQzqIubl1Wmi7OutQ5M=
function testAlgorithm() {
  const sig = buildSignature_('GET', 'https://api.twitter.com/2/users/me',
    {
      oauth_consumer_key: 'abc123',
      oauth_nonce: 'fixednonce',
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: '1000000000',
      oauth_token: 'token456',
      oauth_version: '1.0',
    },
    'secret123', 'tokensec789'
  );
  Logger.log('GAS signature  : ' + sig);
  Logger.log('Python expected: L7E67PHpVQzqIubl1Wmi7OutQ5M=');
  Logger.log('match: ' + (sig === 'L7E67PHpVQzqIubl1Wmi7OutQ5M='));
}

// ===== テスト: OAuth認証確認（GET /2/users/me） =====

function testAuth() {
  const props = PropertiesService.getScriptProperties();
  const apiKey     = props.getProperty('X_API_KEY');
  const apiSecret  = props.getProperty('X_API_SECRET');
  const token      = props.getProperty('X_ACCESS_TOKEN');
  const tokenSecret = props.getProperty('X_ACCESS_TOKEN_SECRET');

  Logger.log(`X_API_KEY: ...${apiKey ? apiKey.slice(-6) : 'NULL'} (len=${apiKey ? apiKey.length : 0})`);
  Logger.log(`X_API_SECRET: ...${apiSecret ? apiSecret.slice(-6) : 'NULL'} (len=${apiSecret ? apiSecret.length : 0})`);
  Logger.log(`X_ACCESS_TOKEN: ${token ? token.substring(0,19) : 'NULL'}... (len=${token ? token.length : 0})`);
  Logger.log(`X_ACCESS_TOKEN_SECRET: ...${tokenSecret ? tokenSecret.slice(-6) : 'NULL'} (len=${tokenSecret ? tokenSecret.length : 0})`);

  const urlV2 = 'https://api.twitter.com/2/users/me';
  const authV2 = buildOAuth1Header_('GET', urlV2, apiKey, apiSecret, token, tokenSecret);
  const resV2 = UrlFetchApp.fetch(urlV2, {
    method: 'get', headers: { 'Authorization': authV2 }, muteHttpExceptions: true,
  });
  Logger.log(`v2 GET /2/users/me: ${resV2.getResponseCode()}`);

  const urlV1 = 'https://api.twitter.com/1.1/account/verify_credentials.json';
  const authV1 = buildOAuth1Header_('GET', urlV1, apiKey, apiSecret, token, tokenSecret);
  const resV1 = UrlFetchApp.fetch(urlV1, {
    method: 'get', headers: { 'Authorization': authV1 }, muteHttpExceptions: true,
  });
  Logger.log(`v1.1 verify_credentials: ${resV1.getResponseCode()}`);
  Logger.log(resV1.getContentText().substring(0, 300));
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

// ===== テスト: キュー確認（Firebaseから取得して表示） =====

function testQueueStatus() {
  const url = `${FIREBASE_BASE}/buildhub-x-queue.json`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());
  if (!data) { Logger.log('キューが空です'); return; }

  const items = Object.entries(data).map(([id, v]) => ({ id, ...v }));
  const pending = items.filter(i => i.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const posted  = items.filter(i => i.status === 'posted').sort((a, b) => b.posted_at.localeCompare(a.posted_at));

  Logger.log(`=== pending: ${pending.length}件 ===`);
  pending.forEach((i, n) => Logger.log(`[${n+1}] [${i.category}] ${i.text.substring(0, 50)}...`));
  Logger.log(`=== posted: ${posted.length}件 ===`);
  posted.slice(0, 5).forEach((i, n) => Logger.log(`[${n+1}] ${i.posted_at} [${i.category}] ${i.text.substring(0, 50)}...`));
}

// ===== テスト: 実際に1件投稿（jitterなし、キュー経由） =====

function testPost() {
  const props = PropertiesService.getScriptProperties();
  const apiKey    = props.getProperty('X_API_KEY');
  const apiSecret = props.getProperty('X_API_SECRET');
  const token     = props.getProperty('X_ACCESS_TOKEN');
  const tokenSecret = props.getProperty('X_ACCESS_TOKEN_SECRET');

  if (!apiKey || !apiSecret || !token || !tokenSecret) {
    Logger.log('ERROR: 必須プロパティ未設定'); return;
  }

  const item = getNextPending_();
  if (!item) { Logger.log('キューが空です'); return; }

  Logger.log(`投稿予定: [${item.category}/${item.theme}]\n${item.text}`);
  const xId = postTweet_(apiKey, apiSecret, token, tokenSecret, item.text);
  if (xId) {
    updateQueueItem_(item.id, { status: 'posted', posted_at: new Date().toISOString(), x_id: xId });
    Logger.log('✅ 投稿成功: x_id=' + xId);
  } else {
    Logger.log('❌ 投稿失敗');
  }
}
