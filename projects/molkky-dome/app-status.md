# マルタ村アプリ ステータス管理

> 最終更新: 2026-02-24
> 更新者: SP（Claude Code）
>
> **このファイルの使い方**: AIに「アプリの状況教えて」と聞けばここを参照して答える。
> チャプチェ会前にAIに「ステータスレポート作って」と言えば、このファイルベースで報告書を生成できる。

---

## サマリー

| # | アプリ | ステータス | GitHub | 次のアクション | 担当 |
|---|--------|-----------|--------|--------------|------|
| 1 | 推し活 | レビュー待ち | [oshi-katsu](https://github.com/marutamura/oshi-katsu) | セキュリティレビュー | SP |
| 2 | 目標達成部 | レビュー待ち | [mokuhyo-tassei-bu](https://github.com/marutamura/mokuhyo-tassei-bu) | コードレビュー | SP |
| 3 | 満願寺スタンプ | 実装中 | [manganji-stamp](https://github.com/marutamura/manganji-stamp) | デザイン確定→実装完了待ち | 中さん |
| 4 | marutamura-bot | 稼働中 | [marutamura-bot](https://github.com/marutamura/marutamura-bot) | Notion連携断念→ポータル連携待ち | - |
| 5 | プチスポンサー | 企画段階 | [marutamura](https://github.com/marutamura/marutamura) | 仕様検討 | 未定 |
| 6 | マルタギルド | 要確認 | なし（Manusのみ） | 中身確認→GitHub移行判断 | SP |
| 7 | モノハブ | 要確認 | なし（Manusのみ） | 中身確認→GitHub移行判断 | SP |
| 8 | 満願寺どっち？ | 要確認 | なし（Manusのみ） | 中身確認→GitHub移行判断 | SP |
| 9 | あちらさまからです | 要確認 | なし（Manusのみ） | 中身確認→GitHub移行判断 | SP |
| 10 | ハッピー鑑定士 | 要確認 | なし（Manusのみ） | 中身確認→GitHub移行判断 | SP |

**レビュー待ち: 2件 / 開発中: 1件 / 要確認: 5件 / 稼働中: 1件 / 企画段階: 1件**

---

## 詳細ステータス

### 1. 推し活（oshi-katsu）

| 項目 | 内容 |
|------|------|
| リポジトリ | [marutamura/oshi-katsu](https://github.com/marutamura/oshi-katsu) |
| デプロイURL | [oshikatsu.manus.space](https://oshikatsu.manus.space) |
| 技術 | React 19 + Express + tRPC + MySQL + Drizzle |
| 認証 | JWT + SSO |
| ステータス | **開発完了・レビュー待ち** |
| レビュー優先度 | **1位**（SSO+認証あり → セキュリティレビュー最優先） |

**次のアクション:**
- [ ] SP: セキュリティレビュー実施（JWT実装、SSO、入力バリデーション）
- [ ] SP: レビュー結果をGitHub Issueまたはこのファイルのレビューログに記録
- [ ] 中さん: レビュー指摘対応

**特記事項:**
- SSO基盤の実装あり → 他アプリへの横展開の基礎になる
- 招待制コミュニティ → 認証まわりが特に重要

---

### 2. 目標達成部（mokuhyo-tassei-bu）

| 項目 | 内容 |
|------|------|
| リポジトリ | [marutamura/mokuhyo-tassei-bu](https://github.com/marutamura/mokuhyo-tassei-bu) |
| デプロイURL | [Manus環境](https://5174-icusdcnczkhi5e0ewd04e-590d85ac.sg1.manus.computer/) |
| 技術 | React 19 + Express + tRPC + MySQL + Drizzle |
| 認証 | OAuth |
| ステータス | **開発完了・レビュー待ち** |
| レビュー優先度 | **2位**（フルスタック完成済み、DB操作あり） |

**次のアクション:**
- [ ] SP: コードレビュー実施（DB操作、API設計、型安全性）
- [ ] SP: レビュー結果を記録
- [ ] 中さん: レビュー指摘対応

**特記事項:**
- 通知テーブルあり → 将来の共通通知基盤の参考になる
- フルスタック構成 → 他アプリのテンプレートにもなりうる

---

### 3. 満願寺スタンプ（manganji-stamp）

| 項目 | 内容 |
|------|------|
| リポジトリ | [marutamura/manganji-stamp](https://github.com/marutamura/manganji-stamp) |
| デプロイURL | [manganji-stamp.vercel.app](https://manganji-stamp.vercel.app) |
| 技術 | React 19 + Express |
| 認証 | OAuth |
| DB | なし |
| ステータス | **デザイン確定・実装中** |
| レビュー優先度 | 3位（フロントエンド中心、リスク低め） |

**次のアクション:**
- [ ] 中さん: 実装完了
- [ ] SP: 完了後にコードレビュー

**特記事項:**
- 全国77ヶ所デジタル御朱印帳コンセプト
- Vercelデプロイ済み（他アプリもVercel移行の参考に）

---

### 4. marutamura-bot

| 項目 | 内容 |
|------|------|
| リポジトリ | [marutamura/marutamura-bot](https://github.com/marutamura/marutamura-bot) |
| デプロイURL | [marutamura-bot.vercel.app](https://marutamura-bot.vercel.app) |
| 技術 | Node + Claude AI |
| 認証 | LINE署名検証 |
| ステータス | **稼働中** |

**次のアクション:**
- 現状維持（ポータルアプリ完成後に連携を再設計）

**現在の制約:**
- Notion連携 → **断念**（下の階層取得不可、トークン消費大）
- GitHub Issue自動作成 → **停止中**（0件）
- → ポータルアプリのAPI経由でDB直接操作に移行予定

---

### 5. プチスポンサー

| 項目 | 内容 |
|------|------|
| リポジトリ | [marutamura/marutamura](https://github.com/marutamura/marutamura) の petit-sponsor/ |
| ステータス | **企画段階** |

**次のアクション:**
- [ ] 仕様の具体化（チャプチェ会で検討）

---

### 6〜10. Manusのみアプリ（GitHub未連携）

これらは中身未確認。次のチャプチェ会で中さんに確認して、GitHub移行の要否を判断する。

| # | アプリ名 | URL | 推定カテゴリ | 確認事項 |
|---|---------|-----|-------------|---------|
| 6 | マルタギルド | [maruta-guild.manus.space](https://maruta-guild.manus.space) | ヒト系 | メンバー管理？ギルド制度？SSO基盤になりうる？ |
| 7 | モノハブ | [monohub.manus.space](https://monohub.manus.space) | モノ系 | モノの共有/貸し借り？ |
| 8 | 満願寺どっち？ | [manganji-docchi.manus.space](https://manganji-docchi.manus.space) | 文化系 | 二択ゲーム？スタンプ連携？ |
| 9 | あちらさまからです | [achirasama.manus.space](https://achirasama.manus.space) | モノ系 | 差し入れ/おすそ分け記録？ |
| 10 | ハッピー鑑定士 | [happykantei.manus.space](https://happykantei.manus.space) | 文化系 | 占い/診断系？ |

**一括次のアクション:**
- [ ] 各URLにアクセスして中身確認
- [ ] GitHub移行が必要か判断（開発続けるなら移行、実験で終わったなら記録だけ）
- [ ] 移行する場合 → marutamura org にリポジトリ作成 + Manusからコード移行

---

## 共通基盤の状態

| 基盤 | 現状 | 理想 | ブロッカー |
|------|------|------|-----------|
| SSO認証 | oshi-katsuに実装済み | 全アプリ共通SSO | ポータル開発待ち |
| セッション管理 | `app_session_id` 共通 | 統一済み（OK） | - |
| ユーザーDB | アプリ個別 | 共通ユーザーDB | ポータル開発待ち |
| 通知 | mokuhyo-tassei-buに通知テーブルあり | 共通通知基盤 | 設計未着手 |
| LINE Bot | 稼働中（Notion/Issue連携は停止） | ポータルAPI経由 | ポータル開発待ち |

---

## ステータス定義

| ステータス | 意味 |
|-----------|------|
| 企画段階 | アイデア/仕様検討中 |
| 実装中 | 中さんがManusで開発中 |
| レビュー待ち | 開発完了 → SPのコードレビュー待ち |
| 修正中 | レビュー指摘の対応中 |
| 稼働中 | リリース済み・本番運用中 |
| 要確認 | 中身未確認（Manusのみアプリ） |
| 保留 | 一時停止中 |

---

## レビューログ

> レビュー実施時にここに追記していく

| 日付 | アプリ | レビュアー | 結果サマリー | 詳細リンク |
|------|--------|-----------|-------------|-----------|
| - | - | - | （まだレビュー未実施） | - |

---

## 更新ルール

- **中さんが新しいアプリをpush/デプロイしたら**: サマリーテーブルに追加 + 詳細セクション作成
- **コードレビュー実施したら**: レビューログに追記 + 該当アプリのステータス更新
- **チャプチェ会で状況変わったら**: 該当アプリの次のアクションを更新
- **更新のタイミング**: チャプチェ会の前後、またはAIセッション時
