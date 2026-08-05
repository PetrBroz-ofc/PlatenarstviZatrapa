/* =========================================================
   PLATNÉŘSTVÍ PAVEL ZÁTRAPA — main.js
   Vykresluje celý web z /data/content.json a /data/theme.json.
   Žádný framework, žádný build krok.
   ========================================================= */

(function () {
  'use strict';

  const ICONS = {
    helmet: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 30c0-11 6-19 14-19s14 8 14 19" /><path d="M8 30h32v3a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3v-3z"/><path d="M24 11V6" /><path d="M20 6h8"/><path d="M24 24v10"/></svg>',
    armor: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 6 12 11v8c0 11 5 18 12 23 7-5 12-12 12-23v-8L24 6z"/><path d="M24 6v36"/><path d="M16 18h16"/></svg>',
    shield: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 5 40 11v11c0 12-7 18-16 21-9-3-16-9-16-21V11L24 5z"/><path d="M24 14v20"/><path d="M15 24h18"/></svg>',
    sword: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 4v28"/><path d="M14 14h20"/><path d="M20 32h8v4l-4 6-4-6v-4z"/></svg>',
    film: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 16h36v22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V16z"/><path d="M6 16l4-10h6l-4 10"/><path d="M20 16l4-10h6l-4 10"/><path d="M34 16l4-10h.5a1.5 1.5 0 0 1 1.5 1.5V16"/></svg>',
    dragon: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 30c4-10 12-18 22-18 6 0 10 3 12 6-4-1-8 0-10 3 5 0 9 2 11 6-6-2-11-1-14 3-4 5-11 6-17 3"/><circle cx="30" cy="17" r="1.4" fill="currentColor" stroke="none"/><path d="M14 30c-2 4-4 6-8 7"/></svg>'
  };

  const state = { content: null, theme: null, activeFilter: 'Vše', lightboxIndex: 0 };

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Nelze načíst ' + path);
    return res.json();
  }

  function applyTheme(theme) {
    if (!theme || !theme.colors) return;
    const root = document.documentElement.style;
    const map = {
      background: '--color-bg', surface: '--color-surface', surfaceAlt: '--color-surface-alt',
      accent: '--color-accent', accentDim: '--color-accent-dim', text: '--color-text',
      textSecondary: '--color-text-secondary', border: '--color-border',
      success: '--color-success', danger: '--color-danger'
    };
    Object.entries(map).forEach(([key, cssVar]) => {
      if (theme.colors[key]) root.setProperty(cssVar, theme.colors[key]);
    });
    if (theme.fonts) {
      if (theme.fonts.display) root.setProperty('--font-display', theme.fonts.display);
      if (theme.fonts.body) root.setProperty('--font-body', theme.fonts.body);
      if (theme.fonts.utility) root.setProperty('--font-utility', theme.fonts.utility);
    }
  }

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  /* ---------------- Section renderers ---------------- */

  function renderHeader(c) {
    const links = c.nav.links.map(l => `<a href="#${l.target}">${esc(l.label)}</a>`).join('');
    const mobileLinks = c.nav.links.map(l => `<a href="#${l.target}" data-close-menu>${esc(l.label)}</a>`).join('');
    return `
    <header class="site-header" id="siteHeader">
      <div class="container">
        <a href="#" class="logo">
          <span class="logo-main">${esc(c.nav.logoText)}</span>
          <span class="logo-sub">${esc(c.nav.logoSub)}</span>
        </a>
        <nav class="nav-links" aria-label="Hlavní navigace">${links}</nav>
        <div class="nav-right">
          <a class="nav-cta" href="#${c.nav.cta.target}">${esc(c.nav.cta.label)}</a>
          <button class="nav-toggle" id="navToggle" aria-label="Otevřít menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
    <div class="mobile-menu" id="mobileMenu">${mobileLinks}</div>`;
  }

  function renderHero(h) {
    const buttons = h.buttons.map(b =>
      `<a class="btn btn-${b.style === 'primary' ? 'primary' : 'ghost'}" href="#${b.target}">${esc(b.label)}</a>`
    ).join('');
    return `
    <section class="hero" id="hero">
      <div class="hero-media" id="heroMedia">
        <img src="${esc(h.backgroundImage)}" alt="${esc(h.backgroundImageAlt)}" loading="eager">
      </div>
      <div class="container hero-content">
        <p class="hero-eyebrow">${esc(h.eyebrow)}</p>
        <h1 class="hero-title"><span>${esc(h.titleLine1)}</span><span class="is-accent">${esc(h.titleLine2)}</span></h1>
        <p class="hero-subtitle">${esc(h.subtitle)}</p>
        <p class="hero-description">${esc(h.description)}</p>
        <div class="hero-actions">${buttons}</div>
      </div>
      <div class="hero-scroll-cue"><span class="line"></span>Scroll</div>
    </section>`;
  }

  function renderAbout(a) {
    const paras = a.paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
    const stats = a.stats.map(s => `
      <div class="reveal">
        <div class="stat-value">${esc(s.value)}</div>
        <div class="stat-label">${esc(s.label)}</div>
      </div>`).join('');
    return `
    <section class="about section-pad" id="o-mne">
      <div class="container about-grid">
        <div class="about-portrait reveal">
          <img src="${esc(a.portraitImage)}" alt="${esc(a.portraitImageAlt)}" loading="lazy">
        </div>
        <div class="about-text">
          <p class="eyebrow reveal">${esc(a.eyebrow)}</p>
          <h2 class="section-title reveal">${esc(a.title)}</h2>
          <div class="reveal">${paras}</div>
          <div class="about-stats">${stats}</div>
        </div>
      </div>
    </section>`;
  }

  function renderServices(s) {
    const cards = s.items.map(it => `
      <div class="service-card reveal">
        <div class="service-icon">${ICONS[it.icon] || ''}</div>
        <h3 class="service-title">${esc(it.title)}</h3>
        <p class="service-desc">${esc(it.description)}</p>
      </div>`).join('');
    return `
    <section class="services section-pad" id="sluzby">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow reveal">${esc(s.eyebrow)}</p>
          <h2 class="section-title reveal">${esc(s.title)}</h2>
        </div>
      </div>
      <div class="container">
        <div class="services-grid">${cards}</div>
      </div>
    </section>`;
  }

  function renderGallery(g) {
    const filters = g.categories.map(cat =>
      `<button class="filter-btn ${cat === state.activeFilter ? 'is-active' : ''}" data-filter="${esc(cat)}">${esc(cat)}</button>`
    ).join('');
    const items = g.items.map((it, idx) => `
      <figure class="masonry-item reveal" data-category="${esc(it.category)}" data-index="${idx}">
        <img src="${esc(it.image)}" alt="${esc(it.imageAlt)}" loading="lazy">
        <figcaption class="masonry-caption">
          <div class="cat">${esc(it.category)}</div>
          <div class="name">${esc(it.title)}</div>
        </figcaption>
      </figure>`).join('');
    return `
    <section class="gallery section-pad" id="galerie">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow reveal">${esc(g.eyebrow)}</p>
          <h2 class="section-title reveal">${esc(g.title)}</h2>
          <p class="lede reveal">${esc(g.description)}</p>
        </div>
        <div class="gallery-filters reveal">${filters}</div>
        <div class="masonry" id="masonryGrid">${items}</div>
      </div>
    </section>
    <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Detail exponátu">
      <button class="lightbox-close" id="lightboxClose" aria-label="Zavřít">✕</button>
      <button class="lightbox-nav lightbox-prev" id="lightboxPrev" aria-label="Předchozí">‹</button>
      <button class="lightbox-nav lightbox-next" id="lightboxNext" aria-label="Další">›</button>
      <div class="lightbox-inner">
        <div class="lightbox-image"><img id="lightboxImg" src="" alt=""></div>
        <div class="lightbox-plate">
          <div class="plate-tag" id="lightboxTag">Exponát</div>
          <h3 id="lightboxTitle"></h3>
          <div class="plate-row"><span>Materiál</span><span id="lightboxMaterial"></span></div>
          <div class="plate-row"><span>Rok</span><span id="lightboxYear"></span></div>
          <div class="plate-row"><span>Kategorie</span><span id="lightboxCategory"></span></div>
        </div>
      </div>
    </div>`;
  }

  function renderCatalog(k) {
    const cards = k.products.map(p => {
      const isStock = p.status === 'Skladem';
      return `
      <div class="product-card reveal">
        <div class="product-image">
          <span class="status-badge ${isStock ? 'in-stock' : 'on-order'}">${esc(p.status)}</span>
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
        </div>
        <div class="product-body">
          <h3 class="product-name">${esc(p.name)}</h3>
          <p class="product-desc">${esc(p.description)}</p>
          <div class="product-footer">
            <span class="product-price">${esc(p.price)}</span>
          </div>
        </div>
      </div>`;
    }).join('');
    return `
    <section class="catalog section-pad" id="katalog">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow reveal">${esc(k.eyebrow)}</p>
          <h2 class="section-title reveal">${esc(k.title)}</h2>
          <p class="lede reveal">${esc(k.description)}</p>
        </div>
        <div class="catalog-grid">${cards}</div>
      </div>
    </section>`;
  }

  function renderNews(n) {
    const items = n.items.map(it => `
      <div class="timeline-item reveal">
        <div class="timeline-date">${esc(it.date)}</div>
        <div class="timeline-content">
          <h3>${esc(it.title)}</h3>
          <p>${esc(it.description)}</p>
        </div>
      </div>`).join('');
    return `
    <section class="news section-pad" id="novinky">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow reveal">${esc(n.eyebrow)}</p>
          <h2 class="section-title reveal">${esc(n.title)}</h2>
        </div>
        <div class="timeline">${items}</div>
      </div>
    </section>`;
  }

  function renderContact(k) {
    return `
    <section class="contact section-pad" id="kontakt">
      <div class="container contact-grid">
        <div>
          <p class="eyebrow reveal">${esc(k.eyebrow)}</p>
          <h2 class="contact-title reveal">${esc(k.title)}</h2>
          <p class="contact-desc reveal">${esc(k.description)}</p>
          <div class="contact-cta reveal">
            <a class="btn btn-primary" href="mailto:${esc(k.cta.email)}">${esc(k.cta.label)}</a>
          </div>
        </div>
        <div class="contact-card reveal">
          <div class="contact-row"><span>Jméno</span><span>${esc(k.name)}</span></div>
          <div class="contact-row"><span>Sídlo</span><span>${esc(k.city)}</span></div>
          <div class="contact-row"><span>IČO</span><span>${esc(k.ico)}</span></div>
          <div class="contact-row"><span>DPH</span><span>${esc(k.vatNote)}</span></div>
          <div class="contact-row"><span>E‑mail</span><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></div>
        </div>
      </div>
    </section>`;
  }

  function renderFooter(f) {
    return `
    <footer class="site-footer">
      <div class="container footer-grid">
        <span class="footer-mark">Platnéřství Pavel Zátrapa</span>
        <span>${esc(f.copyright)}</span>
      </div>
    </footer>`;
  }

  /* ---------------- Interakce ---------------- */

  function setupHeaderScroll() {
    const header = document.getElementById('siteHeader');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function setupMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('mobileMenu');
    if (!toggle || !menu) return;
    const close = () => { toggle.classList.remove('is-open'); menu.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => {
      const open = toggle.classList.toggle('is-open');
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('[data-close-menu]').forEach(a => a.addEventListener('click', close));
  }

  function setupHeroParallax() {
    const media = document.getElementById('heroMedia');
    if (!media || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const img = media.querySelector('img');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 800);
        img.style.transform = `scale(1.08) translateY(${y * 0.06}px)`;
        ticking = false;
      });
    }, { passive: true });
  }

  function setupReveal() {
    const els = document.querySelectorAll('.reveal, .masonry-item, .timeline-item');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    els.forEach(el => io.observe(el));
  }

  function setupGalleryFilter(galleryItems) {
    const grid = document.getElementById('masonryGrid');
    const btns = document.querySelectorAll('.filter-btn');
    if (!grid) return;
    btns.forEach(btn => btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      state.activeFilter = filter;
      btns.forEach(b => b.classList.toggle('is-active', b === btn));
      grid.querySelectorAll('.masonry-item').forEach(item => {
        const show = filter === 'Vše' || item.dataset.category === filter;
        item.style.display = show ? '' : 'none';
      });
    }));
  }

  function setupLightbox(galleryItems) {
    const lb = document.getElementById('lightbox');
    const grid = document.getElementById('masonryGrid');
    if (!lb || !grid) return;
    const img = document.getElementById('lightboxImg');
    const tag = document.getElementById('lightboxTag');
    const title = document.getElementById('lightboxTitle');
    const material = document.getElementById('lightboxMaterial');
    const year = document.getElementById('lightboxYear');
    const category = document.getElementById('lightboxCategory');

    function open(index) {
      state.lightboxIndex = index;
      const it = galleryItems[index];
      img.src = it.image;
      img.alt = it.imageAlt;
      tag.textContent = 'Exponát č. ' + String(index + 1).padStart(3, '0');
      title.textContent = it.title;
      material.textContent = it.material || '—';
      year.textContent = it.year || '—';
      category.textContent = it.category;
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    function step(dir) {
      const next = (state.lightboxIndex + dir + galleryItems.length) % galleryItems.length;
      open(next);
    }

    grid.querySelectorAll('.masonry-item').forEach(item => {
      item.addEventListener('click', () => open(Number(item.dataset.index)));
    });
    document.getElementById('lightboxClose').addEventListener('click', close);
    document.getElementById('lightboxPrev').addEventListener('click', () => step(-1));
    document.getElementById('lightboxNext').addEventListener('click', () => step(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ---------------- Náhled z administrace ---------------- */

  function isPreviewMode() {
    return new URLSearchParams(window.location.search).get('preview') === '1';
  }

  function readDraft() {
    try {
      const c = sessionStorage.getItem('zatrapaDraftContent');
      const t = sessionStorage.getItem('zatrapaDraftTheme');
      if (!c || !t) return null;
      return { content: JSON.parse(c), theme: JSON.parse(t) };
    } catch (e) {
      return null;
    }
  }

  function renderAll(content, theme) {
    const root = document.getElementById('site-root');
    state.content = content;
    state.theme = theme;
    applyTheme(theme);

    const scrollPos = window.scrollY;

    root.innerHTML = [
      renderHeader(content),
      '<main id="main">',
      renderHero(content.hero),
      renderAbout(content.about),
      renderServices(content.services),
      renderGallery(content.gallery),
      renderCatalog(content.catalog),
      renderNews(content.news),
      renderContact(content.contact),
      '</main>',
      renderFooter(content.footer)
    ].join('');

    document.title = content.seo.title;

    setupHeaderScroll();
    setupMobileMenu();
    setupHeroParallax();
    setupReveal();
    setupGalleryFilter(content.gallery.items);
    setupLightbox(content.gallery.items);

    if (isPreviewMode()) window.scrollTo(0, scrollPos);
  }

  function setupPreviewListener() {
    window.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'zatrapa-preview-update') return;
      renderAll(e.data.content, e.data.theme);
    });
  }

  /* ---------------- Init ---------------- */

  async function init() {
    const root = document.getElementById('site-root');
    try {
      let content, theme;
      const draft = isPreviewMode() ? readDraft() : null;
      if (draft) {
        content = draft.content;
        theme = draft.theme;
        setupPreviewListener();
      } else {
        [content, theme] = await Promise.all([
          fetchJSON('data/content.json'),
          fetchJSON('data/theme.json')
        ]);
        if (isPreviewMode()) setupPreviewListener();
      }
      renderAll(content, theme);
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div style="padding:80px 24px;max-width:600px;margin:0 auto;font-family:Georgia,serif;">
        <h1 style="font-family:inherit;">Obsah se nepodařilo načíst</h1>
        <p>Zkontrolujte prosím, že je web spuštěný přes server (ne přímo jako soubor) a že existují soubory data/content.json a data/theme.json.</p>
      </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
