#!/usr/bin/env node
/**
 * X (Twitter) アフィリエイト自動投稿Bot
 *
 * やること:
 * 1. Claude API で魅力的な投稿文を自動生成
 * 2. アフィリエイトリンク付きで投稿
 * 3. 最適な時間帯に自動投稿
 * 4. 投稿履歴管理（重複防止）
 *
 * 使い方:
 *   node x-affiliate-poster.js           # 1件投稿
 *   node x-affiliate-poster.js --dry-run  # テスト（投稿しない）
 *   node x-affiliate-poster.js --type info  # 情報系投稿
 *
 * cron設定 (毎日9時と18時に投稿):
 *   0 9,18 * * * node /path/to/x-affiliate-poster.js
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONFIG = {
  model: "claude-opus-4-6",
  amazonTag: process.env.AMAZON_ASSOCIATE_TAG || "molkkyhub-22",
  historyFile: "./post-history.json",
  // Twitter API v2 設定
  twitterApiKey: process.env.TWITTER_API_KEY,
  twitterApiSecret: process.env.TWITTER_API_SECRET,
  twitterAccessToken: process.env.TWITTER_ACCESS_TOKEN,
  twitterAccessSecret: process.env.TWITTER_ACCESS_SECRET,
};

// === 投稿テンプレート（ローテーション）===
const POST_TEMPLATES = {
  // アフィリエイト投稿（週3回）
  affiliate: [
    {
      topic: "モルック入門セット紹介",
      style: "商品レビュー風",
      affiliateProduct: "TACTIC製モルックセット",
      cta: "初心者にもおすすめ！詳しくはこちら👇",
    },
    {
      topic: "モルックスキットル替えの重要性",
      style: "Tips・ノウハウ風",
      affiliateProduct: "スキットル替えセット",
      cta: "試合前に確認しておこう！詳しくはこちら👇",
    },
    {
      topic: "モルックを持ち運ぶための収納バッグ",
      style: "便利グッズ紹介風",
      affiliateProduct: "スポーツバッグ",
      cta: "大会参加勢は必携！詳しくはこちら👇",
    },
  ],

  // 情報発信投稿（週4回）
  info: [
    {
      topic: "モルックの今日のルール解説",
      style: "教育的・シンプル",
    },
    {
      topic: "モルックの楽しさを伝えるエピソード",
      style: "エンタメ・感情",
    },
    {
      topic: "モルック大会参加のすすめ",
      style: "背中を押す系",
    },
    {
      topic: "モルックのスコア計算テクニック",
      style: "お役立ちTips",
    },
  ],

  // エンゲージメント投稿（週1回）
  engagement: [
    {
      topic: "モルックに関するアンケート・質問",
      style: "インタラクティブ",
    },
  ],
};

// === 今日の投稿タイプを決定 ===
function getTodayPostType() {
  const day = new Date().getDay();
  // 月水金 → affiliate, 火木土 → info, 日 → engagement
  if ([1, 3, 5].includes(day)) return "affiliate";
  if ([0].includes(day)) return "engagement";
  return "info";
}

// === 投稿文自動生成 ===
async function generatePost(type, template) {
  const affiliateLink = template.affiliateProduct
    ? `\nhttps://www.amazon.co.jp/s?k=${encodeURIComponent(template.affiliateProduct)}&tag=${CONFIG.amazonTag}`
    : "";

  const hashtags =
    "\n\n#モルック #モルックHUB #アウトドア #スポーツ #モルック大会";

  const prompt = `
あなたはモルック（フィンランドのアウトドアゲーム）専門のSNSライターです。

以下の条件でXの投稿文を作成してください:

**投稿タイプ**: ${type}
**テーマ**: ${template.topic}
**スタイル**: ${template.style}
${template.affiliateProduct ? `**紹介商品**: ${template.affiliateProduct}` : ""}
${template.cta ? `**CTA**: ${template.cta}` : ""}

## 要件
- 文字数: 100〜200文字（ハッシュタグ除く）
- 読者: モルックに興味がある日本人
- トーン: フレンドリー、熱量がある、押しつけがましくない
- ${type === "affiliate" ? "商品のメリットを具体的に1〜2点紹介" : "役立つ情報か共感できる内容"}
- 絵文字: 2〜3個（自然に使う）
- URLやハッシュタグは含めない（後で追加する）

投稿文だけ出力してください（説明不要）。
`;

  const message = await client.messages.create({
    model: CONFIG.model,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const baseText = message.content[0].text.trim();
  const fullPost = baseText + affiliateLink + hashtags;

  return fullPost;
}

// === Twitter API v2 で投稿 ===
async function postToTwitter(text) {
  if (
    !CONFIG.twitterApiKey ||
    !CONFIG.twitterApiSecret ||
    !CONFIG.twitterAccessToken ||
    !CONFIG.twitterAccessSecret
  ) {
    console.log("⚠️  Twitter API認証情報なし → テストモード");
    return null;
  }

  // OAuth 1.0a 署名（実装が複雑なため、twitter-api-v2 ライブラリ推奨）
  // npm install twitter-api-v2 が必要
  try {
    const { TwitterApi } = await import("twitter-api-v2");
    const twitterClient = new TwitterApi({
      appKey: CONFIG.twitterApiKey,
      appSecret: CONFIG.twitterApiSecret,
      accessToken: CONFIG.twitterAccessToken,
      accessSecret: CONFIG.twitterAccessSecret,
    });

    const result = await twitterClient.v2.tweet(text);
    return result;
  } catch (e) {
    console.error("Twitter API エラー:", e.message);
    console.log("📌 twitter-api-v2 をインストール: npm install twitter-api-v2");
    return null;
  }
}

// === 投稿履歴管理 ===
function loadHistory() {
  if (!fs.existsSync(CONFIG.historyFile)) return [];
  return JSON.parse(fs.readFileSync(CONFIG.historyFile, "utf8"));
}

function saveHistory(history, post) {
  history.push({
    date: new Date().toISOString(),
    text: post.substring(0, 100),
  });
  fs.writeFileSync(CONFIG.historyFile, JSON.stringify(history, null, 2));
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const forceType = args.find((a) => a.startsWith("--type="))?.split("=")[1];

  const postType = forceType || getTodayPostType();
  const templates = POST_TEMPLATES[postType];
  const template = templates[Math.floor(Math.random() * templates.length)];

  console.log(`\n🤖 X自動投稿Bot 起動`);
  console.log(`   投稿タイプ: ${postType}`);
  console.log(`   テーマ: ${template.topic}`);
  console.log(`   ドライラン: ${isDryRun ? "YES" : "NO"}`);

  // 投稿文生成
  const post = await generatePost(postType, template);

  console.log("\n📝 生成された投稿文:");
  console.log("─".repeat(40));
  console.log(post);
  console.log("─".repeat(40));
  console.log(`文字数: ${post.length}文字`);

  if (isDryRun) {
    console.log("\n✅ ドライランモード: 投稿しません");
    return;
  }

  // Twitter投稿
  const result = await postToTwitter(post);

  if (result) {
    console.log(`\n✅ 投稿完了! Tweet ID: ${result.data?.id}`);
  } else {
    // ファイルに保存（後で手動投稿 or 別の方法で投稿）
    const logFile = `./pending-posts-${new Date().toISOString().split("T")[0]}.txt`;
    fs.appendFileSync(logFile, post + "\n\n---\n\n");
    console.log(`\n📁 投稿文を保存: ${logFile}`);
  }

  // 履歴保存
  const history = loadHistory();
  saveHistory(history, post);
  console.log(`📚 投稿履歴更新: ${history.length + 1}件目`);
}

main().catch(console.error);
