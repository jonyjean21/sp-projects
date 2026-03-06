#!/usr/bin/env node
// MACHAP プロダクトスクリーンショット撮影スクリプト
// 各プロダクトに対して複数ビュー（メイン、スクロール、モバイル）を撮影

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imgDir = join(__dirname, '..', 'apps', 'machap', 'img');

if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true });

const products = [
  {
    name: 'molkky-hub',
    url: 'https://molkky-hub.com',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 600 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'viisi-master',
    url: 'https://jonyjean21.github.io/sp-projects/viisi-master/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'championship',
    url: 'https://jonyjean21.github.io/sp-projects/championship/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'naimol-admin',
    url: 'https://jonyjean21.github.io/sp-projects/naimol-admin/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'teamride',
    url: 'https://jonyjean21.github.io/sp-projects/teamride/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'partner-portal',
    url: 'https://jonyjean21.github.io/sp-projects/partner-portal/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'youtube',
    url: 'https://jonyjean21.github.io/sp-projects/youtube/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'meguri',
    url: 'https://jonyjean21.github.io/sp-projects/meguri/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
  {
    name: 'recipe',
    url: 'https://jonyjean21.github.io/sp-projects/recipe/',
    views: [
      { suffix: '1', viewport: { width: 1200, height: 720 }, scroll: 0 },
      { suffix: '2', viewport: { width: 1200, height: 720 }, scroll: 500 },
      { suffix: '3', viewport: { width: 390, height: 720 }, scroll: 0, mobile: true },
    ]
  },
];

async function main() {
  const browser = await chromium.launch();

  for (const product of products) {
    console.log(`📸 ${product.name}...`);
    for (const view of product.views) {
      const context = await browser.newContext({
        viewport: view.viewport,
        isMobile: view.mobile || false,
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      try {
        await page.goto(product.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1500);
        if (view.scroll > 0) {
          await page.evaluate(y => window.scrollTo(0, y), view.scroll);
          await page.waitForTimeout(500);
        }
        const path = join(imgDir, `${product.name}-${view.suffix}.jpg`);
        await page.screenshot({
          path,
          type: 'jpeg',
          quality: 85,
          clip: { x: 0, y: 0, width: view.viewport.width, height: view.viewport.height }
        });
        console.log(`  ✅ ${product.name}-${view.suffix}.jpg`);
      } catch (err) {
        console.log(`  ❌ ${product.name}-${view.suffix}: ${err.message}`);
      }
      await context.close();
    }
  }

  await browser.close();
  console.log('\n🎉 Done!');
}

main().catch(console.error);
