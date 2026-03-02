#!/usr/bin/env node
/**
 * BOOTH デジタル商品 自動生成ツール
 *
 * 販売する商品:
 * 1. 「Claude Code副業プロンプト大全 100選」(¥2,000)
 * 2. 「AIブログ記事生成プロンプトセット」(¥1,500)
 * 3. 「SNS自動投稿プロンプト集」(¥1,000)
 * 4. 「議事録・ビジネス文書プロンプト集」(¥1,500)
 *
 * 目標: 月10件販売 × 各¥1,500 = ¥15,000〜20,000/月
 *
 * 使い方:
 *   node generate-product.js --product 1    # 商品1を生成
 *   node generate-product.js --all           # 全商品生成
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// === 商品定義 ===
const PRODUCTS = [
  {
    id: 1,
    name: "Claude Code副業プロンプト大全 100選",
    price: 2000,
    description:
      "Claude Codeで副業収入を得るために実際に使ったプロンプトを100個まとめました。SEO記事生成・SNS投稿・デジタル商品制作・アフィリエイトまでカバー。",
    sections: [
      {
        title: "SEO記事生成プロンプト (30選)",
        count: 30,
        category: "content",
      },
      { title: "SNS投稿自動化プロンプト (20選)", count: 20, category: "sns" },
      {
        title: "デジタル商品制作プロンプト (20選)",
        count: 20,
        category: "product",
      },
      {
        title: "アフィリエイト最適化プロンプト (15選)",
        count: 15,
        category: "affiliate",
      },
      { title: "ビジネス文書プロンプト (15選)", count: 15, category: "biz" },
    ],
  },
  {
    id: 2,
    name: "AIブログ記事生成プロンプトセット for WordPress",
    price: 1500,
    description:
      "WordPressブログの記事を高品質に自動生成するためのプロンプトセット。SEOを意識した構成から商品レビュー記事まで対応。",
    sections: [
      {
        title: "基本記事生成プロンプト (10種)",
        count: 10,
        category: "blog-basic",
      },
      {
        title: "商品レビュー記事プロンプト (5種)",
        count: 5,
        category: "blog-review",
      },
      { title: "まとめ記事プロンプト (5種)", count: 5, category: "blog-list" },
    ],
  },
  {
    id: 3,
    name: "X(Twitter)副業アカウント運用 自動化プロンプト集",
    price: 1000,
    description:
      "Xアカウントを副業に使うための投稿文自動生成プロンプトセット。アフィリエイト投稿・情報発信・エンゲージメント獲得まで。",
    sections: [
      { title: "アフィリエイト投稿プロンプト (10種)", count: 10, category: "x-aff" },
      { title: "情報発信投稿プロンプト (10種)", count: 10, category: "x-info" },
      {
        title: "エンゲージメント獲得プロンプト (5種)",
        count: 5,
        category: "x-eng",
      },
    ],
  },
];

// === プロンプト集生成 ===
async function generatePromptCollection(product, section) {
  console.log(`  📝 生成中: ${section.title}`);

  const categoryPrompts = {
    content: "SEO記事・ブログコンテンツ生成",
    sns: "X(Twitter)・Instagram等のSNS投稿",
    product: "デジタル商品（PDF・テンプレート）の説明文・目次",
    affiliate: "アフィリエイト記事・商品紹介文",
    biz: "ビジネスメール・議事録・提案書",
    "blog-basic": "ブログ一般記事（情報記事・解説記事）",
    "blog-review": "商品レビュー・比較記事",
    "blog-list": "まとめ記事・ランキング記事",
    "x-aff": "Xでのアフィリエイト投稿",
    "x-info": "Xでの情報発信・価値提供投稿",
    "x-eng": "Xでのリプライ・エンゲージメント促進",
  };

  const prompt = `
あなたはClaude Code・AIを使った副業の専門家です。

以下のカテゴリで実用的なプロンプトを${section.count}個作成してください。

**カテゴリ**: ${categoryPrompts[section.category] || section.category}
**セクション名**: ${section.title}
**商品名**: ${product.name}

## 各プロンプトの形式

### プロンプト N: [わかりやすい名前]
**用途**: [このプロンプトで何ができるか1行で]
**使い方**: [どんな時に使うか]

\`\`\`
[実際のプロンプトテキスト]
[変数は{{変数名}}形式で]
\`\`\`

**ポイント**: [このプロンプトのコツ・注意点]

---

## 要件
- 実際に使える、具体的で高品質なプロンプト
- コピペですぐ使える（説明が少なくてもOK）
- {{変数}}を使って汎用性を高める
- 日本語のビジネス・副業シーンに特化

${section.count}個すべて作成してください。
`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

// === 商品説明文・販売ページ用テキスト生成 ===
async function generateSalesPage(product) {
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `
BOOTHで販売するデジタル商品の販売ページ文を作成してください。

商品名: ${product.name}
価格: ¥${product.price.toLocaleString()}
概要: ${product.description}
セクション: ${product.sections.map((s) => s.title).join("、")}

## 販売ページの構成
1. キャッチコピー（20文字以内）
2. サブキャッチ（50文字以内）
3. 商品説明（200文字）
4. こんな人におすすめ（箇条書き5点）
5. 商品内容（セクション別）
6. 購入者の声（3件、架空でよい）
7. FAQ（3問）
8. 購入ボタン前の一言

Markdown形式で出力してください。
`,
      },
    ],
  });

  return message.content[0].text;
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);
  const productId = parseInt(
    args.find((a) => a.startsWith("--product="))?.split("=")[1] || "1"
  );
  const generateAll = args.includes("--all");

  const outputDir = "./generated-products";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const products = generateAll
    ? PRODUCTS
    : [PRODUCTS.find((p) => p.id === productId) || PRODUCTS[0]];

  for (const product of products) {
    console.log(`\n🛒 商品生成: ${product.name} (¥${product.price})`);

    const productDir = `${outputDir}/product-${product.id}`;
    if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });

    // 販売ページ文生成
    console.log("  📄 販売ページ生成中...");
    const salesPage = await generateSalesPage(product);
    fs.writeFileSync(`${productDir}/sales-page.md`, salesPage);

    // プロンプト集生成（セクション別）
    let allPrompts = `# ${product.name}\n\n${product.description}\n\n---\n\n`;

    for (const section of product.sections) {
      const sectionContent = await generatePromptCollection(product, section);
      allPrompts += `## ${section.title}\n\n${sectionContent}\n\n---\n\n`;

      // 少し待機（API レート制限対策）
      await new Promise((r) => setTimeout(r, 1000));
    }

    // ファイル保存
    fs.writeFileSync(`${productDir}/prompts.md`, allPrompts);

    // BOOTH用PDF変換コマンド（pandoc使用）
    const pdfCmd = `pandoc "${productDir}/prompts.md" -o "${productDir}/${product.name}.pdf" --pdf-engine=xelatex -V mainfont="Noto Sans CJK JP"`;
    fs.writeFileSync(`${productDir}/convert-to-pdf.sh`, `#!/bin/bash\n${pdfCmd}\n`);

    console.log(`  ✅ 生成完了: ${productDir}/`);
    console.log(
      `     - prompts.md (${allPrompts.length}文字)`
    );
    console.log(`     - sales-page.md`);
    console.log(`     - convert-to-pdf.sh`);
  }

  console.log("\n🎉 全商品生成完了!");
  console.log("\n📋 次のステップ:");
  console.log("  1. prompts.md を PDF に変換 (bash convert-to-pdf.sh)");
  console.log("  2. BOOTHに商品登録");
  console.log("  3. sales-page.md の内容をBOOTH商品ページに貼り付け");
  console.log("  4. SNSで告知 (X自動投稿Botが翌朝投稿)");
}

main().catch(console.error);
