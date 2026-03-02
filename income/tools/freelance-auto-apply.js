#!/usr/bin/env node
/**
 * クラウドワークス・ランサーズ 自動応募ツール
 *
 * やること:
 * 1. 案件一覧を定期取得（RSS/API/スクレイピング）
 * 2. 条件に合った案件をフィルタリング
 * 3. Claude で個別提案文を自動生成
 * 4. 応募文をクリップボードor通知（自動投稿は利用規約次第）
 *
 * ターゲット案件:
 * - AIツール開発・自動化スクリプト作成
 * - Webスクレイピング
 * - GAS・スプレッドシート自動化
 * - Claude Code / AI活用相談
 * 予算目標: ¥30,000〜50,000/件 × 月2件 = ¥60,000〜100,000/月
 *
 * 使い方:
 *   node freelance-auto-apply.js --check      # 案件チェック
 *   node freelance-auto-apply.js --generate 123  # 案件IDで提案文生成
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// === SP のプロフィール（提案文に使う）===
const MY_PROFILE = {
  name: "SP",
  specialty: [
    "Claude Code / AI自動化ツール開発",
    "Google Apps Script (GAS)",
    "WordPress / WooCommerce カスタマイズ",
    "Python / JavaScript / Node.js",
    "LINE Bot / ChatBot 開発",
    "SEO記事の自動化・量産システム",
    "スクレイピング・データ収集",
    "Firebase / Firestore",
  ],
  achievements: [
    "モルック情報メディア（月3,000セッション）の全自動化運営",
    "Claude Codeを使ったSEO記事量産システム構築",
    "GAS + Firebase を使った大会情報自動収集・投稿システム",
    "チームライド配車システム開発（複数バグを4ラウンドQAで解決）",
    "Claude Code による議事録自動化パイプライン",
  ],
  hourlyRate: 5000,
  minBudget: 30000,
};

// === 案件フィルター条件 ===
const FILTER_CONDITIONS = {
  minBudget: 20000,
  keywords: [
    "自動化",
    "AI",
    "Claude",
    "ChatGPT",
    "GAS",
    "スクレイピング",
    "Bot",
    "ツール開発",
    "API連携",
    "LINE Bot",
    "WordPress",
    "Python",
    "JavaScript",
    "Node.js",
  ],
  excludeKeywords: [
    "デザイン",
    "イラスト",
    "動画編集",
    "翻訳",
    "テープ起こし",
    "データ入力",
  ],
  maxBudget: 500000,
};

// === 提案文自動生成 ===
async function generateProposal(jobDetails) {
  const prompt = `
あなたはフリーランスのAI自動化エンジニアです。
以下の案件に対して、採用率の高い提案文を作成してください。

## クライアントの案件情報
${jobDetails}

## あなたのプロフィール
名前: ${MY_PROFILE.name}
専門スキル:
${MY_PROFILE.specialty.map((s) => `- ${s}`).join("\n")}

実績:
${MY_PROFILE.achievements.map((a) => `- ${a}`).join("\n")}

## 提案文の要件
1. 文字数: 400〜600文字
2. 構成:
   a. 冒頭: クライアントの課題・要件への理解を示す（2〜3文）
   b. 本文: 類似実績・具体的な解決策の提案（200文字）
   c. 差別化: なぜ自分が適任か（100文字）
   d. 締め: 具体的な次のステップ + 返信を促す（100文字）
3. トーン: プロフェッショナルだが、堅苦しすぎない
4. 「〜と思います」は使わない → 「〜します」「〜できます」で断言
5. クライアントの名前（わかれば）を冒頭に使う

提案文だけを出力してください（説明・前置き不要）。
`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

// === 案件チェック（RSS取得の例）===
async function checkJobs() {
  console.log("\n🔍 案件チェック中...");

  // クラウドワークス RSS
  const cwRssUrl =
    "https://crowdworks.jp/public/jobs/search.atom?order=new&bids_count=0&job_type=fixed_type&industry=4&language=javascript";

  try {
    const response = await fetch(cwRssUrl);
    const text = await response.text();

    // シンプルなRSSパース（実際は xml2js 等を使用）
    const titleMatches = text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g);
    const titles = [...titleMatches].map((m) => m[1]).slice(0, 10);

    console.log("\n📋 新着案件（クラウドワークス）:");
    titles.forEach((title, i) => {
      const isMatch = FILTER_CONDITIONS.keywords.some((kw) =>
        title.includes(kw)
      );
      const icon = isMatch ? "✅" : "⬜";
      console.log(`  ${icon} ${i + 1}. ${title}`);
    });
  } catch (e) {
    console.log("⚠️  RSS取得エラー（手動で案件URLを指定してください）");
    console.log("   使用例: node freelance-auto-apply.js --generate");
  }
}

// === サンプル案件で提案文生成 ===
async function generateSampleProposal() {
  const sampleJob = `
【案件タイトル】Claude API・ChatGPTを使った社内業務自動化ツールの開発

【依頼内容】
弊社の月次レポート作成業務を自動化したいと考えています。
現在、担当者が毎月20時間かけてExcelデータを集計し、
Word形式でレポートを作成しています。

これをAIを使って自動化できる方を募集しています。

【入力データ】
- Google スプレッドシート（5シート、約1,000行/月）
- Google Analytics 月次データ（CSV）

【出力】
- まとめレポート（Word or Notion）
- 異常値があればSlack通知

【予算】 50,000〜100,000円
【納期】 2週間
【技術要件】 Python or JavaScript、Claude API使用推奨
`;

  console.log("\n📝 提案文生成中...");
  const proposal = await generateProposal(sampleJob);

  const filename = `./proposals/sample-${Date.now()}.txt`;
  const dir = "./proposals";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filename, proposal);

  console.log("\n=== 生成された提案文 ===");
  console.log(proposal);
  console.log(`\n✅ 保存: ${filename}`);
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    await checkJobs();
    return;
  }

  if (args.includes("--generate")) {
    await generateSampleProposal();
    return;
  }

  // カスタム案件で提案文生成
  const jobFile = args.find((a) => a.endsWith(".txt") || a.endsWith(".md"));
  if (jobFile && fs.existsSync(jobFile)) {
    const jobDetails = fs.readFileSync(jobFile, "utf8");
    const proposal = await generateProposal(jobDetails);
    console.log("\n=== 提案文 ===");
    console.log(proposal);
    return;
  }

  console.log(`
🤖 フリーランス自動応募ツール

使い方:
  --check              案件チェック（新着確認）
  --generate           サンプル提案文を生成
  [job-file.txt]       指定ファイルの案件に提案文生成

例:
  node freelance-auto-apply.js --check
  node freelance-auto-apply.js --generate
  node freelance-auto-apply.js job-description.txt
`);
}

main().catch(console.error);
