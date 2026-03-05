# MOLKKY HUB Portal 改善計画書

**対象**: `molkky-portal/index.html`
**URL**: https://jonyjean21.github.io/sp-projects/molkky-portal/
**作成日**: 2026-03-05
**担当**: SP + Claude Code

---

## 目次

1. [現状サマリー](#1-現状サマリー)
2. [問題一覧と優先度](#2-問題一覧と優先度)
3. [各課題の原因分析と実装方針](#3-各課題の原因分析と実装方針)
4. [バージョンロードマップ](#4-バージョンロードマップ)
5. [技術調査メモ](#5-技術調査メモ)

---

## 1. 現状サマリー

MOLKKY HUB Portal は SP Portal から分離された独立ポータルで、以下の機能を持つ:

- **Dashboard**: セッション/PV/記事数/大会数/パートナー数、月次目標、トラフィック推移、SNS
- **記事管理**: WP記事一覧（フィルタ/ページネーション）、下書き作成
- **Xポスト生成**: Promote（記事宣伝）/ Repost（引用リポスト）の Gemini 生成
- **大会管理**: WP大会一覧 + Firebase キュー、バリデーション、手動追加、フィルタ/タブ
- **トラフィック**: GA4 データ（GAS 経由）、流入元内訳、人気ページ
- **Search Console**: クリック/表示/順位推移、クエリ TOP10
- **パートナー管理**: Firebase からパートナー一覧取得
- **自動化パイプライン**: 大会収集/議事録/Xポストの各パイプライン状態表示
- **設定**: WP認証、GAS Endpoint、データ管理

**データソース**: WP REST API / Firebase RTDB / GAS Web App / Vercel Proxy (Gemini, Tweet)

現在の構成は 1 ファイル (1,803 行) の SPA。全セクションが遅延読み込み（`lazyLoad`）で設計されているが、Dashboard の初回読み込みで WP API + Firebase + GAS API の 3 系統を逐次/並列で呼び出しており、体感速度に問題がある。

---

## 2. 問題一覧と優先度

| # | 問題 | 優先度 | 影響範囲 |
|---|------|--------|----------|
| 1 | 大会管理で「要確認」が 501 件 — 都道府県が全部消えている | **P0** | 大会管理の信頼性崩壊 |
| 2 | WP 未認証 — 初回訪問時の認証フローが動かない | **P0** | 記事管理・大会投稿が全滅 |
| 3 | ダッシュボード読み込みが遅い | **P1** | UX 全体 |
| 4 | スマホで一番下まで見えない | **P1** | モバイル UX |
| 5 | 手動修正 UI が不便（詳細クリックで最下部にスクロール） | **P1** | 大会管理の運用効率 |
| 6 | ソース画像が読み込めない | **P1** | 大会管理のソース確認 |
| 7 | トラフィック/SC に示唆がない | **P2** | 分析→アクションの接続 |
| 8 | 自動化パイプライン全体像の可視化 | **P2** | 運用理解・オンボーディング |

---

## 3. 各課題の原因分析と実装方針

### 3.1 [P0] 大会管理の都道府県が全消失（501 件「要確認」）

#### 現象
- 「要確認」タブに 501 件表示
- バリデーション `validateTournament()` が `!t.area && !t.area_id` で警告を出している
- つまり `normalizeTournament()` の `areaIds` が空配列を返している

#### 原因仮説（3 つ）

**仮説 A: `_fields` フィルタで `tournament_area` が除外されている（可能性: 中）**

現在の WP API リクエスト:
```
/tournament?per_page=100&_fields=id,title,date,status,acf,link,tournament_area
```
`_fields` パラメータに `tournament_area` を含めているが、WP REST API のカスタム taxonomy フィールドは `_fields` で明示的に指定しても、プラグインの実装次第では返されないことがある。特に ACF がフィルタを上書きしている場合。

**検証方法**: ブラウザで `/wp-json/wp/v2/tournament?per_page=1` を叩いて `tournament_area` フィールドが返るか確認。`_fields` なしで叩いたときと比較する。

**仮説 B: AREAS マッピングの ID ズレ（可能性: 高）**

コード内の `AREAS` マッピング:
```javascript
const AREAS = {
  '北海道':{id:43}, '青森県':{id:44}, ... '沖縄県':{id:89}
};
```
ID 範囲: **43-89**

ユーザーフィードバックでは「都道府県 ID: 58-114」とのこと。

この差分が事実なら、WP 側の taxonomy term ID と `AREAS` 定数が完全にズレている。`AREA_BY_ID` の逆引きが一件もヒットせず、全件 `area: ''` になる。

**検証方法**: `/wp-json/wp/v2/tournament_area?per_page=100` を叩いて実際の term ID を確認する。

**仮説 C: `tournament_area` が taxonomy ではなく ACF フィールド（可能性: 低）**

もし `area` が ACF のセレクトフィールドとして実装されていた場合、`t.tournament_area` ではなく `t.acf.area` に値が入る。ただし `normalizeTournament()` で `t.tournament_area` を参照しているので、ACF 側にあればここで空になる。

#### 実装方針

1. **WP API で `/wp-json/wp/v2/tournament_area?per_page=100` を叩き、実際の term 一覧を取得**
2. term ID と `AREAS` 定数を突き合わせ、ズレを修正
3. ポータル初期化時に taxonomy 一覧を動的取得するよう変更（ハードコードの廃止）:
   ```javascript
   // 起動時に1回だけ取得
   async function loadAreaTaxonomy() {
     const res = await fetch(WP_API + '/tournament_area?per_page=100&_fields=id,name');
     const data = await res.json();
     data.forEach(term => { AREA_BY_ID[term.id] = term.name; });
   }
   ```
4. `_fields` から `tournament_area` を外してフル応答にするか、`_embed` を使って taxonomy データを含める

---

### 3.2 [P0] WP 未認証 — 初回認証フローの不具合

#### 現象
- 初回訪問時に認証モーダルが表示されない、または認証が通らない

#### 原因分析

`restoreAuth()` のフロー:
```javascript
function restoreAuth() {
  const keys = ['portal_auth','molkky_admin_auth','naimol_auth'];
  for(const k of keys) {
    const s = localStorage.getItem(k);
    if(s) { /* JSON.parse → wpAuth 設定 → verifyWp() → return */ }
  }
  showAuthModal();  // ← ここに到達しないケース？
}
```

問題の可能性:
1. **localStorage に壊れたデータが残っている**: `JSON.parse` が成功するが `user` や `pass` が空文字列 → `wpAuth = btoa(':')` → `verifyWp()` で 401 → `connStatus` に「接続失敗」表示だが、モーダルは出ない
2. **別ポータルの古い認証情報を流用**: `molkky_admin_auth` や `naimol_auth` に古いデータがある → 認証失敗するが再ログインを促さない
3. **`verifyWp()` が失敗しても `showAuthModal()` を呼ばない**: 現在の実装では verify 失敗時にステータス表示を変えるだけで、再認証モーダルは出さない

#### 実装方針

1. `verifyWp()` 失敗時に `showAuthModal()` を呼び出す
2. localStorage の認証データが不完全な場合（user/pass が空）はスキップする
3. 認証モーダルに「接続テスト中...」のフィードバック表示を追加

```javascript
async function verifyWp() {
  try {
    await wpFetch('/wp-json/wp/v2/posts?per_page=1');
    document.getElementById('connStatus').innerHTML = '...OK';
  } catch(e) {
    document.getElementById('connStatus').innerHTML = '...失敗';
    wpAuth = '';
    showAuthModal();  // ← ここを追加
  }
}
```

---

### 3.3 [P1] ダッシュボード読み込みが遅い

#### 現象
- ページ表示後、Dashboard のデータが揃うまで数秒かかる
- スピナーが複数箇所で回り続ける

#### 原因分析

`loadDashboard()` の呼び出しフロー:
1. `Promise.all([WP posts count, WP tournament count])` — WP API 2 リクエスト (並列)
2. `db.ref('tournament-queue').orderByChild('status').equalTo('pending')` — Firebase
3. `db.ref('partner/config/partners')` — Firebase
4. `await loadAnalyticsData()` — GAS API（逐次、最も遅い）
5. `renderSNS()`, `renderGoals()` — localStorage のみ

問題点:
- **GAS API が最大ボトルネック** — Google Apps Script の Cold Start があると 3-5 秒かかる
- **Firebase は逐次呼び出し** — tournament-queue → partner が直列

#### 実装方針

**フェーズ 1: 並列化**
```javascript
async function loadDashboard() {
  // 全部並列で発射
  const [wpResult, queueSnap, partnerSnap, _] = await Promise.all([
    Promise.all([
      fetch(WP_API+'/posts?per_page=1&_fields=id'),
      fetch(WP_API+'/tournament?per_page=1&_fields=id')
    ]),
    db.ref('tournament-queue').orderByChild('status').equalTo('pending').once('value'),
    db.ref('partner/config/partners').once('value'),
    loadAnalyticsData()  // GAS も並列
  ]);
  // 各結果を即座に反映
}
```

**フェーズ 2: キャッシュ**
- GAS データを `sessionStorage` にキャッシュ（有効期限: 30 分）
- WP 記事数/大会数も同様にキャッシュ
- 「最終更新: xx分前」の表示を追加
- 手動「更新」ボタンでキャッシュ破棄

**フェーズ 3: スケルトン UI**
- データ取得前にスケルトン（灰色のプレースホルダ）を表示
- 各セクションが取得完了次第、個別に差し替え（プログレッシブレンダリング）

---

### 3.4 [P1] スマホで一番下まで見えない

#### 現象
- モバイルで下方のカード/セクションに到達できない
- スクロールが途中で止まる

#### 原因分析

```css
body { overflow: hidden; }  /* ← body レベルでスクロール禁止 */
.app { height: 100vh; }
.main-body { flex: 1; overflow-y: auto; }  /* ← ここでスクロール */
```

`.main-body` に `overflow-y: auto` があるが、`flex: 1` の計算が正しくない可能性:
- iOS Safari の `100vh` は URL バーを含む高さ → `.main-body` の実際の高さが画面より大きくなり、下部がはみ出す
- `.main-body` 自体のスクロールは動くが、iOS のバウンスとの干渉でスクロールが止まることがある

#### 実装方針

1. **`100vh` を `100dvh` に変更** — Dynamic Viewport Height で iOS の URL バー問題を解決
2. **`-webkit-overflow-scrolling: touch` の追加** — iOS での慣性スクロールを確保
3. **フォールバック**: `window.innerHeight` を使った JS 計算

```css
.app { height: 100vh; height: 100dvh; }  /* dvh 優先、非対応ブラウザは vh */
.main-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom, 20px);  /* ノッチ対応 */
}
```

追加で、モバイルの `@media` ブロックに:
```css
@media(max-width:768px) {
  .main-body { padding-bottom: 40px; }  /* 下部余白を確保 */
}
```

---

### 3.5 [P1] 手動修正 UI が不便（詳細パネル問題）

#### 現象
- 大会カードをクリック → `tShowDetail()` → 詳細パネルが `#tDetail` に挿入 → `el.scrollIntoView()` で最下部にスクロール
- 元のカードリストから離れてしまい、修正後に戻るのが面倒

#### 原因分析

```javascript
function tShowDetail(key) {
  // ...
  el.innerHTML = `<div class="detail-panel">...</div>`;
  el.style.display = 'block';
  el.scrollIntoView({behavior:'smooth',block:'start'});  // ← 最下部へ
}
```

`#tDetail` はページの最下部（フィルタ→リスト→ページャーの下）に配置されている。

#### 実装方針

**方針 A: モーダル/オーバーレイ方式（推奨）**
- クリックしたカードの詳細をモーダルで表示
- 背景のリストは維持されるので、閉じたらすぐ次のカードに移れる
- スマホでも全画面モーダルで快適に操作可能

**方針 B: インライン展開**
- クリックしたカード直下に詳細パネルを挿入（アコーディオン方式）
- 別のカードをクリックしたら前のパネルを閉じて新しいカードの下に展開
- スクロール位置がほとんど動かない

**実装優先**: 方針 A（モーダル）

```html
<!-- 新しい大会詳細モーダル -->
<div class="modal-overlay" id="tDetailModal" style="display:none">
  <div class="modal-box" style="max-width:600px;max-height:85vh;overflow-y:auto">
    <div id="tDetailContent"></div>
  </div>
</div>
```

---

### 3.6 [P1] ソース画像が読み込めない

#### 現象
- 大会詳細の「ソース情報」セクションで画像が表示されない
- `source_images` が空配列か、URL が壊れている

#### 原因分析

画像データの流れ:
1. **IFTTT** が X のキーワード検知 → Firebase `/tournament-queue` にデータ投入
2. IFTTT の Webhook Body に画像 URL を含める設定が必要
3. **Firebase queue** の `images` フィールドに格納
4. **ポータル** の `loadFirebaseQueue()` で `val.images || []` として取得
5. WP 投稿後は `acf.source_images` に保存

問題点:
- **IFTTT の Webhook 設定で画像フィールドが含まれていない可能性が高い**
- IFTTT の X トリガーでは `{{ImageUrl1}}`, `{{ImageUrl2}}` 等のフィールドが利用可能だが、Body テンプレートに含めていないと送信されない
- X の画像 URL は `pbs.twimg.com` ドメインで提供されるが、CORS 制限なし（img タグでは表示可能）

#### 実装方針

1. **IFTTT Webhook Body テンプレートの確認・修正**
   - 現在の Body に `"images": ["{{ImageUrl1}}", "{{ImageUrl2}}", "{{ImageUrl3}}", "{{ImageUrl4}}"]` を追加
   - 空文字列のフィルタリング処理を追加

2. **既存データの対応**
   - Firebase queue の既存エントリにはもう画像データがないため、元の X ポスト URL から再取得する方法を検討
   - FxTwitter API (`api.fxtwitter.com`) を使えばツイートの画像 URL を取得可能:
     ```
     https://api.fxtwitter.com/status/{tweet_id}
     ```
   - ソース URL が X のポスト URL の場合、詳細表示時に FxTwitter API から画像を動的取得するオプションを追加

3. **画像読み込みエラーのハンドリング**
   - `<img>` タグに `onerror` ハンドラを追加してプレースホルダに差し替え:
     ```javascript
     srcHtml += `<img class="source-img" src="${url}" onerror="this.style.display='none'" ...>`;
     ```

---

### 3.7 [P2] トラフィック/SC に示唆がない

#### 現象
- データは表示されるが「だから何をすべきか」が分からない
- 数値の上下は見えるが、具体的なアクション提案がない

#### 実装方針

**「示唆カード」の追加**

トラフィックセクションと SC セクションに、データに基づく自動アドバイスを表示:

```javascript
function generateInsights(data) {
  const insights = [];
  const latest = data.traffic.months.at(-1);
  const prev = data.traffic.months.at(-2);

  // セッション変動
  if (prev && latest.sessions < prev.sessions * 0.9) {
    insights.push({
      type: 'warning',
      title: 'セッション減少中',
      body: `先月比 ${((1 - latest.sessions/prev.sessions)*100).toFixed(0)}% 減。新記事投稿の頻度を上げるか、既存記事のリライトを検討。`,
      action: '記事管理で下書き確認 →'
    });
  }

  // 検索クエリの順位
  if (data.searchConsole?.topQueries) {
    const closeOnes = data.searchConsole.topQueries.filter(q => q.position > 5 && q.position <= 15);
    if (closeOnes.length) {
      insights.push({
        type: 'opportunity',
        title: `"もう少し" クエリが ${closeOnes.length} 件`,
        body: `順位 6-15 位のクエリ: ${closeOnes.slice(0,3).map(q=>q.query).join(', ')}。リライトで 1 ページ目に押し上げ可能。`,
        action: '対象記事を確認 →'
      });
    }
  }

  // 流入元の偏り
  if (data.trafficSources) {
    const organic = data.trafficSources.find(s => s.source === 'Organic Search');
    const social = data.trafficSources.find(s => s.source === 'Organic Social');
    if (organic && social && social.sessions < organic.sessions * 0.1) {
      insights.push({
        type: 'info',
        title: 'SNS 流入が少ない',
        body: 'SNS からの流入が検索の 10% 未満。Xポスト生成を活用して記事の拡散を増やすべき。',
        action: 'Xポスト生成 →'
      });
    }
  }

  return insights;
}
```

表示イメージ:
- 各セクションの上部に「示唆カード」をアコーディオンで表示
- アイコン付き: 警告（赤）/ 機会（緑）/ 情報（青）
- 「アクション」リンクで該当セクションに遷移

---

### 3.8 [P2] 自動化パイプライン全体像の可視化

#### 現象
- 「クロードコード立ち上げたら何かが走る」等、各パイプラインの起動条件・トリガー・依存関係が分かりにくい
- 現在は「自動化パイプライン」セクションにテキストベースで概要が書いてあるだけ

#### 実装方針

**パイプラインマップ（フローチャート風）の構築**

現在のテキスト pill 表示を拡張して、以下を追加:

1. **トリガー条件の明示**:
   | パイプライン | トリガー | 頻度 | 監視対象 |
   |---|---|---|---|
   | 大会 RSS | GAS cron | 毎日 9:00 | JMA + こくちーず |
   | 大会 X 検索 | IFTTT | 5 分間隔 | X キーワード |
   | 議事録 | GAS cron | 1 時間おき | Google Drive |
   | Claude Code 起動時 | セッションフック | 手動起動 | Firebase queue |

2. **ステータスインジケーター**:
   - 各パイプラインの「最終実行日時」を Firebase/GAS ログから取得
   - 正常（24h 以内に実行）/ 警告（24h 以上未実行）/ エラー を色分け

3. **Claude Code セッション開始時の自動処理の説明**:
   ```
   Claude Code 起動
    → .claude/hooks/session_start.sh 実行
    → Firebase /tournament-queue と /chapche-queue を確認
    → 未処理キューがあれば AUTO-PROCESS を出力
    → Claude Code が自動で処理を実行
   ```

---

## 4. バージョンロードマップ

### v1.1 — 致命的バグ修正（最優先）

| タスク | 対応する課題 | 工数見積 |
|--------|-------------|---------|
| AREAS ID マッピング修正 + 動的取得化 | #1 (P0) | 30 分 |
| WP 認証失敗時の再認証フロー修正 | #2 (P0) | 15 分 |
| iOS スクロール問題修正（100dvh + safe-area） | #4 (P1) | 15 分 |

**合計**: 約 1 時間

### v1.2 — 操作性改善

| タスク | 対応する課題 | 工数見積 |
|--------|-------------|---------|
| 大会詳細をモーダル表示に変更 | #5 (P1) | 45 分 |
| ダッシュボード並列化 + sessionStorage キャッシュ | #3 (P1) | 30 分 |
| スケルトン UI 導入 | #3 (P1) | 20 分 |
| ソース画像: IFTTT Body 修正 + onerror ハンドリング | #6 (P1) | 30 分 |

**合計**: 約 2 時間

### v1.3 — 分析強化 + 運用可視化

| タスク | 対応する課題 | 工数見積 |
|--------|-------------|---------|
| トラフィック/SC 示唆カード追加 | #7 (P2) | 1 時間 |
| 自動化パイプラインマップ強化 | #8 (P2) | 45 分 |
| FxTwitter API でのソース画像動的取得 | #6 (P1) | 30 分 |

**合計**: 約 2.5 時間

---

## 5. 技術調査メモ

### 5.1 都道府県 ID のズレ問題

**コード内の `AREAS` 定数**:
```javascript
'北海道':{id:43}, '青森県':{id:44}, ... '沖縄県':{id:89}
// ID 範囲: 43 - 89
```

**ユーザーからの情報**:
> 都道府県 ID: 58-114（47 都道府県）

**差分**: 15 のオフセット。これは WP 側で taxonomy term が追加削除された結果、ID が振り直された可能性がある。あるいは、コード内の AREAS が古いバージョンの WP データを参照している。

**確定方法**:
```bash
curl -s "https://molkky-hub.com/wp-json/wp/v2/tournament_area?per_page=100&_fields=id,name" | python3 -m json.tool
```

**恒久対策**: ハードコードをやめて、ポータル起動時に WP API から taxonomy term 一覧を取得する。AREAS 定数は WP がダウンした場合のフォールバックとしてのみ保持。

### 5.2 IFTTT Webhook の画像フィールド

IFTTT の X トリガーで利用可能なフィールド:
- `{{Text}}` — ツイート本文
- `{{UserName}}` — ユーザー名
- `{{LinkToTweet}}` — ツイート URL
- `{{ImageUrl1}}` 〜 `{{ImageUrl4}}` — 添付画像 URL（ない場合は空文字列）
- `{{CreatedAt}}` — 投稿日時

現在の Webhook Body テンプレート（推定）:
```json
{
  "title": "{{Text}}",
  "url": "{{LinkToTweet}}",
  "source": "ifttt",
  "text": "{{Text}}",
  "created": "{{CreatedAt}}"
}
```

修正後:
```json
{
  "title": "{{Text}}",
  "url": "{{LinkToTweet}}",
  "source": "ifttt",
  "text": "{{Text}}",
  "created": "{{CreatedAt}}",
  "images": ["{{ImageUrl1}}", "{{ImageUrl2}}", "{{ImageUrl3}}", "{{ImageUrl4}}"]
}
```

注意: IFTTT の JSON Body では配列を直接書けない場合がある。その場合は:
```json
{
  "image1": "{{ImageUrl1}}",
  "image2": "{{ImageUrl2}}",
  "image3": "{{ImageUrl3}}",
  "image4": "{{ImageUrl4}}"
}
```
として、Firebase Cloud Function または受信側で配列に変換する。

### 5.3 GAS Cold Start 対策

GAS Web App は初回アクセス時に Cold Start（3-5 秒）が発生する。対策:
1. **キャッシュ**: `sessionStorage` に GA4/SC データを保存、有効期限 30 分
2. **Warm-up ping**: GAS 側に `doGet(e)` で `e.parameter.ping` を受けたら即レスポンスするロジックを追加。ポータル起動直後にバックグラウンドで ping を発射して warm-up する
3. **GAS 側キャッシュ**: `CacheService.getScriptCache()` で GA4 データを 1 時間キャッシュ

### 5.4 WP REST API と SiteGuard WAF

- SiteGuard WAF は `PUT` / `PATCH` / `DELETE` を 403 でブロック
- 全ての更新は `POST` メソッドで行う（`/tournament/{id}` への POST で更新）
- `FormData` を使用（JSON body は WAF にブロックされる可能性あり）
- `<script>` タグを含むコンテンツもブロックされる

### 5.5 大会管理の最大5ページ制限

現在の `loadWpTournaments()` は最大 5 ページ（500 件）しか取得しない:
```javascript
const maxPages = Math.min(totalPages, 5);
```
総大会数が 500+ 件ある場合、残りの大会はポータルに表示されない。

対策案:
- 初回は最新 100 件のみ取得（1 リクエスト）
- フィルタ/検索時にサーバーサイドクエリを発行
- 「全件読み込み」ボタンで残りを遅延取得
- WP API のページネーションを活用して必要なページだけ取得

---

## 付録: 現行コード構造（参考）

```
molkky-portal/index.html (1,803 行)
├── CSS (1-211)
│   ├── Layout / Sidebar / Main
│   ├── Components (card, stat, btn, pill, table)
│   ├── Tournament-specific (t-card, detail-panel, source)
│   ├── Chart bars / Goals / SC query
│   ├── Partner / Post / Pagination
│   └── Responsive (@media 768px)
├── HTML (213-551)
│   ├── Sidebar navigation
│   ├── Dashboard (stats, goals, traffic, SNS, quick actions)
│   ├── Articles (list + create form)
│   ├── Xpost (promote + repost)
│   ├── Tournaments (stats, tabs, filters, list, detail, add form, charts)
│   ├── Traffic (stats, charts)
│   ├── Search Console (stats, charts, query table)
│   ├── Partners (stats, list)
│   ├── Automation (pipeline overview, status)
│   ├── Settings (WP auth, GAS endpoint, data management)
│   └── Auth modal
├── Firebase SDK (554-556)
└── JavaScript (557-1802)
    ├── Constants + Area mapping (558-601)
    ├── Firebase init (607-612)
    ├── Utility functions (614-631)
    ├── WP fetch helpers (633-648)
    ├── Navigation + lazy loading (650-678)
    ├── Auth flow (680-751)
    ├── Dashboard + Analytics (753-867)
    ├── Articles (870-944)
    ├── Xpost generation (947-1021)
    ├── Traffic rendering (1023-1087)
    ├── Search Console rendering (1089-1119)
    ├── Tournaments: load + normalize + queue (1121-1259)
    ├── Tournament validation (1261-1285)
    ├── Tournament tabs + filtering (1287-1360)
    ├── Tournament detail view (1362-1448)
    ├── Tournament queue processing (1450-1518)
    ├── Tournament edit/save (1520-1559)
    ├── Tournament manual add (1561-1653)
    ├── Tournament stats charts (1655-1691)
    ├── Partners (1693-1718)
    ├── Automation status (1720-1769)
    ├── Area select init (1771-1787)
    └── DOMContentLoaded init (1789-1801)
```
