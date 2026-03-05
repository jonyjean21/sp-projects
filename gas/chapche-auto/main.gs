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
  const processedDates = {}; // 同一dateLabel重複防止

  // 直近14日以内のファイルのみ処理（古いファイルの暴走防止）
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);

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

    // 直近14日以内のファイルのみ処理
    const fileDate = new Date(+year, +month - 1, +day);
    if (fileDate < cutoffDate) {
      markAsProcessed_(id);
      continue;
    }

    // 同一日付の重複防止（1回の実行内）
    if (processedDates[dateLabel]) {
      markAsProcessed_(id);
      continue;
    }

    if (isAlreadyProcessed_(dateLabel)) {
      markAsProcessed_(id);
      continue;
    }

    try {
      Logger.log(`処理開始: ${name}`);
      processTranscript_(file, year, month, day, dateLabel);
      markAsProcessed_(id);
      processedDates[dateLabel] = true;
      newCount++;
      Logger.log(`完了: ${dateLabel}`);
    } catch (e) {
      Logger.log(`エラー: ${dateLabel} - ${e.message}`);
      logToFirebase_(dateLabel, 'error', e.message);
    }
  }
  Logger.log(`処理完了: ${newCount}件`);
}

/**
 * 指定日付のみ再処理（既存Notionページは手動削除前提）
 * 使い方: processSpecificDates() を実行
 */
function processSpecificDates() {
  const targetDates = ['260226', '260301', '260303'];
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  const done = {};

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    const dateMatch = name.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (!dateMatch) continue;
    if (!name.includes('Gemini') || !name.includes('会議')) continue;

    const [_, year, month, day] = dateMatch;
    const dateLabel = `${year.slice(2)}${month}${day}`;

    if (!targetDates.includes(dateLabel)) continue;
    if (done[dateLabel]) continue;

    try {
      Logger.log(`再処理開始: ${name} → ${dateLabel}`);
      processTranscript_(file, year, month, day, dateLabel);
      done[dateLabel] = true;
      Logger.log(`完了: ${dateLabel}`);
    } catch (e) {
      Logger.log(`エラー: ${dateLabel} - ${e.message}`);
    }
  }
  Logger.log(`再処理完了: ${Object.keys(done).length}/${targetDates.length}件`);
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
以下はGoogle Meetの文字起こし（Geminiメモ）のノート部分です。議事録JSONに変換してください。

## ルール
- 人名: 「モルックドーム」「中博司」→「中」 / 「master morikawa」→「ししょー」 / 「SP」「サノ」→「サノ」
- タイムスタンプ (00:xx:xx) は削除
- 1項目1行、簡潔に
- プロジェクト別にグルーピング（担当者名を括弧で付記）

## JSON形式で出力:
{
  "time": "開始時刻（例: 21:54）",
  "participants": ["中", "ししょー", "サノ"],
  "summary": "会議全体の要約。3〜5文で、この会議で何が話し合われ、何が決まったかを簡潔にまとめる。見返した時にすぐ内容を把握できるように。",
  "decisions": ["決定事項1", "決定事項2"],
  "actions": [{"who":"中","what":"やること"}],
  "topics": [{"name":"PJ名やトピック（担当者）","summary":"このトピックの要約を1〜2文で","items":["内容1","内容2"]}],
  "next_meeting": "未定"
}

## 出力のポイント
- summary（全体要約）は最上部に表示される。3人が見返した時に一瞬で内容把握できる文章にする
- decisions（決定事項）は最重要。会議で決まったことを明確に
- actions（アクションアイテム）は誰が何をするかを明確に
- topics（議論・進捗メモ）はPJ別にまとめ、担当者名を括弧で付記。各トピックにもsummaryを付ける
- 不要な情報は省略。簡潔さ重視

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

  parsed.date_display = `${year}年${month}月${day}日（${dow}）`;
  return parsed;
}

// ===== Notion API =====

function postToNotion_(dateLabel, m) {
  const config = getConfig_();
  const blocks = [];

  // 基本情報
  blocks.push(h2_('基本情報'));
  blocks.push(bullet_(`日時: ${m.date_display} ${m.time || ''}〜`));
  blocks.push(bullet_(`参加: ${(m.participants || ['中','ししょー','サノ']).join(' / ')}`));
  blocks.push({ divider: {} });

  // 全体要約（見返した時にすぐ把握できる）
  if (m.summary) {
    blocks.push(h2_('要約'));
    blocks.push(callout_(m.summary));
    blocks.push({ divider: {} });
  }

  // 決定事項（最重要 → 上部に配置）
  if (m.decisions && m.decisions.length) {
    blocks.push(h2_('決定事項'));
    for (const d of m.decisions) blocks.push(num_(d));
    blocks.push({ divider: {} });
  }

  // アクションアイテム
  if (m.actions && m.actions.length) {
    blocks.push(h2_('アクションアイテム'));
    for (const a of m.actions) blocks.push(todo_(`${a.who}：${a.what}`));
    blocks.push({ divider: {} });
  }

  // 議論・進捗メモ（PJ別）
  if (m.topics && m.topics.length) {
    blocks.push(h2_('議論・進捗メモ'));
    for (const t of m.topics) {
      blocks.push(bold_(t.name));
      if (t.summary) blocks.push(para_(`💡 ${t.summary}`));
      for (const item of (t.items || [])) blocks.push(bullet_(item));
    }
    blocks.push({ divider: {} });
  }

  // 旧形式互換（progress + discussions がある場合）
  if (!m.topics && m.progress && m.progress.length) {
    blocks.push(h2_('議論・進捗メモ'));
    for (const p of m.progress) {
      for (const proj of (p.projects || [])) {
        blocks.push(bold_(`${proj.name}（${p.person}）`));
        for (const item of (proj.items || [])) blocks.push(bullet_(item));
      }
    }
    if (m.discussions && m.discussions.length) {
      for (const d of m.discussions) {
        blocks.push(bold_(d.topic));
        for (const item of (d.items || [])) blocks.push(bullet_(item));
      }
    }
    blocks.push({ divider: {} });
  }

  // 次回予定
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
function callout_(t) { return { callout: { rich_text: [{ text: { content: t } }], icon: { emoji: '📋' } } }; }

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
  if (!data) return false;
  return data.status !== 'error';
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
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkNewTranscripts') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkNewTranscripts').timeBased().everyHours(1).create();
  Logger.log('トリガーセットアップ完了');
}

function setKeys() {
  // GASエディタの「プロジェクトの設定」→「スクリプトプロパティ」で手動設定
  // NOTION_TOKEN: Notion Integration Token
  // GEMINI_API_KEY: Google AI Studio API Key
  Logger.log('⚠️ スクリプトプロパティから NOTION_TOKEN と GEMINI_API_KEY を手動設定してください');
  checkProperties();
}

function checkProperties() {
  const p = PropertiesService.getScriptProperties();
  const gemini = p.getProperty('GEMINI_API_KEY');
  const notion = p.getProperty('NOTION_TOKEN');
  Logger.log('GEMINI_API_KEY: ' + (gemini ? '設定済み (' + gemini.substring(0, 8) + '...)' : '未設定'));
  Logger.log('NOTION_TOKEN: ' + (notion ? '設定済み (' + notion.substring(0, 8) + '...)' : '未設定'));
}

function testRun() { checkNewTranscripts(); }

function resetProcessed() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_IDS');
  Logger.log('処理済みリストをクリア');
}
