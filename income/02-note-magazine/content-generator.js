#!/usr/bin/env node
/**
 * note 有料マガジン「AIで副業する方法」 記事自動生成ツール
 *
 * コンセプト:
 *   SP自身の実体験（Claude Code で副業）をベースにした有料コンテンツ
 *   読者: 副業したいエンジニア・フリーランサー・ビジネスマン
 *   価格: マガジン ¥1,980/月 または 単記事 ¥500〜
 *   目標読者数: 15人 × ¥1,980 = ¥29,700/月
 *
 * 使い方:
 *   node content-generator.js              # 今日の記事を生成
 *   node content-generator.js --topic "n番目"  # 指定トピックで生成
 *   node content-generator.js --list       # トピック一覧表示
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// === マガジン設定 ===
const MAGAZINE = {
  title: "AIとClaude Codeで月収20万円を目指すロードマップ",
  description:
    "実際にClaude Codeを使って副業収入を作っている現役の経験をそのままお伝えします。ツール紹介ではなく、実際に稼いだ方法だけを書きます。",
  price: 1980,
  author: "SP",
  targetReader: "副業・AI活用に興味があるビジネスパーソン",
};

// === 記事ネタリスト（20記事分）===
const ARTICLE_TOPICS = [
  // Week 1: 導入・実績公開（無料で公開 → マガジン購読を促す）
  {
    id: 1,
    title: "Claude Codeで副業を始めて3ヶ月、実際の収益を全部公開する",
    type: "free",
    hook: "実績公開",
    points: [
      "月1万→3万→目標20万の推移",
      "何をやったか時系列で公開",
      "失敗したこと・うまくいったこと",
    ],
  },
  {
    id: 2,
    title: "AIで副業するのに必要なのは「Claude Code」だけだった",
    type: "paid",
    hook: "逆説・驚き",
    points: [
      "他のツール（ChatGPT, Copilot）と比較した結果",
      "Claude Codeだけで何ができるか",
      "コスパの計算",
    ],
  },
  {
    id: 3,
    title: "【実例】アフィリエイト記事を全自動で月50本生成する方法",
    type: "paid",
    hook: "具体的な数字",
    points: [
      "実際のコード公開",
      "月50本の記事が¥5,000のAPI費用で生成できる",
      "品質管理の方法",
    ],
  },
  {
    id: 4,
    title: "noteで月¥30,000稼ぐために実際にやった7つのこと",
    type: "paid",
    hook: "数字・リスト",
    points: [
      "タイトルの付け方",
      "有料と無料の使い分け",
      "最初の100人の集め方",
    ],
  },
  {
    id: 5,
    title: "BOOTHでAIプロンプト集を売る完全ガイド（月¥20,000達成）",
    type: "paid",
    hook: "ハウツー",
    points: ["売れるプロンプト集の作り方", "価格設定", "マーケティング方法"],
  },
  {
    id: 6,
    title: "X(Twitter)自動投稿Botを作って月¥15,000のアフィリエイト収入を得た",
    type: "paid",
    hook: "実体験",
    points: [
      "Botの作り方（コード付き）",
      "アフィリエイトとの組み合わせ",
      "Twitter規約との兼ね合い",
    ],
  },
  {
    id: 7,
    title: "副業に使える時間が「1日30分」でも稼げる自動化の設計図",
    type: "paid",
    hook: "時間がない人向け",
    points: ["cronで全自動化", "月2時間の作業で回せるシステム", "優先度の付け方"],
  },
  {
    id: 8,
    title: "Claude APIの費用対効果を徹底計算した（月¥3,000で何ができるか）",
    type: "paid",
    hook: "コスパ重視の人向け",
    points: [
      "モデル別コスト比較",
      "ROI計算ツール",
      "無駄なAPI使用を避ける方法",
    ],
  },
  {
    id: 9,
    title: "【失敗談】AI副業で最初の3ヶ月にやってしまった5つのミス",
    type: "free",
    hook: "失敗談（共感・学び）",
    points: [
      "高品質すぎる記事を作りすぎた",
      "SNSを後回しにした",
      "収益化の仕組みを後で考えた",
    ],
  },
  {
    id: 10,
    title: "ランサーズ・クラウドワークスでAIを使って月¥50,000稼ぐ戦略",
    type: "paid",
    hook: "高収入",
    points: [
      "AIツール制作の受託方法",
      "価格設定",
      "Claude Codeで差別化する方法",
    ],
  },
  {
    id: 11,
    title: "既存のブログ・サイトをAIで3倍収益化する方法（実践録）",
    type: "paid",
    hook: "既存資産活用",
    points: [
      "SEO記事の自動リライト",
      "アフィリエイトリンクの最適化",
      "AdSense最大化",
    ],
  },
  {
    id: 12,
    title: "マイクロSaaS開発記 vol.1: 議事録自動化ツールを作って月¥20,000",
    type: "paid",
    hook: "連載・進行形",
    points: ["技術スタック選択", "最初の10人の獲得方法", "価格設定の考え方"],
  },
];

// === 記事生成 ===
async function generateArticle(topic, outputType = "note") {
  console.log(`\n✍️  記事生成中: "${topic.title}"`);

  const prompt = `
あなたは「AIとClaude Codeで実際に副業収入を得ている」経験者です。
SPというハンドルネームで活動しており、Claude Codeを使いこなして自動化で稼いでいます。

以下のトピックでnote有料記事を書いてください。

## 記事情報
- タイトル: ${topic.title}
- タイプ: ${topic.type === "free" ? "無料記事（有料マガジンへの入口）" : "有料記事"}
- フック: ${topic.hook}
- 要点:
${topic.points.map((p) => `  - ${p}`).join("\n")}

## ライティング要件
1. 文字数: ${topic.type === "free" ? "1,500〜2,000文字" : "2,500〜4,000文字"}
2. 視点: 一人称（私、SP）、実体験ベース
3. トーン: 正直・具体的・熱量がある（でも押しつけがましくない）
4. 構成:
   - キャッチーなリード文（最初の100文字で読者をつかむ）
   - 本論（実体験 + 具体的なデータ・数字）
   - まとめ + 次のアクション
${topic.type === "free" ? "5. 末尾: 有料マガジンへの自然な誘導（押しつけがましくなく）" : ""}
5. Markdown形式で出力

## 重要な注意
- 「〜かもしれません」「〜と思います」は使わない → 断言する
- 抽象的な話は1割以下 → 具体的な数字・手順・コードを中心に
- 読者が「これを読んだ後すぐに行動できる」内容にする

記事を書いてください。
`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

// === メタ情報生成（SEO・SNS投稿用）===
async function generateMeta(topic, article) {
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `
以下の記事のメタ情報を生成してください:
タイトル: ${topic.title}
記事（先頭500文字）: ${article.substring(0, 500)}

出力形式（JSON）:
{
  "noteTitle": "note投稿用タイトル（50文字以内）",
  "twitterPost": "Twitter告知用投稿文（140文字以内、ハッシュタグ含む）",
  "description": "記事説明（100文字以内）",
  "tags": ["タグ1", "タグ2", "タグ3"]
}
`,
      },
    ],
  });

  try {
    const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    console.log("\n📚 記事ネタリスト:");
    ARTICLE_TOPICS.forEach((t) => {
      const emoji = t.type === "free" ? "🆓" : "💰";
      console.log(`  ${emoji} #${t.id}: ${t.title}`);
    });
    return;
  }

  const topicId = parseInt(
    args.find((a) => a.startsWith("--id="))?.split("=")[1] || "1"
  );
  const topic = ARTICLE_TOPICS.find((t) => t.id === topicId) || ARTICLE_TOPICS[0];

  // 出力ディレクトリ
  const outputDir = "./generated";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 記事生成
  const article = await generateArticle(topic);

  // メタ情報生成
  const meta = await generateMeta(topic, article);

  // ファイル保存
  const date = new Date().toISOString().split("T")[0];
  const filename = `${outputDir}/${date}-note-${topic.id}.md`;

  const fullContent = `---
title: ${topic.title}
type: ${topic.type}
date: ${date}
noteTitle: ${meta?.noteTitle || topic.title}
description: ${meta?.description || ""}
tags: ${JSON.stringify(meta?.tags || [])}
---

${article}

---

## X告知文
${meta?.twitterPost || ""}
`;

  fs.writeFileSync(filename, fullContent);

  console.log("\n✅ 生成完了!");
  console.log(`   ファイル: ${filename}`);
  console.log(`   文字数: ${article.length}文字`);
  if (meta) {
    console.log(`\n📣 X告知文:`);
    console.log(meta.twitterPost);
  }

  // 次の記事の提案
  const nextTopic = ARTICLE_TOPICS.find((t) => t.id === topicId + 1);
  if (nextTopic) {
    console.log(`\n💡 次回おすすめ: #${nextTopic.id} "${nextTopic.title}"`);
    console.log(
      `   コマンド: node content-generator.js --id=${nextTopic.id}`
    );
  }
}

main().catch(console.error);
