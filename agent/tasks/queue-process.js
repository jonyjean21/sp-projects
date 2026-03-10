// キュー処理 — Firebase の pending アイテムを処理
import { getPendingItems, markProcessed, writeLog } from '../lib/firebase.js';
import { summarize } from '../lib/claude.js';

const QUEUE_HANDLERS = {
  'tournament-queue': processTournament,
  'claude-tips-queue': processClaudeTips,
  // chapche-queue と contribution-queue は既存GASが処理するのでスキップ
};

async function processTournament(item) {
  // 大会情報の要約・整理
  const summary = item.title
    ? `大会: ${item.title} (${item.date || '日程未定'}) - ${item.source || ''}`
    : JSON.stringify(item).slice(0, 200);
  return { action: 'logged', summary };
}

async function processClaudeTips(item) {
  // Claude tips の要約
  if (item.title && item.url) {
    return { action: 'collected', summary: `${item.title} - ${item.url}` };
  }
  return { action: 'skipped', summary: 'incomplete data' };
}

export default async function queueProcess({ dryRun = false } = {}) {
  console.log('=== SP Clone: Queue Process ===');
  console.log(`[${new Date().toISOString()}] 開始\n`);

  const results = {};

  for (const [queueName, handler] of Object.entries(QUEUE_HANDLERS)) {
    console.log(`\n🔄 ${queueName} 処理中...`);
    try {
      const pending = await getPendingItems(queueName);
      console.log(`  ${pending.length} 件の未処理アイテム`);

      if (pending.length === 0) {
        results[queueName] = { processed: 0 };
        continue;
      }

      let processed = 0;
      for (const item of pending) {
        try {
          const result = await handler(item);
          console.log(`  [${item.key}] ${result.action}: ${result.summary}`);

          if (!dryRun) {
            await markProcessed(queueName, item.key);
            await writeLog(`${queueName}-log`, {
              key: item.key,
              action: result.action,
              summary: result.summary,
              processedBy: 'sp-clone-agent',
            });
          } else {
            console.log(`  [DRY RUN] mark processed スキップ`);
          }
          processed++;
        } catch (e) {
          console.error(`  [${item.key}] ERROR: ${e.message}`);
        }
      }

      results[queueName] = { processed, total: pending.length };
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      results[queueName] = { error: e.message };
    }
  }

  // GAS管轄キューのステータスも確認だけする
  for (const q of ['chapche-queue', 'contribution-queue']) {
    try {
      const pending = await getPendingItems(q);
      console.log(`\n📋 ${q}: ${pending.length} pending (GAS管轄)`);
      results[q] = { pending: pending.length, managedBy: 'GAS' };
    } catch (e) {
      results[q] = { error: e.message };
    }
  }

  console.log('\n✅ キュー処理完了');
  console.log(JSON.stringify(results, null, 2));

  return results;
}
