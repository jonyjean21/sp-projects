# 提案文 B：AIチャットbot / LINE Bot 開発

**想定案件**: 顧客問い合わせにClaude APIで自動返信するLINE Botを作りたい（予算10万円）

**生成日**: 2026-03-02

---

## 提案文本文

はじめまして。Claude API × LINE Bot 開発が専門のエンジニア「SP」と申します。

「営業時間外の問い合わせに対応できていない」「スタッフが同じ質問に何度も回答している」──Claude APIを使ったLINE Botで、24時間365日の自動対応が実現できます。

私はNode.js + LINE Messaging API + Claude APIを組み合わせたシステムを複数構築しており、FAQデータベースと連携させることで「ただのキーワード返答」ではなく文脈を理解した自然な会話応答を実現しています。Firebase Realtime Databaseで会話履歴を管理し、対応できなかった質問は管理者LINEにエスカレーションする仕組みも標準搭載します。

【実現方法】
LINE Messaging API + Webhook → Node.js サーバー（Firebase Functions）→ Claude API（FAQ・商品情報をコンテキスト注入）→ 自動返信。管理画面でFAQ内容を随時更新できる構成も追加可能です。

予算10万円の範囲で基本機能フルセットを実装します。納期は要件確定から10〜14営業日。納品後1ヶ月のサポート付きです。

まず「よくある問い合わせ内容」と「現在の返答方法」を共有いただけますか？最適な構成をご提案します。お気軽にメッセージをどうぞ。

---

## メタ情報

- 文字数: 約460文字
- 想定予算: ¥100,000
- 技術スタック: Node.js / LINE Messaging API / Claude API (Anthropic) / Firebase Functions / Firebase Realtime Database
- 納期目安: 10〜14営業日
- ターゲット: 小売・飲食・美容・士業などの中小企業
- 訴求ポイント: Claude APIによる文脈理解の自然な返答、エスカレーション機能、Firebase活用による管理コスト削減
