// 朝のタスク棚卸 — コンテキスト読み込み → キュー確認 → ブリーフィング生成
import { readContext, readMemory, getLatestSessionLog, readInbox, readCurrentTasks } from '../lib/sp-brain.js';
import { getPendingItems } from '../lib/firebase.js';
import { ask } from '../lib/claude.js';

const QUEUES = ['chapche-queue', 'tournament-queue', 'contribution-queue', 'claude-tips-queue'];

export default async function morningReview({ dryRun = false } = {}) {
  console.log('=== SP Clone: Morning Review ===');
  console.log(`[${new Date().toISOString()}] 起動\n`);

  // 1. コンテキスト読み込み
  console.log('📂 コンテキスト読み込み...');
  const memory = readMemory();
  const weeklyState = readContext('weekly-state.md');
  const priorities = readContext('current-priorities.md');
  const activeProjects = readContext('active-projects.md');
  const lastSession = getLatestSessionLog();
  const inbox = readInbox();
  const tasks = readCurrentTasks();

  console.log(`  MEMORY.md: ${memory ? `${memory.length} chars` : 'not found'}`);
  console.log(`  weekly-state: ${weeklyState ? 'loaded' : 'not found'}`);
  console.log(`  priorities: ${priorities ? 'loaded' : 'not found'}`);
  console.log(`  last session: ${lastSession ? lastSession.filename : 'none'}`);
  console.log(`  inbox items: ${inbox.length}`);

  // 2. Firebase キュー確認
  console.log('\n🔥 Firebase キュー確認...');
  const queueStatus = {};
  for (const q of QUEUES) {
    try {
      const pending = await getPendingItems(q);
      queueStatus[q] = pending.length;
      console.log(`  ${q}: ${pending.length} pending`);
    } catch (e) {
      queueStatus[q] = `error: ${e.message}`;
      console.log(`  ${q}: ERROR - ${e.message}`);
    }
  }

  // 3. Claudeでブリーフィング生成
  if (dryRun) {
    console.log('\n[DRY RUN] Claude API呼び出しスキップ');
    return { queueStatus, briefing: '[dry run]' };
  }

  console.log('\n🤖 ブリーフィング生成中...');
  const context = [
    '## 長期記憶',
    memory?.slice(0, 1000) || '(なし)',
    '## 今週の状況',
    weeklyState?.slice(0, 800) || '(なし)',
    '## 優先事項',
    priorities?.slice(0, 500) || '(なし)',
    '## Firebaseキュー状況',
    Object.entries(queueStatus).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
    '## 未処理inbox',
    inbox.length > 0 ? inbox.map(i => `- ${i.filename}`).join('\n') : '(なし)',
    '## 前回セッション',
    lastSession ? lastSession.content.slice(0, 500) : '(なし)',
  ].join('\n\n');

  const briefing = await ask(
    `あなたはSPのAI秘書です。以下のコンテキストを元に、今朝のブリーフィングを作成してください。\n\n` +
    `要件:\n` +
    `- 1-2行で現状サマリー\n` +
    `- 今日やるべきこと TOP3\n` +
    `- キューに溜まっている処理があれば報告\n` +
    `- 簡潔に、箇条書きで\n\n` +
    context,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 500 }
  );

  console.log('\n--- ブリーフィング ---');
  console.log(briefing);
  console.log('---\n');

  return { queueStatus, briefing };
}
