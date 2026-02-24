# sp-projects

孔雀のプロジェクト司令塔。方針・進捗・タスク・ナレッジをここに集約する。

## まず見るところ

| やりたいこと | 見る場所 |
|-------------|---------|
| **次やることを確認** | [`tasks/current.md`](tasks/current.md) |
| **アプリの状況を確認** | [`projects/molkky-dome/app-status.md`](projects/molkky-dome/app-status.md) |
| **チャプチェ会の準備** | [`docs/chapche-status-template.md`](docs/chapche-status-template.md) |
| **会議用ダッシュボード** | [`docs/chapche-dashboard.html`](docs/chapche-dashboard.html)（ブラウザで開いて画面共有） |
| **MOLKKY HUB の状況** | [`projects/personal/molkky-hub.md`](projects/personal/molkky-hub.md) |
| **マルタ村 PJ の状況** | [`projects/molkky-dome/README.md`](projects/molkky-dome/README.md) |
| **完了タスクの記録** | [`tasks/done.md`](tasks/done.md) |
| **セットアップ手順書** | [`docs/setup-guides/`](docs/setup-guides/README.md) |
| **設計メモ・ナレッジ** | [`docs/`](docs/README.md) |

## プロジェクト領域

### 個人プロジェクト（`projects/personal/`）

- **[MOLKKY HUB](projects/personal/molkky-hub.md)** — モルック総合情報メディア（WordPress + SWELL @ ConoHa）
  - 月間 約3,000セッション / 6,000PV（2025年2月時点）
  - X（SNS）が最大の集客チャネル
  - 大会情報のスプシ→GAS→WP自動投稿が稼働中
  - 寄稿プロジェクト（レギュラー3名）で週2〜3回更新

### マルタ村共同プロジェクト（`projects/molkky-dome/`）

- マルタ村（兵庫県川西市）のコミュニティ経済圏構想
- 中さん + ししょー + 孔雀の3人体制、週2回チャプチェ会
- 中さんがManusでアプリ開発 → GitHub org: [marutamura](https://github.com/marutamura)
- 孔雀はClaude Codeでコードレビュー & 全体設計を担当
- アプリ10個以上（GitHub連携済5個 + Manusのみ5個+）
- [コードレビュー・ワークフロー](docs/marutamura-review-workflow.md)

## 構成

```
sp-projects/
├── README.md                    ← いま見ているファイル
├── tasks/                       # タスク管理（PCを開いたらまずここ）
│   ├── README.md
│   ├── current.md               # 今やること・次やること
│   └── done.md                  # 完了済みタスクのログ
├── projects/
│   ├── personal/                # 個人プロジェクト
│   │   └── molkky-hub.md
│   └── molkky-dome/             # マルタ村共同プロジェクト
│       ├── README.md
│       └── app-status.md        # アプリ別ステータス管理（AIが参照）
├── scripts/                     # コピペで使えるスクリプト
│   └── ga4-monthly-export.gs    # GA4月次エクスポートGAS
└── docs/                        # 意思決定ログ・設計メモ・ナレッジ
    ├── README.md
    ├── chapche-status-template.md # チャプチェ会レポートテンプレート
    ├── chapche-dashboard.html   # 会議投影用ダッシュボード（ブラウザで開く）
    └── setup-guides/             # セットアップ手順書（順番に実行するだけ）
```

## 運営方針

- **PC時間が限られている** → 効率化を最優先で設計する
- **タスクはここに集約** → Notion・todoアプリ・脳内に散らばっているものをここに持ってくる
- **設計判断や学びは docs/ に蓄積** → 次に同じ判断をするとき迷わないように
