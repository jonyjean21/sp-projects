/**
 * トクラシ Autopilot — データドリブントピック選定
 * 月曜 5:00 JST にトリガー実行 → Firebase キューに2件投入
 *
 * 【セットアップ】
 * 1. clasp create --type standalone --title "tokurashi-autopilot"
 * 2. clasp push
 * 3. setup() を1回手動実行（トリガー作成）
 */

const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';
const ANALYTICS_PATH = '/tokurashi-analytics';
const QUEUE_PATH = '/tokurashi-article-queue';
const VERCEL_API = 'https://vercel-api-orpin-one.vercel.app';

// カテゴリ一覧
const CATEGORIES = ['ポイ活', 'ふるさと納税', '旅行', '買い物', '節約', '副業'];

// 季節カレンダー（月 → トピックリスト）
const SEASONAL_TOPICS = {
  1:  ['お年玉の賢い使い方', '冬のボーナス運用術', '初売りセールの攻略法', '確定申告の準備ガイド'],
  2:  ['バレンタインのお得な買い方', '春旅行の早割テクニック', '花粉症対策グッズを安く買う方法'],
  3:  ['新生活準備をお得にする方法', '引っ越し費用を抑えるコツ', '春休み旅行の節約術'],
  4:  ['GW旅行を安くする方法', '新学期の出費を抑えるコツ', 'ふるさと納税の始めどきガイド'],
  5:  ['梅雨対策グッズをお得に揃える', 'GW明けの節約リセット術', '母の日ギフトのお得な選び方'],
  6:  ['夏のボーナスの使い道', 'ふるさと納税の中間見直し', '父の日ギフトの賢い買い方', '夏旅行の早期予約術'],
  7:  ['夏休み旅行の節約プラン', 'お中元をお得に贈る方法', '夏のセールで賢く買い物する方法'],
  8:  ['夏の電気代を節約する方法', 'お盆帰省の交通費を抑えるコツ', '夏の終わりセール攻略'],
  9:  ['秋旅行の穴場スポット', 'ふるさと納税の追い込み時期', '敬老の日ギフトのお得な選び方'],
  10: ['ハロウィングッズを安く揃える方法', '冬支度をお得にする方法', '年末に向けた貯金術'],
  11: ['ブラックフライデーの攻略法', 'ふるさと納税の駆け込みガイド', '年賀状をお得に準備する方法', 'クリスマスプレゼントの早期購入術'],
  12: ['年末ふるさと納税の最終チェック', 'クリスマスセール攻略', '大掃除グッズをお得に揃える', '年末年始の旅行費用を抑えるコツ'],
};

// カテゴリ → 季節トピックのマッピング
const TOPIC_CATEGORY_HINTS = {
  'ふるさと納税': 'ふるさと納税',
  '旅行': '旅行',
  'セール': '買い物',
  '買い方': '買い物',
  '節約': '節約',
  '貯金': '節約',
  '電気代': '節約',
  '交通費': '節約',
  'ポイ': 'ポイ活',
  'ボーナス': '節約',
  '副業': '副業',
  'ギフト': '買い物',
};

/**
 * メインエントリ: トピック選定 → Firebaseキュー投入
 */
function selectAndQueueTopics() {
  Logger.log('=== トクラシ Autopilot 開始 ===');

  // 1. Firebase からデータ読取
  const analytics = firebaseGet(ANALYTICS_PATH + '/latest.json') || {};
  const articles = firebaseGet(ANALYTICS_PATH + '/articles.json') || [];
  const existingTitles = articles.map(a => (a.title || '').toLowerCase());
  const existingSlugs = articles.map(a => a.slug || '');

  // カテゴリ別記事数
  const categoryCounts = {};
  CATEGORIES.forEach(c => categoryCounts[c] = 0);
  // WPカテゴリIDからの逆引きはできないので、タイトルからヒューリスティックにカウント
  articles.forEach(a => {
    const title = (a.title || '').toLowerCase();
    for (const [hint, cat] of Object.entries(TOPIC_CATEGORY_HINTS)) {
      if (title.includes(hint.toLowerCase())) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        break;
      }
    }
  });

  // 2. 4ソースからトピック候補生成
  const candidates = [];

  // Source 1: GSC機会キーワード（impressions>10 & CTR<3%）
  const gscQueries = (analytics.gsc && analytics.gsc.top_queries) || [];
  gscQueries.forEach(q => {
    if (q.impressions > 10 && q.ctr < 3) {
      // 既存記事と被ってないか確認
      const isDuplicate = existingTitles.some(t => t.includes(q.query.toLowerCase()));
      if (!isDuplicate) {
        candidates.push({
          raw_topic: q.query,
          source: 'gsc_opportunity',
          score: 40,
          meta: `impressions=${q.impressions}, ctr=${q.ctr}%, pos=${q.position}`,
        });
      }
    }
  });
  Logger.log('GSC候補: ' + candidates.filter(c => c.source === 'gsc_opportunity').length + '件');

  // Source 2: GA4 top_pages関連展開
  const ga4Pages = (analytics.ga4 && analytics.ga4.top_pages) || [];
  const topPaths = ga4Pages.slice(0, 5).map(p => p.path).filter(p => p !== '/');
  if (topPaths.length > 0) {
    // パスからカテゴリ推測
    topPaths.forEach(path => {
      for (const [hint, cat] of Object.entries(TOPIC_CATEGORY_HINTS)) {
        if (path.toLowerCase().includes(hint.toLowerCase())) {
          candidates.push({
            raw_topic: `${cat}の関連トピック（人気ページ: ${path}）`,
            source: 'ga4_related',
            score: 30,
            category_hint: cat,
            meta: `based on top page: ${path}`,
          });
          break;
        }
      }
    });
  }
  Logger.log('GA4候補: ' + candidates.filter(c => c.source === 'ga4_related').length + '件');

  // Source 3: 季節カレンダー
  const now = new Date();
  const month = now.getMonth() + 1;
  const seasonalList = SEASONAL_TOPICS[month] || [];
  seasonalList.forEach(topic => {
    const isDuplicate = existingTitles.some(t => {
      const keywords = topic.split(/[のをにはがでと]/).filter(w => w.length >= 2);
      return keywords.some(kw => t.includes(kw.toLowerCase()));
    });
    if (!isDuplicate) {
      // カテゴリ推測
      let cat = '節約';
      for (const [hint, c] of Object.entries(TOPIC_CATEGORY_HINTS)) {
        if (topic.includes(hint)) { cat = c; break; }
      }
      candidates.push({
        raw_topic: topic,
        source: 'seasonal',
        score: 25,
        category_hint: cat,
        meta: `${month}月の季節トピック`,
      });
    }
  });
  Logger.log('季節候補: ' + candidates.filter(c => c.source === 'seasonal').length + '件');

  // Source 4: カテゴリバランス
  const minCount = Math.min(...Object.values(categoryCounts));
  const underrepresented = CATEGORIES.filter(c => categoryCounts[c] <= minCount + 1);
  underrepresented.forEach(cat => {
    // 少ないカテゴリのスコアにボーナス
    candidates.forEach(c => {
      if (c.category_hint === cat) {
        c.score += 20;
        c.meta = (c.meta || '') + ' +カテゴリバランスボーナス';
      }
    });
    // ボーナス対象がなければ汎用トピックを追加
    if (!candidates.some(c => c.category_hint === cat)) {
      candidates.push({
        raw_topic: `${cat}カテゴリの新しい切り口の記事`,
        source: 'category_balance',
        score: 20,
        category_hint: cat,
        meta: `記事数最少カテゴリ(${categoryCounts[cat]}件)`,
      });
    }
  });
  Logger.log('カテゴリバランス調整後の候補: ' + candidates.length + '件');

  // 3. スコア順ソート → 上位2件を選定
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates.slice(0, 2);

  if (selected.length === 0) {
    Logger.log('候補なし。季節トピックからフォールバック');
    const fallback = seasonalList[0] || 'お得に暮らすための基本テクニック';
    selected.push({
      raw_topic: fallback,
      source: 'seasonal',
      score: 25,
      category_hint: '節約',
      meta: 'フォールバック',
    });
  }

  Logger.log('選定: ' + selected.map(s => s.raw_topic).join(' / '));

  // 4. Geminiで具体化
  const queueItems = [];
  for (const item of selected) {
    try {
      const concrete = concretizeWithGemini(item, existingTitles);
      if (concrete) {
        queueItems.push({
          topic: concrete.topic,
          title: concrete.title,
          outline: concrete.outline,
          category: concrete.category,
          pexels_query: concrete.pexels_query,
          source: item.source,
          score: item.score,
          status: 'pending',
          created_at: new Date().toISOString(),
          published_at: null,
          post_id: null,
        });
      }
    } catch (e) {
      Logger.log('Gemini具体化エラー: ' + e.message);
    }
  }

  // 5. Firebaseキューに投入
  for (const qi of queueItems) {
    firebasePost(QUEUE_PATH + '.json', qi);
    Logger.log('キュー投入: ' + qi.title);
  }

  Logger.log('=== Autopilot 完了: ' + queueItems.length + '件キュー投入 ===');
}

/**
 * Gemini でトピックを具体的な記事企画に変換
 */
function concretizeWithGemini(candidate, existingTitles) {
  const existingList = existingTitles.slice(0, 30).join('\n- ');

  const prompt = `あなたはお得な暮らし情報メディア「トクラシ」の編集者です。
以下のトピック候補を、SEOに強い具体的な記事企画にしてください。

トピック候補: ${candidate.raw_topic}
ソース: ${candidate.source}（${candidate.meta || ''}）
推奨カテゴリ: ${candidate.category_hint || '未指定'}

カテゴリ一覧: ${CATEGORIES.join(', ')}

既存記事タイトル（重複を避けること）:
- ${existingList}

以下のJSON形式で返してください（JSONのみ、説明文不要）:
{
  "topic": "具体的なトピック名（15字以内）",
  "title": "SEOに強い記事タイトル（30字以内、【2026年】等の年号を入れる）",
  "outline": "記事の概要・構成案（100字以内）",
  "category": "カテゴリ名（${CATEGORIES.join('/')}から1つ）",
  "pexels_query": "Pexels画像検索用の英語クエリ（3-5語）"
}`;

  const payload = {
    prompt: prompt,
    temperature: 0.5,
    json_mode: true,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const res = UrlFetchApp.fetch(VERCEL_API + '/api/gemini', options);
  if (res.getResponseCode() !== 200) {
    throw new Error('Gemini API error: ' + res.getResponseCode());
  }

  const data = JSON.parse(res.getContentText());
  const text = (data.candidates || [{}])[0]?.content?.parts?.[0]?.text || '';

  // JSONを抽出
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Gemini応答からJSONを抽出できず');
  }

  const result = JSON.parse(match[0]);

  // カテゴリバリデーション
  if (!CATEGORIES.includes(result.category)) {
    result.category = candidate.category_hint || '節約';
  }

  return result;
}

// ============================================
// Firebase ヘルパー
// ============================================

function firebaseGet(path) {
  const options = { method: 'get', muteHttpExceptions: true };
  const res = UrlFetchApp.fetch(FIREBASE_URL + path, options);
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText());
}

function firebasePost(path, data) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  };
  UrlFetchApp.fetch(FIREBASE_URL + path, options);
}

function firebasePut(path, data) {
  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  };
  UrlFetchApp.fetch(FIREBASE_URL + path, options);
}

// ============================================
// セットアップ
// ============================================

/**
 * 初期セットアップ: 1回だけ手動実行
 * - 毎週月曜5時のトリガー作成
 * - テスト実行
 */
function setup() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'selectAndQueueTopics') {
      ScriptApp.deleteTrigger(t);
      Logger.log('既存トリガー削除');
    }
  });

  // 毎週月曜5時JSTのトリガー
  ScriptApp.newTrigger('selectAndQueueTopics')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(5)
    .create();
  Logger.log('✅ トリガー作成: 毎週月曜5時にselectAndQueueTopics()を実行');

  // テスト実行
  Logger.log('テスト実行...');
  selectAndQueueTopics();
  Logger.log('✅ セットアップ完了！');
}

/**
 * 手動テスト: キュー内容を確認
 */
function testCheckQueue() {
  const queue = firebaseGet(QUEUE_PATH + '.json');
  Logger.log(JSON.stringify(queue, null, 2));
}
