# YouTubeダッシュボード 構想設計書

## 概要
前セッションで共有されたReact/Recharts製のYouTubeアナリティクスダッシュボード。
SP Portalエコシステムに組み込み、モルハブのYouTubeチャンネル分析を行うツール。

---

## 前セッションで共有されたコードの特徴

- **React + Recharts**: useState/useEffect/useCallback + 各種チャートコンポーネント
- **YouTube Data API v3**: channels / search / videos エンドポイント
- **4タブ構成**: Overview / Videos / Patterns / Radar
- **カラースキーム**: lime #d4ff47, coral #ff5068, cyan #00cfff, violet #c084fc
- **デモモード**: APIキーなしでもモックデータで動作
- **レスポンシブ**: PC=サイドバー / スマホ=ボトムナビ
- **約650行** のコンポーネントコード

---

## 組み込み方針

### 選択肢

| 方針 | メリット | デメリット |
|------|---------|-----------|
| A. 独立ページ (`youtube/`) | 他と干渉しない。ReactをCDNで読める | ポータルから分離 |
| B. モルハブポータルに統合 | アナリティクスの一部として自然 | ポータルがバニラJSなのにReactが混在 |
| C. バニラJSに書き換え | 統一技術スタック | Rechartsが使えない。チャート実装が大変 |

### 推奨: A. 独立ページ + ポータルからリンク

**理由**:
- ReactはCDN（unpkg/esm.sh）でimport可能、ビルド不要
- RechartsもCDN対応あり
- YouTube APIキーの管理が独立（Vercel Proxy or 直接）
- モルハブポータルのアナリティクスセクションからリンクカードで飛ばす

---

## ページ構成 (`youtube/index.html`)

### 接続画面
```
┌──────────────────────────────┐
│      YouTube Analytics       │
│                              │
│  APIキー: [________________]  │
│  チャンネル: [molkkyhub____]  │
│                              │
│       [接続] [デモモード]     │
│                              │
│  ※ APIキーはlocalStorageに   │
│    保存。外部送信なし。       │
└──────────────────────────────┘
```

### Tab 1: Overview
```
┌──────────────────────────────┐
│ KPI Cards                    │
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │Views│ │Watch│ │ Subs │    │
│ │12.3K│ │ 847h│ │ +23 │    │
│ └─────┘ └─────┘ └─────┘    │
│                              │
│ 再生数推移（AreaChart）       │
│ ┌──────────────────────┐    │
│ │    ╱╲    ╱╲          │    │
│ │   ╱  ╲  ╱  ╲╱╲      │    │
│ │  ╱    ╲╱      ╲     │    │
│ └──────────────────────┘    │
│                              │
│ トップ動画                    │
│ 1. 〇〇モルック大会レポート    │
│ 2. モルック基本ルール解説     │
└──────────────────────────────┘
```

### Tab 2: Videos
- 全動画のテーブル/カードリスト
- 再生数・いいね・コメント数・エンゲージメント率
- 公開日順 / 再生数順のソート
- 動画カードタップ → YouTube へリンク

### Tab 3: Patterns
- 曜日別パフォーマンス（何曜日に投稿すると再生数が伸びるか）
- 時間帯別分析
- タイトル文字数 vs 再生数の散布図
- カテゴリ別の傾向

### Tab 4: Radar
- 多軸レーダーチャート
- 軸: 再生数 / エンゲージメント / コメント率 / 視聴維持 / いいね率 / 投稿頻度
- チャンネル全体の強み・弱みを可視化

---

## 技術実装

### CDN構成（ビルド不要）
```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "react-dom": "https://esm.sh/react-dom@18",
    "recharts": "https://esm.sh/recharts@2"
  }
}
</script>
<script type="module">
import React from 'react';
import ReactDOM from 'react-dom';
import { AreaChart, BarChart, RadarChart, ... } from 'recharts';
// ... 650行のコンポーネント
</script>
```

### YouTube API
- **直接呼び出し**（クライアントサイド）: APIキーをlocalStorageに保存
- **または Vercel Proxy**: `/api/youtube?endpoint=...` で中継
- エンドポイント:
  - `GET /youtube/v3/channels?part=snippet,statistics&id={channelId}&key={apiKey}`
  - `GET /youtube/v3/search?part=snippet&channelId={channelId}&maxResults=50&order=date&type=video&key={apiKey}`
  - `GET /youtube/v3/videos?part=statistics,contentDetails&id={videoIds}&key={apiKey}`

### データ永続化
- APIキー: localStorage
- キャッシュ: sessionStorage（セッション中はAPI再呼び出し不要）
- チャンネルID: localStorage

---

## カラースキーム
```css
:root {
  --bg: #0a0a0f;
  --card: #141420;
  --border: #1e1e30;
  --text: #e8e8f0;
  --sub: #6a6a80;
  --lime: #d4ff47;
  --coral: #ff5068;
  --cyan: #00cfff;
  --violet: #c084fc;
}
```
既存のSPポータルのダークテーマと親和性が高い。

---

## モルハブポータルとの連携
- モルハブポータル「Analytics」セクションにリンクカード配置
- 「YouTube Analytics を開く →」ボタン
- 将来: YouTube APIデータの一部をモルハブダッシュボードのKPIに表示

---

## 実装ステップ
1. 前セッションのReactコードを再取得 or 再共有
2. `youtube/index.html` に単一HTMLとして構成（CDN React）
3. APIキー入力 → チャンネル接続 → 4タブ表示
4. デモモードでモックデータ動作確認
5. モルハブポータルからリンク
6. appsカタログに追加
