# SP 副業パイプライン 全自動化アーキテクチャ

> 最終更新: 2026-03-02
> 設計思想: **SPがPCの前に座らなくても収益が発生する仕組み**
> 制約: macOS ローカル環境 + 既存ツールスタック内で構築可能なものに限定

---

## 1. 全体アーキテクチャ図

```
                         ┌─────────────────────────────────────┐
                         │         収 益 発 生 先              │
                         │  note / BOOTH / WP / X / CW        │
                         └──────────────┬──────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
    ┌─────────▼────────┐   ┌───────────▼──────────┐   ┌─────────▼─────────┐
    │  自動投稿レイヤー  │   │  コンテンツ配信レイヤー│   │  告知・集客レイヤー │
    │                    │   │                      │   │                   │
    │ WP REST API (記事) │   │ BOOTH (ストック型)    │   │ X 自動投稿        │
    │ Typefully (X投稿)  │   │ note (手動publish)   │   │ Buffer (予備)     │
    │ Vercel Proxy (API) │   │ WP AdSense           │   │ Xで告知→LP誘導   │
    └─────────┬──────────┘   └───────────┬──────────┘   └─────────┬─────────┘
              │                          │                        │
              └──────────────┬───────────┘────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     生成エンジン (中核)       │
              │                              │
              │  macOS cron (5分/1時間/日次)  │
              │       │                      │
              │  ┌────▼──────────────────┐   │
              │  │  Claude Code / Node.js │   │
              │  │  (記事・投稿文・提案文)  │   │
              │  └────┬──────────────────┘   │
              │       │                      │
              │  ┌────▼────────────────┐     │
              │  │  Vercel API Proxy   │     │
              │  │  /api/gemini        │     │
              │  │  /api/tweet-post    │     │
              │  │  /api/note-draft    │     │
              │  └─────────────────────┘     │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     データ・監視レイヤー      │
              │                              │
              │  Firebase RTDB               │
              │   /income-queue    (生成済み) │
              │   /income-posted   (投稿済み) │
              │   /income-revenue  (収益記録) │
              │                              │
              │  GAS (定期実行)               │
              │   - CW RSS監視               │
              │   - 収益レポート自動生成      │
              │                              │
              │  IFTTT Pro                   │
              │   - X キーワード監視          │
              └──────────────────────────────┘
```

### データフロー詳細

```
=== 日次フロー（cron で自動実行） ===

[09:00] macOS cron
    │
    ├─→ Node.js: WP記事生成 → WP REST API → 下書き投稿
    │     └─→ Firebase /income-queue/wp に記録
    │
    ├─→ Node.js: X投稿文生成 → Typefully API → 予約投稿
    │     └─→ Firebase /income-queue/x に記録
    │
    ├─→ Node.js: note記事生成 → ローカル保存
    │     └─→ Firebase /income-queue/note に記録
    │
    └─→ GAS: CW新着案件 RSS → 条件フィルタ → 提案文生成 → メール通知

[18:00] macOS cron
    │
    ├─→ Node.js: X投稿文生成(夜) → Typefully API → 予約投稿
    │
    └─→ Node.js: 日次レポート生成 → Firebase /income-posted に集計

=== 週次フロー（日曜 0:00） ===

[00:00] macOS cron
    │
    ├─→ Node.js: WPアフィリエイト記事 5本バッチ生成
    ├─→ Node.js: note記事 2本生成
    └─→ Node.js: 週次収益レポート → SPにメール or LINE通知
```

---

## 2. 各ストリームの自動化レベル

| # | ストリーム | 自動化レベル | 理由 | SPの作業 |
|---|-----------|------------|------|---------|
| 1 | **WPアフィリエイト記事** | **完全自動** | WP REST API で下書き→公開まで可能 | 週1回の品質チェック(5分) |
| 2 | **X投稿 (@tobiralab)** | **完全自動** | Typefully API($12.5/月)で予約投稿 | 不要 |
| 3 | **note記事** | **半自動** | 公式APIなし。Playwright投稿は可能だが不安定 | 週2回コピペ投稿(各5分=10分) |
| 4 | **BOOTH商品** | **手動(初回のみ)** | APIなし。ストック型なので1回登録すれば終わり | 月1回 新商品追加(30分) |
| 5 | **CW提案文** | **半自動** | RSS取得+提案文生成は自動。送信は手動 | 日2件コピペ送信(5分) |
| 6 | **AdSense** | **完全自動** | 広告表示は完全自動。記事が増えれば収益も増加 | 不要 |

### 判定基準の詳細

#### 1. WPアフィリエイト記事 → 完全自動

既に `01-molkky-affiliate/article-generator.js` が存在し、`--publish` フラグで WP REST API 経由の下書き投稿が実装済み。追加で必要なのは:
- cron の設定（現在未設定）
- キーワード消化済みリストの管理（Firebase に移行）
- アイキャッチ画像の自動生成（Vercel + Sharp.js or Canvas API）

#### 2. X投稿 → 完全自動（Typefully 経由）

X API Free プランは月100投稿制限（2026年2月に改定）で実用的だが、OAuth設定が複雑。
**Typefully** ($12.50/月) を使えば:
- API で投稿予約が可能（公式ドキュメントあり）
- スレッド投稿対応
- 分析機能付き
- X API の認証を Typefully 側が管理

代替: Buffer Free（3チャンネル、各10投稿/月）は無料だが投稿数が足りない。

#### 3. note記事 → 半自動（生成は自動、投稿は手動 or Playwright）

**noteに公式APIは存在しない。** 選択肢は3つ:

| 方法 | メリット | デメリット | 推奨度 |
|------|---------|-----------|--------|
| **A. 手動コピペ** | 確実・規約違反なし | 週10分の手動作業 | 当面はこれ |
| **B. Playwright自動投稿** | 完全自動化 | セットアップ1時間、ログイン切れリスク、規約グレー | 安定後に移行 |
| **C. note非公式API** | 実装シンプル | 予告なく変更される、BAN リスク | 非推奨 |

**現実解: 方法A → 安定したら方法Bに移行**

Playwright で note に自動投稿する場合の技術設計:
```
1. npx playwright install chromium
2. Cookie保存 → ログインセッション維持
3. ProseMirrorエディタにクリップボード経由でMarkdown貼り付け
4. 公開設定（無料/有料・タグ）を自動設定
5. 「投稿」ボタンをクリック
```

注意: ProseMirror エディタの挙動が複雑で、画像挿入は困難。テキスト記事のみ自動化対象。

#### 4. BOOTH → 手動（ストック型なので問題なし）

BOOTHにAPIはない。ただし:
- デジタル商品は**1回登録すれば永続的に売れ続ける**
- 新商品追加は月1回程度
- **告知の自動化**（X投稿）が重要 → Typefully で自動化済み

#### 5. CW提案文 → 半自動

CWにAPIはないが、RSSフィードが存在する:
```
https://crowdworks.jp/public/jobs/search.atom?order=new&keyword=自動化&min_budget=20000
```

フロー:
```
GAS(1時間おき) → CW RSS取得 → 条件フィルタ → Firebase /cw-queue
    ↓
macOS cron(朝) → Firebase から未処理取得 → Claude で提案文生成 → SPにメール通知
    ↓
SP → メール内の提案文をCWにコピペ送信(1件2分)
```

---

## 3. 今すぐ構築できるもの vs 時間がかかるもの

### 今すぐ構築できるもの（所要時間: 1セッション以内）

| # | 対象 | 内容 | 所要時間 | 依存 |
|---|------|------|---------|------|
| 1 | **macOS cron 設定** | run-all.sh を crontab に登録 | 5分 | なし |
| 2 | **WP記事の自動投稿cron化** | 既存スクリプトをcronに追加 | 10分 | WP認証情報 |
| 3 | **CW RSS監視 GAS** | GASスクリプト新規作成 + clasp push | 30分 | GASアカウント(済) |
| 4 | **Firebase income キュー** | /income-queue パスにルール追加 | 15分 | Firebase(済) |
| 5 | **X投稿文の自動生成+ファイル出力** | 既存スクリプトをcron化 | 10分 | なし |
| 6 | **提案文の自動生成パイプライン** | CW RSS → Claude生成 → メール通知 | 45分 | GAS |

### 1-2週間かかるもの

| # | 対象 | 内容 | 所要時間 | 依存 |
|---|------|------|---------|------|
| 7 | **Typefully API 連携** | X投稿の完全自動化 | 2時間 | Typefully契約($12.5/月) |
| 8 | **Playwright note投稿** | note自動投稿Bot構築 | 3-4時間 | `npx playwright install` |
| 9 | **収益ダッシュボード** | income-dashboard/ に自動更新ページ | 3時間 | Firebase |
| 10 | **アイキャッチ自動生成** | Vercel + Canvas API でOG画像生成 | 2時間 | Vercel |

### 1ヶ月以上かかるもの（検証・改善が必要）

| # | 対象 | 内容 | 所要時間 | 依存 |
|---|------|------|---------|------|
| 11 | **SEO記事の品質安定化** | テンプレート改善+検索順位モニタリング | 継続的 | GSC API |
| 12 | **AdSense最適化** | 広告配置A/Bテスト | 継続的 | AdSense承認 |
| 13 | **CW受注率の改善** | 提案文テンプレートのPDCA | 継続的 | 実績蓄積 |

---

## 4. 具体的な実装プラン

### パイプライン1: WPアフィリエイト記事 完全自動パイプライン

```
┌─────────────────────────────────────────────────────┐
│ macOS cron (月水金 09:00)                            │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ income/01-molkky-affiliate/article-generator.js│   │
│  │                                                │   │
│  │ 1. Firebase /income-queue/wp/pending から      │   │
│  │    次のキーワードを取得                         │   │
│  │ 2. Claude API で記事生成(3000-5000字)          │   │
│  │ 3. WP REST API で下書き投稿                    │   │
│  │    - カテゴリ自動設定                           │   │
│  │    - タグ自動設定                               │   │
│  │    - スラッグ自動生成                           │   │
│  │ 4. Firebase ステータスを "draft" に更新        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ 週次バッチ (日曜 00:00)                        │   │
│  │                                                │   │
│  │ 1. 先週のdraft記事一覧をWP APIで取得           │   │
│  │ 2. 品質チェック結果をSPにメール                │   │
│  │ 3. SPが「公開OK」と返信 → 自動公開            │   │
│  │    (または SP が hub-dashboard から一括公開)    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**改修が必要なファイル:**
- `income/01-molkky-affiliate/article-generator.js`
  - キーワード管理を Firebase に移行（現在はハードコード）
  - `--publish` 時にアイキャッチ画像、スラッグ、タグを自動設定
  - 生成済みキーワードの重複防止

**新規作成:**
- `gas/income-wp-monitor/main.gs` — 下書き記事の週次レポートGAS

**cron追加:**
```cron
# WP記事自動生成（月水金 9:00）
0 9 * * 1,3,5 cd /Users/shumpei/sp-projects && node income/01-molkky-affiliate/article-generator.js --publish >> income/logs/cron.log 2>&1
```

---

### パイプライン2: X投稿 完全自動パイプライン

```
┌─────────────────────────────────────────────────────────┐
│ 方式A: Typefully API 経由（推奨・$12.5/月）             │
│                                                          │
│  macOS cron (毎日 08:00, 19:00)                          │
│       │                                                  │
│       ▼                                                  │
│  Node.js: income/06-x-auto-post/x-typefully-poster.js  │
│       │                                                  │
│       ├─ 1. 曜日に応じた投稿タイプ選択                   │
│       │    月木=ClaudeCode解説, 火金=アフィリエイト       │
│       │    水土=モルック情報, 日=エンゲージメント         │
│       │                                                  │
│       ├─ 2. Claude API で投稿文生成                      │
│       │                                                  │
│       ├─ 3. Typefully API で予約投稿                     │
│       │    POST https://api.typefully.com/v1/drafts/     │
│       │    { content, schedule_date, threadify }          │
│       │                                                  │
│       └─ 4. Firebase /income-posted/x に記録             │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 方式B: X API Free 直接（無料だが制限的）                 │
│                                                          │
│  制限: 月100投稿、OAuth 1.0a 設定が必要                  │
│  既存の x-affiliate-poster.js が対応済み                 │
│  月2投稿/日 x 30日 = 60投稿 → Free枠内に収まる         │
│                                                          │
│  ただし @tobiralab のX API Developer登録が必要           │
│  → Developer Portal で App 作成 + OAuth トークン取得    │
└─────────────────────────────────────────────────────────┘
```

**コスト比較:**
| 方式 | 月額コスト | セットアップ時間 | 安定性 | 機能 |
|------|-----------|----------------|--------|------|
| Typefully | $12.50 (~¥1,900) | 30分 | 高 | スレッド、分析、予約 |
| X API Free | ¥0 | 1-2時間 | 中 | 投稿のみ、月100件制限 |
| Buffer Free | ¥0 | 15分 | 高 | 月30投稿制限（3ch x 10） |

**推奨: まず X API Free で始め、月100投稿で不足したら Typefully に移行**

**cron追加:**
```cron
# X投稿（毎日 8:00 と 19:00）
0 8 * * * cd /Users/shumpei/sp-projects && node income/06-x-auto-post/x-affiliate-poster.js >> income/logs/x-post.log 2>&1
0 19 * * * cd /Users/shumpei/sp-projects && node income/06-x-auto-post/x-affiliate-poster.js --type=info >> income/logs/x-post.log 2>&1
```

---

### パイプライン3: note記事 半自動パイプライン

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: 生成自動 + 投稿手動（今すぐ）                   │
│                                                          │
│  macOS cron (火木 18:00)                                 │
│       │                                                  │
│       ▼                                                  │
│  Node.js: income/02-note-magazine/content-generator.js  │
│       │                                                  │
│       ├─ 1. 次のトピックを選択（Firebase管理）           │
│       ├─ 2. Claude API で記事生成                        │
│       ├─ 3. ローカル保存 + Firebase に記録               │
│       └─ 4. SPにメール通知「note記事が完成しました」     │
│                                                          │
│  SP の作業（週2回、各5分）:                              │
│       1. メールの記事を確認                               │
│       2. note.com を開く                                 │
│       3. タイトルと本文をコピペ                           │
│       4. タグ設定 → 公開                                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Phase 2: Playwright 自動投稿（1-2週間後）                │
│                                                          │
│  macOS cron (火木 18:30)                                 │
│       │                                                  │
│       ▼                                                  │
│  Node.js: income/02-note-magazine/note-auto-publish.js  │
│       │                                                  │
│       ├─ 1. Playwright でブラウザ起動                    │
│       ├─ 2. Cookie から note.com にログイン              │
│       │    (Cookie保存: ~/.sp-note-cookies.json)         │
│       ├─ 3. 「投稿」→「テキスト」を選択                 │
│       ├─ 4. タイトル入力                                 │
│       ├─ 5. 本文をクリップボード経由で貼り付け           │
│       │    (ProseMirrorエディタ対応)                     │
│       ├─ 6. 公開設定（無料/有料、タグ）                  │
│       ├─ 7. 「投稿する」をクリック                       │
│       └─ 8. Firebase ステータスを "published" に更新     │
│                                                          │
│  注意事項:                                               │
│  - 画像挿入は非対応（テキスト記事のみ）                  │
│  - ログインセッション切れの検知 + SPに通知               │
│  - noteの仕様変更時の自動検知(スクショ比較)は困難        │
│    → 投稿失敗時にSPにアラートメール                     │
└─────────────────────────────────────────────────────────┘
```

**Playwright セットアップ手順:**
```bash
cd /Users/shumpei/sp-projects/income
npm install playwright
npx playwright install chromium
# テスト: npx playwright codegen note.com  (操作を記録)
```

---

### パイプライン4: CW提案文 半自動パイプライン

```
┌─────────────────────────────────────────────────────────┐
│ GAS: gas/cw-monitor/main.gs (1時間おき)                 │
│                                                          │
│  1. CW RSS フィードを取得                                │
│     URL: crowdworks.jp/public/jobs/search.atom           │
│     パラメータ:                                          │
│       order=new                                          │
│       keyword=自動化 OR GAS OR AI OR Bot OR WordPress    │
│       min_budget=20000                                   │
│                                                          │
│  2. 新着案件をフィルタ                                   │
│     - 除外: デザイン/イラスト/動画/翻訳                  │
│     - 予算: ¥20,000 以上                                │
│     - スキルマッチ: GAS/WordPress/Python/Bot系           │
│                                                          │
│  3. 条件に合致する案件を Firebase /cw-queue に保存       │
│     { title, url, budget, description, status: "new" }   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ macOS cron (毎朝 08:30)                                  │
│                                                          │
│  Node.js: income/tools/cw-proposal-generator.js          │
│       │                                                  │
│       ├─ 1. Firebase /cw-queue/new を取得                │
│       ├─ 2. 各案件に対して Claude で提案文生成           │
│       │    - SP のプロフィール・実績を自動挿入           │
│       │    - 案件の要件に合わせたカスタマイズ            │
│       ├─ 3. 生成した提案文をメールでSPに送信            │
│       │    件名: [CW] 本日の提案候補 N件                │
│       │    本文: 案件概要 + 提案文 + CW応募URL          │
│       └─ 4. Firebase ステータスを "proposal_sent" に更新│
│                                                          │
│  SP の作業（朝5分）:                                     │
│       1. メールを開く                                    │
│       2. 良さそうな案件の提案文をコピー                  │
│       3. CWの応募ページに貼り付け → 送信                │
│       (1件あたり2分 x 2-3件 = 5分)                      │
└─────────────────────────────────────────────────────────┘
```

**新規作成するファイル:**
- `gas/cw-monitor/main.gs` — CW RSS 監視 GAS
- `gas/cw-monitor/.clasp.json` — clasp 設定
- `income/tools/cw-proposal-generator.js` — 提案文自動生成

**メール通知の代替:**
GAS の `MailApp.sendEmail()` で SP のメールアドレスに直接送信可能。
追加コスト: なし（GAS の無料枠内）。

---

### パイプライン5: BOOTH告知 自動パイプライン

```
┌─────────────────────────────────────────────────────────┐
│ 商品登録: 手動（月1回、30分）                            │
│                                                          │
│  SP が BOOTH 管理画面で新商品を登録                      │
│  → Firebase /income-booth/products に URL を追加         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 告知: 完全自動（X投稿パイプラインに統合）                │
│                                                          │
│  macOS cron (水土 10:00)                                 │
│       │                                                  │
│       ▼                                                  │
│  Node.js: income/06-x-auto-post/x-affiliate-poster.js  │
│       │                                                  │
│       ├─ --type=booth で BOOTH告知投稿を生成             │
│       │  - 商品URL、特徴、価格を含む                    │
│       │  - 毎回違う切り口（レビュー風、中身紹介、限定等）│
│       └─ X (Typefully or 直接) に投稿                   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 商品コンテンツ生成: 自動（月次）                         │
│                                                          │
│  Node.js: income/03-booth-prompts/generate-product.js   │
│       │                                                  │
│       ├─ Claude API で新商品コンテンツ生成              │
│       │  - プロンプト集の新テーマ                       │
│       │  - テンプレート集                               │
│       │  - チェックリスト集                             │
│       └─ Markdown + PDF 出力                            │
│          (pandoc or Googleドキュメント経由)              │
└─────────────────────────────────────────────────────────┘
```

---

### パイプライン6: 収益トラッキング自動ダッシュボード

```
┌─────────────────────────────────────────────────────────┐
│ income-dashboard/ (GitHub Pages)                        │
│ URL: jonyjean21.github.io/sp-projects/income-dashboard/ │
│                                                          │
│ データソース:                                            │
│  ┌─────────────────┐  ┌──────────────────┐             │
│  │ Firebase RTDB    │  │ 手動入力(月1回)  │             │
│  │ /income-revenue  │  │ BOOTH売上        │             │
│  │   wp-adsense     │  │ note購読者数     │             │
│  │   wp-affiliate   │  │ CW受注額         │             │
│  │   x-engagement   │  │ Amazon確定額     │             │
│  └────────┬────────┘  └────────┬─────────┘             │
│           │                     │                        │
│           └─────────┬───────────┘                        │
│                     │                                    │
│           ┌─────────▼───────────┐                       │
│           │ income-dashboard/   │                       │
│           │   index.html        │                       │
│           │                     │                       │
│           │ 月次目標 vs 実績    │                       │
│           │ ストリーム別グラフ  │                       │
│           │ 日次推移チャート    │                       │
│           │ 次月の予測         │                       │
│           └─────────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

---

## 5. SPの1日の作業を15分以内にするための運用フロー

### 理想の1日（全パイプライン稼働後）

```
=== 朝 (5分) ===

08:00  macOS cron が自動実行:
        - X投稿文を生成 → Typefully で予約投稿
        - CW新着案件の提案文生成 → メール送信

08:30  SP がスマホでメールチェック（ベッドの中でOK）
        ├─ CW提案文メールを確認
        │   └─ 良い案件があれば CW アプリでコピペ送信 (2分)
        ├─ note記事完成通知があれば確認
        │   └─ 「後で投稿する」とメモ (30秒)
        └─ X投稿の反応を確認
            └─ リプがあれば返信 (2分)

=== 昼 (0分 - 自動) ===

12:00  自動:
        - WP記事が下書き投稿されている（確認は週末にまとめて）
        - BOOTH告知がXに自動投稿される

=== 夜 (5-10分) ===

19:00  macOS cron が自動実行:
        - X投稿文(夜)を生成 → 投稿

20:00  SP がPCの前に座る時間があれば:
        ├─ note記事のコピペ投稿 (5分) ※週2回のみ
        ├─ CW のメッセージ確認・返信 (2-3分)
        └─ income-dashboard で収益確認 (1分)

=== 週末 (15分) ===

日曜:
        ├─ WP下書き記事の品質チェック → 公開判断 (10分)
        ├─ 収益レポート確認 (3分)
        └─ 翌週のコンテンツ方針の微調整 (2分)
```

### 作業時間の内訳

| 作業 | 頻度 | 1回あたり | 月間合計 |
|------|------|-----------|---------|
| CW提案文コピペ送信 | 平日毎日 | 3分 | 60分 |
| X反応確認・返信 | 毎日 | 2分 | 60分 |
| note記事コピペ投稿 | 週2回 | 5分 | 40分 |
| WP記事品質チェック | 週1回 | 10分 | 40分 |
| 収益ダッシュボード確認 | 週1回 | 3分 | 12分 |
| BOOTH新商品登録 | 月1回 | 30分 | 30分 |
| **月間合計** | | | **約4時間** |

**1日あたり: 約8分（平日平均）**

---

## 6. 実装の優先順位（ロードマップ）

### Week 1: 基盤構築（今すぐ着手）

```
Day 1:
  [x] crontab 設定（run-all.sh を macOS に登録）
  [x] .env に必要な環境変数を設定
  [ ] Firebase /income-queue ルール追加

Day 2-3:
  [ ] article-generator.js の改修
      - Firebase キーワード管理
      - WP 投稿時のメタ情報自動設定
  [ ] X投稿スクリプトの cron 化

Day 4-5:
  [ ] GAS: gas/cw-monitor/main.gs 新規作成
      - CW RSS 監視
      - Firebase 連携
      - メール通知
  [ ] income/tools/cw-proposal-generator.js 新規作成
```

### Week 2: X投稿の完全自動化

```
  [ ] X API Developer Portal で @tobiralab の App 作成
  [ ] OAuth トークン取得
  [ ] x-affiliate-poster.js に X API Free 直接投稿を実装
  [ ] 動作確認 → cron に本番投稿を追加
  [ ] (オプション) Typefully 契約 + API 連携
```

### Week 3: note投稿の半自動化

```
  [ ] Playwright インストール + 動作確認
  [ ] note-auto-publish.js 新規作成
      - Cookie ベースのログインセッション管理
      - ProseMirror エディタへの貼り付け
      - 投稿フローのE2Eテスト
  [ ] 失敗時のアラート機構
  [ ] cron 化（最初は --dry-run で1週間テスト）
```

### Week 4: ダッシュボード + 最適化

```
  [ ] income-dashboard/ 構築
      - Firebase から収益データ自動表示
      - ストリーム別グラフ
      - 月間目標 vs 実績
  [ ] 全パイプラインの安定性確認
  [ ] ログ監視の仕組み（エラー時にメール通知）
```

---

## 7. コスト試算

### 月間固定コスト

| 項目 | コスト | 備考 |
|------|--------|------|
| Claude API（記事生成） | ~¥2,000 | haiku で月100記事 = 約¥500、sonnet混在で¥2,000 |
| IFTTT Pro | ¥450 ($2.99) | X キーワード監視（既に契約済み） |
| Typefully（任意） | ¥1,900 ($12.50) | X自動投稿。X API Free で代替可能 |
| Vercel | ¥0 | 無料枠内 |
| Firebase | ¥0 | 無料枠内 |
| GAS | ¥0 | 無料枠内 |
| GitHub Pages | ¥0 | 無料 |
| **合計** | **¥2,450 - ¥4,350** | |

### 期待収益 vs コスト

| | 悲観 | 標準 | 楽観 |
|---|------|------|------|
| WPアフィリエイト | ¥5,000 | ¥15,000 | ¥30,000 |
| AdSense | ¥1,000 | ¥5,000 | ¥15,000 |
| BOOTH | ¥3,000 | ¥20,000 | ¥40,000 |
| note | ¥2,000 | ¥10,000 | ¥20,000 |
| CW受託 | ¥0 | ¥50,000 | ¥100,000 |
| X経由流入 | ¥0 | ¥3,000 | ¥10,000 |
| **月間合計** | **¥11,000** | **¥103,000** | **¥215,000** |
| **コスト差引** | **¥6,650** | **¥98,650** | **¥210,650** |

---

## 8. 技術的な注意事項

### macOS cron の注意点

```bash
# macOS ではスリープ中に cron は実行されない
# 対策1: caffeinate でスリープ防止（電源接続時のみ推奨）
# 対策2: launchd を使う（スリープ復帰後に未実行ジョブを実行）

# launchd の方が macOS に適している
# ~/Library/LaunchAgents/com.sp.income-engine.plist を作成

# ただし、PCを持ち歩く + スリープするSPの使い方を考慮すると
# GAS（クラウド実行）をメインにし、ローカル cron はサブにするのが現実的
```

### 推奨: GAS をメインスケジューラーにする

SPのPCはスリープになることがある（CLAUDE.mdのメモリに記載あり）。
ローカル cron だけに依存すると、スリープ中にジョブが実行されないリスクがある。

**解決策: 重要なジョブは GAS のタイムトリガーで実行**

```
GAS（クラウド、24時間稼働）:
  - CW RSS監視（1時間おき）
  - 収益レポート生成（週次）
  - メール通知（即時）

macOS cron（ローカル、PCが起動中のみ）:
  - Claude API を使った記事生成（APIキーがローカルにある）
  - Playwright note投稿（ブラウザが必要）
  - WP REST API 投稿（認証情報がローカルにある）

Vercel（サーバーレス、24時間稼働）:
  - APIプロキシ（Gemini, X syndication）
  - Webhook受信（IFTTT → Firebase）
  - 将来的にcron的な定期実行も可能（Vercel Cron Jobs）
```

### Vercel Cron Jobs の活用（将来検討）

Vercel の無料プランには Cron Jobs 機能がある（1日1回の制限）。
Pro プラン($20/月)なら頻度制限が緩和される。
PCがスリープしていても確実に実行される。

ただし、現時点では GAS + ローカル cron の組み合わせで十分。

---

## 9. 最初の一手（このセッションでやるべきこと）

以下の3つを今すぐ実行すれば、明日から自動でコンテンツが生成され始める:

### 1. crontab を設定する

```bash
crontab -e
# 以下を追記:
0 9 * * 1,3,5 cd /Users/shumpei/sp-projects && node income/01-molkky-affiliate/article-generator.js --publish >> /Users/shumpei/sp-projects/income/logs/cron.log 2>&1
0 8 * * * cd /Users/shumpei/sp-projects && node income/06-x-auto-post/x-affiliate-poster.js --dry-run >> /Users/shumpei/sp-projects/income/logs/x-post.log 2>&1
0 19 * * * cd /Users/shumpei/sp-projects && node income/06-x-auto-post/x-affiliate-poster.js --type=info --dry-run >> /Users/shumpei/sp-projects/income/logs/x-post.log 2>&1
```

### 2. Firebase /income-queue のパスを初期化する

```javascript
// Firebase RTDB に以下の構造を作成
{
  "income-queue": {
    "wp": { "pending": {}, "draft": {}, "published": {} },
    "note": { "pending": {}, "published": {} },
    "x": { "posted": {} },
    "cw": { "new": {}, "proposal_sent": {}, "applied": {} }
  }
}
```

### 3. GAS で CW RSS 監視を作成する

```bash
cd /Users/shumpei/sp-projects/gas
mkdir -p cw-monitor
cd cw-monitor
clasp create --type standalone --title "SP CW Monitor"
# → main.gs を作成して clasp push
```

---

## まとめ: 「PCの前に座らなくても収益が発生する仕組み」の実現度

| ストリーム | PC不要で収益発生？ | 条件 |
|-----------|-------------------|------|
| WPアフィリエイト | はい | cron + WP REST API が稼働していれば |
| AdSense | はい | 記事が公開されていれば完全自動 |
| BOOTH | はい | 商品が登録済みなら完全放置で売れる |
| X経由流入 | はい | Typefully or X API で自動投稿 |
| note | 部分的 | 週2回のコピペ投稿が必要（各5分） |
| CW受託 | 部分的 | 提案送信と案件対応は手動 |

**結論: BOOTH + WPアフィリエイト + AdSense の3本柱は完全放置で収益が発生する。**
**note と CW は週合計30分の手動作業が残るが、コンテンツ生成と提案文作成は全自動化可能。**
**SPの月間作業時間は約4時間（1日平均8分）に圧縮できる。**
