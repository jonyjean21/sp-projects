#!/usr/bin/env node
/**
 * Markdownからプロ品質PDFテンプレートHTMLを生成するビルドスクリプト
 * 使い方: node build-pdf.js
 * 出力: prompt-book.html (完成版)
 */

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const mdPath = path.join(dir, 'claude-code-副業プロンプト大全50選.md');
const outPath = path.join(dir, 'prompt-book.html');

const md = fs.readFileSync(mdPath, 'utf-8');

// カテゴリメタ情報
const categories = [
  { num: 1, name: 'SEO記事量産', color: '#d4a017', range: [1,5], desc: '検索上位を狙う記事を効率よく生成し、ブログ・メディアのアクセスを伸ばすプロンプト群' },
  { num: 2, name: 'SNS運用自動化', color: '#e06030', range: [6,10], desc: 'X（Twitter）での発信を効率化し、フォロワー獲得と影響力拡大を支援するプロンプト群' },
  { num: 3, name: 'コピーライティング', color: '#20a0d0', range: [11,15], desc: 'LPやメルマガ、商品説明など、購買行動を促す文章を生成するプロンプト群' },
  { num: 4, name: '受託・フリーランス営業', color: '#a040d0', range: [16,20], desc: 'クラウドソーシングでの提案から納品まで、受託業務を効率化するプロンプト群' },
  { num: 5, name: 'プログラミング自動化', color: '#30b060', range: [21,25], desc: 'GAS・WordPress API・LINE Bot・Firebaseのコードを一発生成するプロンプト群' },
  { num: 6, name: 'デザイン指示・画像生成', color: '#d04080', range: [26,30], desc: 'Canva・OGP・アイキャッチなどのデザイン指示書を効率よく作成するプロンプト群' },
  { num: 7, name: 'データ分析・レポート', color: '#50a0a0', range: [31,35], desc: 'GA4・競合分析・収益レポートなどのデータを整理・分析するプロンプト群' },
  { num: 8, name: 'ビジネス文書・メール', color: '#8080d0', range: [36,40], desc: '敬語変換から企画書・見積書まで、ビジネス文書を効率よく作成するプロンプト群' },
  { num: 9, name: '教育・コンテンツ制作', color: '#d08040', range: [41,45], desc: 'オンライン講座やワークショップなど、教育系コンテンツを設計するプロンプト群' },
  { num: 10, name: '収益最大化テクニック', color: '#d04040', range: [46,50], desc: 'アフィリエイト最適化や価格設定など、収益を最大化する戦略プロンプト群' }
];

// Markdownからプロンプトデータをパース
function parsePrompts(md) {
  const prompts = [];
  // ### プロンプトXX: タイトル でスプリット
  const promptRegex = /### プロンプト(\d+): (.+)/g;
  let match;
  const positions = [];
  while ((match = promptRegex.exec(md)) !== null) {
    positions.push({ index: match.index, num: parseInt(match[1]), title: match[2] });
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i < positions.length - 1 ? positions[i+1].index : md.indexOf('## おわりに');
    const block = md.substring(start, end);

    // プロンプト本文（```...```）
    const codeMatch = block.match(/```\n([\s\S]*?)\n```/);
    const promptBody = codeMatch ? codeMatch[1].trim() : '';

    // 使い方のコツ
    const tipsMatch = block.match(/\*\*使い方のコツ:\*\*\n([\s\S]*?)(?=\n\*\*期待される出力例)/);
    const tipsRaw = tipsMatch ? tipsMatch[1].trim() : '';
    const tips = tipsRaw.split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').replace(/`([^`]+)`/g, '<code>$1</code>'));

    // 期待される出力例
    const outputMatch = block.match(/\*\*期待される出力例:\*\*\n([\s\S]*?)(?=\n---|\n$|$)/);
    const output = outputMatch ? outputMatch[1].trim() : '';

    prompts.push({
      num: positions[i].num,
      title: positions[i].title,
      body: promptBody,
      tips: tips,
      output: output
    });
  }
  return prompts;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCatForPrompt(num) {
  return categories.find(c => num >= c.range[0] && num <= c.range[1]);
}

function pad(n) { return n.toString().padStart(2, '0'); }

// ===== HTML生成 =====
const prompts = parsePrompts(md);
console.log(`Parsed ${prompts.length} prompts`);

// 目次HTML
function buildToc() {
  let html = '';
  for (const cat of categories) {
    html += `  <div class="toc-category">
    <div class="toc-category-title cat-${cat.num}">カテゴリ${cat.num}: ${cat.name}</div>
    <div class="toc-items">\n`;
    const catPrompts = prompts.filter(p => p.num >= cat.range[0] && p.num <= cat.range[1]);
    for (const p of catPrompts) {
      html += `      <div class="toc-item"><span class="num">${pad(p.num)}</span> ${escapeHtml(p.title)} <span class="dots"></span></div>\n`;
    }
    html += `    </div>\n  </div>\n\n`;
  }
  return html;
}

// プロンプト本文HTML
function buildPrompts() {
  let html = '';
  let currentCat = null;

  for (const p of prompts) {
    const cat = getCatForPrompt(p.num);

    // カテゴリが変わったらセクションヘッダー
    if (!currentCat || currentCat.num !== cat.num) {
      currentCat = cat;
      html += `
<!-- ==================== カテゴリ${cat.num}: ${cat.name} ==================== -->
<div class="section-header page-break" style="color: ${cat.color};">
  <div class="section-number" style="color: ${cat.color};">${pad(cat.num)}</div>
  <div class="section-label" style="color: ${cat.color};">CATEGORY ${cat.num}</div>
  <h2 class="section-title">${cat.name}</h2>
  <p class="section-desc">${cat.desc}</p>
  <div class="section-prompt-count" style="border-color: ${cat.color}; color: ${cat.color};">PROMPT ${pad(cat.range[0])} - ${pad(cat.range[1])}</div>
</div>
`;
    }

    // プロンプトブロック
    html += `
<div class="prompt-block no-break">
  <div class="prompt-header">
    <div class="prompt-num" style="background: ${cat.color}22; color: ${cat.color};">${pad(p.num)}</div>
    <div class="prompt-title">${escapeHtml(p.title)}</div>
  </div>

  <div class="prompt-label" style="color: ${cat.color};"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${cat.color};margin-right:6px;"></span>PROMPT</div>
  <div class="prompt-code">
    <div class="prompt-code-bar">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      <span>prompt-${pad(p.num)}.txt</span>
    </div>
    <pre>${escapeHtml(p.body)}</pre>
  </div>
`;

    if (p.tips.length > 0) {
      html += `  <div class="tip-box">
    <ul>\n`;
      for (const tip of p.tips) {
        html += `      <li>${tip}</li>\n`;
      }
      html += `    </ul>
  </div>\n`;
    }

    if (p.output) {
      html += `  <div class="output-box">
    <p>${escapeHtml(p.output)}</p>
  </div>\n`;
    }

    html += `</div>

<hr class="prompt-sep">
`;
  }

  return html;
}

// 完成版HTML
const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code 副業プロンプト大全50選</title>
<style>
/* ===== 基本設定 ===== */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Source+Code+Pro:wght@400;500&display=swap');

:root {
  --navy: #0a0e27;
  --navy-light: #141937;
  --navy-mid: #1e2547;
  --gold: #d4a017;
  --gold-light: #f0d060;
  --gold-dim: #a07a10;
  --white: #f5f5f5;
  --gray: #94a3b8;
  --gray-light: #cbd5e1;
  --code-bg: #1a1f3a;
  --tip-bg: #1a2810;
  --tip-border: #3d7a1a;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html {
  font-size: 10.5pt;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  font-family: 'Noto Sans JP', sans-serif;
  background: var(--navy);
  color: var(--white);
  line-height: 1.8;
}

code {
  font-family: 'Source Code Pro', monospace;
  background: rgba(212,160,23,0.12);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.92em;
  color: var(--gold);
}

/* ===== A4ページ設定 ===== */
@page {
  size: A4;
  margin: 20mm 18mm 25mm 18mm;
}

@media print {
  body { background: var(--navy) !important; }
  .page-break { page-break-before: always; }
  .no-break { page-break-inside: avoid; }
  .cover-page { page-break-after: always; }
  .toc-page { page-break-after: always; }
  .section-header { page-break-before: always; page-break-after: auto; }
  .prompt-block { page-break-inside: avoid; }
}

/* ===== 表紙 ===== */
.cover-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: linear-gradient(160deg, var(--navy) 0%, #0d1230 40%, #151040 100%);
  position: relative;
  overflow: hidden;
  padding: 40px;
}

.cover-page::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(212,160,23,0.03) 40px, rgba(212,160,23,0.03) 41px),
    repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(212,160,23,0.03) 40px, rgba(212,160,23,0.03) 41px);
  pointer-events: none;
}

.cover-terminal {
  background: rgba(10,14,39,0.9);
  border: 1px solid var(--gold-dim);
  border-radius: 12px;
  padding: 20px 30px;
  margin-bottom: 50px;
  font-family: 'Source Code Pro', monospace;
  font-size: 14pt;
  color: var(--gold);
  text-align: left;
  max-width: 500px;
  width: 100%;
  position: relative;
  z-index: 1;
}

.cover-terminal .prompt-line::before {
  content: '$ ';
  color: var(--gray);
}

.cover-badge {
  display: inline-block;
  background: var(--gold);
  color: var(--navy);
  font-size: 10pt;
  font-weight: 700;
  padding: 6px 20px;
  border-radius: 20px;
  margin-bottom: 30px;
  letter-spacing: 1px;
  position: relative;
  z-index: 1;
}

.cover-title {
  font-size: 32pt;
  font-weight: 900;
  color: var(--white);
  line-height: 1.3;
  margin-bottom: 10px;
  letter-spacing: 2px;
  position: relative;
  z-index: 1;
}

.cover-title .accent {
  color: var(--gold);
}

.cover-subtitle {
  font-size: 16pt;
  font-weight: 500;
  color: var(--gold);
  margin-bottom: 50px;
  letter-spacing: 3px;
  position: relative;
  z-index: 1;
}

.cover-meta {
  font-size: 11pt;
  color: var(--gray);
  line-height: 2;
  position: relative;
  z-index: 1;
}

.cover-meta strong {
  color: var(--gray-light);
}

.cover-decoration {
  position: absolute;
  bottom: 40px;
  right: 40px;
  font-size: 120pt;
  font-weight: 900;
  color: rgba(212,160,23,0.06);
  font-family: 'Source Code Pro', monospace;
  line-height: 1;
}

.cover-line {
  width: 60px;
  height: 3px;
  background: var(--gold);
  margin: 30px auto;
  position: relative;
  z-index: 1;
}

/* ===== 目次 ===== */
.toc-page {
  padding: 60px 40px;
  background: var(--navy);
}

.toc-page h2 {
  font-size: 22pt;
  color: var(--gold);
  text-align: center;
  margin-bottom: 10px;
  letter-spacing: 4px;
}

.toc-page .toc-sub {
  text-align: center;
  color: var(--gray);
  font-size: 10pt;
  margin-bottom: 40px;
}

.toc-category {
  margin-bottom: 18px;
}

.toc-category-title {
  font-size: 10.5pt;
  font-weight: 700;
  padding: 5px 14px;
  border-radius: 6px;
  margin-bottom: 4px;
  display: inline-block;
}

.toc-items {
  padding-left: 20px;
}

.toc-item {
  display: flex;
  align-items: baseline;
  font-size: 9.5pt;
  color: var(--gray-light);
  padding: 1.5px 0;
}

.toc-item .num {
  color: var(--gold);
  font-weight: 700;
  font-family: 'Source Code Pro', monospace;
  margin-right: 8px;
  min-width: 22px;
}

.toc-item .dots {
  flex: 1;
  border-bottom: 1px dotted rgba(148,163,184,0.25);
  margin: 0 8px;
  min-width: 20px;
}

/* カテゴリカラー */
.cat-1 { background: rgba(212,160,23,0.15); color: #d4a017; border-left: 3px solid #d4a017; }
.cat-2 { background: rgba(224,96,48,0.15); color: #e06030; border-left: 3px solid #e06030; }
.cat-3 { background: rgba(32,160,208,0.15); color: #20a0d0; border-left: 3px solid #20a0d0; }
.cat-4 { background: rgba(160,64,208,0.15); color: #a040d0; border-left: 3px solid #a040d0; }
.cat-5 { background: rgba(48,176,96,0.15); color: #30b060; border-left: 3px solid #30b060; }
.cat-6 { background: rgba(208,64,128,0.15); color: #d04080; border-left: 3px solid #d04080; }
.cat-7 { background: rgba(80,160,160,0.15); color: #50a0a0; border-left: 3px solid #50a0a0; }
.cat-8 { background: rgba(128,128,208,0.15); color: #8080d0; border-left: 3px solid #8080d0; }
.cat-9 { background: rgba(208,128,64,0.15); color: #d08040; border-left: 3px solid #d08040; }
.cat-10 { background: rgba(208,64,64,0.15); color: #d04040; border-left: 3px solid #d04040; }

/* ===== セクションヘッダー ===== */
.section-header {
  min-height: 30vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 80px 40px;
  position: relative;
}

.section-number {
  font-family: 'Source Code Pro', monospace;
  font-size: 60pt;
  font-weight: 900;
  opacity: 0.12;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.section-label {
  font-size: 10pt;
  letter-spacing: 6px;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.section-title {
  font-size: 26pt;
  font-weight: 900;
  margin-bottom: 15px;
}

.section-desc {
  font-size: 10.5pt;
  color: var(--gray);
  max-width: 500px;
  line-height: 1.8;
}

.section-prompt-count {
  margin-top: 20px;
  font-family: 'Source Code Pro', monospace;
  font-size: 9pt;
  padding: 4px 16px;
  border-radius: 20px;
  border: 1px solid;
}

/* ===== プロンプトブロック ===== */
.prompt-block {
  margin: 30px 0;
  padding: 0 10px;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148,163,184,0.15);
}

.prompt-num {
  font-family: 'Source Code Pro', monospace;
  font-size: 11pt;
  font-weight: 700;
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.prompt-title {
  font-size: 14pt;
  font-weight: 700;
  color: var(--white);
}

.prompt-label {
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

/* コードブロック風プロンプト本文 */
.prompt-code {
  background: var(--code-bg);
  border: 1px solid rgba(212,160,23,0.2);
  border-radius: 10px;
  padding: 0;
  margin-bottom: 16px;
  overflow: hidden;
  font-size: 9.5pt;
}

.prompt-code-bar {
  background: rgba(212,160,23,0.1);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(212,160,23,0.15);
}

.prompt-code-bar .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.prompt-code-bar .dot:nth-child(1) { background: var(--gold-dim); }
.prompt-code-bar .dot:nth-child(2) { background: rgba(212,160,23,0.4); }
.prompt-code-bar .dot:nth-child(3) { background: rgba(212,160,23,0.2); }

.prompt-code-bar span {
  font-family: 'Source Code Pro', monospace;
  font-size: 8.5pt;
  color: var(--gray);
  margin-left: auto;
}

.prompt-code pre {
  padding: 16px 20px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Source Code Pro', 'Noto Sans JP', monospace;
  font-size: 9.5pt;
  line-height: 1.7;
  color: var(--gray-light);
}

/* 使い方のコツ（吹き出し風ボックス） */
.tip-box {
  background: var(--tip-bg);
  border: 1px solid var(--tip-border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 12px;
  position: relative;
}

.tip-box::before {
  content: 'TIPS';
  position: absolute;
  top: -10px;
  left: 16px;
  background: var(--tip-border);
  color: #fff;
  font-size: 8pt;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 4px;
  letter-spacing: 2px;
}

.tip-box ul {
  list-style: none;
  padding: 4px 0 0 0;
}

.tip-box li {
  font-size: 9.5pt;
  color: var(--gray-light);
  padding: 3px 0;
  padding-left: 18px;
  position: relative;
  line-height: 1.7;
}

.tip-box li::before {
  content: '>';
  position: absolute;
  left: 0;
  color: var(--tip-border);
  font-family: 'Source Code Pro', monospace;
  font-weight: 700;
}

/* 期待される出力例 */
.output-box {
  background: rgba(32,160,208,0.08);
  border: 1px solid rgba(32,160,208,0.25);
  border-radius: 10px;
  padding: 14px 20px;
  margin-bottom: 12px;
  position: relative;
}

.output-box::before {
  content: 'OUTPUT';
  position: absolute;
  top: -10px;
  left: 16px;
  background: rgba(32,160,208,0.7);
  color: #fff;
  font-size: 8pt;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 4px;
  letter-spacing: 2px;
}

.output-box p {
  font-size: 9.5pt;
  color: var(--gray-light);
  padding-top: 4px;
  line-height: 1.7;
}

/* セパレータ */
.prompt-sep {
  border: none;
  border-top: 1px solid rgba(148,163,184,0.1);
  margin: 40px 20px;
}

/* ===== はじめに / おわりに ===== */
.intro-page, .outro-page {
  padding: 60px 30px;
}

.intro-page h2, .outro-page h2 {
  font-size: 20pt;
  color: var(--gold);
  margin-bottom: 30px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--gold);
}

.intro-page h3, .outro-page h3 {
  font-size: 13pt;
  color: var(--white);
  margin: 24px 0 12px;
}

.intro-page p, .outro-page p {
  font-size: 10.5pt;
  color: var(--gray-light);
  margin-bottom: 14px;
  line-height: 1.9;
}

.intro-page strong, .outro-page strong {
  color: var(--white);
}

.intro-page ol, .intro-page ul,
.outro-page ol, .outro-page ul {
  padding-left: 24px;
  margin-bottom: 14px;
}

.intro-page li, .outro-page li {
  font-size: 10.5pt;
  color: var(--gray-light);
  margin-bottom: 6px;
  line-height: 1.8;
}

.important-box {
  background: rgba(212,160,23,0.08);
  border: 1px solid rgba(212,160,23,0.3);
  border-radius: 10px;
  padding: 16px 20px;
  margin: 20px 0;
}

.important-box p { color: var(--gray-light); }
.important-box strong { color: var(--gold); }

/* ===== 著者プロフィール ===== */
.author-box {
  background: var(--navy-light);
  border: 1px solid rgba(212,160,23,0.2);
  border-radius: 14px;
  padding: 30px;
  margin-top: 40px;
  text-align: center;
}

.author-box h3 { color: var(--gold); font-size: 14pt; margin-bottom: 16px; }
.author-box p { font-size: 10pt; color: var(--gray-light); line-height: 1.9; }
.author-box .author-name { font-size: 16pt; font-weight: 700; color: var(--white); margin-bottom: 4px; }
.author-box .author-label { font-size: 9pt; color: var(--gray); margin-bottom: 16px; }

/* コロフォン */
.colophon {
  text-align: center;
  padding: 60px 30px;
  color: var(--gray);
  font-size: 9pt;
  line-height: 2;
}
.colophon .book-title { color: var(--gray-light); font-size: 10pt; font-weight: 500; }

/* ===== 画面表示用ラッパー ===== */
@media screen {
  body { max-width: 210mm; margin: 0 auto; padding: 20px; }
  .cover-page { min-height: 297mm; border-radius: 8px; margin-bottom: 20px; }
}
</style>
</head>
<body>

<!-- ==================== 表紙 ==================== -->
<div class="cover-page">
  <div class="cover-terminal">
    <div class="prompt-line">claude --prompt "副業で月10万稼ぐ方法"</div>
  </div>
  <div class="cover-badge">2026年3月版 / 全50プロンプト収録</div>
  <h1 class="cover-title">Claude Code<br>副業プロンプト<span class="accent">大全50選</span></h1>
  <div class="cover-line"></div>
  <p class="cover-subtitle">AIで月10万稼ぐ実践テンプレート集</p>
  <div class="cover-meta">
    <strong>著者</strong> SP / 扉ラボ<br>
    <strong>発行</strong> 2026年3月<br>
    <strong>価格</strong> &yen;1,980
  </div>
  <div class="cover-decoration">&gt;_</div>
</div>

<!-- ==================== 目次 ==================== -->
<div class="toc-page page-break">
  <h2>CONTENTS</h2>
  <p class="toc-sub">10カテゴリ / 50プロンプト</p>

${buildToc()}
</div>

<!-- ==================== はじめに ==================== -->
<div class="intro-page page-break">
  <h2>はじめに</h2>

  <h3>Claude Code / Claude APIとは</h3>
  <p>Claude Codeは、Anthropic社が提供するAIアシスタント「Claude」をコマンドラインから直接操作できる公式CLIツールです。ターミナル上でファイル操作、コード生成、テキスト作成を一括で行えるため、従来のチャットUIでは実現できなかった「作業の自動化」が可能になります。</p>
  <p>Claude APIは、同じくAnthropicが提供するAPI経由でClaudeの能力をプログラムから呼び出す仕組みです。GAS（Google Apps Script）やNode.js、Pythonなどから直接呼び出して、定期実行や自動処理パイプラインに組み込めます。</p>

  <h3>この本の使い方</h3>
  <p>本書に掲載されている50個のプロンプトは、全て<strong>そのままコピペして使える実践テンプレート</strong>です。</p>
  <ol>
    <li><strong>カテゴリから選ぶ</strong> &mdash; 自分の副業スタイルに合ったカテゴリを選択</li>
    <li><strong>プロンプトをコピー</strong> &mdash; <code>[変数]</code> の部分を自分の情報に置き換える</li>
    <li><strong>Claude Code / APIに入力</strong> &mdash; 出力をそのまま業務に活用</li>
    <li><strong>使い方のコツを参照</strong> &mdash; より良い結果を得るための調整方法を確認</li>
  </ol>
  <p>各プロンプトの <code>[角括弧]</code> 内は、あなた自身の情報に置き換えてください。例えば <code>[ターゲットキーワード]</code> なら「モルック 始め方」のように具体的な語句を入れます。</p>

  <div class="important-box">
    <p><strong>重要:</strong> プロンプトの出力はあくまで「たたき台」です。最終的には自分の目で確認し、事実確認・修正を行ってから公開してください。AIの出力をそのまま使うのではなく、自分の知見や体験を加えることで、競合と差別化できる質の高いコンテンツになります。</p>
  </div>
</div>

<!-- ==================== プロンプト本文 ==================== -->
${buildPrompts()}

<!-- ==================== おわりに ==================== -->
<div class="outro-page page-break">
  <h2>おわりに</h2>

  <p>この本で紹介した50のプロンプトは、全て私が実際の副業で使い、磨き上げてきたものです。</p>

  <p>私はSPという名前でWordPress情報メディアを運営しています。ニッチスポーツの情報サイトとして、大会情報500件以上の登録、記事の自動投稿、SNS運用、パートナー制度の構築まで、ほぼ全ての作業をClaude Codeで自動化してきました。</p>

  <p>技術スタックは特別なものではありません:</p>
  <ul>
    <li><strong>WordPress</strong> &mdash; 記事管理、REST APIで自動投稿</li>
    <li><strong>Google Apps Script（GAS）</strong> &mdash; 大会情報の自動収集、議事録の自動処理</li>
    <li><strong>Firebase Realtime Database</strong> &mdash; アプリのデータ管理</li>
    <li><strong>GitHub Pages</strong> &mdash; 管理画面やツールの公開</li>
    <li><strong>X（Twitter）</strong> &mdash; 情報発信、コミュニティとのつながり</li>
  </ul>

  <p>これらの「ありふれた技術」と「AIプロンプト」の組み合わせで、月10万円の副業収入を目指して実践しています。</p>

  <p>大事なのは、<strong>AIは道具であって、あなたの代わりではない</strong>ということです。プロンプトから出力されたテキストをそのまま使うのではなく、自分の経験と知見を加えて、自分にしか作れないコンテンツに仕上げてください。それが、長期的に稼ぎ続けるための唯一の方法です。</p>

  <p>この本が、あなたの副業の第一歩になれば幸いです。</p>

  <div class="author-box">
    <h3>著者プロフィール</h3>
    <p class="author-name">SP（エスピー）</p>
    <p class="author-label">扉ラボ / Claude Code ヘビーユーザー</p>
    <p>WordPress &times; GAS &times; Firebase &times; Claude Code を組み合わせた自動化ワークフローを構築し、月10万円の副業収入を目指して実践中。WordPress情報メディア（月3,000セッション）では、大会情報の自動収集から記事投稿まで、可能な限りの作業を自動化。「面倒なことは全部AIにやらせて、人間は創造的なことだけやる」がモットー。</p>
    <p style="margin-top: 12px;">X: @tobiralab</p>
  </div>
</div>

<!-- コロフォン -->
<div class="colophon page-break">
  <p class="book-title">Claude Code 副業プロンプト大全50選</p>
  <p>AIで月10万稼ぐ実践テンプレート集</p>
  <p>2026年3月版 / 著者: SP / 扉ラボ</p>
  <p style="margin-top: 30px;">&copy; 2026 SP. All rights reserved.</p>
  <p>本書の無断複製・転載・再配布を禁じます。</p>
</div>

</body>
</html>`;

fs.writeFileSync(outPath, fullHtml, 'utf-8');
console.log(`Written to ${outPath}`);
console.log(`File size: ${(fullHtml.length / 1024).toFixed(1)} KB`);
