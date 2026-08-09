/* =========================================================
   PLATNÉŘSTVÍ PAVEL ZÁTRAPA — main.js
   Web je vykreslený staticky přímo v index.html (viz lib/render.js
   a scripts/build.js) — tenhle soubor jen "oživuje" existující DOM:
   scroll v hlavičce, mobilní menu, animace při scrollu, filtr galerie
   a lightbox. Nic se tu nefetchuje ani nepřekresluje z JSON, takže web
   funguje i bez JavaScriptu a obsah při načítání nebliká.
   ========================================================= */

(function () {
  'use strict';

  const state = { lightboxIndex: 0 };

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

  // Obecná funkce pro filtrovací tlačítka — každý filtr je naškálovaný jen
  // na svůj vlastní kontejner tlačítek a svou vlastní mřížku položek, ať si
  // galerie a katalog (mají obě třídu .filter-btn) vzájemně nepřekáží.
  function setupFilter(filtersId, gridId, itemSelector) {
    const filtersEl = document.getElementById(filtersId);
    const grid = document.getElementById(gridId);
    if (!filtersEl || !grid) return;
    const btns = filtersEl.querySelectorAll('.filter-btn');
    if (!btns.length) return;
    btns.forEach(btn => btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      btns.forEach(b => b.classList.toggle('is-active', b === btn));
      grid.querySelectorAll(itemSelector).forEach(item => {
        const show = filter === 'Vše' || item.dataset.category === filter;
        item.style.display = show ? '' : 'none';
      });
    }));
  }

  // Lightbox čte data přímo z data-* atributů existujících .masonry-item
  // prvků (title/material/year/category + <img src/alt>) — nic se
  // znovu nefetchuje.
  function setupLightbox() {
    const lb = document.getElementById('lightbox');
    const grid = document.getElementById('masonryGrid');
    if (!lb || !grid) return;
    const items = Array.from(grid.querySelectorAll('.masonry-item'));
    if (!items.length) return;

    const img = document.getElementById('lightboxImg');
    const tag = document.getElementById('lightboxTag');
    const title = document.getElementById('lightboxTitle');
    const material = document.getElementById('lightboxMaterial');
    const year = document.getElementById('lightboxYear');
    const category = document.getElementById('lightboxCategory');

    function open(index) {
      state.lightboxIndex = index;
      const el = items[index];
      const srcImg = el.querySelector('img');
      img.src = srcImg.src;
      img.alt = srcImg.alt;
      tag.textContent = 'Exponát č. ' + String(index + 1).padStart(3, '0');
      title.textContent = el.dataset.title || '';
      material.textContent = el.dataset.material || '—';
      year.textContent = el.dataset.year || '—';
      category.textContent = el.dataset.category || '';
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    function step(dir) {
      const next = (state.lightboxIndex + dir + items.length) % items.length;
      open(next);
    }

    items.forEach((item, idx) => {
      item.addEventListener('click', () => open(idx));
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

  function init() {
    setupHeaderScroll();
    setupMobileMenu();
    setupReveal();
    setupFilter('galleryFilters', 'masonryGrid', '.masonry-item');
    setupFilter('catalogFilters', 'catalogGrid', '.product-card');
    setupLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
