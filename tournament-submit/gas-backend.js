/**
 * 大会情報URL受付 — Google Apps Script バックエンド
 *
 * 【セットアップ手順】
 * 1. Google Apps Script (https://script.google.com/) で新規プロジェクト作成
 * 2. このコードをコピペ
 * 3. SHEET_ID を自分のスプレッドシートIDに変更
 * 4. デプロイ → ウェブアプリ → アクセス: 全員 → デプロイ
 * 5. 表示されるURLを tournament-submit/index.html の QUEUE_SHEET_URL に設定
 */

// ===== 設定 =====
// Script Properties に以下を設定:
//   SHEET_ID  — URLキュー用スプレッドシートのID
//   WP_SITE   — https://molkky-hub.com
//   WP_USER   — WPアプリケーションパスワードのユーザー名
//   WP_PASS   — WPアプリケーションパスワード
//
// 設定方法: GASエディタ → プロジェクトの設定 → スクリプトプロパティ
const props = PropertiesService.getScriptProperties();
const SHEET_ID = props.getProperty('SHEET_ID');
const SHEET_NAME = 'queue';
const WP_SITE = props.getProperty('WP_SITE');
const WP_USER = props.getProperty('WP_USER');
const WP_PASS = props.getProperty('WP_PASS');

// エリアマッピング（都道府県名 → taxonomy ID）
const AREA_MAP = {
  '北海道': 58, '青森': 69, '岩手': 70, '宮城': 71, '秋田': 72,
  '山形': 73, '福島': 74, '茨城': 75, '栃木': 76, '群馬': 77,
  '埼玉': 78, '千葉': 79, '東京': 80, '神奈川': 81, '山梨': 82,
  '新潟': 83, '長野': 84, '富山': 85, '石川': 86, '福井': 87,
  '岐阜': 88, '静岡': 89, '愛知': 90, '三重': 91, '滋賀': 92,
  '京都': 93, '大阪': 94, '兵庫': 95, '奈良': 96, '和歌山': 97,
  '鳥取': 98, '島根': 99, '岡山': 100, '広島': 101, '山口': 102,
  '徳島': 103, '香川': 104, '愛媛': 105, '高知': 106, '福岡': 107,
  '佐賀': 108, '長崎': 109, '熊本': 110, '大分': 111, '宮崎': 112,
  '鹿児島': 113, '沖縄': 114
};

// ===== Webhook受信 =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const url = data.url;
    const timestamp = data.timestamp || new Date().toISOString();

    if (!url) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'URL is required' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // キューに追加
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      // シートがなければ作成
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const newSheet = ss.insertSheet(SHEET_NAME);
      newSheet.appendRow(['timestamp', 'url', 'status', 'processed_at', 'post_id', 'error']);
      newSheet.appendRow([timestamp, url, 'pending', '', '', '']);
    } else {
      sheet.appendRow([timestamp, url, 'pending', '', '', '']);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Tournament URL Queue API is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ===== ツイート情報取得 =====
function fetchTweetData(tweetUrl) {
  const match = tweetUrl.match(/status\/(\d+)/);
  if (!match) return null;
  const tweetId = match[1];

  try {
    const resp = UrlFetchApp.fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=x`,
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return null;
    return JSON.parse(resp.getContentText());
  } catch (e) {
    return null;
  }
}

// ===== テキストから大会情報を抽出（ルールベース） =====
function extractTournamentInfo(tweetData, originalUrl) {
  const text = tweetData.text || '';
  const info = {
    post_title: '',
    event_date: '',
    location: '',
    organizer: tweetData.user ? tweetData.user.name : '',
    sns_link: originalUrl,
    detail_link: '',
    scale: '',
    beginner_friendly: false,
    official: false
  };

  // 詳細リンク（Google Forms, molkky.jp等）
  const urls = (tweetData.entities && tweetData.entities.urls) || [];
  for (const u of urls) {
    const expanded = u.expanded_url || '';
    if (expanded.includes('forms.gle') || expanded.includes('google.com/forms') ||
        expanded.includes('molkky.jp') || expanded.includes('docs.google.com')) {
      info.detail_link = expanded;
      break;
    }
  }
  // フォールバック: 最初のURLを詳細リンクにする
  if (!info.detail_link && urls.length > 0) {
    info.detail_link = urls[0].expanded_url || '';
  }

  // 日付パターン検出
  const datePatterns = [
    /(\d{4})\s*[年\/.-]\s*(\d{1,2})\s*[月\/.-]\s*(\d{1,2})/,
    /(\d{1,2})\s*月\s*(\d{1,2})\s*日/
  ];
  for (const pattern of datePatterns) {
    const m = text.match(pattern);
    if (m) {
      if (m.length === 4) {
        // YYYY年MM月DD日
        info.event_date = m[1] + String(m[2]).padStart(2, '0') + String(m[3]).padStart(2, '0');
      } else if (m.length === 3) {
        // M月D日（年は推測）
        const year = new Date().getFullYear();
        const month = parseInt(m[1]);
        const guessYear = month < new Date().getMonth() + 1 ? year + 1 : year;
        info.event_date = String(guessYear) + String(m[1]).padStart(2, '0') + String(m[2]).padStart(2, '0');
      }
      break;
    }
  }

  // 都道府県検出
  const prefectures = Object.keys(AREA_MAP);
  // ハッシュタグから
  const hashtags = text.match(/#[^\s#]+/g) || [];
  for (const tag of hashtags) {
    for (const pref of prefectures) {
      if (tag.includes(pref)) {
        info.location = pref;
        break;
      }
    }
    if (info.location) break;
  }
  // 本文から
  if (!info.location) {
    for (const pref of prefectures) {
      if (text.includes(pref)) {
        info.location = pref;
        break;
      }
    }
  }

  // 大会名（最初の行 or 「」内のテキスト）
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    // 【】内のタイトル
    const bracketMatch = text.match(/【([^】]+)】/);
    // 「第N回」パターン
    const numMatch = text.match(/(第\d+回[^\n]+)/);
    // 大会名パターン
    const cupMatch = text.match(/([^\n]*(?:カップ|杯|大会|オープン|チャレンジ|リーグ|バトル|グランプリ)[^\n]*)/);

    if (numMatch) {
      info.post_title = numMatch[1].replace(/#\S+/g, '').trim();
    } else if (cupMatch) {
      info.post_title = cupMatch[1].replace(/#\S+/g, '').trim();
    } else if (bracketMatch) {
      info.post_title = bracketMatch[1];
    } else {
      info.post_title = lines[0].replace(/#\S+/g, '').trim();
    }
  }

  // 規模
  const scaleMatch = text.match(/(\d+)\s*(?:チーム|組|人)/);
  if (scaleMatch) {
    info.scale = scaleMatch[0];
  }

  // 初心者歓迎
  if (/初心者|ビギナー|beginner/i.test(text)) {
    info.beginner_friendly = true;
  }

  // 公式大会（JMA主催）
  if (/日本モルック協会|JMA/.test(text) || /molkky_japan/i.test(tweetData.user?.screen_name || '')) {
    info.official = true;
  }

  return info;
}

// ===== WPに投稿 =====
function postToWordPress(info) {
  const areaId = AREA_MAP[info.location];

  const payload = {
    title: info.post_title,
    status: 'draft', // まず下書きで作成（確認後に公開）
    acf: {
      event_date: info.event_date,
      location: info.location,
      organizer: info.organizer,
      sns_link: info.sns_link,
      detail_link: info.detail_link,
      scale: info.scale,
      beginner_friendly: info.beginner_friendly,
      official: info.official
    }
  };

  if (areaId) {
    payload.area = [areaId];
  }

  const resp = UrlFetchApp.fetch(`${WP_SITE}/wp-json/wp/v2/tournament`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(WP_USER + ':' + WP_PASS)
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const result = JSON.parse(resp.getContentText());
  return {
    success: resp.getResponseCode() === 201,
    post_id: result.id,
    error: resp.getResponseCode() !== 201 ? result.message : null
  };
}

// ===== キュー処理（手動実行 or タイマートリガー） =====
function processQueue() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  let processed = 0;

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] !== 'pending') continue;

    const url = data[i][1];
    const row = i + 1;

    try {
      // ツイートの場合
      if (url.includes('x.com/') || url.includes('twitter.com/')) {
        const tweetData = fetchTweetData(url);
        if (!tweetData) {
          sheet.getRange(row, 3).setValue('error');
          sheet.getRange(row, 6).setValue('ツイート取得失敗');
          continue;
        }

        const info = extractTournamentInfo(tweetData, url);
        if (!info.post_title || !info.event_date) {
          sheet.getRange(row, 3).setValue('needs_review');
          sheet.getRange(row, 6).setValue('タイトルまたは日付が取得できませんでした');
          continue;
        }

        const result = postToWordPress(info);
        if (result.success) {
          sheet.getRange(row, 3).setValue('posted');
          sheet.getRange(row, 4).setValue(new Date().toISOString());
          sheet.getRange(row, 5).setValue(result.post_id);
        } else {
          sheet.getRange(row, 3).setValue('error');
          sheet.getRange(row, 6).setValue(result.error);
        }
      } else {
        // ウェブページの場合は手動確認が必要
        sheet.getRange(row, 3).setValue('needs_review');
        sheet.getRange(row, 6).setValue('ウェブページURL: 手動確認が必要');
      }

      processed++;
    } catch (e) {
      sheet.getRange(row, 3).setValue('error');
      sheet.getRange(row, 6).setValue(e.message);
    }
  }

  Logger.log(`Processed ${processed} URLs`);
}

// ===== ステータスチェック（最新のキュー状態を返す） =====
function getQueueStatus() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) return { total: 0, pending: 0 };

  const data = sheet.getDataRange().getValues();
  const stats = { total: data.length - 1, pending: 0, posted: 0, error: 0, needs_review: 0 };

  for (let i = 1; i < data.length; i++) {
    const s = data[i][2];
    if (stats[s] !== undefined) stats[s]++;
  }

  return stats;
}
