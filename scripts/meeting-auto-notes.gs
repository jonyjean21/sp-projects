// ============================================================
// チャプチェ会 打合せメモ自動化
// ============================================================
// Google Drive の文字起こしファイルを読み取り、
// AI で構造化して Notion に自動投稿するスクリプト
//
// 【セットアップ手順】
// 1. Google Apps Script (https://script.google.com) で新しいプロジェクト作成
// 2. このコードを全部貼り付け
// 3. スクリプトプロパティに以下を設定:
//    ファイル → プロジェクトの設定 → スクリプトプロパティ
//    - NOTION_TOKEN    : Notion Integration トークン
//    - NOTION_PAGE_ID  : 打合せメモページID（273d31a2c3eb804bb3f0e66775ba8b14）
//    - DRIVE_FOLDER_ID : 音声メモフォルダID（1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa）
//    - GEMINI_API_KEY  : Google AI Studio APIキー（https://aistudio.google.com で無料取得）
// 4. listFiles() を実行してフォルダ接続を確認
// 5. processNewMeetings() を手動実行してテスト
// 6. setupTrigger() を1回実行（自動化開始）
// ============================================================

// === 設定読み込み ===
function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    NOTION_TOKEN: props.getProperty('NOTION_TOKEN'),
    NOTION_PAGE_ID: props.getProperty('NOTION_PAGE_ID'),
    DRIVE_FOLDER_ID: props.getProperty('DRIVE_FOLDER_ID'),
    GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY')
  };
}

// ============================================================
// 1. フォルダ確認（最初にこれを実行）
// ============================================================

/**
 * Google Drive フォルダ内のファイル一覧をログに表示
 * まずこれを実行してフォルダの中身を確認する
 */
function listFiles() {
  var config = getConfig_();
  var folder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
  var files = folder.getFiles();

  Logger.log('=== フォルダ: ' + folder.getName() + ' ===');
  Logger.log('');

  var count = 0;
  while (files.hasNext()) {
    var file = files.next();
    Logger.log(
      '[' + (count + 1) + '] ' + file.getName() +
      '\n    形式: ' + file.getMimeType() +
      '\n    作成日: ' + file.getDateCreated().toLocaleDateString('ja-JP') +
      '\n    ID: ' + file.getId()
    );
    Logger.log('');
    count++;
  }

  Logger.log('合計: ' + count + ' ファイル');

  // サブフォルダも確認
  var subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    var sub = subfolders.next();
    Logger.log('📁 サブフォルダ: ' + sub.getName() + ' (ID: ' + sub.getId() + ')');
  }
}

// ============================================================
// 2. メイン処理
// ============================================================

/**
 * 新しいファイルを検出して議事録を自動生成（メインエントリーポイント）
 */
function processNewMeetings() {
  var config = getConfig_();
  validateConfig_(config);

  var folder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
  var processedIds = getProcessedIds_();
  var files = folder.getFiles();
  var processed = 0;

  while (files.hasNext()) {
    var file = files.next();

    // 処理済みはスキップ
    if (processedIds.indexOf(file.getId()) !== -1) {
      continue;
    }

    try {
      Logger.log('--- 処理開始: ' + file.getName() + ' ---');

      // ファイル内容を読み取り
      var content = readFileContent_(file);
      if (!content || content.trim().length < 20) {
        Logger.log('  内容が短すぎるためスキップ');
        continue;
      }

      // AI で議事録を構造化
      var structured = structureWithAI_(config, content, file.getName());

      // Notion に投稿
      var notionUrl = postToNotion_(config, structured);

      // 処理済みとして記録
      markAsProcessed_(file.getId(), file.getName());

      Logger.log('  Notion 投稿完了: ' + notionUrl);
      processed++;
    } catch (e) {
      Logger.log('  エラー: ' + e.message);
      Logger.log('  スタック: ' + e.stack);
    }
  }

  Logger.log('=== 処理完了: ' + processed + ' 件 ===');
}

/**
 * 指定ファイルIDの打合せメモを手動処理（テスト用）
 * 使い方: processOneFile('ファイルIDをここに')
 */
function processOneFile(fileId) {
  var config = getConfig_();
  validateConfig_(config);

  var file = DriveApp.getFileById(fileId);
  Logger.log('処理対象: ' + file.getName());

  var content = readFileContent_(file);
  if (!content) {
    Logger.log('ファイルの内容を読み取れませんでした');
    return;
  }

  Logger.log('--- 読み取った内容（先頭500文字） ---');
  Logger.log(content.substring(0, 500));
  Logger.log('--- ここまで ---');

  var structured = structureWithAI_(config, content, file.getName());
  Logger.log('--- 構造化結果 ---');
  Logger.log(JSON.stringify(structured, null, 2));

  var notionUrl = postToNotion_(config, structured);
  markAsProcessed_(file.getId(), file.getName());

  Logger.log('Notion 投稿完了: ' + notionUrl);
}

// ============================================================
// 3. ファイル読み取り
// ============================================================

/**
 * ファイルの内容をテキストとして読み取る
 * Google Docs、テキストファイル、Word ファイルに対応
 */
function readFileContent_(file) {
  var mimeType = file.getMimeType();
  var name = file.getName();

  // Google Docs
  if (mimeType === 'application/vnd.google-apps.document') {
    Logger.log('  Google Docs として読み取り: ' + name);
    var doc = DocumentApp.openById(file.getId());
    return doc.getBody().getText();
  }

  // プレーンテキスト / CSV
  if (mimeType.indexOf('text/') === 0) {
    Logger.log('  テキストファイルとして読み取り: ' + name);
    return file.getBlob().getDataAsString('UTF-8');
  }

  // Word ファイル (.docx)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    Logger.log('  Word ファイルを Google Docs に変換して読み取り: ' + name);
    var blob = file.getBlob();
    var tempDoc = Drive.Files.copy(
      { title: '_temp_convert_' + name, mimeType: 'application/vnd.google-apps.document' },
      file.getId()
    );
    var doc = DocumentApp.openById(tempDoc.id);
    var text = doc.getBody().getText();
    DriveApp.getFileById(tempDoc.id).setTrashed(true);
    return text;
  }

  // SRT / SBV 字幕ファイル（Google Meet のキャプション）
  if (name.match(/\.(srt|sbv|vtt)$/i)) {
    Logger.log('  字幕ファイルとして読み取り: ' + name);
    var raw = file.getBlob().getDataAsString('UTF-8');
    return cleanSubtitleText_(raw);
  }

  // 対応外
  Logger.log('  未対応ファイル形式: ' + mimeType + ' (' + name + ')');
  return null;
}

/**
 * SRT/SBV 字幕ファイルからタイムコードを除去してテキストだけ取り出す
 */
function cleanSubtitleText_(raw) {
  var lines = raw.split('\n');
  var textLines = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    // 空行、番号行、タイムコード行をスキップ
    if (line === '') continue;
    if (line.match(/^\d+$/)) continue;
    if (line.match(/^\d{2}:\d{2}/) || line.match(/-->/)) continue;
    textLines.push(line);
  }

  return textLines.join('\n');
}

// ============================================================
// 4. AI 構造化（Gemini API）
// ============================================================

/**
 * Gemini API で文字起こしテキストを議事録形式に構造化
 */
function structureWithAI_(config, transcript, fileName) {
  // ファイル名から日付を推測
  var dateGuess = extractDateFromName_(fileName);

  var prompt = 'あなたはチャプチェ会（モルック団体の定例打合せ）の議事録作成アシスタントです。\n'
    + '以下の打合せの文字起こし/メモから、構造化された議事録を作成してください。\n\n'
    + '## メンバー:\n'
    + '- ナカ / 中さん\n'
    + '- シショ / ししょー\n'
    + '- サノ\n\n'
    + '## ルール:\n'
    + '- 決定事項は明確な結論だけを箇条書きに\n'
    + '- アクションアイテムは具体的な行動 + 担当者 + 期限\n'
    + '- 議論メモはトピック別にまとめる\n'
    + '- 日本語で出力\n'
    + '- 推測で情報を追加しない。文字起こしに書かれていることだけ使う\n\n'
    + '## 出力形式（JSON）:\n'
    + '```json\n'
    + '{\n'
    + '  "date": "' + (dateGuess || 'YYYY-MM-DD') + '",\n'
    + '  "participants": ["ナカ", "シショ", "サノ"],\n'
    + '  "decisions": ["決定事項1", "決定事項2"],\n'
    + '  "actions": [\n'
    + '    {"action": "具体的な行動", "assignee": "担当者", "deadline": "期限"}\n'
    + '  ],\n'
    + '  "topics": [\n'
    + '    {"title": "トピック名", "notes": ["議論ポイント1", "議論ポイント2"]}\n'
    + '  ]\n'
    + '}\n'
    + '```\n\n'
    + '## 文字起こし:\n'
    + transcript;

  if (config.GEMINI_API_KEY) {
    return callGemini_(config.GEMINI_API_KEY, prompt);
  }

  // Gemini APIキーがない場合はシンプルな構造化
  Logger.log('  Gemini APIキーなし → テンプレート構造化を使用');
  return simpleStructure_(transcript, dateGuess, fileName);
}

/**
 * Gemini API を呼び出し
 */
function callGemini_(apiKey, prompt) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  var payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();

  if (status !== 200) {
    throw new Error('Gemini API エラー (' + status + '): ' + response.getContentText());
  }

  var result = JSON.parse(response.getContentText());
  var text = result.candidates[0].content.parts[0].text;

  // JSON ブロックを抽出
  var jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    text = jsonMatch[1];
  }

  return JSON.parse(text);
}

/**
 * AI なしのシンプル構造化（フォールバック）
 */
function simpleStructure_(transcript, dateGuess, fileName) {
  return {
    date: dateGuess || new Date().toISOString().split('T')[0],
    participants: ['ナカ', 'シショ', 'サノ'],
    decisions: ['（AI構造化なし — 下記メモを参照）'],
    actions: [{ action: '議事録をレビューして決定事項・アクションを追記', assignee: 'チーム', deadline: '次の打合せまで' }],
    topics: [{
      title: fileName || '打合せメモ',
      notes: transcript.split('\n').filter(function(line) { return line.trim().length > 0; }).slice(0, 50)
    }]
  };
}

/**
 * ファイル名から日付を推測
 */
function extractDateFromName_(name) {
  // YYYY-MM-DD パターン
  var m1 = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return m1[0];

  // YYMMDD パターン（例: 260226）
  var m2 = name.match(/(\d{2})(\d{2})(\d{2})/);
  if (m2) return '20' + m2[1] + '-' + m2[2] + '-' + m2[3];

  // YYYY/MM/DD パターン
  var m3 = name.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (m3) return m3[1] + '-' + m3[2] + '-' + m3[3];

  return null;
}

// ============================================================
// 5. Notion 投稿
// ============================================================

/**
 * 構造化された議事録を Notion ページとして投稿
 */
function postToNotion_(config, data) {
  var url = 'https://api.notion.com/v1/pages';

  var title = 'チャプチェ会 議事録 — ' + data.date;
  var participants = (data.participants || ['ナカ', 'シショ', 'サノ']).join('、');

  // ページのブロック構成を組み立て
  var children = [];

  // 参加者
  children.push(makeParagraph_('参加者: ' + participants, true));
  children.push(makeDivider_());

  // 決定事項
  children.push(makeHeading_('決定事項', 2));
  if (data.decisions && data.decisions.length > 0) {
    for (var i = 0; i < data.decisions.length; i++) {
      children.push(makeBullet_(data.decisions[i]));
    }
  }

  // アクションアイテム
  children.push(makeHeading_('アクションアイテム', 2));
  if (data.actions && data.actions.length > 0) {
    for (var j = 0; j < data.actions.length; j++) {
      var a = data.actions[j];
      var text = a.action + ' — 担当: ' + a.assignee;
      if (a.deadline) text += ' / 期限: ' + a.deadline;
      children.push(makeTodo_(text));
    }
  }

  // 議論メモ
  children.push(makeHeading_('議論メモ', 2));
  if (data.topics && data.topics.length > 0) {
    for (var k = 0; k < data.topics.length; k++) {
      var topic = data.topics[k];
      children.push(makeHeading_(topic.title, 3));
      if (topic.notes && topic.notes.length > 0) {
        for (var l = 0; l < topic.notes.length; l++) {
          children.push(makeBullet_(topic.notes[l]));
        }
      }
    }
  }

  children.push(makeDivider_());
  children.push(makeParagraph_('Google Apps Script で自動生成', false, true));

  // Notion API リクエスト
  var payload = {
    parent: { page_id: formatNotionId_(config.NOTION_PAGE_ID) },
    properties: {
      title: [{ text: { content: title } }]
    },
    children: children
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + config.NOTION_TOKEN,
      'Notion-Version': '2022-06-28'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();

  if (status !== 200) {
    var errorBody = response.getContentText();
    Logger.log('Notion API レスポンス: ' + errorBody);

    // parent が database の場合のリトライ
    if (errorBody.indexOf('validation_error') !== -1 && errorBody.indexOf('database') !== -1) {
      Logger.log('  ページIDがデータベースの可能性あり → database_id でリトライ');
      payload.parent = { database_id: formatNotionId_(config.NOTION_PAGE_ID) };
      payload.properties = {
        'Name': { title: [{ text: { content: title } }] }
      };
      options.payload = JSON.stringify(payload);
      response = UrlFetchApp.fetch(url, options);
      status = response.getResponseCode();
    }

    if (status !== 200) {
      throw new Error('Notion API エラー (' + status + '): ' + response.getContentText());
    }
  }

  var result = JSON.parse(response.getContentText());
  return result.url || result.id;
}

// === Notion ブロック生成ヘルパー ===

function makeHeading_(text, level) {
  var key = 'heading_' + level;
  var block = { object: 'block', type: key };
  block[key] = {
    rich_text: [{ type: 'text', text: { content: text } }]
  };
  return block;
}

function makeParagraph_(text, bold, italic) {
  var annotations = {};
  if (bold) annotations.bold = true;
  if (italic) annotations.italic = true;

  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: text },
        annotations: annotations
      }]
    }
  };
}

function makeBullet_(text) {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }]
    }
  };
}

function makeTodo_(text) {
  return {
    object: 'block',
    type: 'to_do',
    to_do: {
      rich_text: [{ type: 'text', text: { content: text } }],
      checked: false
    }
  };
}

function makeDivider_() {
  return { object: 'block', type: 'divider', divider: {} };
}

/**
 * 32桁のIDをハイフン付きUUID形式に変換
 */
function formatNotionId_(id) {
  id = id.replace(/-/g, '');
  if (id.length === 32) {
    return id.substring(0, 8) + '-' + id.substring(8, 12) + '-' +
      id.substring(12, 16) + '-' + id.substring(16, 20) + '-' + id.substring(20);
  }
  return id;
}

// ============================================================
// 6. 処理済みファイル管理
// ============================================================

function getProcessedIds_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('PROCESSED_FILES');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function markAsProcessed_(fileId, fileName) {
  var props = PropertiesService.getScriptProperties();
  var ids = getProcessedIds_();
  ids.push(fileId);

  // 最大100件保持（古いものから削除）
  if (ids.length > 100) {
    ids = ids.slice(ids.length - 100);
  }

  props.setProperty('PROCESSED_FILES', JSON.stringify(ids));
  Logger.log('  処理済みに追加: ' + fileName + ' (' + fileId + ')');
}

/**
 * 処理済みリストをリセット（全ファイルを再処理したい場合）
 */
function resetProcessedFiles() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_FILES');
  Logger.log('処理済みリストをリセットしました');
}

// ============================================================
// 7. トリガー設定
// ============================================================

/**
 * 自動実行トリガーを設定
 * 毎日朝9時にチェック（新ファイルがあれば処理）
 */
function setupTrigger() {
  // 既存のトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processNewMeetings') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 毎日朝9時に実行
  ScriptApp.newTrigger('processNewMeetings')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('トリガー設定完了: 毎日 9:00 に processNewMeetings() を実行');
}

/**
 * 会議直後に手動実行する用（週1回の打合せ後に使う）
 */
function processLatest() {
  var config = getConfig_();
  var folder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
  var files = folder.getFiles();

  // 最新ファイルを探す
  var latest = null;
  var latestDate = new Date(0);

  while (files.hasNext()) {
    var file = files.next();
    if (file.getDateCreated() > latestDate) {
      latestDate = file.getDateCreated();
      latest = file;
    }
  }

  if (!latest) {
    Logger.log('フォルダにファイルがありません');
    return;
  }

  Logger.log('最新ファイル: ' + latest.getName() + ' (' + latestDate.toLocaleDateString('ja-JP') + ')');
  processOneFile(latest.getId());
}

// ============================================================
// 8. 設定チェック
// ============================================================

function validateConfig_(config) {
  var missing = [];
  if (!config.NOTION_TOKEN) missing.push('NOTION_TOKEN');
  if (!config.NOTION_PAGE_ID) missing.push('NOTION_PAGE_ID');
  if (!config.DRIVE_FOLDER_ID) missing.push('DRIVE_FOLDER_ID');

  if (missing.length > 0) {
    throw new Error(
      'スクリプトプロパティが未設定です: ' + missing.join(', ') +
      '\n設定方法: ファイル → プロジェクトの設定 → スクリプトプロパティ'
    );
  }

  if (!config.GEMINI_API_KEY) {
    Logger.log('注意: GEMINI_API_KEY が未設定 → AI構造化なしで動作します');
    Logger.log('Gemini APIキーは https://aistudio.google.com で無料取得できます');
  }
}

/**
 * 全設定を表示（デバッグ用、トークン値は伏せ字）
 */
function showConfig() {
  var config = getConfig_();
  Logger.log('=== 現在の設定 ===');
  Logger.log('NOTION_TOKEN:   ' + (config.NOTION_TOKEN ? '設定済み (' + config.NOTION_TOKEN.substring(0, 10) + '...)' : '未設定'));
  Logger.log('NOTION_PAGE_ID: ' + (config.NOTION_PAGE_ID || '未設定'));
  Logger.log('DRIVE_FOLDER_ID: ' + (config.DRIVE_FOLDER_ID || '未設定'));
  Logger.log('GEMINI_API_KEY: ' + (config.GEMINI_API_KEY ? '設定済み' : '未設定'));
  Logger.log('');
  Logger.log('処理済みファイル数: ' + getProcessedIds_().length);
}
