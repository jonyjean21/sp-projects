# SP-Projects - Claude Code ルール

## 大前提：全自動運用

このリポジトリは **Claude Code が全ての操作を担当する**。
ユーザーは手動でブラウザやGitHub UIを触らない。

### 原則
1. **全部CLIでやる** — git操作、GitHub設定、デプロイ、全てCLI/APIから実行する
2. **必要な情報だけ聞く** — トークンや認証情報が足りない時だけユーザーに確認する
3. **セキュリティ最優先** — トークンやシークレットは絶対にコードやコミットに含めない
4. **手動作業を発生させない** — ブラウザでの操作をユーザーに指示するのは最終手段

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

## プロジェクト構成

- **サイト**: GitHub Pages（main ブランチ / ルート）
- **技術スタック**: HTML / CSS / JavaScript（バニラ）
- **テーマ**: ダーク基調 / サイバーパンク風デザイン
- **対応言語**: 日本語メイン
