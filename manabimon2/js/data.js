/* ============================================================
   data.js — まなびモン2 全データ定義
   ============================================================ */

// ── パートナーモンスター SVG ──────────────────────────────

const PARTNER_SVG = {

  fire_0: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="63" rx="29" ry="27" fill="#FF7043"/>
    <ellipse cx="50" cy="68" rx="17" ry="13" fill="#FFAB91"/>
    <path d="M50 35 Q43 21 48 14 Q53 22 50 35Z" fill="#FFD600"/>
    <path d="M41 39 Q35 26 40 20 Q43 30 41 39Z" fill="#FF8F00"/>
    <path d="M59 39 Q65 26 60 20 Q57 30 59 39Z" fill="#FF8F00"/>
    <circle cx="41" cy="56" r="7.5" fill="white"/>
    <circle cx="59" cy="56" r="7.5" fill="white"/>
    <circle cx="42" cy="57" r="4.5" fill="#1A237E"/>
    <circle cx="60" cy="57" r="4.5" fill="#1A237E"/>
    <circle cx="43" cy="56" r="1.5" fill="white"/>
    <circle cx="61" cy="56" r="1.5" fill="white"/>
    <ellipse cx="35" cy="63" rx="6" ry="4" fill="#FF8A65" opacity="0.55"/>
    <ellipse cx="65" cy="63" rx="6" ry="4" fill="#FF8A65" opacity="0.55"/>
    <path d="M44 68 Q50 74 56 68" stroke="#BF360C" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="22" cy="66" rx="8" ry="6" fill="#FF7043" transform="rotate(-15 22 66)"/>
    <ellipse cx="78" cy="66" rx="8" ry="6" fill="#FF7043" transform="rotate(15 78 66)"/>
    <ellipse cx="40" cy="87" rx="9" ry="5" fill="#FF7043"/>
    <ellipse cx="60" cy="87" rx="9" ry="5" fill="#FF7043"/>
  </svg>`,

  fire_1: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 48 Q5 28 16 18 Q29 30 27 52Z" fill="#EF6C00"/>
    <path d="M82 48 Q95 28 84 18 Q71 30 73 52Z" fill="#EF6C00"/>
    <ellipse cx="50" cy="61" rx="21" ry="25" fill="#F4511E"/>
    <ellipse cx="50" cy="67" rx="12" ry="14" fill="#FFAB91"/>
    <circle cx="50" cy="33" r="18" fill="#F4511E"/>
    <path d="M37 18 L31 4 L41 14Z" fill="#BF360C"/>
    <path d="M63 18 L69 4 L59 14Z" fill="#BF360C"/>
    <ellipse cx="43" cy="30" rx="6" ry="7" fill="#FFD600"/>
    <ellipse cx="57" cy="30" rx="6" ry="7" fill="#FFD600"/>
    <ellipse cx="43" cy="31" rx="3" ry="4" fill="#111"/>
    <ellipse cx="57" cy="31" rx="3" ry="4" fill="#111"/>
    <path d="M36 24 Q42 21 46 25" stroke="#BF360C" stroke-width="2" fill="none"/>
    <path d="M64 24 Q58 21 54 25" stroke="#BF360C" stroke-width="2" fill="none"/>
    <ellipse cx="50" cy="41" rx="8" ry="5" fill="#FFAB91"/>
    <circle cx="47" cy="41" r="1.5" fill="#BF360C"/>
    <circle cx="53" cy="41" r="1.5" fill="#BF360C"/>
    <path d="M44 85 Q50 93 56 90 Q58 84 62 88" stroke="#FFD600" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="38" cy="82" rx="6" ry="3" fill="#F4511E"/>
    <ellipse cx="62" cy="82" rx="6" ry="3" fill="#F4511E"/>
  </svg>`,

  fire_2: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 52 Q1 22 14 11 Q27 26 24 57Z" fill="#C62828"/>
    <path d="M96 52 Q99 22 86 11 Q73 26 76 57Z" fill="#C62828"/>
    <ellipse cx="50" cy="63" rx="21" ry="25" fill="#B71C1C"/>
    <path d="M38 52 Q50 46 62 52 Q50 49 38 52Z" fill="#7B0000"/>
    <path d="M36 62 Q50 56 64 62 Q50 59 36 62Z" fill="#7B0000"/>
    <ellipse cx="50" cy="69" rx="12" ry="13" fill="#FF8A65"/>
    <circle cx="50" cy="31" r="21" fill="#C62828"/>
    <path d="M50 10 Q46 0 50 -4 Q54 0 50 10Z" fill="#FFD600"/>
    <path d="M37 14 Q31 4 36 -1 Q40 7 37 14Z" fill="#FF8F00"/>
    <path d="M63 14 Q69 4 64 -1 Q60 7 63 14Z" fill="#FF8F00"/>
    <ellipse cx="42" cy="28" rx="7.5" ry="8.5" fill="#FF5722"/>
    <ellipse cx="58" cy="28" rx="7.5" ry="8.5" fill="#FF5722"/>
    <ellipse cx="42" cy="29" rx="4" ry="5" fill="white"/>
    <ellipse cx="58" cy="29" rx="4" ry="5" fill="white"/>
    <circle cx="42" cy="29" r="2.5" fill="#111"/>
    <circle cx="58" cy="29" r="2.5" fill="#111"/>
    <polygon points="50,18 53,23 50,26 47,23" fill="#FFD600"/>
    <ellipse cx="50" cy="41" rx="9" ry="6" fill="#8B0000"/>
    <path d="M45 46 L43 53 L47 46Z" fill="white"/>
    <path d="M55 46 L57 53 L53 46Z" fill="white"/>
    <path d="M50 88 Q62 94 68 100" stroke="#B71C1C" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M68 100 Q64 91 72 93Z" fill="#FFD600"/>
    <path d="M34 82 L28 91 M37 84 L32 93 M40 85 L36 94" stroke="#7B0000" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M66 82 L72 91 M63 84 L68 93 M60 85 L64 94" stroke="#7B0000" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  water_0: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="63" rx="29" ry="27" fill="#42A5F5"/>
    <ellipse cx="50" cy="68" rx="17" ry="13" fill="#BBDEFB"/>
    <path d="M50 28 Q43 39 50 46 Q57 39 50 28Z" fill="#1565C0"/>
    <circle cx="41" cy="56" r="7.5" fill="white"/>
    <circle cx="59" cy="56" r="7.5" fill="white"/>
    <circle cx="42" cy="57" r="4.5" fill="#0D47A1"/>
    <circle cx="60" cy="57" r="4.5" fill="#0D47A1"/>
    <circle cx="43" cy="56" r="1.5" fill="white"/>
    <circle cx="61" cy="56" r="1.5" fill="white"/>
    <ellipse cx="35" cy="63" rx="6" ry="4" fill="#64B5F6" opacity="0.55"/>
    <ellipse cx="65" cy="63" rx="6" ry="4" fill="#64B5F6" opacity="0.55"/>
    <path d="M44 68 Q50 74 56 68" stroke="#1565C0" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M22 58 Q14 53 17 67 Q21 73 29 67Z" fill="#42A5F5"/>
    <path d="M78 58 Q86 53 83 67 Q79 73 71 67Z" fill="#42A5F5"/>
    <ellipse cx="40" cy="87" rx="9" ry="5" fill="#42A5F5"/>
    <ellipse cx="60" cy="87" rx="9" ry="5" fill="#42A5F5"/>
    <circle cx="30" cy="44" r="3" fill="#BBDEFB" opacity="0.7"/>
    <circle cx="70" cy="42" r="2" fill="#BBDEFB" opacity="0.7"/>
  </svg>`,

  water_1: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M27 90 Q15 72 20 52 Q26 32 50 27" stroke="#0D47A1" stroke-width="16" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="61" rx="20" ry="23" fill="#1E88E5"/>
    <ellipse cx="50" cy="67" rx="12" ry="14" fill="#BBDEFB"/>
    <circle cx="50" cy="34" r="18" fill="#1E88E5"/>
    <path d="M50 15 Q44 5 47 -1 Q53 5 50 15Z" fill="#0D47A1"/>
    <ellipse cx="43" cy="31" rx="6" ry="7" fill="#00BCD4"/>
    <ellipse cx="57" cy="31" rx="6" ry="7" fill="#00BCD4"/>
    <circle cx="43" cy="32" r="3" fill="#0D47A1"/>
    <circle cx="57" cy="32" r="3" fill="#0D47A1"/>
    <circle cx="44" cy="31" r="1" fill="white"/>
    <circle cx="58" cy="31" r="1" fill="white"/>
    <path d="M42 50 Q50 46 58 50" stroke="#0D47A1" stroke-width="1.5" fill="none"/>
    <path d="M40 58 Q50 54 60 58" stroke="#0D47A1" stroke-width="1.5" fill="none"/>
    <path d="M27 56 Q19 50 21 63 Q25 69 34 63Z" fill="#0D47A1"/>
    <path d="M73 56 Q81 50 79 63 Q75 69 66 63Z" fill="#0D47A1"/>
    <ellipse cx="50" cy="43" rx="7" ry="4" fill="#BBDEFB"/>
    <path d="M14 82 Q20 76 26 82 Q32 88 38 82" stroke="#64B5F6" stroke-width="2" fill="none"/>
  </svg>`,

  water_2: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 72 Q20 62 33 72 Q46 82 59 72 Q72 62 85 72 Q93 79 95 74" stroke="#4FC3F7" stroke-width="3" fill="none" opacity="0.6"/>
    <ellipse cx="50" cy="61" rx="22" ry="26" fill="#0D47A1"/>
    <path d="M38 51 Q50 46 62 51 Q50 48 38 51Z" fill="#1A237E"/>
    <path d="M36 61 Q50 56 64 61 Q50 58 36 61Z" fill="#1A237E"/>
    <ellipse cx="50" cy="68" rx="13" ry="14" fill="#4FC3F7"/>
    <path d="M50 88 Q36 96 29 101" stroke="#0D47A1" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M29 101 Q23 91 31 89Z" fill="#4FC3F7"/>
    <path d="M4 56 Q7 30 22 28 Q28 41 24 61Z" fill="#1565C0"/>
    <path d="M96 56 Q93 30 78 28 Q72 41 76 61Z" fill="#1565C0"/>
    <circle cx="50" cy="30" r="22" fill="#0D47A1"/>
    <path d="M50 8 Q46 -2 50 -7 Q54 -2 50 8Z" fill="#00BCD4"/>
    <path d="M37 12 Q32 2 36 -3 Q41 5 37 12Z" fill="#0288D1"/>
    <path d="M63 12 Q68 2 64 -3 Q59 5 63 12Z" fill="#0288D1"/>
    <ellipse cx="41" cy="26" rx="8.5" ry="9.5" fill="#00E5FF"/>
    <ellipse cx="59" cy="26" rx="8.5" ry="9.5" fill="#00E5FF"/>
    <ellipse cx="41" cy="27" rx="4.5" ry="5.5" fill="#0D47A1"/>
    <ellipse cx="59" cy="27" rx="4.5" ry="5.5" fill="#0D47A1"/>
    <circle cx="41" cy="26" r="2" fill="white"/>
    <circle cx="59" cy="26" r="2" fill="white"/>
    <path d="M50 42 L46 47 L50 50 L54 47Z" fill="#00BCD4"/>
    <ellipse cx="50" cy="38" rx="9" ry="6" fill="#1565C0"/>
    <circle cx="50" cy="62" r="7" fill="#00BCD4" opacity="0.3"/>
    <circle cx="50" cy="62" r="4" fill="#00E5FF" opacity="0.4"/>
  </svg>`,

  grass_0: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="63" rx="29" ry="27" fill="#66BB6A"/>
    <ellipse cx="50" cy="68" rx="17" ry="13" fill="#C8E6C9"/>
    <path d="M50 33 Q40 19 44 11 Q53 22 50 33Z" fill="#2E7D32"/>
    <path d="M50 33 Q60 19 56 11 Q47 22 50 33Z" fill="#388E3C"/>
    <line x1="50" y1="35" x2="50" y2="42" stroke="#2E7D32" stroke-width="2"/>
    <circle cx="41" cy="56" r="7.5" fill="white"/>
    <circle cx="59" cy="56" r="7.5" fill="white"/>
    <circle cx="42" cy="57" r="4.5" fill="#1B5E20"/>
    <circle cx="60" cy="57" r="4.5" fill="#1B5E20"/>
    <circle cx="43" cy="56" r="1.5" fill="white"/>
    <circle cx="61" cy="56" r="1.5" fill="white"/>
    <ellipse cx="35" cy="63" rx="6" ry="4" fill="#81C784" opacity="0.55"/>
    <ellipse cx="65" cy="63" rx="6" ry="4" fill="#81C784" opacity="0.55"/>
    <path d="M44 68 Q50 74 56 68" stroke="#1B5E20" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M21 60 Q13 52 19 66 Q23 71 31 65Z" fill="#66BB6A"/>
    <path d="M79 60 Q87 52 81 66 Q77 71 69 65Z" fill="#66BB6A"/>
    <ellipse cx="40" cy="87" rx="9" ry="5" fill="#66BB6A"/>
    <ellipse cx="60" cy="87" rx="9" ry="5" fill="#66BB6A"/>
    <circle cx="31" cy="46" r="3" fill="#FFE082"/>
    <circle cx="69" cy="44" r="2.5" fill="#FFE082"/>
  </svg>`,

  grass_1: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M63 91 Q70 80 67 70 Q64 60 67 50" stroke="#2E7D32" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="61" rx="20" ry="24" fill="#43A047"/>
    <ellipse cx="50" cy="66" rx="12" ry="14" fill="#C8E6C9"/>
    <circle cx="50" cy="33" r="18" fill="#43A047"/>
    <path d="M50 14 Q42 4 46 -1 Q54 4 50 14Z" fill="#1B5E20"/>
    <path d="M39 18 Q31 10 35 4 Q42 12 39 18Z" fill="#2E7D32"/>
    <path d="M61 18 Q69 10 65 4 Q58 12 61 18Z" fill="#2E7D32"/>
    <ellipse cx="43" cy="30" rx="6" ry="7" fill="#76FF03"/>
    <ellipse cx="57" cy="30" rx="6" ry="7" fill="#76FF03"/>
    <circle cx="43" cy="31" r="3" fill="#1B5E20"/>
    <circle cx="57" cy="31" r="3" fill="#1B5E20"/>
    <circle cx="44" cy="30" r="1" fill="white"/>
    <circle cx="58" cy="30" r="1" fill="white"/>
    <path d="M38 52 Q50 47 62 52" stroke="#2E7D32" stroke-width="2" fill="none"/>
    <path d="M36 60 Q50 55 64 60" stroke="#2E7D32" stroke-width="2" fill="none"/>
    <path d="M27 53 Q11 41 13 59 Q15 69 32 64Z" fill="#2E7D32"/>
    <path d="M73 53 Q89 41 87 59 Q85 69 68 64Z" fill="#2E7D32"/>
    <ellipse cx="50" cy="41" rx="7" ry="4.5" fill="#C8E6C9"/>
    <ellipse cx="38" cy="81" rx="6" ry="3" fill="#2E7D32"/>
    <ellipse cx="62" cy="81" rx="6" ry="3" fill="#2E7D32"/>
    <circle cx="50" cy="61" r="4" fill="#FFEE58" opacity="0.45"/>
  </svg>`,

  grass_2: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M44 91 Q39 97 34 101" stroke="#4E342E" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M50 91 Q50 97 48 101" stroke="#4E342E" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M56 89 Q63 96 66 101" stroke="#4E342E" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="61" rx="22" ry="26" fill="#33691E"/>
    <path d="M39 49 Q50 44 61 49" stroke="#1B5E20" stroke-width="2" fill="none"/>
    <path d="M37 57 Q50 52 63 57" stroke="#1B5E20" stroke-width="2" fill="none"/>
    <path d="M37 65 Q50 60 63 65" stroke="#1B5E20" stroke-width="2" fill="none"/>
    <ellipse cx="50" cy="68" rx="13" ry="14" fill="#8BC34A"/>
    <path d="M4 46 Q9 29 20 27 Q26 40 22 56Z" fill="#4E342E"/>
    <path d="M96 46 Q91 29 80 27 Q74 40 78 56Z" fill="#4E342E"/>
    <circle cx="12" cy="27" r="13" fill="#2E7D32"/>
    <circle cx="7" cy="20" r="9" fill="#388E3C"/>
    <circle cx="19" cy="19" r="9" fill="#43A047"/>
    <circle cx="88" cy="27" r="13" fill="#2E7D32"/>
    <circle cx="93" cy="20" r="9" fill="#388E3C"/>
    <circle cx="81" cy="19" r="9" fill="#43A047"/>
    <circle cx="50" cy="28" r="24" fill="#33691E"/>
    <circle cx="50" cy="3" r="15" fill="#1B5E20"/>
    <circle cx="35" cy="8" r="11" fill="#2E7D32"/>
    <circle cx="65" cy="8" r="11" fill="#2E7D32"/>
    <circle cx="27" cy="19" r="9" fill="#388E3C"/>
    <circle cx="73" cy="19" r="9" fill="#388E3C"/>
    <ellipse cx="42" cy="26" rx="8.5" ry="9.5" fill="#F9A825"/>
    <ellipse cx="58" cy="26" rx="8.5" ry="9.5" fill="#F9A825"/>
    <ellipse cx="42" cy="27" rx="4.5" ry="5.5" fill="#1B5E20"/>
    <ellipse cx="58" cy="27" rx="4.5" ry="5.5" fill="#1B5E20"/>
    <circle cx="42" cy="26" r="2" fill="#FFEE58"/>
    <circle cx="58" cy="26" r="2" fill="#FFEE58"/>
    <circle cx="50" cy="14" r="5" fill="#FFEE58"/>
    <circle cx="50" cy="14" r="3" fill="#FF6F00"/>
    <ellipse cx="50" cy="38" rx="9" ry="6" fill="#8BC34A"/>
    <path d="M34 83 L27 91 M37 85 L32 93 M40 86 L37 94" stroke="#4E342E" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M66 83 L73 91 M63 85 L68 93 M60 86 L63 94" stroke="#4E342E" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`
};

// ── コレクションモンスター SVG 生成 ────────────────────────

const COLL_COLORS = {
  B: { body: '#90A4AE', hi: '#B0BEC5', eye: '#546E7A', text: '#ECEFF1' },
  A: { kuku: { body: '#EF5350', hi: '#FF7043', eye: '#B71C1C' },
       tashihiki: { body: '#26C6DA', hi: '#4DD0E1', eye: '#00838F' },
       kanji: { body: '#AB47BC', hi: '#CE93D8', eye: '#6A1B9A' },
       tani: { body: '#FFA726', hi: '#FFD54F', eye: '#E65100' },
       sansu: { body: '#26A69A', hi: '#80CBC4', eye: '#00695C' },
       kokugo: { body: '#42A5F5', hi: '#90CAF9', eye: '#1565C0' },
       eigo: { body: '#EC407A', hi: '#F48FB1', eye: '#880E4F' } },
  S: { body: '#FFD700', hi: '#FFF9C4', eye: '#FF6F00', text: '#FFF9C4' }
};

function makeCollSVG(type, rank) {
  const symbols = {
    kuku: '×', tashihiki: '±', kanji: '字',
    tani: 'm', sansu: '?', kokugo: '文', eigo: 'A'
  };
  const sym = symbols[type] || '★';

  let bc, hc, ec;
  if (rank === 'B') {
    bc = '#90A4AE'; hc = '#B0BEC5'; ec = '#546E7A';
  } else if (rank === 'S') {
    bc = '#FFD700'; hc = '#FFF9C4'; ec = '#FF6F00';
  } else {
    const c = COLL_COLORS.A[type];
    bc = c.body; hc = c.hi; ec = c.eye;
  }

  const glow = rank === 'S' ? `<filter id="g${type}${rank}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : '';
  const glowAttr = rank === 'S' ? `filter="url(#g${type}${rank})"` : '';
  const stars = rank === 'S'
    ? `<circle cx="16" cy="16" r="4" fill="#FFF9C4" opacity="0.9"/>
       <circle cx="80" cy="20" r="3" fill="#FFF9C4" opacity="0.8"/>
       <circle cx="22" cy="76" r="3" fill="#FFF9C4" opacity="0.8"/>
       <circle cx="78" cy="74" r="4" fill="#FFF9C4" opacity="0.9"/>`
    : '';

  return `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
    <defs>${glow}</defs>
    ${stars}
    <ellipse cx="48" cy="56" rx="32" ry="30" fill="${bc}" ${glowAttr}/>
    <ellipse cx="48" cy="62" rx="20" ry="15" fill="${hc}" opacity="0.5"/>
    <circle cx="37" cy="48" r="7" fill="white"/>
    <circle cx="59" cy="48" r="7" fill="white"/>
    <circle cx="38" cy="49" r="4" fill="${ec}"/>
    <circle cx="60" cy="49" r="4" fill="${ec}"/>
    <circle cx="39" cy="48" r="1.5" fill="white"/>
    <circle cx="61" cy="48" r="1.5" fill="white"/>
    <text x="48" y="72" text-anchor="middle" font-size="18" font-weight="bold" fill="white" font-family="sans-serif">${sym}</text>
    <path d="M38 60 Q48 66 58 60" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

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
      svg: makeCollSVG(subj, rank)
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
