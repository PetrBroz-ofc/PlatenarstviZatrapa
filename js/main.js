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

  function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

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

  // Sdílená logika "chytni a táhni myší" — používá ji Hero i vnitřní
  // posuvník fotek v lightboxu. Navázáno JEDNOU na trvalé prvky (frame/
  // track/dotsContainer) — i když se později obsah track/dots přepíše
  // (nové fotky pro jiný exponát), listenery zůstávají v pořádku, protože
  // jsou na kontejnerech, ne na jednotlivých snímcích/tečkách (tečky mají
  // delegovaný klik na dotsContainer).
  function createDragSlider(frame, track, dotsContainer) {
    function slideCount() { return track.children.length; }
    function slideWidth() { return track.clientWidth || 1; }
    function setActiveDot(index) {
      if (!dotsContainer) return;
      Array.from(dotsContainer.children).forEach((d, i) => d.classList.toggle('is-active', i === index));
    }
    function goTo(index, smooth) {
      const clamped = Math.max(0, Math.min(slideCount() - 1, index));
      track.scrollTo({ left: clamped * slideWidth(), behavior: smooth === false ? 'auto' : 'smooth' });
      setActiveDot(clamped);
    }

    let scrollTimer;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const index = Math.round(track.scrollLeft / slideWidth());
        setActiveDot(Math.max(0, Math.min(slideCount() - 1, index)));
      }, 80);
    }, { passive: true });

    let isDown = false, startX = 0, startScroll = 0, moved = false;
    track.addEventListener('mousedown', (e) => {
      if (slideCount() < 2) return;
      isDown = true;
      moved = false;
      frame.classList.add('is-dragging');
      startX = e.pageX;
      startScroll = track.scrollLeft;
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startScroll - dx;
    });
    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      frame.classList.remove('is-dragging');
      goTo(Math.round(track.scrollLeft / slideWidth()));
    });
    track.addEventListener('click', (e) => { if (moved) e.preventDefault(); });
    track.addEventListener('wheel', (e) => {
      if (slideCount() < 2) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    if (dotsContainer) {
      dotsContainer.addEventListener('click', (e) => {
        const dot = e.target.closest('.hero-slide-dot');
        if (!dot) return;
        goTo(Array.from(dotsContainer.children).indexOf(dot));
      });
    }

    return { goTo, reset: () => { track.scrollLeft = 0; setActiveDot(0); } };
  }

  function setupHeroSlider() {
    const frame = document.getElementById('heroSlider');
    const track = document.getElementById('heroSliderTrack');
    if (!frame || !track || track.children.length < 2) return;
    createDragSlider(frame, track, document.querySelector('.hero-slide-dots'));
  }

  // Lightbox čte data přímo z data-* atributů existujících .masonry-item
  // prvků (title/material/year/category/description + JSON pole images) —
  // nic se znovu nefetchuje. Vnitřní posuvník fotek dané položky jde
  // chytit a táhnout myší stejně jako Hero.
  function setupLightbox() {
    const lb = document.getElementById('lightbox');
    const grid = document.getElementById('masonryGrid');
    if (!lb || !grid) return;
    const items = Array.from(grid.querySelectorAll('.masonry-item'));
    if (!items.length) return;

    const frame = document.getElementById('lightboxSlider');
    const track = document.getElementById('lightboxSliderTrack');
    const dotsContainer = document.getElementById('lightboxSlideDots');
    const tag = document.getElementById('lightboxTag');
    const title = document.getElementById('lightboxTitle');
    const description = document.getElementById('lightboxDescription');
    const material = document.getElementById('lightboxMaterial');
    const year = document.getElementById('lightboxYear');
    const category = document.getElementById('lightboxCategory');
    const slider = createDragSlider(frame, track, dotsContainer);

    function open(index) {
      state.lightboxIndex = index;
      const el = items[index];
      let images = [];
      try { images = JSON.parse(el.dataset.images || '[]'); } catch (e) { images = []; }
      if (!images.length) {
        const srcImg = el.querySelector('img');
        if (srcImg) images = [{ image: srcImg.getAttribute('src'), alt: srcImg.getAttribute('alt') }];
      }
      track.innerHTML = images.map(im =>
        `<div class="hero-slide"><img src="${escHtml(im.image)}" alt="${escHtml(im.alt)}" draggable="false"></div>`
      ).join('');
      dotsContainer.innerHTML = images.length > 1
        ? images.map((_, i) => `<button type="button" class="hero-slide-dot ${i === 0 ? 'is-active' : ''}" aria-label="Fotografie ${i + 1}"></button>`).join('')
        : '';
      frame.classList.toggle('is-draggable', images.length > 1);
      slider.reset();

      tag.textContent = 'Exponát č. ' + String(index + 1).padStart(3, '0');
      title.textContent = el.dataset.title || '';
      description.textContent = el.dataset.description || '';
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

  const COOKIE_CONSENT_KEY = 'pzCookieConsentSeen';
  function setupCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;
    let alreadySeen = false;
    try { alreadySeen = localStorage.getItem(COOKIE_CONSENT_KEY) === '1'; } catch (e) { /* soukromý režim apod. */ }
    if (alreadySeen) return;
    banner.hidden = false;
    setTimeout(() => banner.classList.add('is-visible'), 20);
    const dismiss = () => {
      banner.classList.remove('is-visible');
      try { localStorage.setItem(COOKIE_CONSENT_KEY, '1'); } catch (e) { /* ignore */ }
      setTimeout(() => { banner.hidden = true; }, 500);
    };
    const btn = document.getElementById('cookieBannerBtn');
    if (btn) btn.addEventListener('click', dismiss);
  }

  function init() {
    setupHeaderScroll();
    setupMobileMenu();
    setupReveal();
    setupFilter('galleryFilters', 'masonryGrid', '.masonry-item');
    setupFilter('catalogFilters', 'catalogGrid', '.product-card');
    setupLightbox();
    setupCookieBanner();
    setupHeroSlider();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
