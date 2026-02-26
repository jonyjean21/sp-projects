# SP-Projects - Claude Code ルール

## 大前提：全自動運用

このリポジトリは **Claude Code が全ての操作を担当する**。
ユーザーは手動でブラウザやGitHub UIを触らない。

### 原則
1. **全部CLIでやる** — git操作、GitHub設定、デプロイ、全てCLI/APIから実行する
2. **必要な情報だけ聞く** — トークンや認証情報が足りない時だけユーザーに確認する
3. **セキュリティ最優先** — トークンやシークレットは絶対にコードやコミットに含めない
4. **手動作業を発生させない** — ブラウザでの操作をユーザーに指示するのは最終手段

### 操作方法（トークン不要）
- **git push/pull**: ローカルプロキシ経由で認証不要で動作する
- **ブランチのマージ**: PRを使わず `git merge` → `git push origin main` で直接マージする
- **ブランチ作成**: `git checkout -b <branch>` → `git push -u origin <branch>`

### GitHub API が必要な場合（トークン要）
- PR作成・マージ、リポジトリ設定変更、GitHub Pages設定など
- GitHub Secrets に PAT を保存済み（`GH_PAT_CLASSIC`, `GH_PAT_FINEGRAINED`）
- トークンが必要な場合のみユーザーに確認する
- 基本的にはトークン不要のgit操作で完結させること

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
