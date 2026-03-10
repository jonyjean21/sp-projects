/* ============================================================
   data.js — まなびモン2 全データ定義
   ============================================================ */


// ── モンスター定義 ────────────────────────────────────────

const PARTNER_LINES = {
  fire:  { name: 'ホノライン',  icon: '🔥', stages: ['fire_0',  'fire_1',  'fire_2'],  evoLevels: [3, 7] },
  water: { name: 'ミズライン',  icon: '💧', stages: ['water_0', 'water_1', 'water_2'], evoLevels: [3, 7] },
  grass: { name: 'クサライン',  icon: '🌿', stages: ['grass_0', 'grass_1', 'grass_2'], evoLevels: [3, 7] }
};

const PARTNER_MONSTERS = {
  fire_0:  { id: 'fire_0',  name: 'ホノタン',    line: 'fire',  stage: 0 },
  fire_1:  { id: 'fire_1',  name: 'ホノリュウ',  line: 'fire',  stage: 1 },
  fire_2:  { id: 'fire_2',  name: 'ホノマスター', line: 'fire',  stage: 2 },
  water_0: { id: 'water_0', name: 'ミズタン',    line: 'water', stage: 0 },
  water_1: { id: 'water_1', name: 'ミズリュウ',  line: 'water', stage: 1 },
  water_2: { id: 'water_2', name: 'ミズマスター', line: 'water', stage: 2 },
  grass_0: { id: 'grass_0', name: 'クサタン',    line: 'grass', stage: 0 },
  grass_1: { id: 'grass_1', name: 'クサリュウ',  line: 'grass', stage: 1 },
  grass_2: { id: 'grass_2', name: 'クサマスター', line: 'grass', stage: 2 }
};

// コレクションモンスター（7科目 × 3ランク = 21体）
const COLL_SUBJECTS = ['kuku', 'tashihiki', 'kanji', 'tani', 'sansu', 'kokugo', 'eigo'];
const COLL_RANKS = ['B', 'A', 'S'];

const COLL_NAMES = {
  kuku:      { B: 'ククモン', A: 'ククモンα', S: 'ククモンΣ' },
  tashihiki: { B: 'サンモン', A: 'サンモンα', S: 'サンモンΣ' },
  kanji:     { B: 'カンジモン', A: 'カンジモンα', S: 'カンジモンΣ' },
  tani:      { B: 'タンイモン', A: 'タンイモンα', S: 'タンイモンΣ' },
  sansu:     { B: 'サンスーモン', A: 'サンスーモンα', S: 'サンスーモンΣ' },
  kokugo:    { B: 'コクゴモン', A: 'コクゴモンα', S: 'コクゴモンΣ' },
  eigo:      { B: 'エイゴモン', A: 'エイゴモンα', S: 'エイゴモンΣ' }
};

const COLLECTION_MONSTERS = {};
for (const subj of COLL_SUBJECTS) {
  for (const rank of COLL_RANKS) {
    const id = `${subj}_${rank}`;
    COLLECTION_MONSTERS[id] = {
      id, subject: subj, rank,
      name: COLL_NAMES[subj][rank],
      img: `img/${subj}_${rank}.png`
    };
  }
}

// ── 科目定義 ─────────────────────────────────────────────

const SUBJECTS = {
  kuku:      { id: 'kuku',      name: '九九',       icon: '✖️',  color: '#EF5350', qCount: 15 },
  tashihiki: { id: 'tashihiki', name: 'たしひき算', icon: '➕',  color: '#26C6DA', qCount: 15 },
  kanji:     { id: 'kanji',     name: 'かんじ',     icon: '📝', color: '#AB47BC', qCount: 15 },
  tani:      { id: 'tani',      name: 'たんい',     icon: '📏', color: '#FFA726', qCount: 10 },
  sansu:     { id: 'sansu',     name: 'さんすう文章', icon: '📖', color: '#26A69A', qCount: 10 },
  kokugo:    { id: 'kokugo',    name: 'こくご文章', icon: '🖊️',  color: '#42A5F5', qCount: 10 },
  eigo:      { id: 'eigo',      name: 'えいご',     icon: '🔤', color: '#EC407A', qCount: 10 }
};

// ── 問題データ ────────────────────────────────────────────

const QUESTIONS = {

  kuku: [
    { q: '３ × ４ = ?', choices: ['10', '12', '14', '8'],  answer: 1 },
    { q: '７ × ８ = ?', choices: ['54', '56', '58', '60'], answer: 1 },
    { q: '６ × ６ = ?', choices: ['34', '36', '38', '40'], answer: 1 },
    { q: '９ × ３ = ?', choices: ['24', '25', '27', '28'], answer: 2 },
    { q: '５ × ７ = ?', choices: ['30', '35', '40', '45'], answer: 1 },
    { q: '４ × ８ = ?', choices: ['30', '32', '34', '36'], answer: 1 },
    { q: '２ × ９ = ?', choices: ['16', '17', '18', '19'], answer: 2 },
    { q: '８ × ６ = ?', choices: ['46', '48', '50', '52'], answer: 1 },
    { q: '７ × ７ = ?', choices: ['47', '48', '49', '50'], answer: 2 },
    { q: '３ × ８ = ?', choices: ['22', '24', '26', '28'], answer: 1 },
    { q: '６ × ４ = ?', choices: ['20', '22', '24', '26'], answer: 2 },
    { q: '９ × ９ = ?', choices: ['79', '80', '81', '82'], answer: 2 },
    { q: '５ × ５ = ?', choices: ['20', '25', '30', '35'], answer: 1 },
    { q: '４ × ７ = ?', choices: ['24', '26', '28', '30'], answer: 2 },
    { q: '８ × ９ = ?', choices: ['70', '72', '74', '76'], answer: 1 }
  ],

  tashihiki: [
    { q: '３４ ＋ ２８ = ?', choices: ['60', '62', '64', '66'], answer: 1 },
    { q: '５６ − ２９ = ?', choices: ['25', '27', '29', '31'], answer: 1 },
    { q: '４５ ＋ ３７ = ?', choices: ['80', '82', '84', '86'], answer: 1 },
    { q: '７１ − ４６ = ?', choices: ['23', '25', '27', '29'], answer: 1 },
    { q: '６３ ＋ １８ = ?', choices: ['79', '81', '83', '85'], answer: 1 },
    { q: '８４ − ３５ = ?', choices: ['47', '49', '51', '53'], answer: 1 },
    { q: '２７ ＋ ５６ = ?', choices: ['79', '81', '83', '85'], answer: 2 },
    { q: '９３ − ４８ = ?', choices: ['43', '45', '47', '49'], answer: 1 },
    { q: '３８ ＋ ４６ = ?', choices: ['82', '84', '86', '88'], answer: 1 },
    { q: '６２ − ３７ = ?', choices: ['23', '25', '27', '29'], answer: 1 },
    { q: '４８ ＋ ２５ = ?', choices: ['71', '73', '75', '77'], answer: 1 },
    { q: '７５ − ２８ = ?', choices: ['45', '47', '49', '51'], answer: 1 },
    { q: '５３ ＋ ３９ = ?', choices: ['90', '92', '94', '96'], answer: 1 },
    { q: '８６ − ４７ = ?', choices: ['37', '39', '41', '43'], answer: 1 },
    { q: '２９ ＋ ６４ = ?', choices: ['91', '93', '95', '97'], answer: 1 }
  ],

  kanji: [
    { q: '「魚」の よみかたは？', choices: ['とり', 'うみ', 'さかな', 'かわ'],  answer: 2 },
    { q: '「春」の よみかたは？', choices: ['なつ', 'あき', 'はる', 'ふゆ'],   answer: 2 },
    { q: '「首」の よみかたは？', choices: ['て', 'くび', 'あし', 'め'],       answer: 1 },
    { q: '「北」の よみかたは？', choices: ['みなみ', 'ひがし', 'にし', 'きた'], answer: 3 },
    { q: '「光」の よみかたは？', choices: ['かぜ', 'ひかり', 'みず', 'ほし'],  answer: 1 },
    { q: '「谷」の よみかたは？', choices: ['やま', 'かわ', 'たに', 'いけ'],   answer: 2 },
    { q: '「友」の よみかたは？', choices: ['ひと', 'こ', 'とも', 'おや'],     answer: 2 },
    { q: '「弱い」の よみかたは？', choices: ['つよい', 'よわい', 'おそい', 'はやい'], answer: 1 },
    { q: '「売る」の よみかたは？', choices: ['かう', 'うる', 'もつ', 'つかう'], answer: 1 },
    { q: '「歩く」の よみかたは？', choices: ['はしる', 'とぶ', 'あるく', 'およぐ'], answer: 2 },
    { q: '「雲」の よみかたは？', choices: ['かぜ', 'あめ', 'くも', 'ゆき'],   answer: 2 },
    { q: '「絵」の よみかたは？', choices: ['え', 'き', 'いろ', 'てん'],       answer: 0 },
    { q: '「切る」の よみかたは？', choices: ['かく', 'よむ', 'きる', 'かつ'],  answer: 2 },
    { q: '「形」の よみかたは？', choices: ['ちから', 'かたち', 'おおきさ', 'いろ'], answer: 1 },
    { q: '「新しい」の よみかたは？', choices: ['ふるい', 'あたらしい', 'おおきい', 'ちいさい'], answer: 1 }
  ],

  tani: [
    { q: '１メートル は 何センチメートル？', choices: ['10', '100', '1000', '10000'], answer: 1 },
    { q: '２Ｌ は 何ｄＬ？', choices: ['2', '10', '20', '200'], answer: 2 },
    { q: '３ｋｍ は 何ｍ？', choices: ['300', '3000', '30000', '300000'], answer: 1 },
    { q: '５ｋｇ は 何ｇ？', choices: ['500', '5000', '50000', '500000'], answer: 1 },
    { q: '６０ｃｍ は 何ｍｍ？', choices: ['6', '60', '600', '6000'], answer: 2 },
    { q: '１Ｌ は 何ｄＬ？', choices: ['5', '10', '100', '1000'], answer: 1 },
    { q: '４０００ｇ は 何ｋｇ？', choices: ['4', '40', '400', '4000'], answer: 0 },
    { q: '５ｍ５０ｃｍ は 何ｃｍ？', choices: ['505', '550', '5050', '5500'], answer: 1 },
    { q: '３ｄＬ は 何ｍＬ？', choices: ['3', '30', '300', '3000'], answer: 2 },
    { q: '２ｋｍ５００ｍ は 何ｍ？', choices: ['250', '2500', '25000', '250000'], answer: 1 }
  ],

  sansu: [
    { q: 'えんぴつが３６本あります。\n１２本つかいました。\nのこりは何本？', choices: ['22本', '24本', '26本', '28本'], answer: 1 },
    { q: 'クッキーを１日８まい、\n３日かんたべました。\nぜんぶで何まい？', choices: ['22まい', '24まい', '26まい', '11まい'], answer: 1 },
    { q: '本が４８さつあります。\n２５さつかりました。\nのこりは何さつ？', choices: ['21さつ', '23さつ', '25さつ', '27さつ'], answer: 1 },
    { q: '子どもが３５人います。\nバスに１６人のりました。\nのこりは何人？', choices: ['17人', '19人', '21人', '23人'], answer: 1 },
    { q: 'みかんが１はこ１２こ。\n４はこでは何こ？', choices: ['44こ', '46こ', '48こ', '50こ'], answer: 2 },
    { q: '色えんぴつが３色、\n１色あたり８本。\nぜんぶで何本？', choices: ['20本', '24本', '28本', '32本'], answer: 1 },
    { q: '６２円のおかしと\n３５円のジュースを\nかいました。ぜんぶで？', choices: ['95円', '97円', '99円', '101円'], answer: 1 },
    { q: 'シールが９０まい。\n２人でおなじ数に\nわけると１人は？', choices: ['40まい', '45まい', '50まい', '55まい'], answer: 1 },
    { q: '図書館に本が１５４さつ。\n５６さつ返してもらいました。\n今は何さつ？', choices: ['208さつ', '210さつ', '98さつ', '100さつ'], answer: 1 },
    { q: '１日に２０ページよみます。\n７日間で何ページ？', choices: ['120ページ', '140ページ', '160ページ', '180ページ'], answer: 1 }
  ],

  kokugo: [
    { q: '今日は晴れです。\nたろうくんは公園に\n行きました。\nどこに行きましたか？', choices: ['がっこう', 'こうえん', 'おみせ', 'いえ'], answer: 1 },
    { q: '「赤くてきれいな\n花があります。」\n花びらは何色ですか？', choices: ['しろ', 'あお', 'あか', 'きいろ'], answer: 2 },
    { q: '「たろうは妹に\n本をあげました。」\nだれが本をもらいましたか？', choices: ['たろう', 'おとうと', 'いもうと', 'おかあさん'], answer: 2 },
    { q: '「犬は大きく、\nねこは小さいです。」\n大きいのはどちら？', choices: ['ねこ', 'いぬ', 'どちらもおなじ', 'わからない'], answer: 1 },
    { q: '「朝、ごはんをたべてから\nはをみがきました。」\nはをみがいたのはいつ？', choices: ['たべるまえ', 'たべたあと', 'よる', 'ひる'], answer: 1 },
    { q: '「春になると\nさくらの花がさきます。」\nさくらがさくのはどのきせつ？', choices: ['なつ', 'あき', 'ふゆ', 'はる'], answer: 3 },
    { q: 'みんながしずかにしているとき、\nはなこさんだけが\nさわいでいました。\nさわいでいたのはだれ？', choices: ['みんな', 'はなこさん', 'だれもいない', 'せんせい'], answer: 1 },
    { q: '「たのしい」の\nはんたいのことばは？', choices: ['きれい', 'かなしい', 'あかるい', 'やさしい'], answer: 1 },
    { q: '「山が高い」の「高い」の\nはんたいことばは？', choices: ['おおきい', 'ちいさい', 'ひくい', 'ながい'], answer: 2 },
    { q: '「ねこがにわを\nはしっています。」\nねこは何をしていますか？', choices: ['ねている', 'たべている', 'はしっている', 'あそんでいる'], answer: 2 }
  ],

  eigo: [
    { q: '「赤」は えいごで？', choices: ['Blue', 'Green', 'Red', 'Yellow'], answer: 2 },
    { q: '「ありがとう」は えいごで？', choices: ['Hello', 'Goodbye', 'Sorry', 'Thank you'], answer: 3 },
    { q: '「１・２・３・４・５」の\nつぎの えいごは？', choices: ['Seventh', 'Six', 'Fifth', 'Ten'], answer: 1 },
    { q: 'アルファベットの「A」の\nつぎの もじは？', choices: ['C', 'B', 'D', 'E'], answer: 1 },
    { q: '「いぬ」は えいごで？', choices: ['Cat', 'Bird', 'Fish', 'Dog'], answer: 3 },
    { q: '「あおい」は えいごで？', choices: ['Blue', 'Red', 'Green', 'White'], answer: 0 },
    { q: '「おはようございます」は えいごで？', choices: ['Good night', 'Good afternoon', 'Good morning', 'Good evening'], answer: 2 },
    { q: '「１たす１」は えいごで？', choices: ['One', 'Two', 'Three', 'Four'], answer: 1 },
    { q: '「みどり」は えいごで？', choices: ['Yellow', 'Pink', 'Green', 'Purple'], answer: 2 },
    { q: '「ねこ」は えいごで？', choices: ['Dog', 'Cat', 'Rabbit', 'Bird'], answer: 1 }
  ]
};

// ── XP・レベルシステム ────────────────────────────────────

const XP_PER_CORRECT = 10;
const MAX_LEVEL = 12;

function xpForNextLevel(level) {
  return level * 15; // Lv1→2: 15, Lv2→3: 30, ...
}

function xpForLevel(level) {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForNextLevel(i);
  return total;
}

// ── パートナーメッセージ ──────────────────────────────────

const PARTNER_MSGS = {
  S: ['さすが！かんぺき！', 'すごい！100てんだ！', 'ともだちにじまんしよう！'],
  A: ['よくできました！', 'つぎはまんてんめざそう！', 'もうすこしでかんぺき！'],
  B: ['まあまあだね！', 'もういちどがんばろう！', 'れんしゅうしたらうまくなるよ！'],
  fail: ['ざんねん、つぎがんばろう！', 'まけてもあきらめないよ！', 'いっしょにがんばろう！']
};

function getPartnerMsg(rank, score, total) {
  if (score === 0) return 'がんばれ！きみならできる！';
  const msgs = PARTNER_MSGS[rank] || PARTNER_MSGS.B;
  return msgs[Math.floor(Math.random() * msgs.length)];
}
