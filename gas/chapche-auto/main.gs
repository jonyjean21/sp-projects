/**
 * チャプ会議事録 自動検知 GAS
 *
 * Drive フォルダの新しい Gemini メモを検知 → Firebase キューに登録
 * 議事録の生成・Notion投稿は Claude Code 側で処理
 *
 * トリガー: 1時間おきの時間駆動トリガー
 */

const DRIVE_FOLDER_ID = '1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa';
const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const QUEUE_PATH = '/chapche-queue';

// ===== メイン処理 =====

/**
 * 定期実行: 新しい Gemini メモをチェックしてキューに登録
 */
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

    // 既にキューにあるかチェック
    if (isAlreadyQueued_(dateLabel)) {
      markAsProcessed_(id);
      continue;
    }

    // Firebase キューに登録
    const entry = {
      doc_id: id,
      file_name: name,
      date_label: dateLabel,
      year: year,
      month: month,
      day: day,
      export_url: `https://docs.google.com/document/d/${id}/export?format=txt`,
      status: 'pending',
      queued_at: new Date().toISOString()
    };

    const resp = UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}/${dateLabel}.json`, {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(entry),
      muteHttpExceptions: true
    });

    if (resp.getResponseCode() === 200) {
      markAsProcessed_(id);
      newCount++;
      Logger.log(`キュー登録: ${dateLabel} (${name})`);
    } else {
      Logger.log(`キュー登録失敗: ${resp.getContentText()}`);
    }
  }

  Logger.log(`完了: ${newCount}件の新規メモをキューに登録`);
}

// ===== Firebase チェック =====

function isAlreadyQueued_(dateLabel) {
  const resp = UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}/${dateLabel}.json`, {
    muteHttpExceptions: true
  });
  const data = JSON.parse(resp.getContentText());
  return data !== null;
}

// ===== 処理済みファイル管理 =====

function getProcessedIds_() {
  const prop = PropertiesService.getScriptProperties().getProperty('PROCESSED_IDS');
  return prop ? JSON.parse(prop) : [];
}

function markAsProcessed_(fileId) {
  const ids = getProcessedIds_();
  if (!ids.includes(fileId)) {
    ids.push(fileId);
    const trimmed = ids.slice(-100);
    PropertiesService.getScriptProperties().setProperty('PROCESSED_IDS', JSON.stringify(trimmed));
  }
}

// ===== セットアップ（初回1回だけ実行） =====

function setup() {
  // 既存トリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'checkNewTranscripts') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // 1時間おきのトリガーを作成
  ScriptApp.newTrigger('checkNewTranscripts')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('セットアップ完了: 1時間おきに checkNewTranscripts を実行');
}

/**
 * テスト: 手動で即座に実行
 */
function testRun() {
  checkNewTranscripts();
}

/**
 * リセット: 処理済みリストをクリア（再処理したい時）
 */
function resetProcessed() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_IDS');
  Logger.log('処理済みリストをクリアしました');
}
