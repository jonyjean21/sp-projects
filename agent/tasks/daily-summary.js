// 日次サマリー — 今日の活動を集計してsp-brainに記録
import { writeSessionLog, readContext } from '../lib/sp-brain.js';
import { ask } from '../lib/claude.js';
import { execSync } from 'child_process';
import { join, dirname } from 'path';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '../..');

function getGitActivity() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const log = execSync(
      `git log --since="${today}" --oneline --no-merges`,
      { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
    ).trim();
    return log || '(今日のコミットなし)';
  } catch {
    return '(git log 取得失敗)';
  }
}

export default async function dailySummary({ dryRun = false, queueResults = null, briefing = null } = {}) {
  console.log('=== SP Clone: Daily Summary ===');
  console.log(`[${new Date().toISOString()}] 開始\n`);

  const today = new Date().toISOString().split('T')[0];

  // 1. Git活動
  console.log('📊 Git活動確認...');
  const gitActivity = getGitActivity();
  console.log(gitActivity);

  // 2. サマリー生成
  const summaryInput = [
    `# ${today} セッションログ`,
    '',
    '## Git Activity',
    gitActivity,
    '',
    '## キュー処理結果',
    queueResults ? JSON.stringify(queueResults, null, 2) : '(未実行)',
    '',
    '## 朝のブリーフィング',
    briefing || '(未実行)',
  ].join('\n');

  let sessionLog;
  if (dryRun) {
    console.log('\n[DRY RUN] Claude API スキップ');
    sessionLog = summaryInput;
  } else {
    console.log('\n🤖 セッションログ生成中...');
    sessionLog = await ask(
      `以下の情報を元に、セッションログを整理してください。\n` +
      `フォーマット:\n` +
      `# YYYY-MM-DD セッションログ\n` +
      `## やったこと\n` +
      `## キュー処理\n` +
      `## 明日への引き継ぎ\n` +
      `## メモ\n\n` +
      summaryInput,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 800 }
    );
  }

  // 3. sp-brainに保存
  if (!dryRun) {
    const filename = writeSessionLog(today, sessionLog);
    console.log(`\n📝 セッションログ保存: sp-brain/memory/sessions/${filename}`);
  } else {
    console.log('\n[DRY RUN] ファイル書き込みスキップ');
  }

  console.log('\n--- セッションログ ---');
  console.log(sessionLog);
  console.log('---\n');

  return { date: today, sessionLog };
}
