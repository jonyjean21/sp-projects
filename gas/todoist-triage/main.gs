/**
 * Todoist Inbox 自動トリアージ
 * Inboxのタスクを内容でGemini判定 → 適切なプロジェクトに自動移動
 *
 * セットアップ:
 *   Script Properties（GASエディタ→プロジェクト設定→スクリプトプロパティ）:
 *     TODOIST_API_TOKEN: Todoistの個人APIトークン
 *     GEMINI_API_KEY: GeminiのAPIキー
 *   createTrigger() を1回だけ実行してトリガー登録
 */

const TODOIST_API = 'https://api.todoist.com/api/v1';

const PROJECTS = {
  inbox:      '6g7xmMQrRh4RGGhv',
  molkkyhub:  '6g7xrVCJ96gjVC3J',
  machap:     '6g7xrfqpFqqHfGHW',
  spprojects: '6g7xrh6J8p2HWxX4',
  daily:      '6g7xwp87wwvvcR9W',
};

/**
 * メイン: Inboxを確認して振り分け（2時間おきに自動実行）
 */
function triageInbox() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TODOIST_API_TOKEN');
  const geminiKey = props.getProperty('GEMINI_API_KEY');

  const tasks = fetchInboxTasks_(token);
  if (tasks.length === 0) {
    Logger.log('Inbox: 空');
    return;
  }
  Logger.log(`Inbox: ${tasks.length}件を処理`);

  for (const task of tasks) {
    try {
      const projectKey = classifyTask_(task.content, task.description || '', geminiKey);
      const projectId = PROJECTS[projectKey];
      moveTask_(task.id, projectId, token);
      Logger.log(`✓ 「${task.content}」→ ${projectKey}`);
    } catch (e) {
      Logger.log(`✗ 「${task.content}」エラー: ${e.message}`);
    }
  }
}

function fetchInboxTasks_(token) {
  const res = UrlFetchApp.fetch(`${TODOIST_API}/tasks?project_id=${PROJECTS.inbox}`, {
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  });
  const data = JSON.parse(res.getContentText());
  return Array.isArray(data) ? data : (data.results || []);
}

function classifyTask_(content, description, geminiKey) {
  const prompt = `タスクを分類してください。

タスク: ${content}
説明: ${description || 'なし'}

選択肢（いずれか1つのみ返す）:
- molkkyhub: モルック・大会・チーム・MOLKKY HUB関連
- machap: MACHAP・チームライド・マルタ村・コミュニティアプリ関連
- spprojects: 開発・AI・BuildHub・自動化・GAS・Claude・副業実験関連
- daily: 日常・個人・買い物・用事・家族・食事・その他

キーワード1つのみ:`;

  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0 },
      }),
      muteHttpExceptions: true,
    }
  );

  const label = JSON.parse(res.getContentText())
    ?.candidates?.[0]?.content?.parts?.[0]?.text
    ?.trim().toLowerCase().replace(/[^a-z]/g, '');

  return PROJECTS[label] ? label : 'daily';
}

function moveTask_(taskId, projectId, token) {
  const res = UrlFetchApp.fetch(`${TODOIST_API}/tasks/${taskId}/move`, {
    method: 'post',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ project_id: projectId }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`HTTP ${res.getResponseCode()}: ${res.getContentText()}`);
  }
}

/** トリガー登録（2時間おき）— 初回1回だけ実行 */
function createTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'triageInbox')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('triageInbox').timeBased().everyHours(2).create();
  Logger.log('トリガー登録完了: 2時間おき');
}

/** 動作テスト（移動はしない） */
function testRun() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TODOIST_API_TOKEN');
  const geminiKey = props.getProperty('GEMINI_API_KEY');

  const tasks = fetchInboxTasks_(token);
  Logger.log(`Inbox: ${tasks.length}件`);
  for (const task of tasks) {
    const key = classifyTask_(task.content, task.description || '', geminiKey);
    Logger.log(`「${task.content}」→ ${key}`);
  }
}
