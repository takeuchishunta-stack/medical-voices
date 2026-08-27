(function () {
  'use strict';

  var state = {
    articles: [],
    activeCategory: 'すべて',
    sent: false
  };

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatDate(isoDate) {
    return isoDate.replace(/-/g, '.');
  }

  function sortedArticles() {
    return state.articles.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
  }

  // Fixed display order for the categories the site launched with; any new
  // category added later in articles.json is appended after these, in the
  // order it first appears (newest article first).
  var CATEGORY_ORDER = ['小児歯科・矯正', 'DX / 経営戦略', 'ホスピタリティ', '在宅医療', '自由診療'];

  function categoryList() {
    var present = [];
    sortedArticles().forEach(function (a) {
      if (present.indexOf(a.category) === -1) present.push(a.category);
    });
    var ordered = CATEGORY_ORDER.filter(function (c) { return present.indexOf(c) !== -1; });
    var extra = present.filter(function (c) { return ordered.indexOf(c) === -1; });
    return ordered.concat(extra);
  }

  function articleById(id) {
    return state.articles.find(function (a) { return a.id === id; });
  }

  // ---- Shared media renderers ----

  function renderMedia(article, className) {
    if (article.image) {
      return '<img class="' + className + '" src="' + escapeHtml(article.image) + '" alt="' + escapeHtml(article.person) + '">';
    }
    return '<div class="ph-img ' + className + '"><span>' + escapeHtml(article.imgHint || '写真') + '</span></div>';
  }

  function renderAvatar(article) {
    if (article.image) {
      return '<img src="' + escapeHtml(article.image) + '" alt="' + escapeHtml(article.person) + '">';
    }
    return escapeHtml(article.person.charAt(0));
  }

  // ---- Card rendering ----

  function renderFeaturedCard(article) {
    return (
      '<button type="button" class="featured-card" data-id="' + escapeHtml(article.id) + '">' +
        '<div class="featured-card-media">' +
          renderMedia(article, 'featured-card-img') +
          (article.badge ?
            '<div class="featured-badge"><span class="featured-badge-dot"></span>' + escapeHtml(article.badge) + '</div>' :
            '') +
        '</div>' +
        '<div class="featured-card-body">' +
          '<div class="card-category">' + escapeHtml(article.category) + '</div>' +
          '<div class="featured-card-title">' + escapeHtml(article.title) + '</div>' +
          '<div class="card-byline">' +
            '<div class="avatar">' + renderAvatar(article) + '</div>' +
            '<div><span class="person-name">' + escapeHtml(article.person) + '</span>　' + escapeHtml(article.org) + '</div>' +
          '</div>' +
        '</div>' +
      '</button>'
    );
  }

  function renderArticleCard(article) {
    return (
      '<button type="button" class="article-card" data-id="' + escapeHtml(article.id) + '">' +
        '<div class="article-card-media">' + renderMedia(article, 'article-card-img') + '</div>' +
        '<div class="article-card-body">' +
          '<div class="card-category">' + escapeHtml(article.category) + '</div>' +
          '<div class="article-card-title">' + escapeHtml(article.title) + '</div>' +
          '<div class="article-card-meta"><span class="person-name">' + escapeHtml(article.person) + '</span>　' + escapeHtml(article.org) + '</div>' +
        '</div>' +
      '</button>'
    );
  }

  function renderQaBlock(block) {
    return (
      '<div class="qa-block">' +
        '<div class="qa-question"><span class="qa-q-label">Q.</span><span class="qa-q-text">' + escapeHtml(block.q) + '</span></div>' +
        '<p class="qa-answer">' + escapeHtml(block.a) + '</p>' +
      '</div>'
    );
  }

  // Wraps each heading and the blocks that follow it in the same .article-section,
  // matching the top margin the original design gives per section.
  function renderContent(content) {
    var html = '';
    var openSection = false;
    (content || []).forEach(function (block) {
      if (block.type === 'h') {
        if (openSection) html += '</div>';
        html += '<div class="article-section"><h2 class="article-section-heading">' + escapeHtml(block.text) + '</h2>';
        openSection = true;
      } else if (block.type === 'quote') {
        html += '<blockquote>' + escapeHtml(block.text) + '</blockquote>';
      } else if (block.type === 'qa') {
        html += renderQaBlock(block);
      } else {
        html += '<p>' + escapeHtml(block.text) + '</p>';
      }
    });
    if (openSection) html += '</div>';
    return html;
  }

  // ---- View renderers ----

  function renderHome() {
    var cats = ['すべて'].concat(categoryList());
    document.getElementById('tab-bar').innerHTML = cats.map(function (c) {
      return '<button type="button" class="tab-chip' + (state.activeCategory === c ? ' is-active' : '') + '" data-category="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
    }).join('');

    var filtered = sortedArticles().filter(function (a) {
      return state.activeCategory === 'すべて' || a.category === state.activeCategory;
    });
    var featured = filtered.filter(function (a) { return a.featured; });
    var rest = filtered.filter(function (a) { return !a.featured; });

    var featuredGridEl = document.getElementById('featured-grid');
    if (featured.length > 0) {
      featuredGridEl.innerHTML = featured.map(renderFeaturedCard).join('');
      featuredGridEl.classList.remove('is-hidden');
    } else {
      featuredGridEl.innerHTML = '';
      featuredGridEl.classList.add('is-hidden');
    }

    document.getElementById('article-grid').innerHTML = rest.map(renderArticleCard).join('');
    document.getElementById('no-results').textContent = filtered.length === 0 ? 'この条件の記事はまだありません。' : '';
  }

  function renderArticle(article) {
    document.getElementById('article-category').textContent = article.category;
    document.getElementById('article-title').textContent = article.title;
    document.getElementById('article-avatar').innerHTML = renderAvatar(article);
    document.getElementById('article-person').textContent = article.person;
    document.getElementById('article-meta').textContent = article.org + '／' + formatDate(article.date);
    document.getElementById('article-hero').innerHTML = renderMedia(article, 'article-hero-img');
    document.getElementById('article-lead').textContent = article.lead;
    document.getElementById('article-body').innerHTML = renderContent(article.content);
    document.getElementById('article-profile-name').textContent = article.person + '（' + article.org + '）';
    document.getElementById('article-profile-text').textContent = article.profile;
  }

  function renderContactSubmit() {
    document.getElementById('contact-submit').textContent = state.sent ? '送信しました（デモ）' : '送信する';
  }

  // ---- Routing ----

  var VIEWS = ['view-home', 'view-article', 'view-about', 'view-media'];

  function showView(id) {
    VIEWS.forEach(function (v) {
      document.getElementById(v).classList.toggle('is-hidden', v !== id);
    });
  }

  function setActiveNav(section) {
    document.getElementById('nav-home').classList.toggle('is-active', section === 'home');
    document.getElementById('nav-about').classList.toggle('is-active', section === 'about');
    document.getElementById('nav-media').classList.toggle('is-active', section === 'media');
  }

  function currentHash() {
    return window.location.hash.replace(/^#/, '');
  }

  function route() {
    var hash = currentHash();

    if (hash === 'about') {
      showView('view-about');
      setActiveNav('about');
      renderContactSubmit();
    } else if (hash === 'media') {
      showView('view-media');
      setActiveNav('media');
    } else {
      var article = hash ? articleById(hash) : null;
      if (article) {
        showView('view-article');
        setActiveNav('home');
        renderArticle(article);
      } else {
        showView('view-home');
        setActiveNav('home');
        renderHome();
      }
    }

    window.scrollTo(0, 0);
  }

  // ---- Events ----

  function goTo(hash) {
    if (window.location.hash === hash) {
      route();
    } else {
      window.location.hash = hash;
    }
  }

  function bindStaticEvents() {
    document.getElementById('logo-link').addEventListener('click', function () { goTo(''); });
    document.getElementById('nav-home').addEventListener('click', function () { goTo(''); });
    document.getElementById('nav-about').addEventListener('click', function () { goTo('about'); });
    document.getElementById('nav-media').addEventListener('click', function () { goTo('media'); });
    document.getElementById('header-cta').addEventListener('click', function () { goTo('about'); });
    document.getElementById('home-cta-button').addEventListener('click', function () { goTo('about'); });
    document.getElementById('article-back-link').addEventListener('click', function () { goTo(''); });

    document.getElementById('tab-bar').addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-chip');
      if (!btn) return;
      state.activeCategory = btn.getAttribute('data-category');
      renderHome();
    });

    document.getElementById('featured-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.featured-card');
      if (!btn) return;
      goTo(btn.getAttribute('data-id'));
    });

    document.getElementById('article-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.article-card');
      if (!btn) return;
      goTo(btn.getAttribute('data-id'));
    });

    document.getElementById('contact-form').addEventListener('submit', function (e) {
      e.preventDefault();
      state.sent = true;
      renderContactSubmit();
    });

    window.addEventListener('hashchange', route);
  }

  function init(articles) {
    state.articles = articles;
    bindStaticEvents();
    route();
  }

  fetch('js/articles.json')
    .then(function (res) { return res.json(); })
    .then(init)
    .catch(function (err) {
      console.error('Failed to load articles.json', err);
    });
})();
