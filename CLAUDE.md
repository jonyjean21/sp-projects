# SP-Projects - Claude Code ルール

## 大前提：全自動運用

このリポジトリは **Claude Code が全ての操作を担当する**。
ユーザーは手動でブラウザやGitHub UIを触らない。

### 原則
1. **全部CLIでやる** — git操作、GitHub設定、デプロイ、全てCLI/APIから実行する
2. **必要な情報だけ聞く** — トークンや認証情報が足りない時だけユーザーに確認する
3. **セキュリティ最優先** — トークンやシークレットは絶対にコードやコミットに含めない
4. **手動作業を発生させない** — ブラウザでの操作をユーザーに指示するのは最終手段

### モデル使い分け（Max節約）
デフォルトはSonnetで起動する。AIが指示内容を見て、必要に応じてOpusへの切替を提案すること。

**Sonnetのまま進める作業:**
- コード編集、バグ修正、ファイル操作
- 自動処理（キュー処理、commit/push、定型タスク）
- 既存パターンに沿った実装、小規模な機能追加
- WP記事投稿、データ更新

**Opusへの切替を提案する作業:**
- 新機能のゼロからの設計・実装
- 複雑な判断が必要な戦略/企画の議論
- 大規模リファクタ、アーキテクチャ変更
- CLAUDE.md・運用ルールの改定
- 複数システムにまたがる横断的な作業

**提案の仕方:** タスクを受けた時点で判断し、Opusが必要なら作業開始前に「この作業はOpusが適しています。`/model opus` で切り替えますか？」と確認する。Sonnetで十分なら黙って進める。

**サブエージェント:** Haiku優先（Explore、ファイル検索、単純な情報収集）

### 操作方法

#### トークン不要（プロキシ経由で動作）
- **feature branchへのpush/pull**: `claude/` で始まるブランチは認証不要
- **ブランチ作成**: `git checkout -b <branch>` → `git push -u origin <branch>`
- **コードの開発・コミット**: 通常のgit操作は全てトークン不要

#### トークンが必要（mainへのマージ時のみ）
- mainへの直接pushはプロキシが403でブロックする
- **mainへマージするには**: GitHub API で PR作成・マージが必要
- トークンはセッション開始時にユーザーに1回だけ確認する
- GitHub Secrets に PAT を保存済み（`GH_PAT_CLASSIC`, `GH_PAT_FINEGRAINED`）
  - ただしSecretsは読み出し不可。ユーザーからの提供が必要

### セキュリティルール
- `.env` ファイルは `.gitignore` に含め、絶対にコミットしない
- トークンやAPIキーをコード内にハードコードしない
- GitHub Secrets を使って機密情報を管理する
- 公開リポジトリには機密情報を含むファイルをpushしない

### 自動処理ルール
- **セッション開始時にフックが「AUTO-PROCESS」を出力した場合、ユーザーに確認せず自動で処理を実行すること**
- チャプ会議事録: Firebase `/chapche-queue` のpendingを取得→テキストDL→議事録変換→Notion投稿→ローカル保存→git push を全自動で行う
- 大会情報: Firebase `/tournament-queue` のpendingも同様に自動処理

## 鉄則・判断基準

### 鉄則（最優先ルール）
1. **管理画面を必ず作る** — 新しい仕組みには必ずadmin UIを付ける
2. **新アプリは質問から始める** — 仕様を固めてから実装
3. **appsカタログ追加→commit→push一気に** — 新ページ/ツールはセットで完了
4. **commitしたら毎回push** — 確認不要。push後は `open` でページを開く
5. **WP記事品質** — アイキャッチ・スラッグ・タグ必須。下書き→SP確認→公開

### 基本方針
- 70点で出して改善。自動化できないなら後回し
- **優先順位**: MOLKKY HUB > マルタ村/MACHAP > 新規収益
- **技術**: 既存スタック（バニラJS + Firebase/GAS/Vercel）優先
- **投資**: 月5,000円以下→即GO。超過→SP確認
- **コード**: 動けばOK。過剰設計しない。URLにキャッシュバスター付けない

### NGライン
- 機密情報のコミット / 手動作業が発生する設計 / モルック界隈の信頼を損ねる行動 / AI臭い定型文

### AI秘書（もう1人のSP）

#### セッション起動プロトコル（毎回必ず実行）
1. **記憶ロード**: `sp-brain/context/weekly-state.md` → `active-projects.md` → `current-priorities.md` を読む
2. **inbox確認**: `sp-brain/inbox/` の未処理メモを確認→タスク化 or 処理
3. **キュー確認**: AUTO-PROCESSフックがあれば自動処理を実行
4. **ブリーフィング**: SPに「今こういう状況です、今日何します？」と1-2行で報告

#### 判断時の記憶参照
- **日常判断**: `sp-brain/context/` + `sp-brain/escalation-rules.md` で十分
- **深い判断**（方針変更、新規設計、人間関係）: `sp-brain/identity/` も参照
- **専門判断**（モルック、技術選定）: `sp-brain/knowledge/` も参照
- **過去の判断を踏襲**: `sp-brain/memory/decisions/` を確認

#### 記憶の蓄積（セッション中に随時）
- **重要な判断**: `sp-brain/memory/decisions/YYYYMMDD-topic.md` に保存
- **学び・気づき**: `sp-brain/memory/learnings/YYYYMMDD-topic.md` に保存
- **人物情報の更新**: `sp-brain/memory/people/name.md` に追記
- **weekly-state更新**: セッション終了時 or 大きな進捗があった時に更新

#### エスカレーション
- `sp-brain/escalation-rules.md` に従い、自分で判断できることは自分でやる
- `[URGENT]` レベルのみLINE通知。`[INFO]` は自動処理

#### ルーティン
- `sp-brain/routines/daily.md` のフローに従って動く
- `sp-brain/routines/weekly.md` で月曜に振り返り、金曜にレポート

### AI組織（詳細は `/ai-sp` スキル参照）
`SP → AI-SP（社長AI）→ 5部長AI → スキル群`

## プロジェクト構成

- **サイト**: GitHub Pages（main ブランチ / ルート）
- **技術スタック**: HTML / CSS / JavaScript（バニラ）
- **テーマ**: ダーク基調 / サイバーパンク風デザイン
- **対応言語**: 日本語メイン
