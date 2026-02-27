# ナイモル大会結果スキル

## 概要
主催者から受け取ったスプレッドシートから大会結果データを取得し、
WordPress の結果ページを自動生成・投稿する。
Ninja Tables プラグインを使わず、HTMLテーブルで全順位表を描画する。
チーム情報スプシと紐づけて参加チーム一覧も生成する。

## 使い方
- `/naimol-result <結果スプシURL> <チーム情報スプシURL>` — 結果ページを生成・投稿
- `/naimol-result <結果スプシURL>` — チーム情報なしで結果のみ投稿

## 処理フロー

### Step 1: スプシをxlsxでダウンロード＆解析

数式の計算結果を確実に取得するため、xlsx形式でエクスポートする。

```bash
# 結果スプシ
RESULT_SHEET_ID=$(echo "$RESULT_URL" | grep -o '/d/[a-zA-Z0-9_-]*' | sed 's|/d/||')
curl -sL "https://docs.google.com/spreadsheets/d/$RESULT_SHEET_ID/export?format=xlsx" -o /tmp/naimol_results.xlsx

# チーム情報スプシ（任意）
TEAM_SHEET_ID=$(echo "$TEAM_URL" | grep -o '/d/[a-zA-Z0-9_-]*' | sed 's|/d/||')
curl -sL "https://docs.google.com/spreadsheets/d/$TEAM_SHEET_ID/export?format=xlsx" -o /tmp/naimol_teams.xlsx
```

python3 + openpyxl で以下を抽出:

#### 総合結果シート（行4〜）
```python
import openpyxl
wb = openpyxl.load_workbook('/tmp/naimol_results.xlsx', data_only=True)
ws = wb['総合結果']
# col B=順位, C=チーム名(番号付き), D=参加pt, E=予選, F=決勝, G=ボーナス, H=PM, I=合計
```

#### パーフェクトモルック賞シート（行4〜）
```python
ws_pm = wb['パーフェクトモルック賞']
# col B=チーム名, C=達成試合（例: 予選リーグ第1試合）
```

#### チーム情報スプシ
```python
wb_team = openpyxl.load_workbook('/tmp/naimol_teams.xlsx', data_only=True)
ws_team = wb_team.active  # or wb_team[wb_team.sheetnames[0]]
# col A=番号, B=チーム名, C=メンバー1名, D=ID, F=メンバー2名, ...
# col P=掲載可否（掲載可能/掲載不可）, R=拠点, U=SNS, V=一言
```

### Step 2: データ整形

チーム名の番号プレフィックスを分離:
```python
# "11_GriGo軍団" → number=11, name="GriGo軍団"
parts = team_name.split('_', 1)
number = int(parts[0])
name = parts[1] if len(parts) > 1 else parts[0]
```

チーム番号をキーにして、結果データとチーム情報をマージ。
掲載不可チームはチーム一覧から除外（順位表には表示する）。

### Step 3: 大会ページ特定

```bash
WP_USER=$(grep '^WP_USER=' /Users/shumpei/sp-projects/.env | cut -d= -f2)
WP_APP_PASSWORD=$(grep '^WP_APP_PASSWORD=' /Users/shumpei/sp-projects/.env | cut -d= -f2-)

# 大会スラッグで親ページ検索（parent=484がナイモルトップ）
curl -s "https://molkky-hub.com/wp-json/wp/v2/pages?slug=$EVENT_SLUG&parent=484" \
  -u "$WP_USER:$WP_APP_PASSWORD"

# 既存resultページ確認
curl -s "https://molkky-hub.com/wp-json/wp/v2/pages?slug=result&parent=$PARENT_ID" \
  -u "$WP_USER:$WP_APP_PASSWORD"
```

大会スラッグが不明な場合、AskUserQuestionで確認。
既存の大会一覧:
- naimol_minatomirai_20260215（ID 5355）
- nice_molkky_5（ID 3179）
- nice_molkky_beginners_3（ID 2781）
- nice_molkky_beginners_2（ID 1463）
- nice_molkky_beginners_1（ID 486）

### Step 4: ユーザー確認

AskUserQuestionで以下を確認:
- 読み込みデータのサマリー（チーム数、上位チーム、PM件数）
- 写真URL（任意。ローカルファイルパスならWPメディアにアップロード）
- 大会スラッグ（自動検出できない場合）
- 投稿確認（publish / draft）

### Step 5: HTML生成

WPブロックエディタ形式（`<!-- wp:html -->`等）で生成。
各セクションのHTML/CSSは既存結果ページ（ID 3941等）のスタイルを踏襲。

セクション構成:
1. 冒頭テキスト
2. 大会成績（上位4チーム表彰台 + 写真モーダル）
3. 全順位表（HTMLテーブル、インラインCSS）
4. パーフェクトモルック賞
5. 参加チーム一覧（掲載可能チームのみ）
6. ギャラリーリンク（存在する場合）

### Step 6: WP REST API 投稿

```bash
# 新規作成
curl -s -X POST "https://molkky-hub.com/wp-json/wp/v2/pages" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"title":"大会結果","slug":"result","status":"publish","parent":'$PARENT_ID',"content":"..."}'

# 既存更新
curl -s -X PUT "https://molkky-hub.com/wp-json/wp/v2/pages/$RESULT_PAGE_ID" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"content":"...","status":"publish"}'
```

### Step 7: 完了報告

```
✅ 結果ページ投稿完了！
  ページID: XXXX
  URL: https://molkky-hub.com/nice_molkky_japan_details/{slug}/result/
  チーム数: XX（掲載可能: XX）
  PM賞: XX件
```

## 注意事項
- WP認証情報は `.env` から読み取る（ハードコードしない）
- 掲載不可チームは順位表には表示、参加チーム一覧からは除外
- チーム名の番号プレフィックスは表示時に除去する
- 写真はWPメディアURLまたはローカルファイルパスを受け付ける
- ローカルファイルの場合: `curl -F "file=@path" -u "$WP_USER:$WP_APP_PASSWORD" https://molkky-hub.com/wp-json/wp/v2/media`
