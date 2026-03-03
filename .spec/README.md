# 仕様駆動開発（Spec-Driven Development）

## この仕組みについて

Claude Code がコードを書く前に、まず **仕様（Spec）を参照する**。
「ゼロから生成」ではなく「仕様に沿って構造化」するアプローチ。

> 参考: [Claude Codeですべての日常業務を爆速化しよう！](https://qiita.com/minorun365/items/114f53def8cb0db60f47)

## 基本ルール

1. **新規開発・大きな変更の前に spec を書く（or 更新する）**
2. **Claude Code は spec を読んでから実装に入る**
3. **spec と実装が乖離したら spec を先に直す**

## ディレクトリ構成

```
.spec/
├── README.md           ← このファイル
├── _template.md        ← 新規spec作成用テンプレート
├── teamride.md         ← TeamRide アプリ仕様
├── tournament-submit.md ← 大会投稿フォーム仕様
├── income-engine.md    ← 収入エンジン仕様
└── molkky-dome.md      ← モルック・ドーム プロジェクト仕様
```

## 使い方

### 新機能を作るとき
1. `_template.md` をコピーして spec を書く
2. Claude Code に「`.spec/xxx.md` を読んで実装して」と伝える
3. 実装完了後、spec の「ステータス」を更新

### 既存機能を変更するとき
1. 該当する spec を確認
2. 変更内容を spec に反映
3. spec に沿って実装
