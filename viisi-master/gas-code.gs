// ============================================================
// 5先王 Google Apps Script API
// Google Sheets をデータベースとして使い、
// アプリから試合・選手データを読み書きする
// ============================================================
// シート名: "試合" / "選手"
// デプロイ: ウェブアプリ → 実行: 自分 / アクセス: 全員
// ※ スタンドアロンスクリプトでもOK（自動でシートを作成）

// --- スプレッドシート取得（バウンド／スタンドアロン両対応） ---
function _getSpreadsheet() {
  // バウンドスクリプトならそのまま使う
  try {
    var ss = _getSpreadsheet();
    if (ss) return ss;
  } catch(e) {}

  // スタンドアロン: PropertiesServiceにシートIDを保存して再利用
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');

  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch(e) {
      // シートが削除された場合は新規作成へ
    }
  }

  // 新規スプレッドシートを作成
  var ss = SpreadsheetApp.create('5先王データ');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

// --- 自動セットアップ: シートが無ければ作成＆ヘッダー追加 ---
function _ensureSheets(ss) {
  var mSheet = ss.getSheetByName('試合');
  if (!mSheet) {
    mSheet = ss.insertSheet('試合');
    mSheet.getRange(1, 1, 1, 7).setValues([['date', 'challenger', 'defender', 'role', 'sc', 'sd', 'winner']]);
    mSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }
  var pSheet = ss.getSheetByName('選手');
  if (!pSheet) {
    pSheet = ss.insertSheet('選手');
    pSheet.getRange(1, 1, 1, 3).setValues([['name', 'x', 'role']]);
    pSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  // デフォルトの「シート1」があれば削除
  var defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  return { matchesSheet: mSheet, playersSheet: pSheet };
}

function doGet(e) {
  var ss = _getSpreadsheet();
  var sheets = _ensureSheets(ss);
  var matchesSheet = sheets.matchesSheet;
  var playersSheet = sheets.playersSheet;

  var matches = [];
  if (matchesSheet.getLastRow() > 1) {
    var data = matchesSheet.getRange(2, 1, matchesSheet.getLastRow() - 1, 7).getValues();
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var dateVal = row[0];
      var date;
      if (dateVal instanceof Date) {
        date = Utilities.formatDate(dateVal, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else {
        date = String(dateVal);
      }
      matches.push({
        date: date,
        challenger: String(row[1]),
        defender: String(row[2]),
        role: String(row[3]),
        sc: Number(row[4]),
        sd: Number(row[5]),
        winner: String(row[6])
      });
    }
  }

  var players = {};
  if (playersSheet.getLastRow() > 1) {
    var pData = playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 3).getValues();
    for (var j = 0; j < pData.length; j++) {
      var r = pData[j];
      var name = String(r[0]);
      if (name) {
        players[name] = { x: r[1] ? String(r[1]) : null, role: String(r[2] || 'challenger') };
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ matches: matches, players: players }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var ss = _getSpreadsheet();
    _ensureSheets(ss);
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    switch (action) {
      case 'addMatch':
        _addMatch(ss, data.match);
        break;

      case 'updateMatch':
        _updateMatch(ss, data.oldMatch, data.match);
        break;

      case 'deleteMatch':
        _deleteMatch(ss, data.match);
        break;

      case 'addPlayer':
        _addPlayer(ss, data.player);
        break;

      case 'updatePlayer':
        _updatePlayer(ss, data.originalName, data.player);
        break;

      case 'deletePlayer':
        _deletePlayer(ss, data.name);
        break;

      case 'bulkImport':
        _bulkImport(ss, data);
        break;

      case 'syncAll':
        _syncAll(ss, data);
        break;
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

// --- 試合 ---

function _addMatch(ss, m) {
  var sheet = ss.getSheetByName('試合');
  sheet.appendRow([m.date, m.challenger, m.defender, m.role, m.sc, m.sd, m.winner]);
}

function _updateMatch(ss, oldMatch, newMatch) {
  var sheet = ss.getSheetByName('試合');
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    var d = rows[i][0];
    var dateStr = (d instanceof Date) ? Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd') : String(d);
    if (dateStr === oldMatch.date && String(rows[i][1]) === oldMatch.challenger &&
        String(rows[i][2]) === oldMatch.defender && String(rows[i][3]) === oldMatch.role &&
        Number(rows[i][4]) === oldMatch.sc && Number(rows[i][5]) === oldMatch.sd) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[newMatch.date, newMatch.challenger, newMatch.defender, newMatch.role, newMatch.sc, newMatch.sd, newMatch.winner]]);
      break;
    }
  }
}

function _deleteMatch(ss, m) {
  var sheet = ss.getSheetByName('試合');
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    var d = rows[i][0];
    var dateStr = (d instanceof Date) ? Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd') : String(d);
    if (dateStr === m.date && String(rows[i][1]) === m.challenger &&
        String(rows[i][2]) === m.defender && String(rows[i][3]) === m.role &&
        Number(rows[i][4]) === m.sc && Number(rows[i][5]) === m.sd) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

// --- 選手 ---

function _addPlayer(ss, p) {
  var sheet = ss.getSheetByName('選手');
  sheet.appendRow([p.name, p.x || '', p.role || 'challenger']);
}

function _updatePlayer(ss, originalName, p) {
  var sheet = ss.getSheetByName('選手');
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === originalName) {
      sheet.getRange(i + 1, 1, 1, 3).setValues([[p.name, p.x || '', p.role || 'challenger']]);
      break;
    }
  }
}

function _deletePlayer(ss, name) {
  var sheet = ss.getSheetByName('選手');
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === name) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

// --- 一括インポート ---

function _bulkImport(ss, data) {
  if (data.matches && data.matches.length > 0) {
    var sheet = ss.getSheetByName('試合');
    var rows = [];
    for (var i = 0; i < data.matches.length; i++) {
      var m = data.matches[i];
      rows.push([m.date, m.challenger, m.defender, m.role, m.sc, m.sd, m.winner]);
    }
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
  if (data.players) {
    var pSheet = ss.getSheetByName('選手');
    var pRows = [];
    var names = Object.keys(data.players);
    for (var j = 0; j < names.length; j++) {
      var n = names[j];
      var p = data.players[n];
      pRows.push([n, p.x || '', p.role || 'challenger']);
    }
    if (pRows.length > 0) {
      pSheet.getRange(2, 1, pRows.length, 3).setValues(pRows);
    }
  }
}

// --- 全データ同期（Sheets のデータを完全上書き） ---

function _syncAll(ss, data) {
  // 試合シートをクリアして書き直し
  var mSheet = ss.getSheetByName('試合');
  if (mSheet.getLastRow() > 1) {
    mSheet.getRange(2, 1, mSheet.getLastRow() - 1, 7).clearContent();
  }
  if (data.matches && data.matches.length > 0) {
    var mRows = [];
    for (var i = 0; i < data.matches.length; i++) {
      var m = data.matches[i];
      mRows.push([m.date, m.challenger, m.defender, m.role, m.sc, m.sd, m.winner]);
    }
    mSheet.getRange(2, 1, mRows.length, 7).setValues(mRows);
  }

  // 選手シートをクリアして書き直し
  var pSheet = ss.getSheetByName('選手');
  if (pSheet.getLastRow() > 1) {
    pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 3).clearContent();
  }
  if (data.players) {
    var pRows = [];
    var names = Object.keys(data.players);
    for (var j = 0; j < names.length; j++) {
      var n = names[j];
      var p = data.players[n];
      pRows.push([n, p.x || '', p.role || 'challenger']);
    }
    if (pRows.length > 0) {
      pSheet.getRange(2, 1, pRows.length, 3).setValues(pRows);
    }
  }
}
