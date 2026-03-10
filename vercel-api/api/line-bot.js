/**
 * LINE Bot Webhook — 「もう1人のSP」の対話エンドポイント
 *
 * 環境変数:
 *   LINE_CHANNEL_SECRET     — LINE Messaging API チャネルシークレット
 *   LINE_CHANNEL_ACCESS_TOKEN — LINE Messaging API アクセストークン
 *   ANTHROPIC_API_KEY        — Claude API キー
 *   FIREBASE_URL             — Firebase Realtime DB URL
 *
 * 処理フロー:
 *   1. LINE Webhook受信 → 署名検証
 *   2. ユーザーメッセージ取得
 *   3. 「覚えて：」コマンドの処理（Firebase保存）
 *   4. Claude API で返答生成（sp-brain の思考DNAを参照）
 *   5. LINE Reply API で返信
 *   6. 会話ログを Firebase /line-logs に保存
 */

import crypto from 'crypto';

// --- 署名検証 ---
function verifySignature(body, signature, secret) {
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// --- LINE Reply API ---
async function replyToLine(replyToken, text, accessToken) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: text.slice(0, 5000) }],
    }),
  });
}

// --- Firebase 保存 ---
async function saveToFirebase(path, data, firebaseUrl) {
  await fetch(`${firebaseUrl}/${path}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// --- Claude API 呼び出し ---
async function askClaude(userMessage, conversationHistory, apiKey) {
  const systemPrompt = `あなたは「SP」のAIクローンです。SPの代わりに考え、判断し、返答します。

## SPの特徴
- 関西弁ベース（「〜やねん」「〜やろ」「ええと思う」）
- カジュアルだけど失礼にはならない
- 結論から言う。無駄な前置きはしない
- 完璧より「動くもの」を優先。70点で出して改善
- モルック愛。MOLKKY HUBの運営者
- 技術: バニラJS + Firebase/GAS/Vercel。フレームワークは使わない
- 自動化できないなら後回し

## 判断基準
- 優先順位: MOLKKY HUB > マルタ村/MACHAP > 新規収益
- 投資: 月5,000円以下なら即GO
- コンテンツ: AI臭い表現はNG。モルック愛が伝わるか
- 技術: 既存スタックで済むならそれでやる

## 注意
- 短く返す（LINEなので）
- 分からんことは分からんと言う
- 機密情報は絶対に返さない`;

  const messages = [
    ...conversationHistory.slice(-10).map((h) => ({
      role: h.role,
      content: h.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Claude API error');
  }
  return data.content[0].text;
}

// --- メインハンドラ ---
export default async function handler(req, res) {
  // POST only
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const firebaseUrl = process.env.FIREBASE_URL;

  if (!channelSecret || !accessToken || !anthropicKey) {
    res.status(500).json({ error: 'Missing environment variables' });
    return;
  }

  // 署名検証
  const rawBody =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(rawBody, signature, channelSecret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const events = body.events || [];

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const userMessage = event.message.text;
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const timestamp = new Date().toISOString();

    try {
      let replyText;

      // 「覚えて：」コマンド
      if (userMessage.startsWith('覚えて：') || userMessage.startsWith('覚えて:')) {
        const memory = userMessage.replace(/^覚えて[：:]/, '').trim();
        if (firebaseUrl) {
          await saveToFirebase('line-memories', {
            content: memory,
            userId,
            timestamp,
          }, firebaseUrl);
        }
        replyText = `覚えた：「${memory}」`;
      } else {
        // Claude API で返答
        // TODO: Firebase から会話履歴を取得して渡す
        replyText = await askClaude(userMessage, [], anthropicKey);
      }

      // LINE返信
      await replyToLine(replyToken, replyText, accessToken);

      // 会話ログ保存
      if (firebaseUrl) {
        await saveToFirebase(`line-logs/${userId}`, {
          userMessage,
          replyText,
          timestamp,
        }, firebaseUrl);
      }
    } catch (e) {
      console.error('Error processing LINE event:', e);
      await replyToLine(
        replyToken,
        'ごめん、ちょっとエラーが出た。もう1回試してみて。',
        accessToken
      );
    }
  }

  res.status(200).json({ ok: true });
}
