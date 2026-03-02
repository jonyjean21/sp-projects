---
title: 【コード公開】アフィリエイト記事を全自動で月50本生成する方法
type: paid
price: 500
estimated_read_time: 12分
publish_date: 2026-03-03
---

# 【コード公開】アフィリエイト記事を全自動で月50本生成する方法

結論から言う。月50本のアフィリエイト記事を生成するAPI費用は**¥200円以下**だ。

「それ品質は大丈夫なの？」という疑問には答える。**大丈夫だ。というかそれが全て**。この記事では、自分が運営しているWordPress情報メディアで実際に使っているコードと設定を全部公開する。

---

## なぜ「量産」が大事か：SEOの現実

まず前提として、SEOにおける「量」の重要性を理解してほしい。

Googleはサイトの権威性（オーソリティ）をドメイン単位で評価する。新しいサイトが権威性を上げる最短ルートは「特定テーマで大量の記事を書くこと」だ。

ニッチスポーツで言えば、競合サイトが20記事しかない状況で俺が100記事を持っていれば、Googleは「このサイトはそのスポーツについて詳しい」と判断し始める。これが「トピッククラスター」という概念だ。

問題は、人間が100記事を書くのにかかる時間だ。1記事2時間として200時間。フルタイムの副業でも3ヶ月かかる。

**Claude APIを使えばこれが変わる。1記事の生成時間は約90秒。50本なら75分だ。**

---

## Claude APIの費用対効果計算

モデルはclaude-haiku-3-5を使う。理由はコストだ。

アフィリエイト記事1本（約2,000文字）の生成コスト内訳：

| 項目 | トークン数 | 費用 |
|------|-----------|------|
| 入力（プロンプト） | 約500トークン | ¥0.075 |
| 出力（記事本文） | 約2,800トークン | ¥1.26 |
| **合計** | **3,300トークン** | **¥1.34** |

月50本で計算すると：

- API費用: **¥67**
- 月のドメイン・サーバー代: **¥1,500**（さくらサーバー）
- 合計ランニングコスト: **¥1,567/月**

3ヶ月目の収益が¥10,044だったから、**ROIは約542%**だ。

高品質な記事が必要なときだけclaude-opus-4-6に切り替える。比較記事やSEO的に重要なランディングページだ。コストは10倍になるが、それでも1記事¥13円程度。

---

## 実際のコード

`article-generator.js` の核心部分を公開する。

```javascript
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// キーワードリスト（購買意図が高い順）
const KEYWORDS = [
  { keyword: "モルック おすすめ セット 2026", intent: "purchase", priority: 1 },
  { keyword: "モルック 初心者 セット 購入", intent: "purchase", priority: 1 },
  { keyword: "モルック 木製 おすすめ ランキング", intent: "purchase", priority: 1 },
  { keyword: "モルック 子供 何歳から", intent: "consideration", priority: 2 },
  { keyword: "モルック 公式 セット 値段", intent: "consideration", priority: 2 },
  { keyword: "モルック ルール 簡単", intent: "information", priority: 3 },
  { keyword: "モルック 歴史", intent: "information", priority: 3 },
];

// 購買意図別プロンプトテンプレート
const PROMPT_TEMPLATES = {
  purchase: (keyword, affiliateLinks) => `
あなたはモルック専門のアフィリエイトライターです。
キーワード「${keyword}」で検索する人は購入を検討しています。

以下のAmazonリンクを自然に2〜3箇所に埋め込んでください:
${affiliateLinks.map(l => `- ${l.name}: ${l.url}`).join("\n")}

記事要件:
- 文字数: 2,000〜2,500文字
- 構成: 導入 → おすすめ3選 → 比較表 → まとめ
- CTAは「今すぐ確認する」「Amazonで見る」等、購買を促す表現
- Markdown形式
- titleタグ用のh1タグ（キーワードを含める）

キーワード: ${keyword}
記事を書いてください。
`,
  consideration: (keyword, affiliateLinks) => `
あなたはモルック専門ライターです。
キーワード「${keyword}」で検索する人は購入を検討中です。

記事要件:
- 文字数: 1,500〜2,000文字
- 構成: 疑問への回答 → 詳細解説 → おすすめ商品紹介（さりげなく）
- Markdown形式
- 末尾にAmazonリンクを自然に配置

アフィリエイトリンク:
${affiliateLinks.slice(0, 2).map(l => `- ${l.name}: ${l.url}`).join("\n")}

キーワード: ${keyword}
`,
  information: (keyword) => `
モルック初心者向けに「${keyword}」について説明する記事を書いてください。
- 文字数: 1,200〜1,500文字
- 構成: 答え → 詳細 → 関連情報
- Markdown形式
`
};

// アフィリエイトリンク設定
const AFFILIATE_LINKS = [
  {
    name: "Tactic モルック公式セット",
    url: "https://amzn.to/XXXXX",
    tag: "molkky-official"
  },
  {
    name: "モルック 木製 国内正規品",
    url: "https://amzn.to/YYYYY",
    tag: "molkky-domestic"
  },
  {
    name: "モルック 収納バッグ付きセット",
    url: "https://amzn.to/ZZZZZ",
    tag: "molkky-bag"
  }
];

// 記事生成メイン関数
async function generateArticle(keywordObj) {
  const { keyword, intent } = keywordObj;
  const template = PROMPT_TEMPLATES[intent];
  const prompt = template(keyword, AFFILIATE_LINKS);

  console.log(`生成中: "${keyword}" (intent: ${intent})`);

  const message = await client.messages.create({
    model: "claude-haiku-3-5",  // コスト最適化
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

// ファイル保存
function saveArticle(keyword, content) {
  const outputDir = "./generated/articles";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const slug = keyword.replace(/\s+/g, "-").toLowerCase();
  const filename = path.join(outputDir, `${slug}.md`);
  const date = new Date().toISOString().split("T")[0];

  const frontmatter = `---
title: "${keyword}"
date: ${date}
status: draft
intent: purchase
---\n\n`;

  fs.writeFileSync(filename, frontmatter + content, "utf-8");
  console.log(`保存: ${filename}`);
  return filename;
}

// バッチ処理（月50本生成）
async function batchGenerate(count = 50) {
  const targets = KEYWORDS
    .sort((a, b) => a.priority - b.priority)
    .slice(0, count);

  let successCount = 0;
  let totalCost = 0;

  for (const kwObj of targets) {
    try {
      const content = await generateArticle(kwObj);
      saveArticle(kwObj.keyword, content);
      successCount++;

      // レート制限対策（1秒待機）
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`エラー [${kwObj.keyword}]: ${err.message}`);
    }
  }

  console.log(`\n完了: ${successCount}/${targets.length}本`);
  console.log(`推定API費用: ¥${(successCount * 1.34).toFixed(0)}`);
}

// 実行
batchGenerate(50);
```

このコードで月50本の生成が完全に自動化される。

---

## キーワードの選び方：購買意図系を最優先する理由

キーワードには大きく3種類がある。

**① 購買意図系（Purchase Intent）**
「モルック おすすめ セット」「モルック 買う どこ」
→ 検索している人はほぼ購入する気がある。コンバージョン率は情報系の5〜10倍。

**② 検討意図系（Consideration Intent）**
「モルック 子供 何歳から」「モルック 値段 相場」
→ 購入を真剣に考えている段階。記事内でさりげなくリンクを入れると効果的。

**③ 情報収集系（Informational Intent）**
「モルック ルール」「モルック 歴史」
→ 検索数は多いが購買につながりにくい。ブランド認知のために書くが、優先度は最低。

**最初の30本は全て購買意図系に絞る。**これだけで収益効率が3倍変わる。

実際にやってみて分かったこと：情報系記事は月500PVを稼いでも月¥0のことがある。購買系記事は月30PVでも¥3,000になることがある。PVの量より、検索意図との一致が全てだ。

---

## WordPressへの自動投稿の設定

WordPressのREST APIを使えば、記事生成から投稿まで完全自動化できる。

```javascript
import fetch from "node-fetch";

async function postToWordPress(title, content, status = "draft") {
  const WP_URL = process.env.WP_URL;      // サイトのURL
  const WP_USER = process.env.WP_USER;    // 管理者ユーザー名
  const WP_PASS = process.env.WP_APP_PASS; // アプリケーションパスワード

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");

  const response = await fetch(`${WP_URL}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title,
      content: content,
      status: status,  // "draft" or "publish"
      categories: [5], // カテゴリIDを指定
    }),
  });

  const data = await response.json();
  console.log(`投稿完了: ${data.link}`);
  return data;
}
```

注意点が一つある。**最初は全部 `status: "draft"` で投稿する。**いきなり自動公開すると、品質チェックができず低品質記事が大量に公開される。ドラフトで保存して、5分でざっと確認してから公開に変える運用が安全だ。

慣れてきたら週次バッチで自動公開する仕組みに移行する。

---

## 実際の収益データ

3ヶ月のデータをまとめる。

| 月 | 記事数（累計） | PV | アフィリエイト収益 | API費用 |
|----|--------------|-----|-----------------|--------|
| 1ヶ月目 | 20本 | 120 | ¥0 | ¥47 |
| 2ヶ月目 | 50本 | 820 | ¥3,000 | ¥112 |
| 3ヶ月目 | 80本 | 2,400 | ¥10,044 | ¥163 |

3ヶ月の累計投資額：API費用¥322 + サーバー代¥4,500 = **¥4,822**

3ヶ月の累計収益：**¥13,044**

ROI（投資回収率）：**170%**（3ヶ月で元が取れ、¥8,222の純利益）

今の月収は¥10,000だが、記事数が100本を超えたあたりから指数関数的に伸びることがGoogleのアルゴリズムから期待できる。現在(2026年3月)は記事80本。月100本を目指して量産を続けている。

---

## まとめ：今すぐできること

1. `npm install @anthropic-ai/sdk` でSDKをインストール
2. 環境変数 `ANTHROPIC_API_KEY` にAPIキーを設定（無料枠あり）
3. キーワードリストを30件用意する（購買意図系を優先）
4. この記事のコードをコピーして実行する

1時間あれば最初の記事生成まで動く。

次の記事では「BOOTHでAIプロンプト集を売る完全ガイド」を書く。アフィリエイトより早く収益が出るので、並行して進めることをすすめる。
