# マルタ村ポータルアプリ 設計書

> 作成: 2026-02-24
> ステータス: 設計中

---

## 背景と課題

### なぜポータルが必要か

1. **Notion依存からの脱却** — 現在の管理は全てNotionベース。LINE Bot × Notion連携を試したが、下の階層が取得できず、トークン/クレジット消費が大きすぎて断念
2. **アプリ群の入口がない** — 10+アプリが並走しているが、統一的な入口がない。LINE Botが事実上の入口だが限界あり
3. **GitHub Issueが停止中** — marutamura-botのIssue自動作成機能が機能していない（0件）
4. **運営とユーザーで必要な情報が違う** — 運営はタスク管理・進捗管理、ユーザーはサービス一覧・イベント情報

### 現状のツール構成と問題点

```
Notion（メイン管理）─── 下の階層がAPI経由で取れない
  ├── プロジェクト一覧        └── トークン/クレジット消費大
  ├── やることリスト
  ├── 打合せメモ
  └── 各種管理ページ

LINE Bot ─── Issue作成が停止中
  ├── Claude AI連携        └── Notion連携も断念
  └── GitHub Issue作成（停止中）

GitHub ─── レビューフロー自体は機能
  ├── 5リポジトリ
  └── Issues（使われていない）
```

---

## ポータルの2層構成

```
┌─────────────────────────────────────────────────┐
│            マルタ村ポータル                        │
│                                                   │
│  ┌─────────────────┐  ┌─────────────────────┐   │
│  │  運営ポータル     │  │  ユーザーポータル     │   │
│  │  (Admin)         │  │  (Public)            │   │
│  │                  │  │                      │   │
│  │  SP/中/ししょー │  │  ドーム利用者        │   │
│  │  3人限定         │  │  コミュニティメンバー  │   │
│  └────────┬────────┘  └──────────┬───────────┘   │
│           │                       │               │
│  ┌────────▼───────────────────────▼───────────┐   │
│  │            共通基盤                          │   │
│  │  SSO認証 / ユーザーDB / 通知                 │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## A. 運営ポータル（Admin Portal）

### 対象ユーザー
- SP（全体管理・企画推進・コードレビュー）
- 中さん（ドーム運営・アプリ開発主導）
- ししょー（チャプチェ会メンバー）

### 機能一覧

#### A1. ダッシュボード
- 今日のタスク概要（担当別）
- アプリ群のステータス一覧
- 直近のチャプチェ会メモ
- GitHub最新アクティビティ

#### A2. タスク管理（Notion「やることリスト」の代替）
- 担当別タスクボード（SP・中さん・ししょー）
- 優先度・期限設定
- ステータス管理（未着手 → 進行中 → 完了）
- カテゴリ分け（ドーム系/アプリ系/マルタ村系/川モル系）
- **Notionスクショにある担当別ビューを再現**

#### A3. プロジェクト管理
- 全プロジェクト一覧（Notionの全カテゴリ）
  - ドーム系①：お客さん満足度向上
  - ドーム系②：経営改善（平日）
  - ドーム系③：タスク
  - マルタ村系（概念・ビジョン）
  - マルタ村系（サービス）
  - 文化
  - 川モル系
  - その他
- プロジェクトごとの進捗状況
- 議事メモ・検討履歴

#### A4. アプリ管理
- 全10+アプリのステータス一覧
- GitHub連携（各リポジトリの最新コミット・Issue・PR）
- デプロイ状況（Vercel / Manus）
- コードレビューキュー

#### A5. チャプチェ会（ミーティング管理）
- 議事録の作成・管理
- 検討ボックス（アジェンダ管理）
- 決定事項のタスク化
- みんなの声を反映しました（フィードバック追跡）

#### A6. ドーム運営
- 制度・仕組みの一覧管理
- 備品・消耗品管理
- ポップ・お知らせ管理
- 送付業務トラッカー

---

## B. ユーザーポータル（Public Portal）

### 対象ユーザー
- モルックドーム利用者
- マルタ村コミュニティメンバー
- 一般の訪問者

### 機能一覧

#### B1. マルタ村トップ
- マルタ村のコンセプト紹介
- サービス一覧（カード型UI）
- 最新のお知らせ

#### B2. サービスハブ
- 全アプリへの導線（SSO連携でシームレス遷移）
  - 推し活コミュニティ → oshi-katsu
  - 目標達成部 → mokuhyo-tassei-bu
  - 満願寺スタンプ → manganji-stamp
  - モノハブ、あちらさまからです、etc.
- 各サービスの概要・スクリーンショット

#### B3. モルックドーム情報
- 営業情報・アクセス
- 予約（貸切プラン・大会プラン・早朝パスポート）
- 大会情報・結果
- 川西12傑ランキング

#### B4. コミュニティ
- イベントカレンダー
- マルタ文化・ハッピー文化紹介
- お知らせ・ニュース

---

## 技術設計

### 技術スタック（既存アプリと統一）

```
フロントエンド: React 19 + TypeScript + Vite + Radix UI + Tailwind CSS
バックエンド:   Express + tRPC
DB:            MySQL + Drizzle ORM（SQLiteから開始も可）
認証:          SSO（oshi-katsu実装を汎用化）
デプロイ:      Vercel
パッケージ:    pnpm
```

### リポジトリ構成

```
marutamura/marutamura-portal
├── apps/
│   ├── admin/          # 運営ポータル
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Tasks.tsx
│   │   │   │   ├── Projects.tsx
│   │   │   │   ├── Apps.tsx
│   │   │   │   ├── Meetings.tsx
│   │   │   │   └── DomeOps.tsx
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   └── index.html
│   │
│   └── public/         # ユーザーポータル
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Home.tsx
│       │   │   ├── Services.tsx
│       │   │   ├── DomeInfo.tsx
│       │   │   └── Community.tsx
│       │   ├── components/
│       │   └── hooks/
│       └── index.html
│
├── packages/
│   ├── shared/         # 共通コンポーネント・型定義
│   ├── db/             # Drizzle スキーマ・マイグレーション
│   └── auth/           # SSO認証モジュール
│
├── server/             # Express + tRPC API
│   ├── routers/
│   │   ├── tasks.ts
│   │   ├── projects.ts
│   │   ├── apps.ts
│   │   ├── meetings.ts
│   │   └── public.ts
│   └── index.ts
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### DB スキーマ（概要）

```sql
-- タスク管理（Notionのやることリスト代替）
CREATE TABLE tasks (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  assignee    ENUM('kujaku', 'naka', 'shisho') NOT NULL,
  status      ENUM('todo', 'in_progress', 'done') DEFAULT 'todo',
  priority    ENUM('urgent', 'high', 'medium', 'low') DEFAULT 'medium',
  category    ENUM('dome_satisfaction', 'dome_weekday', 'dome_task',
                   'marutamura_vision', 'marutamura_service',
                   'culture', 'kawamol', 'app', 'other') NOT NULL,
  due_date    DATE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- プロジェクト管理
CREATE TABLE projects (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(100) NOT NULL,
  status      ENUM('planning', 'developing', 'running', 'done', 'paused') DEFAULT 'planning',
  description TEXT,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- チャプチェ会 議事録
CREATE TABLE meetings (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  date        DATE NOT NULL,
  title       VARCHAR(255),
  agenda      TEXT,        -- 検討ボックス
  notes       TEXT,        -- 打合せメモ
  decisions   TEXT,        -- 決定事項
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- アプリ管理
CREATE TABLE apps (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  repo_url    VARCHAR(255),
  deploy_url  VARCHAR(255),
  tech_stack  VARCHAR(255),
  status      ENUM('planning', 'developing', 'review', 'running', 'paused') DEFAULT 'planning',
  has_github  BOOLEAN DEFAULT FALSE,
  notes       TEXT,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- お知らせ（ユーザーポータル用）
CREATE TABLE announcements (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  title       VARCHAR(255) NOT NULL,
  content     TEXT NOT NULL,
  category    VARCHAR(100),
  published   BOOLEAN DEFAULT FALSE,
  publish_at  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 開発フェーズ

### Phase 1: 運営ポータル MVP（最優先）
Notionの「やることリスト」を移行する。これが一番日常的に使う機能。

**スコープ:**
- 認証（3人限定 → 簡易認証 or SSO）
- ダッシュボード（タスク概要）
- タスク管理（担当別ボード・ステータス管理）
- Notionからの初期データ移行

**ゴール:** チャプチェ会でポータルのタスクボードを使って進捗確認できる

### Phase 2: プロジェクト管理 + アプリ管理
- プロジェクト一覧（全カテゴリ）
- アプリステータス一覧
- GitHub連携（API経由でリポジトリ情報取得）

### Phase 3: チャプチェ会 + ドーム運営
- 議事録管理
- 検討ボックス
- ドーム運営タスク

### Phase 4: ユーザーポータル
- マルタ村トップページ
- サービスハブ（全アプリへの導線）
- モルックドーム情報
- SSO連携でシームレス遷移

### Phase 5: LINE Bot 連携復活
- ポータルのAPIを通じてLINE Botからタスク追加
- 通知配信（ポータル → LINE）
- Notion連携は不要（ポータルが代替）

---

## Notion連携を諦めた代わりに

```
Before（断念した構成）:
  LINE Bot → Claude AI → Notion API → 下の階層取れない → トークン大量消費

After（ポータルで代替）:
  LINE Bot → ポータルAPI → DB直接操作 → 高速・低コスト
  ブラウザ → ポータルUI → DB直接操作 → 全データ見える
```

**メリット:**
- Notion APIの制限に縛られない
- トークン/クレジット消費が激減（自前DB直叩き）
- 下の階層も全部見える（自分のDBだから）
- カスタマイズ自由（Notionの制約なし）

---

## LINE Bot との関係

marutamura-bot の役割を再定義:

| 機能 | 現状 | ポータル導入後 |
|------|------|----------------|
| Notion操作 | **断念** | → ポータルAPI経由でDB操作 |
| GitHub Issue作成 | **停止中** | → ポータル経由 or 直接GitHub API |
| タスク追加 | なし | → LINEから「○○やる」→ ポータルにタスク追加 |
| 進捗確認 | なし | → LINEで「今のタスク」→ ポータルから取得 |
| AI相談 | Claude連携 | → 維持（ポータルのデータも参照可能に） |

---

## 次のアクション

1. **Phase 1 から着手** — 運営ポータルのタスク管理MVP
2. **marutamura org に `marutamura-portal` リポジトリ作成**
3. **Notionのやることリストを初期データとしてDBに投入**
4. **チャプチェ会でお披露目 → フィードバック → 改善**

---

## 参考

- [マルタ村全体設計](./marutamura-architecture.md)
- [コードレビューワークフロー](./marutamura-review-workflow.md)
- [タスク一覧](../tasks/current.md)
- [プロジェクト一覧](../projects/molkky-dome/README.md)
