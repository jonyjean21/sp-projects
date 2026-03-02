#!/usr/bin/env node
/**
 * MOLKKY HUB SEO記事自動生成ツール
 *
 * やること:
 * 1. キーワードリストから記事を自動生成
 * 2. アフィリエイトリンクを自動挿入
 * 3. WordPress REST API で自動投稿（下書き）
 *
 * 使い方:
 *   node article-generator.js                    # 1記事生成
 *   node article-generator.js --publish           # 生成+WP下書き投稿
 *   node article-generator.js --keyword "モルック おすすめ"
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// === 設定 ===
const CONFIG = {
  model: "claude-opus-4-6",
  wpApiUrl: process.env.WP_API_URL || "https://molkky-hub.com/wp-json/wp/v2",
  wpUsername: process.env.WP_USERNAME,
  wpPassword: process.env.WP_APP_PASSWORD, // WordPressアプリパスワード
  amazonAssociateTag: process.env.AMAZON_ASSOCIATE_TAG || "molkkyhub-22",
  outputDir: "./generated-articles",
};

// === アフィリエイト商品データ ===
const AFFILIATE_PRODUCTS = [
  {
    name: "モルック公式セット (TACTIC社製)",
    amazonUrl:
      "https://www.amazon.co.jp/dp/B00E5WQBHU?tag=" + CONFIG.amazonAssociateTag,
    rakutenUrl: "https://hb.afl.rakuten.co.jp/hgc/xxx/?pc=xxx",
    price: "¥4,500〜",
    description: "フィンランド発祥の本格的なモルックセット",
    commission: "Amazon: 4-8%",
  },
  {
    name: "モルック スキットル 替え 12本セット",
    amazonUrl:
      "https://www.amazon.co.jp/dp/XXXXXX?tag=" + CONFIG.amazonAssociateTag,
    price: "¥2,000〜",
    description: "試合で使い込んだスキットルの替えに最適",
    commission: "Amazon: 4-8%",
  },
  {
    name: "スポーツ用 収納バッグ",
    amazonUrl:
      "https://www.amazon.co.jp/s?k=スポーツバッグ&tag=" +
      CONFIG.amazonAssociateTag,
    price: "¥1,500〜",
    description: "モルックセットをまとめて収納できるバッグ",
    commission: "Amazon: 4-8%",
  },
];

// === キーワードリスト（SEO調査済み）===
const KEYWORD_DATABASE = [
  // 購買意図が高い（アフィリエイト収益化に最適）
  { keyword: "モルック おすすめ セット", intent: "purchase", priority: 1 },
  { keyword: "モルック どこで 買える", intent: "purchase", priority: 1 },
  { keyword: "モルック 値段 価格", intent: "purchase", priority: 1 },
  { keyword: "モルック スキットル 替え", intent: "purchase", priority: 1 },
  { keyword: "モルック セット 安い", intent: "purchase", priority: 1 },

  // 情報系（AdSense収益化に最適）
  { keyword: "モルック ルール 簡単 説明", intent: "info", priority: 2 },
  { keyword: "モルック 得点 計算", intent: "info", priority: 2 },
  { keyword: "モルック やり方 初心者", intent: "info", priority: 2 },
  { keyword: "モルック 大会 参加", intent: "info", priority: 2 },
  { keyword: "モルック 練習方法", intent: "info", priority: 2 },

  // ロングテール（競合が少ない）
  { keyword: "モルック 何人 で できる", intent: "info", priority: 3 },
  { keyword: "モルック 雨 天気 屋外", intent: "info", priority: 3 },
  { keyword: "モルック 子供 年齢 何歳から", intent: "info", priority: 3 },
  { keyword: "モルック 公式 アプリ スコア", intent: "info", priority: 3 },
];

// === 記事生成 ===
async function generateArticle(keyword, intent) {
  console.log(`\n📝 記事生成中: "${keyword}"`);

  const affiliateSection =
    intent === "purchase"
      ? `
## おすすめ商品・購入はこちら

${AFFILIATE_PRODUCTS.slice(0, 2)
  .map(
    (p) => `
### ${p.name}
- 価格: ${p.price}
- ${p.description}
- **[Amazonで見る](${p.amazonUrl})**
`
  )
  .join("\n")}
`
      : "";

  const prompt = `
あなたはモルックの専門家であり、SEOライターです。
以下のキーワードで検索する読者のために、役に立つ記事を書いてください。

**キーワード**: ${keyword}
**検索意図**: ${intent === "purchase" ? "商品購入を検討している" : "情報を調べている"}

## 記事の要件
1. 文字数: 2,000〜3,000文字
2. 構成:
   - タイトル (h1): キーワードを含む、読者の疑問に答える
   - リード文: 読者の悩みに共感 + 記事で分かることを明示
   - 本文 (h2/h3で構成): 実践的で具体的な情報
   - まとめ: 重要ポイントの整理
3. 読者: モルックに興味を持ち始めた日本人（初心者〜中級者）
4. トーン: 親しみやすく、でも情報は正確に
5. SEO: キーワードを自然に3〜5回使用

**出力形式**: Markdown（WordPressにそのまま貼れる形式）

記事を書いてください。アフィリエイトセクションは後で追加するので不要です。
`;

  const message = await client.messages.create({
    model: CONFIG.model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const articleContent = message.content[0].text;

  // アフィリエイトセクションを追記
  const fullArticle = articleContent + "\n\n" + affiliateSection;

  return fullArticle;
}

// === WordPress に投稿 ===
async function postToWordPress(title, content, status = "draft") {
  if (!CONFIG.wpUsername || !CONFIG.wpPassword) {
    console.log("⚠️  WP認証情報なし → ファイル保存のみ");
    return null;
  }

  const credentials = Buffer.from(
    `${CONFIG.wpUsername}:${CONFIG.wpPassword}`
  ).toString("base64");

  const response = await fetch(`${CONFIG.wpApiUrl}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title,
      content: content,
      status: status,
      categories: [], // カテゴリIDを設定
      tags: [], // タグIDを設定
    }),
  });

  if (!response.ok) {
    throw new Error(`WP投稿失敗: ${response.status}`);
  }

  return await response.json();
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);
  const shouldPublish = args.includes("--publish");
  const keywordArg = args.find((a) => !a.startsWith("--"));

  // 出力ディレクトリ作成
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // キーワードを選択（引数 or 優先度順に未使用を選択）
  let targetKeyword;
  let targetIntent;

  if (keywordArg) {
    targetKeyword = keywordArg;
    targetIntent = "info";
  } else {
    // 優先度順に1つ選ぶ
    const sorted = KEYWORD_DATABASE.sort((a, b) => a.priority - b.priority);
    const selected = sorted[0]; // TODO: 使用済みキーワードを除外するロジック
    targetKeyword = selected.keyword;
    targetIntent = selected.intent;
  }

  // 記事生成
  const article = await generateArticle(targetKeyword, targetIntent);

  // タイトル抽出（h1の最初の行）
  const titleMatch = article.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : targetKeyword;

  // ファイル保存
  const filename = `${Date.now()}-${targetKeyword.replace(/\s+/g, "-")}.md`;
  const filepath = path.join(CONFIG.outputDir, filename);
  fs.writeFileSync(filepath, article);
  console.log(`✅ 記事保存: ${filepath}`);

  // WordPress投稿（オプション）
  if (shouldPublish) {
    try {
      const result = await postToWordPress(title, article);
      if (result) {
        console.log(
          `✅ WP下書き投稿完了: ${result.link || "投稿ID: " + result.id}`
        );
      }
    } catch (e) {
      console.error(`❌ WP投稿エラー: ${e.message}`);
    }
  }

  console.log("\n📊 生成完了:");
  console.log(`   キーワード: ${targetKeyword}`);
  console.log(`   タイトル: ${title}`);
  console.log(`   文字数: 約${article.length}文字`);
  console.log(`   ファイル: ${filepath}`);
}

main().catch(console.error);
