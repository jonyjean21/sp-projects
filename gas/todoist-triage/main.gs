/**
 * Todoist Inbox 自動トリアージ
 * Inboxのタスクを内容でGemini判定 → 適切なプロジェクトに自動移動
 *
 * セットアップ:
 *   1. Script Properties に以下を設定:
 *      - TODOIST_API_TOKEN : Todoist設定 → インテグレーション → APIトークン
 *      - GEMINI_API_KEY    : .env の GEMINI_API_KEY と同じ値
 *   2. createTrigger() を1回実行してトリガー登録（2時間おき）
 */

const TODOIST_API = 'https://api.todoist.com/rest/v2';

// プロジェクトID（Todoistの実ID）
const PROJECTS = {
  inbox:       '6g7xmMQrRh4RGGhv',
  molkkyhub:   '6g7xrVCJ96gjVC3J',  // MOLKKY HUB
  machap:      '6g7xrfqpFqqHfGHW',  // MACHAP
  spprojects:  '6g7xrh6J8p2HWxX4',  // SP-projects
  daily:       '6g7xwp87wwvvcR9W',  // 日常/雑務
};

/**
 * メイン: Inboxを確認して振り分け
 */
function triageInbox() {
  const token = PropertiesService.getScriptProperties().getProperty('TODOIST_API_TOKEN');
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!token || !geminiKey) {
    Logger.log('ERROR: Script Propertiesが未設定');
    return;
  }

  const tasks = fetchInboxTasks_(token);
  if (tasks.length === 0) {
    Logger.log('Inboxは空');
    return;
  }

  Logger.log(`Inbox: ${tasks.length}件`);

  for (const task of tasks) {
    try {
      const projectId = classifyTask_(task.content, task.description || '', geminiKey);
      if (projectId && projectId !== PROJECTS.inbox) {
        moveTask_(task.id, projectId, token);
        Logger.log(`移動: 「${task.content}」→ ${getProjectName_(projectId)}`);
      } else {
        Logger.log(`スキップ: 「${task.content}」（inbox維持）`);
      }
    } catch (e) {
      Logger.log(`エラー: ${task.content} — ${e.message}`);
    }
  }
}

/**
 * Inboxのタスク一覧を取得
 */
function fetchInboxTasks_(token) {
  const res = UrlFetchApp.fetch(`${TODOIST_API}/tasks?project_id=${PROJECTS.inbox}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`Todoist API error: ${res.getResponseCode()}`);
  }
  return JSON.parse(res.getContentText());
}

/**
 * Geminiでタスク内容を判定 → プロジェクトIDを返す
 */
function classifyTask_(content, description, geminiKey) {
  const prompt = `
あなたはタスク管理AIです。以下のタスクを最適なプロジェクトに分類してください。

タスク名: ${content}
説明: ${description || '（なし）'}

プロジェクト選択肢:
- molkkyhub: モルック、大会、チーム、MOLKKY HUB、スポーツ関連
- machap: MACHAP、チームライド、マルタ村、ポータル、コミュニティアプリ
- spprojects: 開発、AI、BuildHub、自動化、GitHub、GAS、プログラミング、副業実験、Claude
- daily: 日常、個人、買い物、用事、家族、車、食事、雑務、その他

必ずいずれか1つのキーワードのみ返してください（説明不要）:
molkkyhub / machap / spprojects / daily
`.trim();

  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 20, temperature: 0 },
      }),
      muteHttpExceptions: true,
    }
  );

  if (res.getResponseCode() !== 200) {
    throw new Error(`Gemini error: ${res.getResponseCode()}`);
  }

  const result = JSON.parse(res.getContentText());
  const label = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();

  return PROJECTS[label] || PROJECTS.daily;
}

/**
 * タスクを指定プロジェクトに移動
 */
function moveTask_(taskId, projectId, token) {
  const res = UrlFetchApp.fetch(`${TODOIST_API}/tasks/${taskId}`, {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({ project_id: projectId }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`移動失敗 taskId=${taskId}: ${res.getResponseCode()} ${res.getContentText()}`);
  }
}

/**
 * プロジェクト名（ログ用）
 */
function getProjectName_(projectId) {
  const names = {
    [PROJECTS.molkkyhub]:  'MOLKKY HUB',
    [PROJECTS.machap]:     'MACHAP',
    [PROJECTS.spprojects]: 'SP-projects',
    [PROJECTS.daily]:      '日常/雑務',
  };
  return names[projectId] || projectId;
}

/**
 * トリガー登録（2時間おき）— 初回1回だけ実行
 */
function createTrigger() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'triageInbox')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('triageInbox')
    .timeBased()
    .everyHours(2)
    .create();

  Logger.log('トリガー登録完了: 2時間おき');
}

/**
 * 動作テスト用（実行してもAPIコール確認のみ、移動はしない）
 */
function testRun() {
  const token = PropertiesService.getScriptProperties().getProperty('TODOIST_API_TOKEN');
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  const tasks = fetchInboxTasks_(token);
  Logger.log(`Inbox: ${tasks.length}件`);

  for (const task of tasks) {
    const projectId = classifyTask_(task.content, task.description || '', geminiKey);
    Logger.log(`「${task.content}」→ ${getProjectName_(projectId)}`);
  }
}
