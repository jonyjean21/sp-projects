# Tournament Submit（大会情報投稿フォーム）

## ステータス: active

## 概要
モルック大会情報を MOLKKY HUB に投稿するためのWebフォーム。

## 目的・背景
- 大会主催者やユーザーが簡単に大会情報を登録できる
- Firebase キューに登録 → Claude Code `/tournament` スキルが自動処理
- 手動投稿の負担を軽減

## 技術スタック
- HTML / CSS / JavaScript（バニラ）
- テーマ: ダーク基調（#0a0a0a）、サイバーパンク風
- Firebase Realtime Database（キュー登録先）

## 機能一覧

| 機能 | 説明 | 優先度 | 状態 |
|------|------|--------|------|
| 投稿フォーム | 大会情報の入力UI | 高 | 完了 |
| Firebase連携 | キューへの書き込み | 高 | 要確認 |
| バリデーション | 必須項目チェック | 中 | 未着手 |
| 送信確認画面 | 投稿後のフィードバック | 低 | 未着手 |

## データ構造

Firebase `/tournament-queue/{id}`:
```json
{
  "url": "https://...",
  "source": "form",
  "status": "pending",
  "submitted_at": "2026-03-03T...",
  "processed_at": null
}
```

## 外部連携
- **Firebase RTDB**: `viisi-master-app` プロジェクト
- **WordPress REST API**: MOLKKY HUB への最終投稿先（`/tournament` スキル経由）

## 制約・ルール
- ダークテーマ統一（SP-Projects デザインガイドに準拠）
- 認証なし（公開フォーム）
- スパム対策を将来的に検討

## 今後の方針
- フォームバリデーション強化
- 送信後のステータス表示
- reCAPTCHA等のスパム対策
