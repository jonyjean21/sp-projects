/**
 * MOLKKY HUB 大会情報ページ強化スクリプト
 * - キーワード検索（大会名・主催者・開催地）
 * - 初心者向けフィルタ
 * - ソート（開催日 近い順/遠い順）
 * - 既存DOMのカード表示/非表示制御
 * - 地域タブとの連携（サーバーリロード→クライアント制御に変換）
 *
 * 対象: /event/tournament/ ページのみ
 * 依存: なし（バニラJS、ES5互換）
 */
(function () {
  'use strict';

  if (!location.pathname.startsWith('/event/tournament')) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 地域タブ（region）→ 都道府県（prefecture）のマッピング
  // タブは region 単位、カードの class は area-{prefecture} 単位
  var REGION_TO_PREFECTURES = {
    hokkaido: ['hokkaido'],
    tohoku: ['aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima'],
    kanto: ['ibaraki', 'tochigi', 'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa', 'yamanashi'],
    hokushinetsu: ['niigata', 'nagano', 'toyama', 'ishikawa', 'fukui'],
    tokai: ['gifu', 'shizuoka', 'aichi', 'mie'],
    kansai: ['shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama'],
    chugoku: ['tottori', 'shimane', 'okayama', 'hiroshima', 'yamaguchi'],
    shikoku: ['tokushima', 'kagawa', 'ehime', 'kochi'],
    kyushu: ['fukuoka', 'saga', 'nagasaki', 'kumamoto', 'oita', 'miyazaki', 'kagoshima'],
    okinawa: ['okinawa']
  };

  // 逆引きマップ生成: prefecture → region
  var PREFECTURE_TO_REGION = {};
  for (var region in REGION_TO_PREFECTURES) {
    var prefs = REGION_TO_PREFECTURES[region];
    for (var p = 0; p < prefs.length; p++) {
      PREFECTURE_TO_REGION[prefs[p]] = region;
    }
  }

  // 初心者向けキーワード
  var BEGINNER_KEYWORDS = ['初心者', 'ビギナー', '体験', '未経験', 'はじめて', '初めて', '入門'];

  function init() {
    var list = document.querySelector('.mh-list');
    var regionFilter = document.querySelector('.mh-region-filter');
    if (!list || !regionFilter) return;

    var articles = Array.prototype.slice.call(list.querySelectorAll('article.mh-row'));
    if (articles.length === 0) return;

    // --- 各カードからデータ抽出 ---
    var cards = articles.map(function (el) {
      var titleEl = el.querySelector('.mh-title');
      var locEl = el.querySelector('.mh-chip--loc');
      var orgTextEl = el.querySelector('.mh-orgText');
      var scaleEl = el.querySelector('.mh-chip--scale');
      var dateYEl = el.querySelector('.mh-dateY');
      var dateMDEl = el.querySelector('.mh-dateMD');

      // area クラスを抽出（area-fukuoka → fukuoka）
      var prefecture = '';
      var classList = el.className.split(/\s+/);
      for (var i = 0; i < classList.length; i++) {
        if (classList[i].indexOf('area-') === 0) {
          prefecture = classList[i].substring(5);
          break;
        }
      }

      // 所属する地域
      var region = PREFECTURE_TO_REGION[prefecture] || '';

      // 日付パース
      var dateObj = null;
      if (dateYEl && dateMDEl) {
        var year = parseInt(dateYEl.textContent.trim());
        var md = dateMDEl.textContent.trim();
        var parts = md.split('/');
        if (parts.length === 2 && !isNaN(year)) {
          dateObj = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
        }
      }

      var title = titleEl ? titleEl.textContent.trim() : '';
      var loc = locEl ? locEl.textContent.replace(/📍\s*/, '').trim() : '';
      var org = orgTextEl ? orgTextEl.textContent.trim() : '';
      var scale = scaleEl ? scaleEl.textContent.replace(/👥\s*/, '').trim() : '';

      // 初心者向け判定
      var fullText = title + ' ' + loc + ' ' + org + ' ' + scale;
      var isBeginner = false;
      for (var j = 0; j < BEGINNER_KEYWORDS.length; j++) {
        if (fullText.indexOf(BEGINNER_KEYWORDS[j]) !== -1) {
          isBeginner = true;
          break;
        }
      }

      return {
        el: el,
        title: title,
        loc: loc,
        org: org,
        prefecture: prefecture,
        region: region,
        scale: scale,
        dateObj: dateObj,
        isBeginner: isBeginner,
        searchText: fullText.toLowerCase()
      };
    });

    var totalCount = cards.length;

    // --- CSS注入 ---
    injectStyles();

    // --- コントロールバーUI ---
    var controls = document.createElement('div');
    controls.className = 'te-controls';

    // 検索ボックス
    var searchWrap = document.createElement('div');
    searchWrap.className = 'te-search-wrap';
    var searchIcon = document.createElement('span');
    searchIcon.className = 'te-search-icon';
    searchIcon.textContent = '\uD83D\uDD0D';
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'te-search';
    searchInput.placeholder = '\u5927\u4F1A\u540D\u30FB\u4E3B\u50AC\u8005\u30FB\u958B\u50AC\u5730\u3067\u691C\u7D22';
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);

    // 初心者向けフィルタ
    var beginnerBtn = document.createElement('button');
    beginnerBtn.type = 'button';
    beginnerBtn.className = 'te-beginner-btn';
    beginnerBtn.textContent = '\uD83C\uDD95 \u521D\u5FC3\u8005OK';

    // ソート
    var sortSelect = document.createElement('select');
    sortSelect.className = 'te-sort-select';
    var optAsc = document.createElement('option');
    optAsc.value = 'asc';
    optAsc.textContent = '\u2195 \u958B\u50AC\u65E5 \u8FD1\u3044\u9806';
    var optDesc = document.createElement('option');
    optDesc.value = 'desc';
    optDesc.textContent = '\u2195 \u958B\u50AC\u65E5 \u9060\u3044\u9806';
    sortSelect.appendChild(optAsc);
    sortSelect.appendChild(optDesc);

    // 件数表示
    var countEl = document.createElement('div');
    countEl.className = 'te-count';

    controls.appendChild(searchWrap);
    controls.appendChild(beginnerBtn);
    controls.appendChild(sortSelect);
    controls.appendChild(countEl);

    // 地域タブの直後に挿入
    regionFilter.parentNode.insertBefore(controls, regionFilter.nextSibling);

    // 検索結果なしメッセージ
    var noResults = document.createElement('div');
    noResults.className = 'te-no-results';
    noResults.textContent = '\u6761\u4EF6\u306B\u4E00\u81F4\u3059\u308B\u5927\u4F1A\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F';
    noResults.style.display = 'none';
    list.parentNode.insertBefore(noResults, list.nextSibling);

    // --- 状態 ---
    var state = {
      keyword: '',
      beginnerOnly: false,
      sortOrder: 'asc',
      activeRegion: '' // '' = すべて, 'hokkaido', 'kanto', etc.
    };

    // --- 地域タブの乗っ取り ---
    // 既存: <a href="/event/tournament/?area=kanto" class="mh-btn">関東</a>
    // → クリックでページリロードせず、クライアント側フィルタに変換
    var regionLinks = regionFilter.querySelectorAll('a.mh-btn');
    for (var i = 0; i < regionLinks.length; i++) {
      (function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();

          // アクティブ状態を切り替え
          for (var j = 0; j < regionLinks.length; j++) {
            regionLinks[j].classList.remove('is-active');
          }
          link.classList.add('is-active');

          // hrefからarea=xxx を取得
          var href = link.getAttribute('href') || '';
          var match = href.match(/[?&]area=([a-z]+)/);
          state.activeRegion = match ? match[1] : '';

          applyFilters();
        });
      })(regionLinks[i]);
    }

    // --- イベントリスナー ---
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.keyword = searchInput.value.trim().toLowerCase();
        applyFilters();
      }, 150);
    });

    beginnerBtn.addEventListener('click', function () {
      state.beginnerOnly = !state.beginnerOnly;
      beginnerBtn.classList.toggle('is-active', state.beginnerOnly);
      applyFilters();
    });

    sortSelect.addEventListener('change', function () {
      state.sortOrder = sortSelect.value;
      applySort();
    });

    // --- フィルタ適用 ---
    function applyFilters() {
      var visibleCount = 0;
      var keywords = state.keyword ? state.keyword.split(/\s+/) : [];

      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var visible = true;

        // キーワードフィルタ（AND検索: スペース区切りで全てに一致）
        if (keywords.length > 0) {
          for (var k = 0; k < keywords.length; k++) {
            if (card.searchText.indexOf(keywords[k]) === -1) {
              visible = false;
              break;
            }
          }
        }

        // 初心者向けフィルタ
        if (visible && state.beginnerOnly && !card.isBeginner) {
          visible = false;
        }

        // 地域フィルタ
        // タブは region（kanto）、カードは prefecture（tokyo）なので
        // card.region と state.activeRegion を比較
        if (visible && state.activeRegion) {
          if (card.region !== state.activeRegion) {
            visible = false;
          }
        }

        card.el.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      }

      // 件数更新
      countEl.innerHTML = '<strong>' + visibleCount + '\u4EF6</strong> / \u5168' + totalCount + '\u4EF6';

      // 検索結果なし表示
      noResults.style.display = visibleCount === 0 ? '' : 'none';
      list.style.display = visibleCount === 0 ? 'none' : '';
    }

    // --- ソート適用 ---
    function applySort() {
      var sorted = cards.slice().sort(function (a, b) {
        if (!a.dateObj && !b.dateObj) return 0;
        if (!a.dateObj) return 1;
        if (!b.dateObj) return -1;
        var diff = a.dateObj.getTime() - b.dateObj.getTime();
        return state.sortOrder === 'asc' ? diff : -diff;
      });

      // DOM並び替え（DocumentFragment でリフロー最小化）
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < sorted.length; i++) {
        fragment.appendChild(sorted[i].el);
      }
      list.appendChild(fragment);

      // ソート後もフィルタを再適用（表示/非表示の整合性保持）
      applyFilters();
    }

    // --- 初期状態の検出 ---
    // URLに ?area=kanto 等がある場合、該当タブをアクティブにする
    var urlParams = new URLSearchParams(location.search);
    var initialArea = urlParams.get('area');
    if (initialArea) {
      state.activeRegion = initialArea;
      // 該当タブにis-activeを付与
      for (var i = 0; i < regionLinks.length; i++) {
        var href = regionLinks[i].getAttribute('href') || '';
        regionLinks[i].classList.remove('is-active');
        if (href.indexOf('area=' + initialArea) !== -1) {
          regionLinks[i].classList.add('is-active');
        }
      }
    }

    // 初期表示
    applyFilters();
  }

  // --- スタイル注入 ---
  function injectStyles() {
    var css = [
      '.te-controls {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 10px;',
      '  align-items: center;',
      '  padding: 14px 16px;',
      '  margin: 12px 0 16px;',
      '  background: #f7f9fc;',
      '  border: 1px solid #e2e8f0;',
      '  border-radius: 8px;',
      '}',
      '.te-search-wrap {',
      '  position: relative;',
      '  flex: 1 1 240px;',
      '  min-width: 200px;',
      '}',
      '.te-search-icon {',
      '  position: absolute;',
      '  left: 10px;',
      '  top: 50%;',
      '  transform: translateY(-50%);',
      '  font-size: 14px;',
      '  pointer-events: none;',
      '  color: #94a3b8;',
      '}',
      '.te-search {',
      '  width: 100%;',
      '  padding: 8px 12px 8px 32px;',
      '  border: 1px solid #cbd5e1;',
      '  border-radius: 6px;',
      '  font-size: 14px;',
      '  background: #fff;',
      '  box-sizing: border-box;',
      '  outline: none;',
      '  transition: border-color 0.2s;',
      '}',
      '.te-search:focus {',
      '  border-color: #3b82f6;',
      '  box-shadow: 0 0 0 2px rgba(59,130,246,0.15);',
      '}',
      '.te-search::placeholder {',
      '  color: #94a3b8;',
      '}',
      '.te-beginner-btn {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  padding: 8px 14px;',
      '  border: 1px solid #cbd5e1;',
      '  border-radius: 6px;',
      '  background: #fff;',
      '  font-size: 13px;',
      '  cursor: pointer;',
      '  white-space: nowrap;',
      '  transition: all 0.2s;',
      '  color: #475569;',
      '  user-select: none;',
      '}',
      '.te-beginner-btn:hover {',
      '  background: #f1f5f9;',
      '}',
      '.te-beginner-btn.is-active {',
      '  background: #eff6ff;',
      '  border-color: #3b82f6;',
      '  color: #1d4ed8;',
      '}',
      '.te-sort-select {',
      '  padding: 8px 12px;',
      '  border: 1px solid #cbd5e1;',
      '  border-radius: 6px;',
      '  font-size: 13px;',
      '  background: #fff;',
      '  cursor: pointer;',
      '  outline: none;',
      '  color: #475569;',
      '}',
      '.te-sort-select:focus {',
      '  border-color: #3b82f6;',
      '}',
      '.te-count {',
      '  font-size: 13px;',
      '  color: #64748b;',
      '  white-space: nowrap;',
      '  margin-left: auto;',
      '}',
      '.te-count strong {',
      '  color: #1e293b;',
      '}',
      '.te-no-results {',
      '  text-align: center;',
      '  padding: 40px 20px;',
      '  color: #94a3b8;',
      '  font-size: 15px;',
      '}',
      '@media (max-width: 600px) {',
      '  .te-controls {',
      '    flex-direction: column;',
      '    align-items: stretch;',
      '  }',
      '  .te-search-wrap {',
      '    min-width: 0;',
      '  }',
      '  .te-count {',
      '    margin-left: 0;',
      '    text-align: center;',
      '  }',
      '  .te-sort-select, .te-beginner-btn {',
      '    width: 100%;',
      '    box-sizing: border-box;',
      '  }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
