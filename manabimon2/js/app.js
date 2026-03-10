/* ============================================================
   app.js — まなびモン2 ゲームロジック
   ============================================================ */

'use strict';

// ── 状態 ─────────────────────────────────────────────────

const SAVE_KEY = 'manabimon2_v1';

const DEFAULT_STATE = {
  partner: null,          // { lineId, level, xp, stage }
  collection: [],         // 解放済みモンスターID一覧
  unitClear: {},          // { kuku: { count, best } }
  totalQuestions: 0,
  achievements: []
};

let state = loadState();

function loadState() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? { ...DEFAULT_STATE, ...JSON.parse(s) } : { ...DEFAULT_STATE };
  } catch { return { ...DEFAULT_STATE }; }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// ── クイズ一時状態 ────────────────────────────────────────

let quizState = null; // { subjectId, questions, cur, correct }

// ── 画面管理 ─────────────────────────────────────────────

const SCREENS = ['starter', 'home', 'quiz', 'result', 'monster', 'zukan', 'settings'];

function showScreen(name) {
  SCREENS.forEach(id => {
    const el = document.getElementById(`screen-${id}`);
    if (el) el.classList.toggle('active', id === name);
  });
}

// ── パートナーユーティリティ ─────────────────────────────

function getPartnerMonster() {
  if (!state.partner) return null;
  const line = PARTNER_LINES[state.partner.lineId];
  const stageIdx = state.partner.stage;
  return PARTNER_MONSTERS[line.stages[stageIdx]];
}

function monImg(id, cls = '') {
  return `<img src="img/${id}.png" class="mon-img${cls ? ' ' + cls : ''}" alt="${id}">`;
}

function getPartnerSVG() {
  const m = getPartnerMonster();
  return m ? monImg(m.id) : '';
}

function getEvoLevel() {
  const line = PARTNER_LINES[state.partner.lineId];
  if (state.partner.stage >= line.stages.length - 1) return null;
  return line.evoLevels[state.partner.stage];
}

function shouldEvolve() {
  if (!state.partner) return false;
  const evoLv = getEvoLevel();
  return evoLv !== null && state.partner.level >= evoLv;
}

// ── XP ・レベルアップ処理 ────────────────────────────────

/**
 * XPを加算してレベルアップを処理する。
 * @returns {Array} 進化発生したら [{before, after, monsterName}]、なければ []
 */
function addXP(amount) {
  const p = state.partner;
  p.xp += amount;

  const evolutions = [];

  // レベルアップループ
  while (p.level < MAX_LEVEL) {
    const needed = xpForNextLevel(p.level);
    if (p.xp < needed) break;
    p.xp -= needed;
    p.level++;

    // 進化チェック
    if (shouldEvolve()) {
      const beforeId = PARTNER_LINES[p.lineId].stages[p.stage];
      p.stage++;
      const afterId = PARTNER_LINES[p.lineId].stages[p.stage];
      evolutions.push({
        before: monImg(beforeId, 'evo-img'),
        after: monImg(afterId, 'evo-img'),
        name: PARTNER_MONSTERS[afterId].name
      });
    }
  }

  // Max レベル
  if (p.level >= MAX_LEVEL) {
    p.level = MAX_LEVEL;
    p.xp = 0;
  }

  saveState();
  return evolutions;
}

// ── コレクション解放 ─────────────────────────────────────

/**
 * ユニットクリア後、新しく解放されたモンスターIDを返す
 */
function tryUnlockCollection(subjectId, rank) {
  const rankOrder = ['B', 'A', 'S'];
  const rankIdx = rankOrder.indexOf(rank);
  const newUnlocks = [];

  for (let i = 0; i <= rankIdx; i++) {
    const id = `${subjectId}_${rankOrder[i]}`;
    if (!state.collection.includes(id)) {
      state.collection.push(id);
      newUnlocks.push(id);
    }
  }

  saveState();
  return newUnlocks;
}

// ── ホーム画面 ───────────────────────────────────────────

function renderHome() {
  // パートナー表示
  const p = state.partner;
  const monster = getPartnerMonster();

  document.getElementById('home-partner-svg').innerHTML = getPartnerSVG();
  document.getElementById('home-name').textContent = monster ? monster.name : '---';
  document.getElementById('home-lv').textContent = p ? p.level : 1;
  document.getElementById('stat-total').textContent = state.totalQuestions;

  // XPバー
  if (p) {
    const needed = p.level < MAX_LEVEL ? xpForNextLevel(p.level) : 0;
    const pct = needed > 0 ? Math.min(100, (p.xp / needed) * 100) : 100;
    document.getElementById('home-xp-fill').style.width = pct + '%';
    document.getElementById('home-xp').textContent = p.xp;
    document.getElementById('home-xp-max').textContent = needed > 0 ? needed : 'MAX';
  }

  // 科目グリッド
  const grid = document.getElementById('subjects-grid');
  grid.innerHTML = '';
  for (const [id, subj] of Object.entries(SUBJECTS)) {
    const clear = state.unitClear[id];
    const bestText = clear ? `ベスト: ${clear.best}（${clear.count}かい）` : 'まだ';
    const div = document.createElement('div');
    div.className = `subject-card ${id}`;
    div.innerHTML = `
      <div class="subject-icon">${subj.icon}</div>
      <div class="subject-name">${subj.name}</div>
      <div class="subject-best">${bestText}</div>`;
    div.addEventListener('click', () => startQuiz(id));
    grid.appendChild(div);
  }
}

// ── クイズ ───────────────────────────────────────────────

function startQuiz(subjectId) {
  const subj = SUBJECTS[subjectId];
  const allQ = QUESTIONS[subjectId];

  // シャッフルして必要問題数に絞る
  const shuffled = [...allQ].sort(() => Math.random() - 0.5).slice(0, subj.qCount);

  quizState = {
    subjectId,
    questions: shuffled,
    cur: 0,
    correct: 0,
    answered: false
  };

  document.getElementById('quiz-subject-name').textContent = `${subj.icon} ${subj.name}`;
  document.getElementById('quiz-total').textContent = shuffled.length;

  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  const qs = quizState;
  const q = qs.questions[qs.cur];

  document.getElementById('quiz-cur').textContent = qs.cur + 1;

  // プログレスバー
  const pct = (qs.cur / qs.questions.length) * 100;
  document.getElementById('quiz-progress-bar').style.width = pct + '%';

  // 問題文
  document.getElementById('question-text').textContent = q.q;

  // 選択肢をシャッフル（正解インデックスを追跡）
  const choiceData = q.choices.map((text, i) => ({ text, isCorrect: i === q.answer }));
  const shuffledChoices = [...choiceData].sort(() => Math.random() - 0.5);

  const grid = document.getElementById('choices-grid');
  grid.innerHTML = '';
  shuffledChoices.forEach(({ text, isCorrect }) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = text;
    btn.addEventListener('click', () => onChoiceClick(btn, isCorrect, q.choices[q.answer]));
    grid.appendChild(btn);
  });

  qs.answered = false;
}

function onChoiceClick(btn, isCorrect, correctText) {
  if (quizState.answered) return;
  quizState.answered = true;

  const grid = document.getElementById('choices-grid');
  const allBtns = grid.querySelectorAll('.choice-btn');

  // 全ボタン無効化
  allBtns.forEach(b => b.disabled = true);

  if (isCorrect) {
    btn.classList.add('correct');
    quizState.correct++;
    showAnswerFeedback(true, '');
  } else {
    btn.classList.add('wrong');
    // 正解ボタンを緑に
    allBtns.forEach(b => {
      if (b.textContent === correctText) b.classList.add('correct');
    });
    showAnswerFeedback(false, `こたえ: ${correctText}`);
  }

  // フラッシュ
  const body = document.getElementById('quiz-body');
  body.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong');
  setTimeout(() => {
    body.classList.remove('flash-correct', 'flash-wrong');
    hideAnswerFeedback();
    nextQuestion();
  }, 1000);
}

function showAnswerFeedback(isCorrect, correctText) {
  const overlay = document.getElementById('answer-overlay');
  document.getElementById('answer-icon').textContent = isCorrect ? '⭕' : '❌';
  document.getElementById('answer-text').textContent = isCorrect ? 'せいかい！' : 'ざんねん…';
  document.getElementById('answer-correct').textContent = correctText;
  overlay.classList.remove('hidden');
}

function hideAnswerFeedback() {
  document.getElementById('answer-overlay').classList.add('hidden');
}

function nextQuestion() {
  quizState.cur++;
  if (quizState.cur >= quizState.questions.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

// ── リザルト ─────────────────────────────────────────────

async function finishQuiz() {
  const { subjectId, questions, correct } = quizState;
  const total = questions.length;
  state.totalQuestions += total;

  // ランク計算
  const pct = correct / total;
  const rank = pct === 1 ? 'S' : pct >= 0.8 ? 'A' : 'B';

  // ユニットクリア更新
  const prev = state.unitClear[subjectId];
  const rankOrder = ['B', 'A', 'S'];
  const isNewBest = !prev || rankOrder.indexOf(rank) > rankOrder.indexOf(prev.best);
  state.unitClear[subjectId] = {
    count: (prev?.count || 0) + 1,
    best: isNewBest ? rank : (prev?.best || rank)
  };
  saveState();

  // XP加算
  const xpGain = correct * XP_PER_CORRECT;
  const evolutions = addXP(xpGain);

  // コレクション解放チェック
  const newUnlocks = (correct > 0) ? tryUnlockCollection(subjectId, rank) : [];

  // リザルト画面構築
  document.getElementById('result-score').textContent = `${correct}/${total}`;

  const rankEl = document.getElementById('result-rank');
  rankEl.textContent = rank;
  rankEl.className = `result-rank rank-${rank}`;

  document.getElementById('result-xp').textContent = `＋${xpGain} XP`;
  document.getElementById('result-partner-svg').innerHTML = getPartnerSVG();
  document.getElementById('result-partner-msg').textContent = getPartnerMsg(rank, correct, total);

  // コレクション解放表示
  const unlockDiv = document.getElementById('result-unlock');
  if (newUnlocks.length > 0) {
    const mon = COLLECTION_MONSTERS[newUnlocks[newUnlocks.length - 1]];
    document.getElementById('result-unlock-svg').innerHTML = monImg(mon.id);
    document.getElementById('result-unlock-name').textContent = mon.name;
    unlockDiv.style.display = '';
  } else {
    unlockDiv.style.display = 'none';
  }

  showScreen('result');

  // 進化オーバーレイを順に表示
  for (const evo of evolutions) {
    await showEvoOverlay(evo);
  }

  // コレクション解放オーバーレイ
  for (const id of newUnlocks) {
    await showUnlockOverlay(id);
  }
}

// ── 進化オーバーレイ ─────────────────────────────────────

function showEvoOverlay({ before, after, name }) {
  return new Promise(resolve => {
    document.getElementById('evo-before').innerHTML = before;
    document.getElementById('evo-after').innerHTML = after;
    document.getElementById('evo-name').textContent = `✨ ${name} ✨`;

    spawnParticles();

    const overlay = document.getElementById('evo-overlay');
    overlay.classList.remove('hidden');

    document.getElementById('evo-ok').onclick = () => {
      overlay.classList.add('hidden');
      resolve();
    };
  });
}

function spawnParticles() {
  const container = document.getElementById('evo-particles');
  container.innerHTML = '';
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FFE66D'];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / 16) * 360;
    const dist = 80 + Math.random() * 50;
    const dx = Math.cos(angle * Math.PI / 180) * dist;
    const dy = Math.sin(angle * Math.PI / 180) * dist;
    p.style.cssText = `
      left:50%; top:50%;
      background:${colors[i % colors.length]};
      --dx:${dx}px; --dy:${dy}px;
      --delay:${Math.random() * 0.3}s;
    `;
    container.appendChild(p);
  }
}

// ── コレクション解放オーバーレイ ─────────────────────────

function showUnlockOverlay(monsterId) {
  return new Promise(resolve => {
    const mon = COLLECTION_MONSTERS[monsterId];
    document.getElementById('unlock-svg-wrap').innerHTML = monImg(mon.id, 'unlock-img');
    document.getElementById('unlock-name').textContent = mon.name;
    const rankMap = { B: '⭐ Bランク', A: '⭐⭐ Aランク', S: '⭐⭐⭐ Sランク' };
    document.getElementById('unlock-rank-badge').textContent = rankMap[mon.rank];

    const overlay = document.getElementById('unlock-overlay');
    overlay.classList.remove('hidden');

    document.getElementById('unlock-ok').onclick = () => {
      overlay.classList.add('hidden');
      resolve();
    };
  });
}

// ── スターター選択 ───────────────────────────────────────

function renderStarter() {
  const grid = document.getElementById('starter-grid');
  grid.innerHTML = '';
  let selected = null;

  Object.entries(PARTNER_LINES).forEach(([lineId, line]) => {
    const card = document.createElement('div');
    card.className = 'starter-card';
    const m = PARTNER_MONSTERS[line.stages[0]];
    card.innerHTML = `
      ${monImg(m.id, 'starter-mon-img')}
      <div class="starter-card-name">${m.name}</div>
      <div class="starter-card-type">${line.icon} ${line.name}</div>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.starter-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selected = lineId;
      document.getElementById('btn-starter-go').style.display = '';
    });
    grid.appendChild(card);
  });

  document.getElementById('btn-starter-go').onclick = () => {
    if (!selected) return;
    state.partner = { lineId: selected, level: 1, xp: 0, stage: 0 };
    saveState();
    showScreen('home');
    renderHome();
  };
}

// ── モンスタールーム ─────────────────────────────────────

function renderMonsterRoom() {
  const p = state.partner;
  const monster = getPartnerMonster();

  // パートナーカード
  const card = document.getElementById('partner-room-card');
  const needed = p.level < MAX_LEVEL ? xpForNextLevel(p.level) : 0;
  const pct = needed > 0 ? Math.min(100, (p.xp / needed) * 100) : 100;
  card.innerHTML = `
    ${monImg(monster.id, 'partner-room-img')}
    <div class="partner-room-info">
      <div class="partner-room-name">${monster.name}</div>
      <div class="partner-room-lv">Lv.${p.level}${p.level >= MAX_LEVEL ? ' MAX' : ''}</div>
      <div class="partner-room-xp-track">
        <div class="partner-room-xp-fill" style="width:${pct}%"></div>
      </div>
    </div>`;

  // コレクション
  const grid = document.getElementById('collection-grid');
  grid.innerHTML = '';
  document.getElementById('coll-count').textContent = state.collection.length;

  // 解放済みのみ表示
  const unlocked = state.collection.map(id => COLLECTION_MONSTERS[id]).filter(Boolean);
  if (unlocked.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;color:#999;font-size:13px;padding:8px">まだモンスターがいません。べんきょうしてゲットしよう！</p>';
  } else {
    unlocked.forEach(mon => {
      const item = document.createElement('div');
      item.className = `collection-item rank-${mon.rank}`;
      item.innerHTML = `
        ${monImg(mon.id, 'coll-img')}
        <div class="c-name">${mon.name}</div>
        <div class="c-rank rank-${mon.rank}">${mon.rank}ランク</div>`;
      grid.appendChild(item);
    });
  }
}

// ── ずかん ───────────────────────────────────────────────

let zukanTab = 'all';

function renderZukan(tab) {
  zukanTab = tab || 'all';
  const grid = document.getElementById('zukan-grid');
  grid.innerHTML = '';
  document.getElementById('zukan-count').textContent = state.collection.length;

  // タブのactive切り替え
  document.querySelectorAll('.zukan-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === zukanTab);
  });

  // 表示対象モンスターを決定
  let monsters = [];
  for (const subj of COLL_SUBJECTS) {
    if (zukanTab !== 'all' && zukanTab !== subj) continue;
    for (const rank of ['B', 'A', 'S']) {
      monsters.push(COLLECTION_MONSTERS[`${subj}_${rank}`]);
    }
  }

  monsters.forEach(mon => {
    const isUnlocked = state.collection.includes(mon.id);
    const item = document.createElement('div');
    item.className = `zukan-item${isUnlocked ? ` rank-${mon.rank}` : ' locked'}`;
    item.innerHTML = `
      ${isUnlocked ? monImg(mon.id, 'zukan-img') : `<div class="zukan-silhouette">${monImg(mon.id, 'zukan-img silhouette')}</div>`}
      <div class="z-name">${isUnlocked ? mon.name : '???'}</div>
      ${isUnlocked ? `<div class="z-rank">${mon.rank}ランク</div>` : ''}`;
    grid.appendChild(item);
  });
}

// ── ナビゲーション ───────────────────────────────────────

function navigateTo(nav) {
  // BottomNavのactive切り替え（全画面共通）
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === nav);
  });

  switch (nav) {
    case 'home':
      renderHome();
      showScreen('home');
      break;
    case 'monster':
      renderMonsterRoom();
      showScreen('monster');
      break;
    case 'zukan':
      renderZukan(zukanTab);
      showScreen('zukan');
      break;
    case 'settings':
      showScreen('settings');
      break;
  }
}

// ── イベントリスナー一括登録 ─────────────────────────────

function setupEvents() {
  // BottomNav（全画面）
  document.addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (btn && btn.dataset.nav) {
      navigateTo(btn.dataset.nav);
    }
  });

  // クイズ終了ボタン
  document.getElementById('quiz-back').addEventListener('click', () => {
    if (confirm('クイズをやめますか？')) {
      showScreen('home');
      renderHome();
    }
  });

  // リザルト → ホーム
  document.getElementById('btn-result-home').addEventListener('click', () => {
    showScreen('home');
    renderHome();
  });

  // ずかんタブ
  document.getElementById('zukan-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.zukan-tab');
    if (tab) renderZukan(tab.dataset.tab);
  });

  // せってい: パートナーリセット
  document.getElementById('btn-reset-partner').addEventListener('click', () => {
    if (confirm('パートナーをかえますか？\nXP・レベルはリセットされます。')) {
      state.partner = null;
      saveState();
      renderStarter();
      showScreen('starter');
    }
  });

  // せってい: 全リセット
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    if (confirm('ぜんぶのデータをけしますか？\nもとにもどせません！')) {
      localStorage.removeItem(SAVE_KEY);
      state = { ...DEFAULT_STATE };
      renderStarter();
      showScreen('starter');
    }
  });
}

// ── 起動 ─────────────────────────────────────────────────

function init() {
  setupEvents();

  if (!state.partner) {
    renderStarter();
    showScreen('starter');
  } else {
    renderHome();
    showScreen('home');
  }
}

init();
