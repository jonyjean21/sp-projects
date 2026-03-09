/* トクラシ — app.js */
(function () {
  'use strict';

  const ARTICLES_URL = 'articles.json';
  let articles = [];

  /* ---- Data ---- */
  async function loadArticles() {
    try {
      const res = await fetch(ARTICLES_URL + '?t=' + Date.now());
      articles = await res.json();
    } catch {
      articles = [];
    }
    return articles;
  }

  /* ---- Index page ---- */
  function renderIndex() {
    const listEl = document.getElementById('article-list');
    const tabsEl = document.getElementById('cat-tabs');
    if (!listEl) return;

    loadArticles().then(() => {
      // Categories
      const cats = ['ALL', ...new Set(articles.map(a => a.category))];
      if (tabsEl) {
        tabsEl.innerHTML = cats.map(c =>
          `<span class="cat-tab${c === 'ALL' ? ' active' : ''}" data-cat="${c}">${c === 'ALL' ? 'すべて' : c}</span>`
        ).join('');
        tabsEl.addEventListener('click', e => {
          const tab = e.target.closest('.cat-tab');
          if (!tab) return;
          tabsEl.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          renderList(tab.dataset.cat);
        });
      }
      renderList('ALL');
    });

    function renderList(cat) {
      const filtered = cat === 'ALL' ? articles : articles.filter(a => a.category === cat);
      if (!filtered.length) {
        listEl.innerHTML = '<div class="empty">記事がまだありません</div>';
        return;
      }
      listEl.innerHTML = filtered.map(a => `
        <a class="article-card" href="article.html?slug=${a.slug}">
          <span class="cat-label">${a.category}</span>
          <h2>${esc(a.title)}</h2>
          <p class="excerpt">${esc(a.excerpt)}</p>
          <div class="meta">${a.date}</div>
        </a>
      `).join('');
    }
  }

  /* ---- Article page ---- */
  function renderArticle() {
    const el = document.getElementById('article-content');
    if (!el) return;

    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) { location.href = 'index.html'; return; }

    loadArticles().then(() => {
      const a = articles.find(x => x.slug === slug);
      if (!a) {
        el.innerHTML = '<div class="empty">記事が見つかりませんでした</div>';
        return;
      }
      document.title = a.title + ' | トクラシ';
      el.innerHTML = `
        <a class="back-link" href="index.html">&larr; 記事一覧へ</a>
        <div class="pr-badge">PR</div>
        <div class="article-header">
          <span class="cat-label">${a.category}</span>
          <h1>${esc(a.title)}</h1>
          <div class="meta">${a.date} 更新</div>
        </div>
        <div class="article-body">${a.body}</div>
        <div class="disclaimer">
          ※ 当サイトはアフィリエイトプログラムに参加しています。記事内のリンクから商品を購入された場合、当サイトに報酬が支払われることがあります。<br>
          ※ 記載の情報は記事公開時点のものです。最新の情報は各公式サイトでご確認ください。<br>
          ※ 当サイトの情報を参考にした結果について、当サイトは一切の責任を負いません。
        </div>
      `;
    });
  }

  /* ---- Util ---- */
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', () => {
    renderIndex();
    renderArticle();
  });
})();
