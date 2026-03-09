/**
 * 寄稿原稿コレクター
 * Google Drive 指定フォルダを監視 → Firebase /contribution-queue に push
 * 処理済みファイルは「処理済み」サブフォルダに移動
 *
 * セットアップ:
 *   1. DRIVE_FOLDER_ID に監視対象フォルダのIDを設定
 *   2. createTrigger() を1回実行してトリガー登録
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const QUEUE_PATH = '/contribution-queue';
const LOG_PATH = '/contribution-collector-log';

// ★ ここにGoogle DriveフォルダIDを設定
const DRIVE_FOLDER_ID = '1yR_TEf-y21lh_2c6aS6BAWxR2JnuKSPq';

/**
 * メイン処理: フォルダ内の新規ファイルを検出してキューに追加
 */
function checkContributions() {
  const startTime = new Date();
  let newCount = 0;
  let skipped = 0;

  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const processedFolder = getOrCreateSubfolder_(folder, '処理済み');
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      const mimeType = file.getMimeType();

      // 対応形式: Google Docs, .md, .txt, .docx
      const supportedTypes = [
        'application/vnd.google-apps.document',
        'text/markdown',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/octet-stream' // .md がこれで来ることがある
      ];

      if (!supportedTypes.includes(mimeType) && !fileName.match(/\.(md|txt|docx)$/i)) {
        skipped++;
        continue;
      }

      // ファイル名から寄稿者とVol番号を推定
      const parsed = parseFileName_(fileName);

      // テキスト内容を抽出
      const content = extractText_(file, mimeType);
      if (!content || content.trim().length < 50) {
        skipped++;
        Logger.log(`スキップ（内容が短すぎ）: ${fileName}`);
        continue;
      }

      // Firebase キューに追加
      pushToQueue_({
        filename: fileName,
        author: parsed.author,
        vol: parsed.vol,
        drive_file_id: file.getId(),
        drive_url: file.getUrl(),
        content_preview: content.substring(0, 500),
        content_length: content.length,
        mime_type: mimeType,
        has_images: content.includes('![') || content.includes('[image'),
        timestamp: new Date().toISOString(),
        status: 'pending'
      });

      // 処理済みフォルダに移動
      processedFolder.addFile(file);
      folder.removeFile(file);
      newCount++;
      Logger.log(`キュー追加: ${fileName} (${parsed.author} vol${parsed.vol})`);
    }
  } catch (e) {
    Logger.log(`エラー: ${e.message}`);
    writeLog_({ timestamp: startTime.toISOString(), error: e.message });
    return;
  }

  const durationSec = Math.round((new Date() - startTime) / 1000);

  if (newCount > 0 || skipped > 0) {
    writeLog_({
      timestamp: startTime.toISOString(),
      durationSec: durationSec,
      newCount: newCount,
      skipped: skipped
    });
  }

  Logger.log(`完了: ${newCount}件キュー追加, ${skipped}件スキップ (${durationSec}秒)`);
}

/**
 * ファイル名から寄稿者名とVol番号を推定
 * 例: "老師_vol2.md" → { author: "老師", vol: 2 }
 *      "老師盃原稿.md" → { author: "老師盃原稿", vol: null }
 */
function parseFileName_(fileName) {
  // 拡張子を除去
  const name = fileName.replace(/\.(md|txt|docx|gdoc)$/i, '');

  // パターン1: {名前}_vol{N} or {名前}_Vol{N}
  const volMatch = name.match(/^(.+?)_[Vv]ol\.?(\d+)$/);
  if (volMatch) {
    return { author: volMatch[1].trim(), vol: parseInt(volMatch[2]) };
  }

  // パターン2: {名前}_{N}
  const numMatch = name.match(/^(.+?)_(\d+)$/);
  if (numMatch) {
    return { author: numMatch[1].trim(), vol: parseInt(numMatch[2]) };
  }

  // パターン3: 名前のみ
  return { author: name.trim(), vol: null };
}

/**
 * ファイルからテキストを抽出
 */
function extractText_(file, mimeType) {
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      // Google Docs → マークダウンとしてエクスポート
      const doc = DocumentApp.openById(file.getId());
      return doc.getBody().getText();
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // .docx → Google Docs に変換してテキスト取得
      const tempDoc = Drive.Files.copy(
        { title: '_temp_convert', mimeType: 'application/vnd.google-apps.document' },
        file.getId()
      );
      const doc = DocumentApp.openById(tempDoc.id);
      const text = doc.getBody().getText();
      DriveApp.getFileById(tempDoc.id).setTrashed(true);
      return text;
    }

    // .md, .txt → そのまま読む
    return file.getBlob().getDataAsString('UTF-8');
  } catch (e) {
    Logger.log(`テキスト抽出エラー (${file.getName()}): ${e.message}`);
    return null;
  }
}

/**
 * サブフォルダを取得（なければ作成）
 */
function getOrCreateSubfolder_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parentFolder.createFolder(name);
}

/**
 * Firebase キューに追加
 */
function pushToQueue_(payload) {
  UrlFetchApp.fetch(`${FIREBASE_URL}${QUEUE_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * 実行ログをFirebaseに記録
 */
function writeLog_(logEntry) {
  UrlFetchApp.fetch(`${FIREBASE_URL}${LOG_PATH}.json`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(logEntry),
    muteHttpExceptions: true
  });
}

// === トリガー管理 ===

/**
 * 1時間おきに実行するトリガーを作成（1回だけ実行）
 */
function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkContributions') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('checkContributions')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('トリガー作成完了: 1時間おきに checkContributions を実行');
}

/**
 * テスト実行
 */
function testRun() {
  Logger.log('=== テスト実行開始 ===');
  checkContributions();
  Logger.log('=== テスト実行完了 ===');
}
