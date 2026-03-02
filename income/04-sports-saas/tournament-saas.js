#!/usr/bin/env node
/**
 * スポーツ大会自動化SaaS
 *
 * ★ これはSPが既に持っているインフラをそのままSaaS化するもの！
 * ★ tournament-queue パイプラインがすでに稼働中 → パッケージ化するだけ
 *
 * 提供機能:
 * 1. 大会結果 → 自動レポート生成（日本語）
 * 2. X/LINE への自動投稿
 * 3. 大会ページ自動生成（GitHub Pages）
 * 4. 試合スコア → スタンディング自動更新
 *
 * ターゲット顧客:
 * - モルックチーム・クラブ
 * - スポーツ協会・連盟（モルック以外も）
 * - 地域スポーツサークル
 *
 * 価格: ¥3,000〜10,000/月
 * 目標: 10クラブ × ¥3,000 = ¥30,000/月
 *
 * 日本全国の登録スポーツクラブ: 170,000以上
 *
 * 使い方:
 *   node tournament-saas.js --demo           # デモ: サンプル大会データで試す
 *   node tournament-saas.js --report <json>  # 大会データからレポート生成
 *   node tournament-saas.js --landing        # 販売ページHTML生成
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// === サンプル大会データ ===
const SAMPLE_TOURNAMENT = {
  name: "第12回 XXモルック大会",
  date: "2026-03-02",
  location: "大阪府 XX公園",
  participants: [
    {
      team: "モルック戦士団",
      members: ["田中", "鈴木"],
      scores: [50, 45, 48],
      rank: 1,
    },
    { team: "スキットル破壊者", members: ["佐藤"], scores: [45, 43, 44], rank: 2 },
    { team: "投擲の達人", members: ["伊藤", "渡辺"], scores: [42, 40, 41], rank: 3 },
    { team: "初心者チーム", members: ["山田"], scores: [35, 38, 33], rank: 4 },
  ],
  mvp: "田中（モルック戦士団）",
  highlight: "最終ラウンドで大逆転劇",
};

// === 大会レポート生成 ===
async function generateReport(tournament) {
  console.log(`\n📊 大会レポート生成: ${tournament.name}`);

  const prompt = `
以下の大会データから、SNSや団体ウェブサイトに掲載できる公式大会レポートを作成してください。

**大会情報**:
- 名称: ${tournament.name}
- 日時: ${tournament.date}
- 場所: ${tournament.location}
- 参加チーム数: ${tournament.participants.length}チーム
- MVP: ${tournament.mvp}
- ハイライト: ${tournament.highlight}

**結果**:
${tournament.participants
  .map(
    (p) => `
${p.rank}位: ${p.team}（${p.members.join("・")}）
スコア: ${p.scores.join(" / ")} → 最高: ${Math.max(...p.scores)}点
`
  )
  .join("")}

## 出力内容（3種類）

### 1. 公式レポート（Webサイト掲載用・500文字）
大会の雰囲気、白熱した試合展開、結果を生き生きと伝える文章。

### 2. X(Twitter)投稿文（140文字以内 + ハッシュタグ）
結果の速報と次回予告を含む。

### 3. LINE公式アカウント通知文（200文字）
会員向けに結果と写真撮影済みの案内。

---

上記3種類をそれぞれ分けて出力してください。
`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

// === 販売用ランディングページ生成 ===
async function generateLandingPage() {
  console.log("\n🌐 ランディングページ生成中...");

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `
スポーツサークル向けの大会自動化SaaSのランディングページのHTMLを作成してください。

## サービス概要
- 名称: 「大会くん」（仮）
- 価格: ¥3,000/月（年払いで¥27,000）
- ターゲット: モルック、バドミントン、テニス等のスポーツサークル運営者
- 機能:
  1. 大会結果を入力するだけで → レポート自動生成
  2. X/LINE に自動投稿
  3. スタンディング（順位表）自動更新
  4. 大会ページ（サイト）自動生成

## デザイン要件
- シンプルで読みやすい
- モバイルファーストのレスポンシブ
- ダークベースのサイバーパンク風（SPのサイトテーマに合わせる）
- CTAボタン: 「無料で試す（30日間）」

## コンテンツ要件
- ヘッダー: キャッチコピー + サブコピー
- 痛みの解消: 今の手作業の大変さを共感
- 機能説明: 3つのシンプルな説明
- 価格表: 月払い・年払い
- FAQ: 5問
- CTAセクション

完全なHTMLファイル（CSS込み）を出力してください。
`,
      },
    ],
  });

  return message.content[0].text;
}

// === 潜在顧客リスト生成 ===
async function generateProspectList() {
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `
日本のスポーツサークル運営者に大会自動化ツールを売るための営業メール文を作成してください。

## 対象
モルックチームの代表者（SNSで活動しているコミュニティ）

## メール要件
- 件名: 注目してもらえるもの
- 本文: 200文字以内で簡潔に
- 訴求: 「大会後の作業が5分で終わる」
- CTA: 無料トライアルに誘導
- トーン: 同じスポーツ仲間として親しみやすく

X(Twitter)のDM用メッセージも作成してください（140文字以内）。
`,
      },
    ],
  });

  return message.content[0].text;
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);
  const outputDir = "./output";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  if (args.includes("--demo")) {
    const report = await generateReport(SAMPLE_TOURNAMENT);
    const filename = `${outputDir}/demo-report-${Date.now()}.txt`;
    fs.writeFileSync(filename, report);
    console.log("\n=== 大会レポート ===");
    console.log(report);
    console.log(`\n✅ 保存: ${filename}`);
    return;
  }

  if (args.includes("--landing")) {
    const html = await generateLandingPage();
    const filename = `${outputDir}/landing-page.html`;
    fs.writeFileSync(filename, html);
    console.log(`✅ ランディングページ生成: ${filename}`);
    return;
  }

  if (args.includes("--prospects")) {
    const emails = await generateProspectList();
    const filename = `${outputDir}/prospect-emails.txt`;
    fs.writeFileSync(filename, emails);
    console.log("\n=== 営業メール ===");
    console.log(emails);
    console.log(`\n✅ 保存: ${filename}`);
    return;
  }

  // カスタム大会データ
  const dataFile = args.find((a) => a.endsWith(".json"));
  if (dataFile && fs.existsSync(dataFile)) {
    const tournament = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    const report = await generateReport(tournament);
    console.log(report);
    return;
  }

  console.log(`
🏆 スポーツ大会自動化SaaS

コマンド:
  --demo         デモ大会データでレポート生成
  --landing      販売ランディングページ生成
  --prospects    営業メール・DM文生成
  [data.json]    カスタム大会データでレポート生成

使用例:
  node tournament-saas.js --demo
  node tournament-saas.js --landing
`);
}

main().catch(console.error);
