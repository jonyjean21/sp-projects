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
- **git push が 403 で失敗する場合**: `gh api` 経由でブランチ作成・更新を行う
- **リポジトリ設定**: `gh api repos/{owner}/{repo} -X PATCH` で変更する
- **GitHub Pages**: `gh api` で設定する
- **PRの作成・マージ**: `gh pr create` / `gh pr merge` を使う
- **ブランチ保護**: `gh api` で設定する

### GitHub API認証
- GitHub Secrets に PAT を保存済み（`GH_PAT_CLASSIC`, `GH_PAT_FINEGRAINED`）
- `gh` CLI が使えない環境では、GitHub REST API + `curl` で PR作成・マージを行う
- トークンが必要な場合はユーザーに確認する（Secretsから直接読み出しはできない）

### セキュリティルール
- `.env` ファイルは `.gitignore` に含め、絶対にコミットしない
- トークンやAPIキーをコード内にハードコードしない
- GitHub Secrets を使って機密情報を管理する
- 公開リポジトリには機密情報を含むファイルをpushしない

## プロジェクト構成

- **サイト**: GitHub Pages（main ブランチ / ルート）
- **技術スタック**: HTML / CSS / JavaScript（バニラ）
- **テーマ**: ダーク基調 / サイバーパンク風デザイン
- **対応言語**: 日本語メイン
