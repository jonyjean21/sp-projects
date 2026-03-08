/* ============================================================
   まなびモン — app.js
   メインアプリロジック
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
const DEFAULT_STATE = {
  grade: null,
  monster: { stage: 0, level: 1, xp: 0 },
  stars: 0,
  streak: 0,
  lastDate: null,
  maxStreak: 0,
  totalQ: 0,
  totalCorrect: 0,
  totalStars: 0,
  maxLv: 1,
  perfectCount: 0,
  evoCount: 0,
  shopCount: 0,
  owned: [],       // shop item ids
  achievements: [],// achievement ids
  equipped: [],    // equipped accessory ids
  subjCorrect: {}, // { subjectKey: count }
  subjTotal: {},
};

let S = {};        // current state
let soundOn = true;

// Quiz session
let quiz = {
  subject: null,
  subjectKey: null,
  questions: [],
  idx: 0,
  correct: 0,
  starsEarned: 0,
  xpEarned: 0,
  answered: false,
};

// ============================================================
// SAVE / LOAD
// ============================================================
function saveState() {
  localStorage.setItem('manabimon_state', JSON.stringify(S));
  localStorage.setItem('manabimon_sound', soundOn ? '1' : '0');
}
function loadState() {
  try {
    const raw = localStorage.getItem('manabimon_state');
    if (raw) {
      S = Object.assign({}, DEFAULT_STATE, JSON.parse(raw));
    } else {
      S = { ...DEFAULT_STATE };
    }
  } catch (e) {
    S = { ...DEFAULT_STATE };
  }
  soundOn = localStorage.getItem('manabimon_sound') !== '0';
  // Fix missing keys
  if (!S.subjCorrect) S.subjCorrect = {};
  if (!S.subjTotal)   S.subjTotal   = {};
  if (!S.owned)       S.owned       = [];
  if (!S.achievements)S.achievements= [];
  if (!S.equipped)    S.equipped    = [];
}
function resetState() {
  const grade = S.grade;
  S = { ...DEFAULT_STATE, grade };
  saveState();
}

// ============================================================
// SOUND ENGINE (Web Audio API)
// ============================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, dur, type = 'sine', vol = 0.3) {
  if (!soundOn) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (e) {}
}
function playSoundCorrect() {
  playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 100); setTimeout(() => playTone(784, 0.2), 200);
}
function playSoundWrong() {
  playTone(330, 0.15, 'sawtooth'); setTimeout(() => playTone(260, 0.2, 'sawtooth'), 150);
}
function playSoundLevelUp() {
  [523,587,659,698,784,880,988,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.12, 'triangle', 0.25), i*80));
}
function playSoundEvolve() {
  [262,330,392,523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.15, 'triangle', 0.3), i*100));
}
function playSoundClick() {
  playTone(660, 0.08, 'sine', 0.15);
}

// ============================================================
// SCREEN MANAGER
// ============================================================
function showScreen(id) {
  const prev = document.querySelector('.screen.active');
  const next = document.getElementById('screen-' + id);
  if (!next || next === prev) return;

  if (prev) {
    prev.classList.add('out');
    setTimeout(() => { prev.classList.remove('active', 'out'); }, 220);
  }
  next.classList.add('active', 'in');
  setTimeout(() => next.classList.remove('in'), 300);

  // Render specific screens
  if (id === 'home')         renderHome();
  if (id === 'monster-room') renderMonsterRoom();
  if (id === 'shop')         renderShop();
  if (id === 'achievements') renderAchievements();

  // Update nav
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.nav === id);
  });
}

// ============================================================
// GRADE THEMING
// ============================================================
function applyGradeTheme(grade) {
  document.body.className = grade === 1 ? '' : `grade-${grade}`;
}

// ============================================================
// MONSTER HELPERS
// ============================================================
function getMonsterData(grade, stage) {
  return MONSTERS[grade].stages[stage];
}
function getCurrentMonster() {
  return getMonsterData(S.grade, S.monster.stage);
}
function getMonsterEmoji() {
  return getCurrentMonster().emoji;
}
function getMonsterName() {
  return getCurrentMonster().name;
}
function xpMax() {
  return xpForLevel(S.monster.level);
}
function getMonsterStageForLevel(lv) {
  const stages = MONSTERS[S.grade].stages;
  let found = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (lv >= stages[i].minLv) { found = i; break; }
  }
  return found;
}

// ============================================================
// RENDER HOME
// ============================================================
function renderHome() {
  if (!S.grade) return;
  applyGradeTheme(S.grade);

  // Stats
  document.getElementById('stat-stars').textContent = S.stars;
  document.getElementById('stat-streak').textContent = S.streak;

  // Monster
  document.getElementById('home-monster').textContent = getMonsterEmoji();
  document.getElementById('home-name').textContent    = getMonsterName();
  document.getElementById('home-lv').textContent      = S.monster.level;
  const pct = Math.min(100, Math.round(S.monster.xp / xpMax() * 100));
  document.getElementById('home-xp-bar').style.width  = pct + '%';
  document.getElementById('home-xp').textContent      = S.monster.xp;
  document.getElementById('home-xp-max').textContent  = xpMax();

  renderMissions();
  renderSubjects();
}

// ============================================================
// MISSIONS
// ============================================================
const MISSIONS = [
  { key:'q10',   icon:'📝', label:'もんだい10もん', target: s => s.totalQ, goal: 10, unit:'' },
  { key:'corr5', icon:'✅', label:'5もん連続正解',  target: s => s._sessionCorrect||0, goal: 5, unit:'' },
  { key:'subj2', icon:'📚', label:'2教科べんきょう', target: s => s._todaySubjects||0, goal: 2, unit:'' },
];

function renderMissions() {
  const row = document.getElementById('missions-row');
  const missions = [
    { icon:'📝', label:'もんだいを10ことく',   done: S.totalQ >= 10 },
    { icon:'✅', label:'きょう1ステージクリア', done: (S._todayQuizzes||0) >= 1 },
    { icon:'⭐', label:'スターを5こあつめる',   done: S.stars >= 5 },
  ];
  row.innerHTML = missions.map(m => `
    <div class="mission-chip ${m.done ? 'done' : ''}">
      <span>${m.icon}</span>
      <span>${m.label}</span>
      ${m.done ? '<span>✔</span>' : ''}
    </div>
  `).join('');
}

// ============================================================
// SUBJECTS GRID
// ============================================================
function renderSubjects() {
  const grid = document.getElementById('subjects-grid');
  const subjs = SUBJECTS[S.grade];
  grid.innerHTML = subjs.map(subj => {
    const total = S.subjTotal[subj.key] || 0;
    const corr  = S.subjCorrect[subj.key] || 0;
    const pct   = total > 0 ? Math.round(corr / total * 100) : 0;
    const stars  = Math.round(pct / 20);
    const dots   = Array.from({length:5}, (_,i) => `<span class="sdot ${i<stars?'on':''}"></span>`).join('');
    return `
      <div class="subj-card" data-key="${subj.key}" data-name="${subj.name}">
        <span class="subj-icon">${subj.icon}</span>
        <span class="subj-name">${subj.name}</span>
        <span class="subj-prog">${total > 0 ? pct + '%正解' : 'まだやってないよ'}</span>
        <div class="subj-dots">${dots}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.subj-card').forEach(card => {
    card.addEventListener('click', () => {
      playSoundClick();
      startQuiz(card.dataset.key, card.dataset.name);
    });
  });
}

// ============================================================
// QUIZ ENGINE
// ============================================================
function startQuiz(subjKey, subjName) {
  const pool = QUESTIONS[S.grade][subjKey];
  if (!pool || pool.length === 0) return;

  // Shuffle and pick 10
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(10, shuffled.length));

  // Hide any lingering feedback
  document.getElementById('feedback-overlay').classList.remove('show');

  quiz = {
    subject: subjName,
    subjectKey: subjKey,
    questions: selected,
    idx: 0,
    correct: 0,
    starsEarned: 0,
    xpEarned: 0,
    answered: false,
    results: {},
  };

  renderQuizUI();
  showScreen('quiz');
}

function renderQuizUI() {
  // Tag
  document.getElementById('quiz-tag').textContent = quiz.subject;

  // Monster
  document.getElementById('quiz-mon').textContent = getMonsterEmoji();

  // Dots
  const dots = document.getElementById('quiz-dots');
  dots.innerHTML = quiz.questions.map((_, i) =>
    `<div class="qdot ${i === 0 ? 'cur' : ''}"></div>`
  ).join('');

  renderQuestion();
}

function renderQuestion() {
  const q = quiz.questions[quiz.idx];
  quiz.answered = false;

  document.getElementById('q-num').textContent    = `もんだい ${quiz.idx + 1}/${quiz.questions.length}`;
  document.getElementById('q-text').textContent   = q.q;
  document.getElementById('q-hint').textContent   = q.hint || '';

  // Update dots using recorded results
  document.querySelectorAll('.qdot').forEach((d, i) => {
    if (i === quiz.idx) d.className = 'qdot cur';
    else if (quiz.results && quiz.results[i] !== undefined) d.className = 'qdot ' + (quiz.results[i] ? 'ok' : 'ng');
    else d.className = 'qdot';
  });

  // Hide feedback
  const overlay = document.getElementById('feedback-overlay');
  overlay.classList.remove('show');

  // Monster neutral
  const mon = document.getElementById('quiz-mon');
  mon.className = 'quiz-mon';
  document.getElementById('quiz-bubble').className = 'quiz-bubble';

  // Choices
  const choices = document.getElementById('choices');
  const shuffledChoices = [...q.c].sort(() => Math.random() - 0.5);

  choices.innerHTML = shuffledChoices.map(choice =>
    `<button class="choice-btn">${choice}</button>`
  ).join('');

  choices.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (quiz.answered) return;
      answerQuestion(btn, q);
    });
  });
}

function answerQuestion(btn, q) {
  quiz.answered = true;
  const isCorrect = btn.textContent === q.a;

  // Disable all buttons
  document.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === q.a) b.classList.add('ok');
    else if (b === btn && !isCorrect) b.classList.add('ng');
  });

  const mon = document.getElementById('quiz-mon');
  const bubble = document.getElementById('quiz-bubble');

  if (isCorrect) {
    playSoundCorrect();
    quiz.correct++;
    quiz.starsEarned += 10;
    quiz.xpEarned += 10;
    mon.className = 'quiz-mon happy';
    bubble.textContent = ['クリティカル！','げきは！','いちげき！','よし、やった！','てきをたおした！'][Math.floor(Math.random()*5)];
    bubble.className = 'quiz-bubble show';
    showXpPopup(btn, '+10XP');
  } else {
    playSoundWrong();
    mon.className = 'quiz-mon sad';
    bubble.textContent = ['まけないぞ！','つぎはやる！','くそ、あとで覚えとけ！'][Math.floor(Math.random()*3)];
    bubble.className = 'quiz-bubble show';
  }

  // Record result and update dot
  quiz.results[quiz.idx] = isCorrect;
  document.querySelectorAll('.qdot')[quiz.idx].className = 'qdot ' + (isCorrect ? 'ok' : 'ng');

  // Show feedback
  const overlay = document.getElementById('feedback-overlay');
  document.getElementById('fb-icon').textContent    = isCorrect ? '⚔️' : '🧊';
  document.getElementById('fb-msg').textContent     = isCorrect ? 'とどめをさした！' : 'ダメージをうけた…';
  document.getElementById('fb-msg').className       = 'fb-msg ' + (isCorrect ? 'ok-txt' : 'ng-txt');
  document.getElementById('fb-exp').textContent     = q.exp || '';
  document.getElementById('fb-xp').textContent      = isCorrect ? '＋10 XP ＋10⭐' : 'まけるな！つぎはやり返せ！';

  setTimeout(() => overlay.classList.add('show'), 100);
}

document.getElementById('btn-next').addEventListener('click', () => {
  playSoundClick();
  quiz.idx++;
  if (quiz.idx < quiz.questions.length) {
    renderQuestion();
  } else {
    finishQuiz();
  }
});

document.getElementById('btn-quiz-quit').addEventListener('click', () => {
  if (confirm('きょうはここまで？')) {
    showScreen('home');
  }
});

// ============================================================
// QUIZ FINISH
// ============================================================
function finishQuiz() {
  // Update stats
  S.totalQ += quiz.questions.length;
  S.totalCorrect += quiz.correct;
  S.stars += quiz.starsEarned;
  S.totalStars += quiz.starsEarned;
  S._todayQuizzes = (S._todayQuizzes || 0) + 1;

  if (!S.subjCorrect[quiz.subjectKey]) S.subjCorrect[quiz.subjectKey] = 0;
  if (!S.subjTotal[quiz.subjectKey])   S.subjTotal[quiz.subjectKey]   = 0;
  S.subjCorrect[quiz.subjectKey] += quiz.correct;
  S.subjTotal[quiz.subjectKey]   += quiz.questions.length;

  // Perfect score?
  if (quiz.correct === quiz.questions.length) S.perfectCount++;

  // Streak
  const today = new Date().toDateString();
  if (S.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (S.lastDate === yesterday) S.streak++;
    else S.streak = 1;
    S.lastDate = today;
    if (S.streak > S.maxStreak) S.maxStreak = S.streak;
  }

  // XP & Level up
  let leveledUp = false;
  let evolved = false;
  S.monster.xp += quiz.xpEarned;

  while (S.monster.xp >= xpMax()) {
    S.monster.xp -= xpMax();
    S.monster.level++;
    leveledUp = true;
    if (S.monster.level > S.maxLv) S.maxLv = S.monster.level;
  }

  if (leveledUp) {
    const newStage = getMonsterStageForLevel(S.monster.level);
    if (newStage > S.monster.stage) {
      S.monster.stage = newStage;
      S.evoCount++;
      evolved = true;
      playSoundEvolve();
    } else {
      playSoundLevelUp();
    }
  }

  // Check achievements
  const newBadges = checkAchievements();

  saveState();
  renderResultScreen(leveledUp, evolved, newBadges);
  showScreen('result');
}

// ============================================================
// RESULT SCREEN
// ============================================================
function renderResultScreen(leveledUp, evolved, newBadges) {
  const pct = Math.round(quiz.correct / quiz.questions.length * 100);

  const titles = {
    100: 'かんぺき！まんてん！🎊',
    80:  'すごい！よくできました！',
    60:  'まあまあ！がんばったよ！',
    40:  'もうすこし！がんばろう！',
    0:   'つぎはもっとできるよ！'
  };
  const title = titles[Object.keys(titles).reverse().find(k => pct >= k)];

  document.getElementById('res-monster').textContent  = getMonsterEmoji();
  document.getElementById('res-title').textContent    = title;
  document.getElementById('res-correct').textContent  = `${quiz.correct}/${quiz.questions.length}`;
  document.getElementById('res-stars').textContent    = `+${quiz.starsEarned}⭐`;
  document.getElementById('res-xp').textContent       = `+${quiz.xpEarned}XP`;

  // Level up card
  const lvCard = document.getElementById('lv-up-card');
  if (leveledUp && !evolved) {
    lvCard.classList.remove('hidden');
    document.getElementById('new-lv').textContent = S.monster.level;
  } else {
    lvCard.classList.add('hidden');
  }

  // Evolve card
  const evoCard = document.getElementById('evolve-card');
  if (evolved) {
    evoCard.classList.remove('hidden');
    document.getElementById('evo-mon').textContent  = getMonsterEmoji();
    document.getElementById('evo-name').textContent = getMonsterName();
    document.getElementById('evo-desc').textContent = getCurrentMonster().desc;
  } else {
    evoCard.classList.add('hidden');
  }

  // Message
  const msgs = {
    100: `${getMonsterName()}がとてもよろこんでいる！`,
    80:  `${getMonsterName()}が「がんばったね！」といっているよ！`,
    60:  `${getMonsterName()}が「もっとやろう！」といっているよ！`,
    0:   `${getMonsterName()}が「いっしょにがんばろう！」といっているよ！`
  };
  const msg = msgs[Object.keys(msgs).reverse().find(k => pct >= k)];
  document.getElementById('res-msg').textContent = msg;

  // Confetti for good scores
  if (pct >= 80) spawnConfetti();
}

// ============================================================
// MONSTER ROOM
// ============================================================
function renderMonsterRoom() {
  // Big monster display
  document.getElementById('room-showcase').textContent = getMonsterEmoji();

  // Stats
  const statsGrid = document.getElementById('room-stats-grid');
  statsGrid.innerHTML = `
    <div class="rst-card"><span class="rst-val">${S.monster.level}</span><span class="rst-lbl">レベル</span></div>
    <div class="rst-card"><span class="rst-val">${S.monster.xp}/${xpMax()}</span><span class="rst-lbl">けいけんち</span></div>
    <div class="rst-card"><span class="rst-val">${S.stars}</span><span class="rst-lbl">スター⭐</span></div>
    <div class="rst-card"><span class="rst-val">${S.totalQ}</span><span class="rst-lbl">といたもんだい</span></div>
    <div class="rst-card"><span class="rst-val">${S.streak}</span><span class="rst-lbl">れんぞくにっすう🔥</span></div>
    <div class="rst-card"><span class="rst-val">${S.evoCount}</span><span class="rst-lbl">しんかかいすう✨</span></div>
  `;

  // Evolution tree hidden — keep it a surprise!

  // Accessories
  const accList = document.getElementById('acc-list');
  const owned = SHOP_ITEMS.filter(item => S.owned.includes(item.id));
  if (owned.length === 0) {
    accList.innerHTML = '<span style="color:var(--txt2);font-size:.85em;">まだアクセサリーがないよ。ショップでかってね！</span>';
  } else {
    accList.innerHTML = owned.map(item =>
      `<span class="acc-chip">${item.icon} ${item.name}</span>`
    ).join('');
  }
}

// ============================================================
// SHOP
// ============================================================
function renderShop() {
  document.getElementById('shop-bal').textContent = S.stars;

  const grid = document.getElementById('shop-grid');
  grid.innerHTML = SHOP_ITEMS.map(item => {
    const owned   = S.owned.includes(item.id);
    const afford  = S.stars >= item.cost;
    let cls = 'shop-card';
    if (owned)  cls += ' owned';
    else if (!afford) cls += ' poor';
    return `
      <div class="${cls}" data-id="${item.id}">
        <span class="shop-item-icon">${item.icon}</span>
        <span class="shop-item-name">${item.name}</span>
        ${owned
          ? '<span class="shop-owned-badge">もっている</span>'
          : `<span class="shop-item-cost">⭐ ${item.cost}</span>`}
        <span class="shop-item-desc">${item.desc}</span>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.shop-card:not(.owned):not(.poor)').forEach(card => {
    card.addEventListener('click', () => {
      const item = SHOP_ITEMS.find(i => i.id === card.dataset.id);
      if (!item || S.owned.includes(item.id) || S.stars < item.cost) return;
      if (confirm(`「${item.name}」を⭐${item.cost}でかう？`)) {
        playSoundClick();
        S.stars   -= item.cost;
        S.owned.push(item.id);
        S.shopCount++;
        saveState();
        checkAchievements();
        renderShop();
        showXpPopupAt(`${item.icon} ゲット！`, window.innerWidth/2, window.innerHeight/2);
      }
    });
  });
}

// ============================================================
// ACHIEVEMENTS
// ============================================================
function checkAchievements() {
  const newOnes = [];
  ACHIEVEMENTS.forEach(ach => {
    if (!S.achievements.includes(ach.id) && ach.check(S)) {
      S.achievements.push(ach.id);
      newOnes.push(ach);
    }
  });
  if (newOnes.length) saveState();
  return newOnes;
}

function renderAchievements() {
  const bar = document.getElementById('ach-bar');
  bar.textContent = `${S.achievements.length} / ${ACHIEVEMENTS.length} バッジかくとく！`;

  const grid = document.getElementById('badges-grid');
  grid.innerHTML = ACHIEVEMENTS.map(ach => {
    const on = S.achievements.includes(ach.id);
    return `
      <div class="badge-card ${on ? 'on' : 'off'}">
        <span class="badge-icon">${ach.icon}</span>
        <span class="badge-name">${ach.name}</span>
        <span class="badge-desc">${on ? ach.desc : '???'}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// CONFETTI
// ============================================================
function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#FFD700','#FF6B9D','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left:${Math.random()*100}%;
      top:-20px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${1.2 + Math.random()*1.2}s;
      animation-delay:${Math.random()*.5}s;
      transform:rotate(${Math.random()*360}deg) scale(${0.5+Math.random()});
    `;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}

function showXpPopup(anchor, text) {
  const rect = anchor.getBoundingClientRect();
  showXpPopupAt(text, rect.left + rect.width/2, rect.top);
}

function showXpPopupAt(text, x, y) {
  const el = document.createElement('div');
  el.className = 'xp-popup';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ============================================================
// SETTINGS MODAL
// ============================================================
function openSettings() {
  document.getElementById('modal-settings').classList.add('open');
  document.getElementById('btn-sound').textContent = soundOn ? '🔊 オン' : '🔇 オフ';
  document.getElementById('btn-sound').classList.toggle('off', !soundOn);
}
function closeSettings() {
  document.getElementById('modal-settings').classList.remove('open');
}

document.getElementById('btn-settings').addEventListener('click', () => {
  playSoundClick();
  openSettings();
});
document.getElementById('btn-settings-close').addEventListener('click', () => {
  closeSettings();
});
document.getElementById('btn-sound').addEventListener('click', () => {
  soundOn = !soundOn;
  document.getElementById('btn-sound').textContent = soundOn ? '🔊 オン' : '🔇 オフ';
  document.getElementById('btn-sound').classList.toggle('off', !soundOn);
  saveState();
});
document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('全部のデータがきえるよ！本当にリセットする？')) {
    resetState();
    S.grade = 2;
    saveState();
    closeSettings();
    renderHome();
  }
});

// Modal backdrop click
document.getElementById('modal-settings').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-settings')) closeSettings();
});

// ============================================================
// RESULT BUTTONS
// ============================================================
document.getElementById('btn-res-home').addEventListener('click', () => {
  playSoundClick();
  showScreen('home');
});
document.getElementById('btn-res-retry').addEventListener('click', () => {
  playSoundClick();
  startQuiz(quiz.subjectKey, quiz.subject);
});

// ============================================================
// BOTTOM NAV
// ============================================================
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    playSoundClick();
    showScreen(btn.dataset.nav);
  });
});

// ============================================================
// BACK BUTTONS
// ============================================================
document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    playSoundClick();
    showScreen(btn.dataset.back);
  });
});

// Monster tap easter egg
document.getElementById('home-monster').addEventListener('click', () => {
  playSoundClick();
  const m = document.getElementById('home-monster');
  m.style.transform = 'scale(1.3) rotate(10deg)';
  setTimeout(() => m.style.transform = '', 300);
  const phrases = ['こおりにしてやる！','もっとつよくなるぞ！','たたかうぞ！','ぬくもりなどきらいだ！','ていおうへのみち！'];
  showXpPopupAt(phrases[Math.floor(Math.random()*phrases.length)],
    m.getBoundingClientRect().left + 50, m.getBoundingClientRect().top - 20);
});

// ============================================================
// DAILY STREAK CHECK
// ============================================================
function checkDailyStreak() {
  const today = new Date().toDateString();
  if (S.lastDate && S.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (S.lastDate !== yesterday) {
      // Streak broken
      if (S.streak > 0) {
        S.streak = 0;
        saveState();
      }
    }
  }
  S._todayQuizzes = 0;
}


// ============================================================
// INIT
// ============================================================
function init() {
  loadState();
  // Grade 2 fixed
  S.grade = 2;
  checkDailyStreak();
  checkAchievements();
  applyGradeTheme(2);
  document.getElementById('screen-welcome').classList.remove('active');
  const homeScreen = document.getElementById('screen-home');
  homeScreen.classList.add('active');
  renderHome();
}

init();
