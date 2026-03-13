# TikTok動画 自動生成パイプライン設計

> 作成日: 2026-03-13
> 目的: 退職代行TikTokの動画を最小労力で量産する

---

## 方針: 2段階アプローチ

### Phase 1: CapCut手動（今すぐ開始）
- **ツール**: CapCutアプリ（スマホ）
- **所要時間**: 1本あたり10-15分
- **品質**: 高い（テンプレ、自動テロップ、BGM全部入り）
- **用途**: 最初の10本はここで作って投稿→反応を見る

### Phase 2: Python自動化（反応確認後に構築）
- **ツール**: Python + MoviePy + FFmpeg + Gemini
- **所要時間**: スクリプト実行で1本1分以下
- **品質**: 中程度（テロップ+背景+BGMのシンプル構成）
- **用途**: 反応のいいパターンが分かったら量産体制へ

---

## Phase 1: CapCut手動フロー（即実行可能）

```
1. スクリプト（scripts.md）からテキストをコピー
2. CapCutアプリを開く
3. テンプレートを選択（テロップ系テンプレ）
4. テキストを差し替え
5. BGMを選択（トレンドBGM or エモ系ピアノ）
6. 書き出し → TikTokに直接投稿
```

**CapCutのAI機能活用:**
- 自動キャプション: 音声→テロップ自動生成（30秒で完了）
- テンプレート適用: カット・字幕・BGMが自動適用
- AI Voice: テキスト→ナレーション生成

**1本の制作フロー（10分）:**
1. スクリプト選択（1分）
2. CapCutでテンプレ選択+テキスト差し替え（5分）
3. BGM選択+微調整（2分）
4. 書き出し+投稿（2分）

---

## Phase 2: Python自動化パイプライン（後日構築）

### 技術スタック

| ツール | 役割 | コスト |
|--------|------|--------|
| Python 3.x | メインスクリプト | ¥0 |
| MoviePy | 動画編集（テロップ挿入、合成） | ¥0 |
| FFmpeg | エンコード | ¥0 |
| Pillow | テロップ画像生成 | ¥0 |
| Gemini API | スクリプト自動生成 | ¥0（無料枠） |
| Pexels API | 背景動画素材 | ¥0 |
| フリーBGM | BGM素材 | ¥0 |

### 処理フロー

```
[Input] スクリプトJSON（テーマ、テロップテキスト、ハッシュタグ）
    ↓
[Step 1] Gemini API → スクリプト自動生成（or JSONから読み込み）
    ↓
[Step 2] Pexels API → テーマに合った背景動画をDL
    ↓
[Step 3] Pillow → テロップ画像を生成（白文字+黒縁取り）
    ↓
[Step 4] MoviePy → 背景動画 + テロップ画像 + BGM を合成
    ↓
[Step 5] FFmpeg → TikTok最適フォーマットで書き出し（9:16, 1080x1920）
    ↓
[Output] mp4ファイル + メタデータ（キャプション、ハッシュタグ）
```

### スクリプト設計案

```python
# tools/tiktok-video-gen.py（将来の実装）
#
# Usage:
#   python3 tools/tiktok-video-gen.py --theme "新卒 退職"
#   python3 tools/tiktok-video-gen.py --script scripts/001.json
#   python3 tools/tiktok-video-gen.py --batch scripts/  # フォルダ内一括
#
# Output:
#   output/tiktok/001_新卒退職.mp4
#   output/tiktok/001_新卒退職_meta.json（キャプション+ハッシュタグ）
```

### TikTok投稿の自動化

**現状**: TikTok公式APIは個人の投稿自動化をサポートしていない
**対策**:
1. 動画は自動生成、投稿はスマホから手動（1分/本）
2. 将来的にTikTok Content Posting APIが使えるようになれば自動化
3. 代替: Instagramリール・YouTube Shortsにもクロスポスト（API経由で自動化可能）

---

## BGM戦略

### フリーBGM素材サイト
- DOVA-SYNDROME: https://dova-s.jp/ （商用利用OK）
- 甘茶の音楽工房: https://amachamusic.chagasi.com/
- MusMus: https://musmus.main.jp/

### ジャンル別おすすめBGM
| 動画テーマ | BGMジャンル | 雰囲気 |
|-----------|-----------|--------|
| 体験談系 | エモ系ピアノ | 切なさ+希望 |
| 情報系（料金・比較） | ポップ/アップテンポ | 明るく分かりやすく |
| 共感系（パワハラ等） | Lo-Fi/チル系 | 落ち着いた共感 |
| 煽り系（辞めろ） | トレンドBGM | TikTokの流行に乗る |

**注意**: TikTokの商用利用では楽曲の著作権に注意。CapCut内蔵BGMかフリーBGMを使用。

---

## 優先アクション

1. **今日**: CapCutでスクリプト#5（体験談風）の動画を1本作ってみる
2. **今週**: 毎日1本、CapCut手動で投稿（7本）
3. **来週**: 反応を分析→伸びたパターンの量産計画
4. **再来週以降**: Python自動化パイプライン構築（反応が確認できてから）
