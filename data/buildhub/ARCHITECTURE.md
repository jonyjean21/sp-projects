# BuildHub 自動投稿パイプライン アーキテクチャ

> 作成: 2026-03-12 | 状態: 本番稼働中

---

## 全体像

```
【収集】                    【蓄積】              【生成・投稿】

  Reddit (r/ClaudeAI)  ─┐
  Reddit (r/ClaudeCode) ─┤
  Hacker News          ─┤
  Zenn                 ─┼→ Firebase RTDB   →  ConoHa WING cron
  Qiita                ─┤  /claude-tips-queue     buildhub-cron.php
  dev.to               ─┤  (pending/posted)       毎朝7時JST
  GitHub Releases      ─┘                         ↓
                                              Gemini API
  ↑                                               ↓
  GAS (main.gs)                             WP記事として投稿
  6時間ごとに自動収集                          buildhub.jp
```

---

## 各コンポーネントの役割

### 1. GAS 収集スクリプト（gas/claude-tips-collector/main.gs）
- **何をする**: 7つのソースをクロールして記事ネタを収集
- **どこに保存**: Firebase RTDB `/claude-tips-queue` に `status: "pending"` で追加
- **実行タイミング**: 6時間おき（GASトリガー設定済み）
- **スコアリング**: 海外ソース+50、コードあり+20、GitHub URL+15、GitHub releases固定60

### 2. Firebase RTDB（キュー）
- **何をする**: 収集済みネタのキュー管理
- **ステータス**: `pending` → `posted` / `skipped`
- **重複防止**: スラッグが既存WP記事と一致したらスキップ

### 3. ConoHa WING cron（buildhub-cron.php）← **正式パイプライン**
- **何をする**: Firebase pending → Gemini で記事生成 → WP投稿
- **実行タイミング**: 毎朝7:00 JST（ConoHa WING管理画面でcron設定）
- **配置場所**: `/home/{user}/public_html/buildhub.jp/buildhub-cron.php`
- **記事構成**:
  - メイン記事（高スコア1本をフル翻訳・詳細解説）
  - その他注目記事（残りを要約）
  - 編集部コメント（Geminiが生成）
- **アイキャッチ**: Pexels APIで自動取得

---

## なぜ ConoHa WING cron が正解か

```
GH Actions（GitHub = Microsoft Azure）
    ↓
    403 Blocked ← ConoHa WINGはMicrosoft/Google IPを全ブロック
    buildhub.jpのWP APIに到達できない

ConoHa WING cron（サーバー内から実行）
    ↓
    ✅ 直接WP APIにアクセス可能（ループバック）
    外部IP制限を受けない
```

**教訓**: レンタルサーバーの自動化は「サーバー内部で完結させる」のが基本。
外部サービス（GH Actions / GAS）からWP APIを叩く構成はブロックされる可能性がある。

---

## APIキー管理

| キー | 現状 | リスク | 改善案（任意） |
|------|------|--------|--------------|
| GEMINI_API_KEY | PHPに直書き | 低（gitignore済み、サーバー内のみ） | wp-config.phpに移動 |
| PEXELS_API_KEY | PHPに直書き | 低（同上） | wp-config.phpに移動 |

**現状の安全性**: `deploy/` フォルダは `.gitignore` 済みのため、GitHubに漏れるリスクはない。
サーバーが侵害された場合のリスクはあるが、現実的な運用としては許容範囲。

**改善したい場合（任意）**: ConoHa WINGのwp-config.phpに追記
```php
// wp-config.php の最後に追加（FTPでアクセスして編集）
define('GEMINI_API_KEY', 'your-key');
define('PEXELS_API_KEY', 'your-key');
```
→ buildhub-cron.phpのdefine行を削除

---

## ローカル手動実行（必要な時）

```bash
# BuildHub記事を今すぐ投稿（ローカルから）
GEMINI_API_KEY=... BUILDHUB_WP_USER=... BUILDHUB_WP_APP_PASS=... PEXELS_API_KEY=... \
  python3 tools/buildhub-digest.py

# ドライラン（投稿しない）
GEMINI_API_KEY=... python3 tools/buildhub-digest.py --dry-run
```

---

## 廃止したもの・理由

| 廃止したもの | 理由 |
|---|---|
| GH Actions schedule (`buildhub-digest.yml`) | ConoHa WING IP制限でブロックされるため。`workflow_dispatch`（手動）のみ残す |
| GAS daily-digest.gs | ConoHa WINGにGoogleIPがブロックされるため |

---

## X投稿・note用まとめ（コピペ用）

### ワンライナー説明
> GASで7ソースを収集→Firebaseにキュー→ConoHa WINGのPHPが毎朝Geminiで記事生成→自動投稿。GitHub Actionsは使えない（Microsoft IPがブロックされる）。

### 図解（ASCII）
```
収集(GAS) → Firebase → ConoHa PHP cron → Gemini → WordPress
  6h毎         queue       毎朝7時          AI生成     自動公開
```

### 学び
- レンタルサーバー自動化は「サーバー内cron」が最強
- GitHub Actions / GAS は外部IPとしてブロックされることがある
- Firebaseをキューとして使うと収集と投稿を疎結合にできる
