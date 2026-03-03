#!/usr/bin/env node
/**
 * prompt-book.html → PDF生成スクリプト
 * 使い方: node generate-pdf.cjs
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROMIUM = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
const HTML_PATH = path.join(__dirname, 'generated/prompt-book.html');
const PDF_PATH = path.join(__dirname, 'generated/claude-code-副業プロンプト大全50選.pdf');

(async () => {
  if (!fs.existsSync(CHROMIUM)) {
    console.error('Chromiumが見つかりません:', CHROMIUM);
    process.exit(1);
  }

  console.log('PDF生成開始...');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.goto('file://' + HTML_PATH, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
  });

  await browser.close();

  const size = (fs.statSync(PDF_PATH).size / 1024).toFixed(1);
  console.log(`完了: ${PDF_PATH}`);
  console.log(`ファイルサイズ: ${size} KB`);
})();
