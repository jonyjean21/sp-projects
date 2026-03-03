# スマホ × Claude Code ウェブ版 運用設計メモ

> 記録日: 2026-03-03
> ステータス: アイデア段階（未実装）

---

## 背景・課題

理想は全操作をCLI（PC環境）で完結させること。
だが仕事中などにスマホしかない場面が発生する。

→ **ウェブ版Claude（claude.ai）を使うことになる**

---

## ウェブ版で何が困るか

```
スマホ
  ↓
ウェブ版Claude
  ↓
プロキシの壁
  ↓
Firebase / GA4 / GAS → ❌ 直接アクセスできない
```

CLIの場合はプロキシ経由でfirebase等のAPIに届くが、
ウェブ版は外部API直接呼び出しができない制限がある。

---

## 解決アイデア：GitHub Actions を橋にする

### 仕組み

```
【GitHub Actions（サーバー側・自動実行）】
  ↓ cronで定期実行（6時間ごとなど）
Firebase / GA4 にアクセス
  ↓
データを JSON ファイルに変換して commit・push
  ↓
data/ フォルダに最新データが常に存在する状態に
  ↓
ウェブ版Claude が git clone → ファイルを読める ✅
```

### ワークフロー例

```yaml
# .github/workflows/fetch-data.yml
name: データ取得
on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごと
  workflow_dispatch:         # 手動実行も可能

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Firebase・GA4からデータ取得
        run: node scripts/fetch-data.js
        env:
          FIREBASE_KEY: ${{ secrets.FIREBASE_KEY }}
          GA4_KEY: ${{ secrets.GA4_KEY }}
      - name: Commit
        run: |
          git config user.email "bot@github.com"
          git config user.name "DataBot"
          git add data/
          git commit -m "auto: データ更新" || true
          git push
```

---

## スマホでの理想的な作業フロー（実現後）

```
スマホ → ウェブ版Claude を開く
           ↓
         "最新データ確認して" と依頼
           ↓
         data/firebase.json を読む ✅
         data/analytics.json を読む ✅
           ↓
         分析・コード修正・push まで完結
```

---

## 現時点で「わからない」部分

- どのデータをどれくらいの頻度でfetchすべきか
- fetch-data.js の実装内容（Firebase・GA4の認証周り）
- Secrets に何を登録すればよいか
- スマホで実際にどんな作業が発生するか（読むだけ？編集もする？）

---

## 次のアクション（やるなら）

1. スマホで何の作業が必要かを明確にする
2. 必要なデータソースを絞る（Firebase? GA4? GAS?）
3. GitHub Actionsのワークフローを作成
4. Secretsに認証情報を登録
5. 動作確認

---

## 関連ファイル

- `CLAUDE.md` — 運用ルール全般
- `scripts/` — fetch用スクリプトを置く予定
- `data/` — 取得済みデータのJSON置き場

---

*このドキュメントは記事化の素材として保存。実装決定時に更新予定。*
