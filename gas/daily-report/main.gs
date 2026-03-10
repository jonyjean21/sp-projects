/**
 * 日報自動生成 GAS
 *
 * 毎朝4時JST実行:
 * 1. GitHub API で前日コミット取得（公開リポ、認証不要）
 * 2. コミット分類（feat/fix/etc + プロジェクト別）
 * 3. Gemini で AI要約 + note/X用エクスポート文生成
 * 4. Firebase /daily-reports/{YYYY-MM-DD} にPUT
 *
 * Script Properties: GEMINI_API_KEY
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const GITHUB_REPO = 'jonyjean21/sp-projects';
const REPORT_PATH = '/daily-reports';
const LOG_PATH = '/daily-report-log';
const ACTIVITIES_PATH = '/daily-activities';

// ===== プロジェクト分類マップ =====
const AREA_MAP = [
  { pattern: /^viisi-master/, area: '5先王' },
  { pattern: /^championship/, area: '日本選手権' },
  { pattern: /^teamride/, area: 'チームライド' },
  { pattern: /^meguri/, area: 'めぐり帳' },
  { pattern: /^recipe/, area: 'レシピBOX' },
  { pattern: /^inbox/, area: 'INBOX' },
  { pattern: /^machap/, area: 'MACHAP' },
  { pattern: /^youtube/, area: 'YouTube' },
  { pattern: /^portal/, area: 'SP Portal' },
  { pattern: /^molkky-portal/, area: 'MOLKKY HUB Portal' },
  { pattern: /^molkky-admin/, area: 'モルハブ管理' },
  { pattern: /^hub-dashboard/, area: 'モルハブ向上委員会' },
  { pattern: /^partner/, area: 'パートナー' },
  { pattern: /^promote/, area: 'Xポスト生成' },
  { pattern: /^repost/, area: '引用リポスト' },
  { pattern: /^tournament/, area: '大会情報' },
  { pattern: /^naimol/, area: 'ナイモル' },
  { pattern: /^report-admin/, area: '日報システム' },
  { pattern: /^gas\//, area: 'GAS自動化' },
  { pattern: /^tools\//, area: 'ツール' },
  { pattern: /^apps\//, area: 'Appsカタログ' },
  { pattern: /^data\//, area: 'データ' },
  { pattern: /^projects\/molkky-dome/, area: 'モルックドーム' },
  { pattern: /^\.claude/, area: 'Claude設定' },
];

// ===== コミットタイプ分類 =====
function classifyType_(msg) {
  const lower = msg.toLowerCase();
  if (/^feat[:(]/.test(lower) || /^add[:(]/.test(lower)) return 'feat';
  if (/^fix[:(]/.test(lower)) return 'fix';
  if (/^refactor[:(]/.test(lower)) return 'refactor';
  if (/^docs?[:(]/.test(lower)) return 'docs';
  if (/^style[:(]/.test(lower)) return 'style';
  if (/^chore[:(]/.test(lower)) return 'chore';
  if (/^test[:(]/.test(lower)) return 'test';
  // メッセージ内容から推定
  if (/追加|新規|作成|構築|実装/.test(msg)) return 'feat';
  if (/修正|バグ|fix/.test(lower)) return 'fix';
  if (/リファクタ|整理|削除|cleanup/.test(lower)) return 'refactor';
  if (/ドキュメント|readme|memory/.test(lower)) return 'docs';
  return 'feat';
}

// ===== ファイルパスからエリア分類 =====
function classifyArea_(filePath) {
  for (const { pattern, area } of AREA_MAP) {
    if (pattern.test(filePath)) return area;
  }
  return 'その他';
}

// ===== メイン処理 =====
function generateDailyReport() {
  const now = new Date();
  // 前日の日報を生成（4am〜4am JST基準）
  const target = new Date(now);
  target.setDate(target.getDate() - 1);
  const dateStr = Utilities.formatDate(target, 'Asia/Tokyo', 'yyyy-MM-dd');
  generateForDate(dateStr);
}

/**
 * 指定日の日報を生成（バックフィル用にも使える）
 */
function generateForDate(dateStr) {
  const startTime = new Date();
  Logger.log(`=== 日報生成開始: ${dateStr} ===`);

  // 1. 時間範囲（JST 4:00〜翌4:00 → UTC変換）
  const [year, month, day] = dateStr.split('-').map(Number);
  const sinceJST = new Date(year, month - 1, day, 4, 0, 0); // 当日4am JST
  const untilJST = new Date(year, month - 1, day + 1, 4, 0, 0); // 翌日4am JST
  const since = new Date(sinceJST.getTime() - 9 * 3600000).toISOString(); // UTC変換
  const until = new Date(untilJST.getTime() - 9 * 3600000).toISOString();

  // 2. GitHub APIでコミット一覧取得
  const commits = fetchCommits_(since, until);
  Logger.log(`コミット数: ${commits.length}`);

  // 3. 各コミットの詳細取得 & 分類
  const enriched = commits.map(c => enrichCommit_(c, dateStr));

  // 4. Claude Code セッション活動ログ取得
  const activities = fetchDailyActivities_(dateStr);
  Logger.log(`セッション活動: ${activities.length}件`);

  // 5. 統計集計
  const stats = computeStats_(enriched);

  // 6. 日付表示
  const days = ['日','月','火','水','木','金','土'];
  const d = new Date(year, month - 1, day);
  const dow = days[d.getDay()];
  const dateDisplay = `${year}年${month}月${day}日（${dow}）`;

  // 7. AI要約（コミットまたはセッション活動がある場合）
  let summary = { headline: '活動なし', body: '活動なし', highlights: [], areas_narrative: '' };
  let exports = { note_markdown: '', x_thread: [] };

  if (enriched.length > 0 || activities.length > 0) {
    const aiResult = callGemini_(enriched, stats, dateDisplay, activities);
    summary = aiResult.summary || summary;
    exports = aiResult.exports || exports;
  }

  // 8. Firebase書き込み
  const report = {
    generated_at: new Date().toISOString(),
    date: dateStr,
    date_display: dateDisplay,
    commits: enriched.map(c => ({
      sha: c.sha,
      time: c.time,
      type: c.type,
      message: c.message,
      files: c.files,
      additions: c.additions,
      deletions: c.deletions,
      area: c.area
    })),
    activities: activities,
    stats: stats,
    summary: summary,
    exports: exports
  };

  UrlFetchApp.fetch(`${FIREBASE_URL}${REPORT_PATH}/${dateStr}.json`, {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(report),
    muteHttpExceptions: true
  });

  // 9. 実行ログ
  const duration = Math.round((new Date() - startTime) / 1000);
  UrlFetchApp.fetch(`${FIREBASE_URL}${LOG_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      timestamp: new Date().toISOString(),
      date_processed: dateStr,
      commit_count: enriched.length,
      status: 'success',
      duration_sec: duration
    }),
    muteHttpExceptions: true
  });

  Logger.log(`=== 完了: ${dateStr} / ${enriched.length}コミット / ${duration}秒 ===`);
}

// ===== GitHub API =====

function fetchCommits_(since, until) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/commits?since=${since}&until=${until}&per_page=100`;
  const resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'SP-DailyReport/1.0' }
  });

  if (resp.getResponseCode() !== 200) {
    Logger.log(`GitHub API error: ${resp.getResponseCode()}`);
    return [];
  }
  return JSON.parse(resp.getContentText());
}

function enrichCommit_(commitData, dateStr) {
  const sha = commitData.sha;
  const message = commitData.commit.message.split('\n')[0]; // 1行目のみ
  const commitDate = new Date(commitData.commit.author.date);
  const timeJST = Utilities.formatDate(commitDate, 'Asia/Tokyo', 'HH:mm');

  // コミット詳細（変更ファイル）
  let additions = 0, deletions = 0, files = [];
  try {
    const detailResp = UrlFetchApp.fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits/${sha}`,
      { muteHttpExceptions: true, headers: { 'User-Agent': 'SP-DailyReport/1.0' } }
    );
    if (detailResp.getResponseCode() === 200) {
      const detail = JSON.parse(detailResp.getContentText());
      additions = detail.stats?.additions || 0;
      deletions = detail.stats?.deletions || 0;
      files = (detail.files || []).map(f => f.filename);
    }
  } catch (e) {
    Logger.log(`詳細取得失敗: ${sha.substring(0, 7)} - ${e.message}`);
  }

  // 主要エリア判定（最も多く変更されたエリア）
  const areaCounts = {};
  files.forEach(f => {
    const a = classifyArea_(f);
    areaCounts[a] = (areaCounts[a] || 0) + 1;
  });
  const area = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'その他';

  return {
    sha: sha.substring(0, 7),
    time: timeJST,
    type: classifyType_(message),
    message: message,
    files: files,
    additions: additions,
    deletions: deletions,
    area: area
  };
}

// ===== 統計集計 =====

function computeStats_(commits) {
  const types = {};
  const areas = {};
  let totalAdditions = 0, totalDeletions = 0;
  const hours = [];

  commits.forEach(c => {
    // タイプ別
    types[c.type] = (types[c.type] || 0) + 1;

    // エリア別
    if (!areas[c.area]) areas[c.area] = { commits: 0, additions: 0, deletions: 0 };
    areas[c.area].commits++;
    areas[c.area].additions += c.additions;
    areas[c.area].deletions += c.deletions;

    totalAdditions += c.additions;
    totalDeletions += c.deletions;

    // 時間帯
    const hour = parseInt(c.time.split(':')[0]);
    hours.push(hour);
  });

  const timeRange = commits.length > 0
    ? { first: commits[commits.length - 1].time, last: commits[0].time }
    : { first: '-', last: '-' };

  const uniqueHours = [...new Set(hours)];

  return {
    total_commits: commits.length,
    total_additions: totalAdditions,
    total_deletions: totalDeletions,
    types: types,
    areas: areas,
    time_range: timeRange,
    active_hours: uniqueHours.length
  };
}

// ===== セッション活動ログ取得 =====

function fetchDailyActivities_(dateStr) {
  const resp = UrlFetchApp.fetch(
    `${FIREBASE_URL}${ACTIVITIES_PATH}/${dateStr}.json`,
    { muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) return [];
  const data = JSON.parse(resp.getContentText());
  if (!data) return [];

  // 全セッションの活動を時系列で統合
  const all = [];
  Object.values(data).forEach(session => {
    if (session && session.items) {
      session.items.forEach(item => {
        all.push({
          time: session.time || '',
          activity: item
        });
      });
    }
  });
  return all;
}

// ===== Gemini API =====

function callGemini_(commits, stats, dateDisplay, activities) {
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!geminiKey) {
    Logger.log('GEMINI_API_KEY未設定 → AI要約スキップ');
    return { summary: null, exports: null };
  }

  const commitList = commits.map(c =>
    `${c.time} [${c.type}] ${c.message} (${c.area}, +${c.additions}/-${c.deletions})`
  ).join('\n');

  const areasList = Object.entries(stats.areas)
    .sort((a, b) => b[1].commits - a[1].commits)
    .map(([name, s]) => `${name}: ${s.commits}件, +${s.additions}/-${s.deletions}`)
    .join('\n');

  // セッション活動テキスト
  activities = activities || [];
  const activitiesList = activities.length > 0
    ? activities.map(a => `- ${a.time ? a.time + ' ' : ''}${a.activity}`).join('\n')
    : 'なし';

  const prompt = `あなたはSP（個人開発者）の日報を書くアシスタントです。
以下はSPの${dateDisplay}のgitコミット履歴とClaude Codeセッションでの作業記録です。

## コミット一覧（時刻順）
${commitList || 'なし'}

## プロジェクト別集計
${areasList || 'なし'}

## Claude Codeセッション活動（コミット外の作業）
${activitiesList}

## 統計
- コミット: ${stats.total_commits}件, +${stats.total_additions}行, -${stats.total_deletions}行
- セッション活動: ${activities.length}件
- 活動時間帯: ${stats.time_range.first}〜${stats.time_range.last}

以下のJSON形式で出力してください:
{
  "summary": {
    "headline": "1行の見出し（15文字以内、その日の成果を端的に）",
    "body": "3〜5文のサマリー。何を作り、何を改善したか具体的に",
    "highlights": ["成果1", "成果2", "成果3"],
    "areas_narrative": "プロジェクト別の活動概要を2〜3文で"
  },
  "exports": {
    "note_markdown": "note.com記事用のマークダウン。見出し・箇条書き・コードブロックを使い、読みやすく。1000〜1500字。冒頭に日付、末尾に数値サマリー。個人開発者の日報として読み応えのある内容に",
    "x_thread": ["ツイート1（140字以内）", "ツイート2", "ツイート3"]
  }
}

## 注意
- SPは日本語話者。日本語で書く
- AI臭い定型文（「いかがでしたか」等）は禁止
- headline はキャッチーに
- x_thread は3〜5ツイートのスレッド。1ツイート140字以内。個人開発の臨場感が伝わるように
- note_markdownはマークダウン形式。## 見出し、- 箇条書きを使う`;

  const resp = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, responseMimeType: 'application/json' }
      }),
      muteHttpExceptions: true
    }
  );

  const result = JSON.parse(resp.getContentText());
  if (result.error) {
    Logger.log('Gemini error: ' + result.error.message);
    return { summary: null, exports: null };
  }

  const text = result.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

// ===== トリガー管理 =====

function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'generateDailyReport') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('generateDailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('トリガー作成: 毎朝4時JST generateDailyReport');
}

// ===== テスト・ユーティリティ =====

function testRun() {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  generateForDate(today);
}

function testYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');
  generateForDate(dateStr);
}

/**
 * 直近N日分をバックフィル
 */
function backfill(days) {
  days = days || 7;
  for (let i = 1; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
    Logger.log(`バックフィル: ${dateStr}`);
    generateForDate(dateStr);
    Utilities.sleep(2000); // レートリミット対策
  }
}

function showRecentLogs() {
  const resp = UrlFetchApp.fetch(
    `${FIREBASE_URL}${LOG_PATH}.json?orderBy=%22timestamp%22&limitToLast=5`,
    { muteHttpExceptions: true }
  );
  const logs = JSON.parse(resp.getContentText());
  if (!logs) { Logger.log('ログなし'); return; }
  Object.entries(logs).forEach(([key, log]) => {
    Logger.log(`${log.timestamp}: ${log.date_processed} ${log.commit_count}件 ${log.status} (${log.duration_sec}秒)`);
  });
}

function checkProperties() {
  const p = PropertiesService.getScriptProperties();
  const gemini = p.getProperty('GEMINI_API_KEY');
  Logger.log('GEMINI_API_KEY: ' + (gemini ? '設定済み (' + gemini.substring(0, 8) + '...)' : '未設定'));
}
