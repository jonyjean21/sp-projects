#!/usr/bin/env node
/**
 * アフィリエイトブログ 記事量産ツール
 *
 * ブログ構成（3サイト展開）:
 *   Blog 1: スポーツ・アウトドアゲーム アフィリエイト
 *   Blog 2: ファミリーレジャー・公園遊び
 *   Blog 3: アウトドア用品・キャンプ
 *
 * 収益モデル:
 *   - Amazon/楽天 アフィリエイト (4〜8%)
 *   - Google AdSense
 *   - 目標: 各ブログ ¥20,000/月 × 3ブログ = ¥60,000/月
 *
 * 使い方:
 *   node blog-generator.js --blog 1 --keyword "アウトドアゲーム おすすめ"
 *   node blog-generator.js --blog 1 --batch 5   # 5記事一括生成
 *   node blog-generator.js --research            # キーワードリサーチ実行
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AMAZON_TAG = process.env.AMAZON_ASSOCIATE_TAG || "blog-22";

// === ブログ設定 ===
const BLOGS = {
  1: {
    name: "アウトドアゲーム研究所",
    niche: "アウトドアゲーム・スポーツ",
    target: "アウトドアゲームに興味がある家族・グループ",
    mainKeywords: [
      "モルック",
      "ペタンク",
      "クロッケー",
      "スラックライン",
      "フリスビー",
      "バドミントン",
      "ビーチバレー",
    ],
    affiliateCategory: "sports",
    amazonSearchBase:
      "https://www.amazon.co.jp/s?k={keyword}&tag=" + AMAZON_TAG,
  },
  2: {
    name: "公園あそびラボ",
    niche: "ファミリーレジャー・子供との外遊び",
    target: "子育て中の親（特にパパ）",
    mainKeywords: [
      "外遊び 子供",
      "公園遊び",
      "ファミリースポーツ",
      "子供 体を動かす",
      "ボール遊び",
    ],
    affiliateCategory: "toys-games",
    amazonSearchBase:
      "https://www.amazon.co.jp/s?k={keyword}&tag=" + AMAZON_TAG,
  },
  3: {
    name: "週末キャンプ・アウトドア",
    niche: "キャンプ・アウトドア用品",
    target: "キャンプ・BBQ好きな20〜40代",
    mainKeywords: [
      "テント",
      "BBQ",
      "焚き火",
      "キャンプ道具",
      "アウトドアチェア",
    ],
    affiliateCategory: "sports",
    amazonSearchBase:
      "https://www.amazon.co.jp/s?k={keyword}&tag=" + AMAZON_TAG,
  },
};

// === キーワードリサーチ（Claude に調べさせる）===
async function researchKeywords(blog) {
  console.log(`\n🔍 キーワードリサーチ: ${blog.name}`);

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `
SEOアフィリエイトブログのキーワードリサーチをしてください。

**ブログ**: ${blog.name}
**ニッチ**: ${blog.niche}
**ターゲット読者**: ${blog.target}
**既存コアキーワード**: ${blog.mainKeywords.join("、")}

以下の基準でキーワードを30個提案してください:

1. 購買意図キーワード (10個):
   - 「おすすめ」「比較」「選び方」「口コミ」「安い」等を含む
   - アフィリエイト収益が見込める

2. 情報系キーワード (10個):
   - 「やり方」「方法」「コツ」「初心者」等を含む
   - AdSense収益 + 購買記事への内部リンク

3. ロングテールキーワード (10個):
   - 競合が少ない
   - 月間検索数は少ないが、検索意図が明確

各キーワードについて:
- 推定月間検索数（大まかに: 低<100, 中100-1000, 高>1000）
- 記事タイトル案
- 想定アフィリエイト商品

表形式で出力してください。
`,
      },
    ],
  });

  return message.content[0].text;
}

// === SEO記事生成 ===
async function generateBlogArticle(blog, keyword, articleType = "review") {
  console.log(`\n📝 記事生成: "${keyword}" (${blog.name})`);

  const articleTypes = {
    review: {
      desc: "商品レビュー・紹介記事",
      template: "商品の詳細を紹介し、購入を促す",
    },
    comparison: {
      desc: "比較記事",
      template: "複数商品を比較して最適なものを提案",
    },
    howto: {
      desc: "ハウツー記事",
      template: "やり方・方法を教えながら関連商品を紹介",
    },
    ranking: {
      desc: "ランキング記事",
      template: "TOP5〜10形式でおすすめを紹介",
    },
  };

  const type = articleTypes[articleType] || articleTypes.review;
  const amazonSearchUrl = blog.amazonSearchBase.replace(
    "{keyword}",
    encodeURIComponent(keyword)
  );

  const prompt = `
あなたはSEOとアフィリエイトに精通したブログライターです。

**ブログ**: ${blog.name}（${blog.niche}に特化）
**ターゲット読者**: ${blog.target}
**記事タイプ**: ${type.desc}
**メインキーワード**: ${keyword}
**Amazonアフィリエイト**: ${amazonSearchUrl}

## 記事要件

1. 文字数: 3,000〜5,000文字
2. SEO最適化:
   - タイトルにキーワードを含める
   - 見出し（h2/h3）にもキーワードのバリエーションを入れる
   - 内部リンク候補を【内部リンク候補: XXX】の形式でマーク
3. アフィリエイト:
   - 自然な流れで商品を3〜5点紹介
   - 各商品に [Amazonで確認する](URL) リンクを追加
   - 押しつけがましくない紹介
4. 読者体験:
   - 読者の悩みに共感するリード文
   - F字型読み取りを意識したレイアウト
   - まとめで購入を後押しするCTA

## 構成テンプレート
- H1: メインキーワードを含むタイトル
- リード文（200文字）
- H2: 読者の悩み・背景
- H2: [メインコンテンツ]（${type.template}）
- H2: 購入の際の注意点・選び方のコツ
- H2: まとめ + おすすめ商品一覧
- 「この記事が役に立ったら」的なCTA

Markdown形式で記事全文を書いてください。
`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

// === バッチ生成 ===
async function batchGenerate(blog, count) {
  console.log(`\n🚀 バッチ生成開始: ${blog.name} × ${count}記事`);

  // まずキーワードリサーチ
  const research = await researchKeywords(blog);
  const researchFile = `./research-${blog.name}-${Date.now()}.md`;
  fs.writeFileSync(researchFile, research);
  console.log(`✅ キーワードリサーチ保存: ${researchFile}`);

  // キーワードをリサーチ結果から抽出（簡易）
  const keywords = blog.mainKeywords.slice(0, count);

  const outputDir = `./articles-blog-${Object.keys(BLOGS).find((k) => BLOGS[k] === blog)}`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < keywords.length; i++) {
    const keyword = `${keywords[i]} おすすめ`;
    const article = await generateBlogArticle(blog, keyword, "ranking");

    const filename = `${outputDir}/${String(i + 1).padStart(2, "0")}-${keyword.replace(/\s+/g, "-")}.md`;
    fs.writeFileSync(filename, article);
    console.log(
      `✅ [${i + 1}/${keywords.length}] 保存: ${filename} (${article.length}文字)`
    );

    // レート制限対策
    if (i < keywords.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n🎉 バッチ生成完了! ${count}記事 → ${outputDir}/`);
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);
  const blogId = parseInt(args.find((a) => a.startsWith("--blog="))?.split("=")[1] || "1");
  const keyword = args.find((a) => a.startsWith("--keyword="))?.split("=").slice(1).join("=");
  const batchCount = parseInt(args.find((a) => a.startsWith("--batch="))?.split("=")[1] || "0");
  const doResearch = args.includes("--research");

  const blog = BLOGS[blogId] || BLOGS[1];

  if (doResearch) {
    const result = await researchKeywords(blog);
    const file = `./keyword-research-blog${blogId}.md`;
    fs.writeFileSync(file, result);
    console.log(`✅ リサーチ完了: ${file}`);
    return;
  }

  if (batchCount > 0) {
    await batchGenerate(blog, batchCount);
    return;
  }

  if (keyword) {
    const outputDir = `./articles-blog-${blogId}`;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const article = await generateBlogArticle(blog, keyword);
    const filename = `${outputDir}/${Date.now()}-${keyword.replace(/\s+/g, "-")}.md`;
    fs.writeFileSync(filename, article);
    console.log(`\n✅ 記事生成完了: ${filename}`);
    console.log(`   文字数: ${article.length}文字`);
    return;
  }

  // デフォルト: 最初のキーワードで1記事
  const defaultKeyword = blog.mainKeywords[0] + " おすすめ";
  const outputDir = `./articles-blog-${blogId}`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const article = await generateBlogArticle(blog, defaultKeyword);
  const filename = `${outputDir}/${Date.now()}-sample.md`;
  fs.writeFileSync(filename, article);
  console.log(`\n✅ サンプル記事生成: ${filename}`);
}

main().catch(console.error);
