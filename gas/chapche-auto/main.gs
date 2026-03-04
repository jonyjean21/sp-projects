/**
 * チャプ会議事録 全自動 GAS
 *
 * Drive の Gemini メモを検知 → Gemini 2.5 Flash で議事録変換 → Notion に投稿
 * SP の操作一切不要。トリガー: 1時間おき。
 */

const DRIVE_FOLDER_ID = '1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa';
const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const NOTION_PARENT_PAGE_ID = '273d31a2-c3eb-804b-b3f0-e66775ba8b14';

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  const geminiKey = p.getProperty('GEMINI_API_KEY');
  const notionToken = p.getProperty('NOTION_TOKEN');
  if (!geminiKey || !notionToken) {
    throw new Error('Script Properties に GEMINI_API_KEY / NOTION_TOKEN を設定してください');
  }
  return { geminiKey, notionToken };
}

// ===== メイン =====

function checkNewTranscripts() {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const processedIds = getProcessedIds_();
  const files = folder.getFiles();
  let newCount = 0;

  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();
    const name = file.getName();

    if (processedIds.includes(id)) continue;
    if (!name.includes('Gemini') || !name.includes('会議')) continue;

    const dateMatch = name.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (!dateMatch) continue;

    const [_, year, month, day] = dateMatch;
    const dateLabel = `${year.slice(2)}${month}${day}`;

    if (isAlreadyProcessed_(dateLabel)) {
      markAsProcessed_(id);
      continue;
    }

    try {
      Logger.log(`処理開始: ${name}`);
      processTranscript_(file, year, month, day, dateLabel);
      markAsProcessed_(id);
      newCount++;
      Logger.log(`完了: ${dateLabel}`);
    } catch (e) {
      Logger.log(`エラー: ${dateLabel} - ${e.message}`);
      logToFirebase_(dateLabel, 'error', e.message);
    }
  }
  Logger.log(`処理完了: ${newCount}件`);
}

function processTranscript_(file, year, month, day, dateLabel) {
  // ショートカットの場合は実体ファイルを取得
  let targetFile = file;
  if (file.getMimeType() === 'application/vnd.google-apps.shortcut') {
    const meta = JSON.parse(UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + file.getId() + '?fields=shortcutDetails',
      { headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() } }
    ).getContentText());
    targetFile = DriveApp.getFileById(meta.shortcutDetails.targetId);
  }

  // テキスト抽出（Google Docsはエクスポート、それ以外は直接読み取り）
  let fullText;
  const mime = targetFile.getMimeType();
  if (mime === 'application/vnd.google-apps.document') {
    // Google Docs → Drive APIでテキストエクスポート
    const exported = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + targetFile.getId() + '/export?mimeType=text/plain',
      { headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() } }
    );
    fullText = exported.getContentText();
  } else {
    fullText = targetFile.getBlob().getDataAsString();
  }
  const marker = fullText.indexOf('📖 文字起こし');
  const notes = marker > 0 ? fullText.substring(0, marker) : fullText.substring(0, 15000);

  // Gemini で議事録JSON生成
  const minutes = callGemini_(notes, year, month, day);

  // Notion に投稿
  const pageId = postToNotion_(dateLabel, minutes);

  // Firebase に記録
  logToFirebase_(dateLabel, 'posted', pageId);
}

// ===== Gemini API =====

function callGemini_(notes, year, month, day) {
  const config = getConfig_();
  const days = ['日','月','火','水','木','金','土'];
  const dow = days[new Date(+year, +month - 1, +day).getDay()];

  const prompt = `あなたはチャプチェ会（チャプ会）の議事録作成アシスタントです。
以下はGoogle Meetの文字起こし（Geminiメモ）のノート部分です。簡潔な議事録JSONに変換してください。

## ルール
- 人名: 「モルックドーム」「中博司」→「中」 / 「master morikawa」→「ししょー」 / 「SP」「サノ」→「サノ」
- タイムスタンプ (00:xx:xx) は削除
- 1項目1行、簡潔に
- 担当者別・プロジェクト別にグルーピング

## JSON形式で出力:
{
  "time": "開始時刻（例: 21:54）",
  "participants": ["中", "ししょー", "サノ"],
  "progress": [{"person":"中","projects":[{"name":"PJ名","items":["内容1"]}]}],
  "discussions": [{"topic":"話題","items":["内容1"]}],
  "decisions": ["決定事項1"],
  "actions": [{"who":"中","what":"やること"}],
  "next_meeting": "未定"
}

## 入力:
${notes.substring(0, 12000)}`;

  const resp = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
      }),
      muteHttpExceptions: true
    }
  );

  const result = JSON.parse(resp.getContentText());
  if (result.error) throw new Error('Gemini: ' + result.error.message);

  const text = result.candidates[0].content.parts[0].text;
  const parsed = JSON.parse(text);

  // 日付情報を付加
  parsed.date_display = `${year}年${month}月${day}日（${dow}）`;
  return parsed;
}

// ===== Notion API =====

function postToNotion_(dateLabel, m) {
  const config = getConfig_();
  const blocks = [];

  // ヘッダー
  blocks.push(h2_('チャプ会 議事録'));
  blocks.push(bullet_(`日時: ${m.date_display} ${m.time || ''}〜`));
  blocks.push(bullet_(`参加: ${(m.participants || ['中','ししょー','サノ']).join(' / ')}`));
  blocks.push(bullet_('形式: Geminiメモ統合版（自動生成）'));
  blocks.push({ divider: {} });

  // 進捗
  blocks.push(h2_('プロジェクト進捗報告会'));
  for (const p of (m.progress || [])) {
    blocks.push(h3_(`${p.person}担当`));
    for (const proj of (p.projects || [])) {
      blocks.push(bold_(proj.name));
      for (const item of (proj.items || [])) blocks.push(bullet_(item));
    }
  }
  blocks.push({ divider: {} });

  // 議論
  if (m.discussions && m.discussions.length) {
    blocks.push(h2_('議論トピック'));
    for (const d of m.discussions) {
      blocks.push(bold_(d.topic));
      for (const item of (d.items || [])) blocks.push(bullet_(item));
    }
    blocks.push({ divider: {} });
  }

  // 決定事項
  if (m.decisions && m.decisions.length) {
    blocks.push(h2_('決定事項'));
    for (const d of m.decisions) blocks.push(num_(d));
    blocks.push({ divider: {} });
  }

  // アクション
  if (m.actions && m.actions.length) {
    blocks.push(h2_('アクションアイテム'));
    for (const a of m.actions) blocks.push(todo_(`${a.who}：${a.what}`));
    blocks.push({ divider: {} });
  }

  // 次回
  blocks.push(h2_('次回予定'));
  blocks.push(para_(m.next_meeting || '未定'));

  // 100ブロック制限対策
  const trimmed = blocks.slice(0, 98);

  const resp = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${config.notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    payload: JSON.stringify({
      parent: { page_id: NOTION_PARENT_PAGE_ID },
      properties: { title: { title: [{ text: { content: `${dateLabel}_打合せ` } }] } },
      children: trimmed
    }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(resp.getContentText());
  if (result.status && result.status >= 400) throw new Error('Notion: ' + (result.message || ''));
  return result.id;
}

// Notion helpers
function h2_(t) { return { heading_2: { rich_text: [{ text: { content: t } }] } }; }
function h3_(t) { return { heading_3: { rich_text: [{ text: { content: t } }] } }; }
function bullet_(t) { return { bulleted_list_item: { rich_text: [{ text: { content: t } }] } }; }
function num_(t) { return { numbered_list_item: { rich_text: [{ text: { content: t } }] } }; }
function todo_(t) { return { to_do: { rich_text: [{ text: { content: t } }], checked: false } }; }
function para_(t) { return { paragraph: { rich_text: [{ text: { content: t } }] } }; }
function bold_(t) { return { paragraph: { rich_text: [{ text: { content: t }, annotations: { bold: true } }] } }; }

// ===== Firebase =====

function logToFirebase_(dateLabel, status, detail) {
  UrlFetchApp.fetch(`${FIREBASE_URL}/chapche-queue/${dateLabel}.json`, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify({ status, detail, processed_at: new Date().toISOString() }),
    muteHttpExceptions: true
  });
}

function isAlreadyProcessed_(dateLabel) {
  const resp = UrlFetchApp.fetch(`${FIREBASE_URL}/chapche-queue/${dateLabel}.json`, { muteHttpExceptions: true });
  const data = JSON.parse(resp.getContentText());
  return data !== null;
}

// ===== 処理済み管理 =====

function getProcessedIds_() {
  const prop = PropertiesService.getScriptProperties().getProperty('PROCESSED_IDS');
  return prop ? JSON.parse(prop) : [];
}

function markAsProcessed_(id) {
  const ids = getProcessedIds_();
  if (!ids.includes(id)) {
    ids.push(id);
    PropertiesService.getScriptProperties().setProperty('PROCESSED_IDS', JSON.stringify(ids.slice(-100)));
  }
}

// ===== セットアップ =====

function setup() {
  // トリガー再作成
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkNewTranscripts') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkNewTranscripts').timeBased().everyHours(1).create();

  Logger.log('トリガーセットアップ完了');
  Logger.log('⚠️ Script Properties で GEMINI_API_KEY と NOTION_TOKEN を手動設定してください');
}

/**
 * Script Properties に NOTION_TOKEN を設定
 * setup() 実行後にこれを1回実行
 */
function setNotionToken() {
  PropertiesService.getScriptProperties().setProperty('NOTION_TOKEN', 'REPLACE_ME');
  Logger.log('NOTION_TOKEN を設定しました（値を確認してください）');
}

function testRun() { checkNewTranscripts(); }

function resetProcessed() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_IDS');
  Logger.log('処理済みリストをクリア');
}
