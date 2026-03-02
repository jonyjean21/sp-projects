#!/usr/local/bin/node
/**
 * クラウドワークス 案件マッチング + 提案文自動生成
 *
 * やること:
 * 1. クラウドワークスRSS/検索から新着案件を取得
 * 2. Claude API でスコアリング（受注可能性 + 単価）
 * 3. 上位案件の提案文を自動生成 → ファイル保存
 * 4. SPが5分確認してコピペ応募するだけ
 *
 * 使い方:
 *   node crowdworks-proposal-generator.js          # 全自動: 案件取得→スコアリング→提案文生成
 *   node crowdworks-proposal-generator.js --dry    # 案件取得+スコアリングのみ（提案文生成なし）
 *   node crowdworks-proposal-generator.js --count 5  # 上位5件の提案文を生成（デフォルト3件）
 *
 * cron設定（毎日9時に実行）:
 *   0 9 * * * cd /Users/shumpei/sp-projects/income && /usr/local/bin/node tools/crowdworks-proposal-generator.js >> logs/cw.log 2>&1
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONFIG = {
  scoringModel: "claude-haiku-4-5-20251001",   // スコアリング: 安いhaiku
  proposalModel: "claude-sonnet-4-6",          // 提案文: 品質重視のsonnet
  outputDir: path.join(__dirname, "generated-proposals"),
  selfIntroFile: path.join(__dirname, "generated-proposals", "self-intro.md"),
  maxProposals: 3,
  // SP のスキルプロフィール（スコアリングの基準）
  spProfile: {
    skills: [
      "Claude Code / Claude API",
      "Google Apps Script (GAS)",
      "WordPress REST API",
      "Node.js / JavaScript",
      "Firebase",
      "業務自動化・DX",
      "記事執筆・コンテンツ制作",
      "Python（基礎）",
    ],
    experience: "MOLKKY HUB（月3,000セッションのモルック情報メディア）を自作・運営中。Claude Codeで収益自動化システムを構築している。GAS・WordPress・Firebase・Firebaseを実務で使用。",
    preference: {
      minBudget: 10000,    // ¥10,000以上
      maxBudget: 200000,   // ¥200,000以下（初期は大手を避ける）
      preferFixed: true,   // 固定報酬優先
      avoidCategories: ["デザイン", "イラスト", "動画編集", "翻訳"],
    },
  },
};

// クラウドワークスRSSフィード一覧（検索キーワード別）
const CW_FEEDS = [
  // GAS / スプレッドシート自動化
  "https://crowdworks.jp/public/jobs/search.atom?search[job_type]=fixed_works&search[keyword]=GAS&search[order]=new",
  // WordPress
  "https://crowdworks.jp/public/jobs/search.atom?search[job_type]=fixed_works&search[keyword]=WordPress+自動化&search[order]=new",
  // Claude / ChatGPT / AI
  "https://crowdworks.jp/public/jobs/search.atom?search[job_type]=fixed_works&search[keyword]=ChatGPT+自動化&search[order]=new",
  // Node.js / API
  "https://crowdworks.jp/public/jobs/search.atom?search[job_type]=fixed_works&search[keyword]=API+連携+Node&search[order]=new",
  // 業務自動化
  "https://crowdworks.jp/public/jobs/search.atom?search[job_type]=fixed_works&search[keyword]=業務自動化&search[order]=new",
  // 記事執筆
  "https://crowdworks.jp/public/jobs/search.atom?search[job_type]=fixed_works&search[keyword]=記事+AI+執筆&search[order]=new",
];

// === RSS取得 ===
async function fetchJobs(feedUrl) {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; job-fetcher/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // Atom feedをパース（正規表現でシンプルに）
    const entries = [];
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

    for (const match of entryMatches) {
      const entry = match[1];
      const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1").trim() || "";
      const url = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] || "";
      const summary = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() || "";
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || "";

      if (title && url) {
        entries.push({ title, url, summary: summary.substring(0, 300), published });
      }
    }

    return entries;
  } catch (e) {
    console.error(`RSS取得エラー (${feedUrl.split("?")[0]}): ${e.message}`);
    return [];
  }
}

// === 重複除去 ===
function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
}

// === AI スコアリング（複数案件を一括評価）===
async function scoreJobs(jobs) {
  if (jobs.length === 0) return [];

  const jobList = jobs.map((j, i) =>
    `[${i + 1}] タイトル: ${j.title}\n概要: ${j.summary}\nURL: ${j.url}`
  ).join("\n\n");

  const prompt = `
あなたはフリーランスエンジニアのキャリアコンサルタントです。
以下のフリーランス案件を、指定したフリーランサーのスキルと優先条件に基づいてスコアリングしてください。

## フリーランサーのプロフィール
スキル: ${CONFIG.spProfile.skills.join(", ")}
経歴: ${CONFIG.spProfile.experience}
条件: 最低予算¥${CONFIG.spProfile.preference.minBudget.toLocaleString()}以上、固定報酬優先

## 評価対象案件
${jobList}

## 評価基準
- スキルマッチ度 (0-40点): 上記スキルとの一致度
- 受注可能性 (0-30点): 実績ゼロでも提案できそうか
- 収益性 (0-30点): 予算規模・継続性

## 出力形式（必ずJSONで返す）
{
  "scores": [
    {
      "index": 1,
      "total": 85,
      "skill_match": 35,
      "win_rate": 25,
      "revenue": 25,
      "reason": "GASの自動化案件でスキル完全一致。予算¥30,000で実績なしでも提案可能"
    }
  ]
}
`;

  const message = await client.messages.create({
    model: CONFIG.scoringModel,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが見つからない");
    const result = JSON.parse(jsonMatch[0]);

    return result.scores.map(s => ({
      ...jobs[s.index - 1],
      score: s.total,
      reason: s.reason,
    })).sort((a, b) => b.score - a.score);
  } catch (e) {
    console.error("スコアリングパースエラー:", e.message);
    return jobs.map((j, i) => ({ ...j, score: 50, reason: "スコアリング失敗" }));
  }
}

// === 提案文生成 ===
async function generateProposal(job) {
  // 自己PRを読み込む
  let selfIntro = "";
  if (fs.existsSync(CONFIG.selfIntroFile)) {
    selfIntro = fs.readFileSync(CONFIG.selfIntroFile, "utf8").substring(0, 500);
  }

  const prompt = `
あなたはフリーランスエンジニア「SP」として、クラウドワークスの案件に提案文を書きます。

## 案件情報
タイトル: ${job.title}
概要: ${job.summary}

## SP のプロフィール
${selfIntro || CONFIG.spProfile.experience}
スキル: ${CONFIG.spProfile.skills.join(", ")}

## 提案文の要件
1. 文字数: 400〜600文字
2. 構成:
   - 冒頭: 案件への共感・課題理解（2〜3文）
   - 中盤: 自分がどう解決できるか（具体的・数字あり）
   - 終盤: 実績の一例（MOLKKY HUBや自動化システムの話）
   - 締め: 気軽に相談してくださいという一文
3. トーン: 誠実・丁寧。押しつけがましくない
4. NGワード: 「御社」「貴社」は避ける（個人向け案件が多いため）
5. Claude CodeやAIを自然にアピール（差別化）

提案文だけ出力してください（説明・コメント不要）。
`;

  const message = await client.messages.create({
    model: CONFIG.proposalModel,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text.trim();
}

// === メイン処理 ===
async function main() {
  const args = process.argv.slice(2);
  const isDry = args.includes("--dry");
  const countArg = args.find(a => a.startsWith("--count="))?.split("=")[1];
  const maxCount = parseInt(countArg || CONFIG.maxProposals);

  console.log("\n🔍 クラウドワークス案件取得中...");

  // 全フィードから案件取得
  const allJobs = [];
  for (const feed of CW_FEEDS) {
    const jobs = await fetchJobs(feed);
    allJobs.push(...jobs);
    process.stdout.write(".");
  }
  console.log(`\n   取得: ${allJobs.length}件`);

  // 重複除去
  const unique = deduplicateJobs(allJobs);
  console.log(`   重複除去後: ${unique.length}件`);

  if (unique.length === 0) {
    console.log("⚠️  案件が取得できませんでした");
    return;
  }

  // スコアリング（最大20件を評価）
  console.log("\n🤖 AIスコアリング中...");
  const toScore = unique.slice(0, 20);
  const scored = await scoreJobs(toScore);

  // 上位を表示
  console.log("\n📋 上位案件:");
  scored.slice(0, maxCount + 2).forEach((j, i) => {
    console.log(`\n  ${i + 1}位 (${j.score}点) ${j.title}`);
    console.log(`     理由: ${j.reason}`);
    console.log(`     URL: ${j.url}`);
  });

  if (isDry) {
    console.log("\n✅ ドライランモード: 提案文生成をスキップ");
    return;
  }

  // 上位案件の提案文を生成
  const top = scored.slice(0, maxCount);
  const outputPath = path.join(
    CONFIG.outputDir,
    `proposals-${new Date().toISOString().split("T")[0]}.md`
  );

  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  let output = `# クラウドワークス提案文 ${new Date().toLocaleDateString("ja-JP")}\n\n`;
  output += `生成: ${top.length}件 | 対象案件: ${unique.length}件から上位を選択\n\n---\n\n`;

  for (let i = 0; i < top.length; i++) {
    const job = top[i];
    console.log(`\n✍️  提案文生成中 ${i + 1}/${top.length}: ${job.title}`);

    const proposal = await generateProposal(job);

    output += `## ${i + 1}. ${job.title}\n`;
    output += `**スコア**: ${job.score}点 | **理由**: ${job.reason}\n`;
    output += `**URL**: ${job.url}\n\n`;
    output += `### 提案文\n\n${proposal}\n\n`;
    output += `---\n\n`;
  }

  fs.writeFileSync(outputPath, output);

  console.log(`\n✅ 提案文生成完了!`);
  console.log(`   ファイル: ${outputPath}`);
  console.log(`   生成数: ${top.length}件`);
  console.log(`\n📌 次のステップ:`);
  console.log(`   1. cat ${outputPath} で内容確認`);
  console.log(`   2. 各案件URLを開いて提案文をコピペ`);
  console.log(`   3. 案件に合わせて一言カスタマイズ → 応募！`);
}

main().catch(console.error);
