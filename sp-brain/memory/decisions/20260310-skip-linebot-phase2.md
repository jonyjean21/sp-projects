# LINE Bot（Phase 2）をスキップ → Phase 3（自律稼働）へ

- **日付**: 2026-03-10
- **決定**: LINE Bot連携は後回し。Todoistメモ→セッション処理のフローで十分

## 理由
- PCの前にいない時にAI秘書とやり取りする場面が少ない
- Todoistで回ってるなら追加コスト（Claude API費用）は不要
- LINE Botは「ただのAPI中継」になるリスクがある

## 今後のフェーズ構成（修正版）
1. Phase 1: 記憶層（sp-brain/） ← 完了
2. ~~Phase 2: LINE Bot連携~~ → スキップ（必要になったら再検討）
3. Phase 3: 自律稼働（GASトリガー + LINE通知）← 次はここ

## Phase 3でやること
- GASの定期実行でキュー処理（Firebase）を自動化
- 処理結果をLINE通知（Bot不要、LINE Notify or Messaging APIのpushだけ）
- SPはTodoistにメモを入れるだけ、残りは全部自動
