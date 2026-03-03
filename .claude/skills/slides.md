# スライド作成 スキル

## 概要
Marp を使って Markdown からプレゼン資料（PDF/PPTX/HTML）を爆速作成する。
SP-Projects のダークテーマ（sp-dark）を標準適用。

## 使い方
- `/slides <テーマ>` — テーマを指定してスライドを新規作成
- `/slides build <ファイル>` — 既存のMarkdownをPDF/PPTX/HTMLにビルド
- `/slides build <ファイル> --pdf` — PDF のみビルド
- `/slides build <ファイル> --pptx` — PPTX のみビルド
- `/slides list` — slides/ 内のスライド一覧を表示

## 処理フロー

### Step 1: スライド作成（新規の場合）

ユーザーからテーマ・内容のインプットを受けて、Markdownスライドを生成する。

**保存先**: `slides/` ディレクトリ
**ファイル名規則**: `YYYYMMDD_タイトル.md`（日本語OK）

```markdown
---
marp: true
theme: sp-dark
paginate: true
---

<!-- _class: lead -->

# タイトル
## サブタイトル

---

# スライド内容...
```

### Step 2: テーマ設定

デフォルトで `sp-dark` テーマを使用。テーマファイル: `slides/themes/sp-dark.css`

テーマの特徴:
- ダーク背景（#0d1117）
- アクセントカラー: 青（#58a6ff）、緑（#7ee787）
- Noto Sans JP フォント
- `<!-- _class: lead -->` でタイトルスライド用レイアウト

### Step 3: ビルド

```bash
cd /home/user/sp-projects/slides

# PDF 出力
npx @marp-team/marp-cli --pdf --allow-local-files --theme-set themes/ <ファイル名>.md -o output/<ファイル名>.pdf

# PPTX 出力
npx @marp-team/marp-cli --pptx --allow-local-files --theme-set themes/ <ファイル名>.md -o output/<ファイル名>.pptx

# HTML 出力
npx @marp-team/marp-cli --html --allow-local-files --theme-set themes/ <ファイル名>.md -o output/<ファイル名>.html
```

## スライド作成のルール

### 構成原則
1. **1スライド1メッセージ** — 詰め込みすぎない
2. **箇条書きは5項目以内** — 読みやすさ優先
3. **コードブロック、テーブルを活用** — データは視覚的に
4. **最初と最後はリードスライド** — `<!-- _class: lead -->` を使用

### 仕様駆動アプローチ
- ユーザーの「伝えたいこと」をまずヒアリング
- ゼロから生成するのではなく、ユーザーのインプットを構造化・整理
- ドラフト → レビュー → 修正 のサイクルを回す

### Marp記法メモ
- `---` でスライド区切り
- `<!-- _class: lead -->` タイトルスライド
- `<!-- _footer: テキスト -->` フッター
- `![bg right:40%](image.png)` 背景画像（右40%）
- `![w:300](image.png)` サイズ指定画像

## 出力ディレクトリ
- `slides/output/` に PDF/PPTX/HTML を出力
- output/ は .gitignore に追加済み（大容量ファイル除外）
