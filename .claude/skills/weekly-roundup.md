# /weekly-roundup — 週間大会まとめ記事の全自動生成

## 概要
毎週月曜日にその週（月〜日）のモルック大会情報をまとめた記事を全自動で公開し、IFTTT経由でXポストする。
平日・祝日開催も含め、1週間分を網羅する。**SP確認不要の完全自動化。**

## 自動化スクリプト
```bash
python3 tools/weekly-roundup-gen.py              # 今週分を生成・公開・Xポスト予約
python3 tools/weekly-roundup-gen.py --dry-run     # プレビューのみ（投稿しない）
python3 tools/weekly-roundup-gen.py --no-tweet    # 記事公開のみ（Xポストなし）
python3 tools/weekly-roundup-gen.py --week-offset 1  # 来週分を生成
```

## トリガー
- セッション開始時のフックで「今日は月曜日」を検知 → `python3 tools/weekly-roundup-gen.py` を自動実行
- または手動で `/weekly-roundup` を実行

## スクリプトの処理フロー
1. WP REST API で今週（月〜日）の大会データ取得
2. 日別にグループ化した記事HTMLを生成
3. 冒頭・末尾に大会情報一覧ページ(/event/tournament/)へのCTAを配置
4. tools/eyecatch-gen.py でアイキャッチ画像を生成
5. WPメディアにアイキャッチをアップロード
6. WP記事を **status: publish** で自動公開（下書き確認なし）
7. IFTTT Webhook 経由で Xポストを12:00 JSTに予約

## 記事フォーマット
- タイトル: 【今週のモルック大会】{M/D}〜{M/D}の全国大会情報まとめ｜{年}{月}第{N}週
- slug: weekly-molkky-{YYYYMMDD}（月曜日の日付）
- カテゴリ: 週間まとめ(139) + 大会情報(8)
- 重複チェック: 同一slugが存在すればスキップ
- 0件の週はスキップ

## 重要ルール
1. **全自動** — スクリプト実行のみ。SP確認不要
2. **リンクは実在するもののみ** — sns_link / detail_link のAPIデータを使用
3. **tournament CPT の個別ページにはリンクしない** — 参加チーム一覧しか表示されない
4. **アイキャッチは必ず設定** — tools/eyecatch-gen.py で生成
5. **日本時間(JST)で全て処理** — UTC+9
6. **大会情報ページへの導線を必ず配置** — 冒頭と末尾に /event/tournament/ へのリンク
