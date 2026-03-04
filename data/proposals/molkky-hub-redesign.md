# MOLKKY HUB トップページ リデザイン提案書

作成日: 2026-03-04
調査対象: https://molkky-hub.com

---

## 1. 現状分析

### 1.1 サイト概要

| 項目 | 値 |
|------|-----|
| テーマ | SWELL（子テーマ使用） |
| 月間セッション | 約3,000 |
| 総大会情報 | 560件（カスタム投稿: tournament） |
| チーム紹介 | 70件（カスタム投稿: molkky_team） |
| ブログ記事 | 25件（通常投稿） |
| 固定ページ | 約38件 |
| サイト説明 | 「モルックを愛するすべてのひとのために」 |

### 1.2 現在のトップページ構成

```
[ヘッダー] ゴールド(#FFD700)ロゴ + グローバルナビ
   ├─ 大会情報
   ├─ チーム紹介
   ├─ モルック入門（モルックとは / ルール / 正規品一覧）
   ├─ ツール・運営（アプリ）
   ├─ 情報提供・寄稿（フォーム / プロジェクト / 連載一覧）
   ├─ 記事一覧
   └─ お問い合わせ

[メインビジュアル] 単一画像（高さ: SP 20vh / PC 21vw）、暗めフィルター

[メインコンテンツ] 3カラム・カードレイアウト（PC3列 / SP1列）
   └─ 最新記事6件のカード表示
      - 寄稿記事が大半（いとゆう/ナイモル/かずえ/ソウタ連載）
      - サムネイル + タイトル + 日付 + カテゴリ

[サイドバー] ON（ただし内容は空の状態）

[フッター] プライバシーポリシー / 免責事項 / コピーライト
```

### 1.3 デザイン設定

| 設定 | 値 |
|------|-----|
| メインカラー | `#FFD700`（ゴールド） |
| テキストカラー | `#222222` |
| 背景色 | `#FDFDFD` |
| リンクカラー | `#005F73` |
| 見出しカラー | `#FFD700` |
| フォント | Noto Sans JP, 400, 17px(PC) / 4vw(SP) |
| 字間 | 0.1em |
| 角丸 | 4px |
| グラデーション | `#D8FFFF` → `#87E7FF` |

### 1.4 コンテンツ分類

**カテゴリ別記事数:**
- 寄稿: 10件（最多、最新記事もほぼ寄稿）
- 大会情報: 8件
- ソウタ連載: 4件
- YouTube: 2件
- いとゆう連載: 2件
- かずえ連載: 2件
- ルール・遊び方: 2件
- チーム紹介/ツール/ナイモル/商品紹介: 各1件

**大会の地域分布（上位）:**
兵庫(15), 岡山(12), 神奈川(10), 北海道(10), 奈良(5), 大阪(5), 福岡(5), 愛知(5), 茨城(4), 広島(4)

**ACFフィールド（大会）:**
event_date, location, organizer, sns_link, detail_link, scale, beginner_friendly, official

### 1.5 プラグイン環境

- Contact Form 7（問い合わせ）
- NinjaTables（テーブル）
- WP ULike（いいねボタン）
- FileBird（メディア整理）
- BackWPup（バックアップ）
- Akismet（スパム対策）
- SiteGuard（WAF / PUT,PATCH,DELETE → 403）
- ACF（Advanced Custom Fields）

### 1.6 競合サイト

| サイト | 特徴 |
|--------|------|
| molkky.jp（JMA公式） | 公式大会情報、協会ニュース。堅い。デザインは標準的 |
| blog.jajapatatas.com（全国モルックカレンダーニュース） | 大会カレンダー、コラム。はてなブログ。情報量多い |
| molkky-hiroshima.jp | 地域団体サイト。体験会・大会情報 |

**MOLKKY HUBのポジション:** JMA公式でもなく、個人ブログでもない。「メディア×ハブ×裏方の黒子」として、全国の大会情報を集約し、チーム・プレイヤーをつなぐ役割。560件の大会DB + 70チームは他サイトにない独自資産。

---

## 2. 現状の課題

### 2.1 構造的問題

1. **トップページが「ブログ一覧」になっている**
   - 560件の大会DB、70チームという最大の資産がトップに露出していない
   - 最新の寄稿記事6件だけが並ぶ → 初見で「モルック情報サイト」だと認識しにくい

2. **フルワイドセクションが未使用**
   - SWELLの強力機能（フルワイドブロック/タブ/アコーディオン）が一切未使用
   - 結果として平坦なレイアウトになっている

3. **サイドバーが空**
   - サイドバーONなのに中身がない → メインコンテンツ幅が無駄に狭い

4. **CTAボタンがゼロ**
   - 「大会を探す」「チームを見る」などの誘導が一切ない
   - 直帰率が高い可能性

5. **メインビジュアルが静的**
   - テキストオーバーレイなし、動的な数値なし
   - サイトの規模感（560大会、70チーム）が伝わらない

### 2.2 SEO面の課題

1. **meta description が汎用的**
   - 「モルックを愛するすべてのひとのために」→ 検索結果で差別化できない
2. **構造化データが1ブロックのみ**
   - WebSite/Organization schema が不十分
3. **内部リンク不足**
   - トップから大会情報/チーム紹介への直接導線がない
4. **コンテンツの薄さ**
   - ブログ記事25件は少ない。SEO的には最低100記事が目安
5. **キーワード戦略不在**
   - 「モルック 大会」「モルック チーム」「モルック ルール」等の検索意図に対応するランディングページが弱い

### 2.3 UX面の課題

1. **大会検索ができない**
   - 560件の大会DBがあるのに、地域/日付でのフィルタリング不可
2. **初心者導線がない**
   - 「モルックとは」がナビ2階層目に埋もれている
3. **モバイル最適化が不十分**
   - フォントサイズ4vw（≒16px@400px）は適切だが、カードが1列のみで情報密度が低い

---

## 3. リデザイン提案

### Option A: SWELL カスタマイズ（クイックウィン）

**工数**: 2-3時間
**難易度**: 低
**方法**: SWELL標準機能 + カスタマイザー + 固定ページのブロックエディタ

#### 実施内容

**A-1. サイドバーをOFFにする**
- カスタマイザー → トップページ → サイドバー非表示
- メインコンテンツが全幅に → 情報密度UP

**A-2. メインビジュアルにテキストオーバーレイ追加**
- カスタマイザー → メインビジュアル → テキスト設定
```
日本最大級のモルック情報ハブ
560+ 大会 ・ 70+ チーム ・ 全国をカバー
```
- ボタン追加:「大会を探す」→ /event/

**A-3. トップページをフルワイドブロックで構成**

固定ページ（page_id=11）のブロックエディタで以下を構築:

```
[フルワイド] ダークBG: 大会情報セクション
  ├─ 見出し「直近の大会」
  ├─ 投稿リストブロック（tournament CPT、3件、カード型）
  └─ ボタン「すべての大会を見る →」

[フルワイド] ライトBG: チーム紹介セクション
  ├─ 見出し「モルックチーム紹介」
  ├─ 投稿リストブロック（molkky_team CPT、6件、サムネイル型）
  └─ ボタン「全チームを見る →」

[フルワイド] グラデーションBG: 寄稿・コラム
  ├─ 見出し「寄稿・連載」
  ├─ 投稿リストブロック（寄稿カテゴリ、3件）
  └─ ボタン「連載一覧 →」

[フルワイド] ゴールドBG: 初心者誘導
  ├─ 見出し「モルックをはじめよう」
  ├─ カラムブロック（3列）
  │   ├─ モルックとは → /introduction/
  │   ├─ ルール → /rule/
  │   └─ 正規品一覧 → /molkky-official-items/
  └─ ボタン「モルック入門ガイド →」

[フルワイド] ダークBG: CTA
  ├─ 「大会情報を登録する」→ /forms/
  └─ 「お問い合わせ」→ /contact/
```

**A-4. カスタムCSS追加**

```css
/* トップページ用スタイル強化 */
.home .p-mainVisual__textLayer {
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
}

/* 統計数字の強調 */
.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color_main);
  display: block;
  line-height: 1.2;
}
.stat-label {
  font-size: 0.9rem;
  color: #666;
}

/* フルワイドセクション間のリズム */
.swell-block-fullWide + .swell-block-fullWide {
  margin-top: 0;
}

/* ゴールドアクセントのボタン */
.is-style-btn_normal a {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border: none;
  font-weight: 600;
  letter-spacing: 0.05em;
}
```

**A-5. meta description 改善**
```
MOLKKY HUB（モルハブ）- 全国560件以上のモルック大会情報、70以上のチーム紹介、ルール解説を掲載。大会を探す・チームを見つける・モルックを始めるならモルハブ。
```

#### 期待効果
- 直帰率改善: トップから大会/チームへの導線確立
- 滞在時間UP: 複数セクションによるスクロール誘導
- CVR改善: CTAボタンによる情報提供フォームへの誘導

---

### Option B: カスタムフロントページテンプレート（中規模改修）

**工数**: 1-2日
**難易度**: 中
**方法**: SWELL子テーマに `front-page.php` + カスタムCSS

#### 構成案

```
[ヒーロー] 全幅・高さ60vh
  ├─ 背景: 大会写真のスライドショー（3-5枚ローテーション）
  ├─ オーバーレイ: 半透明ダーク
  ├─ メインコピー: 「モルックのすべてが、ここに。」
  ├─ サブコピー: 「全国の大会情報・チーム紹介・ルール解説」
  ├─ 動的カウンター（JS）:
  │   [560+] 大会情報  [70+] チーム  [47] 都道府県
  └─ CTAボタン x2:
      「大会を探す」(primary) 「モルックとは？」(secondary)

[直近の大会] フルワイド・ダークBG
  ├─ 今後開催の大会 3-4件（WP REST API → JS動的取得）
  ├─ カード: 大会名 / 日付 / 場所 / 主催者 / 初心者OKバッジ
  ├─ タイムライン形式（日付を左軸に）
  └─ 「大会をもっと見る →」ボタン

[数字で見るモルハブ] フルワイド・グラデーションBG
  ├─ 4カラムの統計カード（カウントアップアニメーション付き）
  │   ├─ 大会情報: 560+ 件
  │   ├─ チーム: 70+ チーム
  │   ├─ 都道府県: 20+ エリア
  │   └─ 寄稿者: 4+ 人
  └─ IntersectionObserver でスクロールトリガー

[エリアから探す] フルワイド
  ├─ 日本地図SVG（クリッカブル）
  │   └─ 各都道府県→「/event/?location=XX」にリンク
  ├─ または地域ボタン: 北海道・東北 / 関東 / 中部 / 近畿 / 中国・四国 / 九州・沖縄
  └─ 各地域の大会件数をバッジ表示

[チーム紹介ギャラリー] フルワイド・ライトBG
  ├─ 横スクロールカルーセル（Swiper.js）
  ├─ チームロゴ/写真 + チーム名 + 拠点
  └─ 「全チームを見る →」

[寄稿・連載] フルワイド
  ├─ 連載者のアイコン+名前のタブ切替
  ├─ タブ: ソウタ / いとゆう / かずえ / ナイモル
  └─ 各タブ内に最新記事2件

[モルック入門] フルワイド・ゴールドBG
  ├─ 3カラム・アイコン付きカード
  │   ├─ モルックとは → アイコン+説明+リンク
  │   ├─ ルール → アイコン+説明+リンク
  │   └─ 道具・正規品 → アイコン+説明+リンク
  └─ 背景: 木のスキットルのイラスト（薄く）

[CTA] フルワイド・ダークBG
  ├─ 「大会情報を掲載しませんか？」
  ├─ 「寄稿者募集中」
  └─ ボタン: 情報提供フォーム / 寄稿プロジェクト / お問い合わせ
```

#### 技術実装

**front-page.php の骨格:**
```php
<?php get_header(); ?>

<section class="mh-hero">
  <div class="mh-hero__bg">
    <!-- SWELL MV or custom slider -->
  </div>
  <div class="mh-hero__content">
    <h1>モルックのすべてが、ここに。</h1>
    <p>全国の大会情報・チーム紹介・ルール解説</p>
    <div class="mh-hero__stats" id="hero-stats">
      <!-- JS で動的にカウントアップ -->
    </div>
    <div class="mh-hero__cta">
      <a href="/event/" class="mh-btn -primary">大会を探す</a>
      <a href="/introduction/" class="mh-btn -secondary">モルックとは？</a>
    </div>
  </div>
</section>

<section class="mh-upcoming">
  <div class="mh-container">
    <h2>直近の大会</h2>
    <div id="upcoming-tournaments">
      <!-- WP REST API でJS動的取得 -->
    </div>
    <a href="/event/" class="mh-btn -outline">大会をもっと見る</a>
  </div>
</section>

<!-- ... 以下各セクション ... -->

<?php get_footer(); ?>
```

**JS: 動的大会取得**
```javascript
// 直近の大会を取得してカード表示
fetch('/wp-json/wp/v2/tournament?per_page=4&orderby=date&order=desc&_fields=id,title,link,acf')
  .then(r => r.json())
  .then(tournaments => {
    const container = document.getElementById('upcoming-tournaments');
    tournaments.forEach(t => {
      const acf = t.acf;
      container.innerHTML += `
        <div class="mh-tournament-card">
          <div class="mh-tournament-card__date">${formatDate(acf.event_date)}</div>
          <h3>${t.title.rendered}</h3>
          <p class="mh-tournament-card__location">${acf.location}</p>
          <p class="mh-tournament-card__organizer">${acf.organizer}</p>
          ${acf.beginner_friendly ? '<span class="mh-badge -beginner">初心者OK</span>' : ''}
          <a href="${t.link}">詳細を見る</a>
        </div>
      `;
    });
  });
```

#### SiteGuard WAFとの共存
- PHP/CSS/JSはテーマファイルとして設置 → WAFの影響なし
- REST APIはGETリクエストのみ → WAFブロック対象外
- `<script>` タグはテーマ内 `wp_enqueue_script` で読み込み → WAF回避

#### メリット
- SWELLの恩恵（ヘッダー/フッター/レスポンシブ/SEO）を維持
- PHP + JSで完全自由なレイアウト
- WP REST APIで動的コンテンツ
- 子テーマなのでSWELLアップデートに影響されない

#### デメリット
- SWELL子テーマへのFTP/SSHアクセスが必要
- ブロックエディタからの編集は不可（コードベースでの管理）

---

### Option C: 完全カスタムランディングページ（GitHub Pages）

**工数**: 2-3日
**難易度**: 中-高
**方法**: 静的HTML/CSS/JS を GitHub Pages にデプロイし、WP REST API からデータ取得

#### 概要

`jonyjean21.github.io/sp-projects/molkky-hub-lp/` に専用LPを構築。
WP REST APIで大会情報・チーム・記事を動的取得。WP本体のトップからリダイレクトまたはリンク。

#### 構成案

```
[ヒーロー] フルスクリーン
  ├─ 背景: パーティクルアニメーション + 大会写真
  ├─ タイトルアニメーション（GSAP/CSS）
  ├─ リアルタイム統計（REST API）
  └─ CTA

[大会検索] インタラクティブセクション
  ├─ 日本地図SVG（都道府県クリック）
  ├─ フィルター: 地域 / 日付範囲 / 初心者OK / 公式大会
  ├─ 検索結果をカード表示
  └─ REST API: /wp-json/wp/v2/tournament?acf[location]=XXX

[大会タイムライン] 今後の大会
  ├─ 縦タイムライン（日付軸）
  ├─ スクロールアニメーション
  └─ カウントダウンタイマー（直近大会まで）

[チーム紹介] ギャラリー
  ├─ Masonry or カルーセル
  ├─ ホバーエフェクト
  └─ 地域別フィルター

[寄稿ハイライト] マガジン風
  ├─ フィーチャー記事（大きいカード）
  └─ 連載者プロフィール

[初心者ガイド] ステップ形式
  ├─ Step 1: モルックとは
  ├─ Step 2: ルールを知る
  ├─ Step 3: 道具をそろえる
  └─ Step 4: 大会に出よう！

[参加CTA]
  ├─ 大会を登録する
  ├─ チームを紹介する
  └─ 寄稿する
```

#### デザインテイスト

championship/ ページのゴールドテーマ（`--accent: #d4a017`）をベースに、
ダーク背景 + ゴールドアクセントの「プレミアム感」で統一。

```css
:root {
  --bg-dark: #0a0a0a;
  --bg-section: #111111;
  --gold: #FFD700;
  --gold-dark: #BFA100;
  --gold-gradient: linear-gradient(135deg, #FFD700, #FFA500);
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255,255,255,0.7);
  --card-bg: #1a1a1a;
  --card-border: rgba(255,215,0,0.2);
}
```

#### メリット
- 完全な自由度（デザイン/アニメーション/インタラクション）
- CLIで管理可能（SP の運用スタイルに完全適合）
- 表示速度が圧倒的に速い（静的ホスティング）
- WP REST APIでデータは常に最新
- championship/ ページとデザイン統一可能

#### デメリット
- WPのSEO（Yoast/SWELL内蔵）の恩恵を受けられない
- ドメインが異なる（molkky-hub.com vs jonyjean21.github.io）
  → サブドメイン or iframe で解決可能だが複雑
- WP側のトップページとの二重管理
- Google検索で molkky-hub.com のトップとして認識されない

---

## 4. SEO改善提案（全オプション共通）

### 4.1 メタデータ改善

**現在:**
```
title: トップページ - MOLKKY HUB
description: モルックを愛するすべてのひとのために
```

**提案:**
```
title: MOLKKY HUB（モルハブ）| 全国のモルック大会情報・チーム紹介
description: 日本最大級のモルック情報サイト。全国560件以上の大会情報、70以上のチーム紹介、初心者向けルール解説を掲載。近くのモルック大会を探す、チームを見つけるならMOLKKY HUB。
```

### 4.2 構造化データ追加

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "MOLKKY HUB",
  "alternateName": "モルハブ",
  "url": "https://molkky-hub.com",
  "description": "日本最大級のモルック情報サイト",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://molkky-hub.com/?s={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "MOLKKY HUB",
  "url": "https://molkky-hub.com",
  "logo": "https://molkky-hub.com/wp-content/uploads/logo.png",
  "sameAs": ["https://twitter.com/molkkyhub"]
}
```

### 4.3 コンテンツSEO戦略

**ターゲットキーワードと対応ページ:**

| キーワード | 月間検索数(推定) | 対応ページ | 状態 |
|-----------|----------------|-----------|------|
| モルック | 高 | /introduction/ | 既存（改善必要） |
| モルック ルール | 高 | /rule/ | 既存 |
| モルック 大会 | 中 | /event/ | 既存（検索機能追加必要） |
| モルック チーム | 中 | /molkky-team/ | 既存 |
| モルック 購入 | 中 | /molkky-official-items/ | 既存（アフィリエイト強化可能） |
| モルック 大会 [地域名] | 低-中(累計で大) | 未作成 | **新規: エリア別まとめ記事** |
| モルック 始め方 | 中 | 未作成 | **新規: 初心者ガイド** |
| モルック 練習 | 低-中 | 寄稿記事あり | 既存（まとめ記事新規作成可能） |

**優先施策:**
1. **エリア別大会まとめ記事の自動生成** — 560件のDBから47都道府県分を生成（以前の候補リストにも記載）
2. **購入ガイド記事** — アフィリエイト収益化
3. **内部リンク網の強化** — トップ → カテゴリ → 個別記事の3層構造

### 4.4 テクニカルSEO

1. **sitemap.xml にカスタム投稿を含める** — tournament, molkky_team が含まれているか確認
2. **パンくずリスト** — SWELL内蔵機能を有効化
3. **Core Web Vitals** — メインビジュアル画像の最適化（WebP化、lazy-load）
4. **canonical URL** — トップページの正規URLを明示

---

## 5. 推奨アプローチ

### 結論: Option A（即時）+ Option B（中期）のハイブリッド

#### Phase 1: 今すぐやる（Option A / 2-3時間）

1. **サイドバーOFF** — カスタマイザーで即対応
2. **メインビジュアルにテキスト追加** — カスタマイザーで即対応
3. **固定ページ（トップ）にフルワイドブロック追加**
   - 大会情報セクション（投稿リストブロック）
   - チーム紹介セクション
   - 初心者導線セクション
   - CTAセクション
4. **meta description 変更**
5. **カスタムCSS追加**（統計数字、ボタン、セクション間隔）

**効果**: トップページの第一印象が劇的に改善。大会・チームへの導線確立。

#### Phase 2: 次のイテレーション（Option Bの部分導入 / 1日）

1. **front-page.php** は使わず、固定ページ + カスタムHTML ブロックで実装
   - SWELL の「カスタムHTMLブロック」内にJS記述
   - ただし SiteGuard WAF が `<script>` をブロックする → `wp_enqueue_script` で外部JSファイルとして読み込む必要
   - 代替: カスタマイザーの「追加JS」フィールドを使用

2. **動的コンテンツの実装**
   - REST API で直近の大会を取得→カード表示
   - カウントアップアニメーション
   - Swiper.js でチームカルーセル

3. **エリアボタンの追加**
   - 地域別ボタン → 大会フィルターページへ

#### Phase 3: 長期（Option Bフル実装 / 必要に応じて）

- 子テーマへのテンプレートファイル追加
- 大会検索ページの構築（フィルター/地図）
- SEOコンテンツの量産パイプライン

### なぜ Option C を推奨しないか

- MOLKKY HUB のドメインパワー（molkky-hub.com）をSEOで最大活用するべき
- GitHub Pages は別ドメインになるため、SEO的に分散する
- WPのテーマ内で実現できるレベルのデザインで十分
- 管理が二重になる

### Option A 実装時の注意点

1. **SWELLのブロックエディタは WP REST API 経由で操作可能**
   - `POST /wp-json/wp/v2/pages/11` で固定ページのcontent更新
   - ただしブロックのGutenbergマークアップが必要
   - SiteGuard WAFがPOSTは通すので、REST API経由で更新可能

2. **カスタマイザー設定もREST APIで可能**
   - `POST /wp-json/wp/v2/settings` （要認証）

3. **CLI運用との相性**
   - Phase 1 はほぼ全て WP REST API + curl で完結
   - ブロックマークアップを手書きして POST するワークフロー

---

## 6. 実装ロードマップ

```
Week 1（Phase 1）:
  ├─ サイドバーOFF
  ├─ MV テキスト追加
  ├─ フルワイドブロック追加（大会/チーム/初心者/CTA）
  ├─ meta description 更新
  └─ カスタムCSS

Week 2-3（Phase 2）:
  ├─ REST API連携JS（直近大会の動的表示）
  ├─ カウントアップアニメーション
  ├─ エリアボタン
  └─ チームカルーセル

Week 4+（SEO）:
  ├─ エリア別大会まとめ記事の自動生成
  ├─ 購入ガイド記事
  └─ 内部リンク強化
```

---

## 付録: データサマリー

### 大会の地域分布（上位20 / 直近100件より）

| 地域 | 件数 |
|------|------|
| 兵庫 | 15 |
| 岡山 | 12 |
| 神奈川 | 10 |
| 北海道 | 10 |
| 奈良 | 5 |
| 大阪 | 5 |
| 福岡 | 5 |
| 愛知 | 5 |
| 茨城 | 4 |
| 広島 | 4 |
| 埼玉 | 3 |
| 熊本 | 3 |
| 石川 | 2 |
| 東京 | 2 |
| 山梨 | 2 |
| 佐賀 | 2 |

### ナビゲーション構造

```
大会情報 ─────────── /event/
チーム紹介 ─────────── /molkky-team/
モルック入門 ─────────┬─ モルックとは → /introduction/
                      ├─ ルール → /rule/
                      └─ 正規品一覧 → /molkky-official-items/
ツール・運営 ──────────── アプリ → /app/
情報提供・寄稿 ────────┬─ 情報提供フォーム一覧 → /forms/
                      ├─ 寄稿プロジェクトについて → /contribute/
                      └─ 寄稿・連載一覧 → /contribute/contribute-works/
記事一覧 ─────────── /info/
お問い合わせ ──────── /contact/
```

### WP REST API エンドポイント（活用可能）

```
GET /wp-json/wp/v2/tournament?per_page=N&orderby=date&order=desc
GET /wp-json/wp/v2/molkky_team?per_page=N
GET /wp-json/wp/v2/posts?categories=122&per_page=N  (寄稿)
GET /wp-json/wp/v2/posts?categories=8&per_page=N    (大会情報記事)
GET /wp-json/wp/v2/search?search=KEYWORD
```
