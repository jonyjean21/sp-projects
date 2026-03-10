#!/usr/bin/env node
// SP Clone Agent — 自律稼働エントリーポイント
import morningReview from './tasks/morning-review.js';
import queueProcess from './tasks/queue-process.js';
import dailySummary from './tasks/daily-summary.js';

const TASKS = {
  'morning-review': async (opts) => {
    const morning = await morningReview(opts);
    const queue = await queueProcess(opts);
    const summary = await dailySummary({ ...opts, queueResults: queue, briefing: morning.briefing });
    return { morning, queue, summary };
  },
  'queue-process': queueProcess,
  'daily-summary': dailySummary,
  'weekly-report': async (opts) => {
    // Phase 3.1: 週次レポートは後で実装
    console.log('=== SP Clone: Weekly Report ===');
    console.log('--- 未実装（Phase 3.1）---');
    return { status: 'not-implemented' };
  },
};

async function main() {
  const args = process.argv.slice(2);
  const taskName = args[0];
  const dryRun = args.includes('--dry-run');

  if (!taskName || !TASKS[taskName]) {
    console.log('Usage: node index.js <task> [--dry-run]');
    console.log('Tasks:', Object.keys(TASKS).join(', '));
    process.exit(1);
  }

  console.log(`\n🚀 SP Clone Agent — ${taskName}${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`   ${new Date().toISOString()}\n`);

  try {
    const result = await TASKS[taskName]({ dryRun });
    console.log('\n✅ 完了');
    process.exit(0);
  } catch (e) {
    console.error(`\n❌ エラー: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
