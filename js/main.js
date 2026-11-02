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

  // Filtr + stránkování "Zobrazit více" pro galerii i katalog. Filtr
  // skrývá položky přes style.display, stránkování přes třídu
  // .is-collapsed. Ukazuje se vždy PAGE_SIZE položek (2 řady po 3),
  // tlačítko přidá dalších PAGE_SIZE. Změna filtru stránkování vynuluje.
  const PAGE_SIZE = 6;
  function setupFilter(filtersId, gridId, itemSelector, moreId) {
    const filtersEl = document.getElementById(filtersId);
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const items = Array.from(grid.querySelectorAll(itemSelector));
    const moreBtn = moreId ? document.getElementById(moreId) : null;
    const moreWrap = moreBtn ? moreBtn.parentElement : null;
    let filter = 'Vše';
    let limit = PAGE_SIZE;

    function apply(revealNew) {
      let shown = 0;
      let matching = 0;
      items.forEach(item => {
        const match = filter === 'Vše' || item.dataset.category === filter;
        item.style.display = match ? '' : 'none';
        if (!match) return;
        matching++;
        const collapsed = matching > limit;
        const wasCollapsed = item.classList.contains('is-collapsed');
        item.classList.toggle('is-collapsed', collapsed);
        if (!collapsed) shown++;
        if (!collapsed && wasCollapsed && revealNew) {
          // nově odkryté položky plynule najedou s malým zpožděním za sebou
          item.classList.remove('is-visible');
          const delay = (shown - (limit - PAGE_SIZE) - 1) * 70;
          setTimeout(() => item.classList.add('is-visible'), 30 + Math.max(0, delay));
        }
      });
      if (moreWrap) moreWrap.hidden = matching <= limit;
    }

    if (filtersEl) {
      const btns = filtersEl.querySelectorAll('.filter-btn');
      btns.forEach(btn => btn.addEventListener('click', () => {
        filter = btn.dataset.filter;
        limit = PAGE_SIZE;
        btns.forEach(b => b.classList.toggle('is-active', b === btn));
        apply(false);
        // po přefiltrování ukaž položky hned, bez čekání na scroll
        items.forEach(it => { if (it.style.display !== 'none') it.classList.add('is-visible'); });
      }));
    }
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        limit += PAGE_SIZE;
        apply(true);
      });
    }
    apply(false);
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

    return {
      goTo,
      getIndex: () => Math.round(track.scrollLeft / slideWidth()),
      reset: () => { track.scrollLeft = 0; setActiveDot(0); }
    };
  }

  // Hero karusel: plynulý nekonečný posun přes transform. Na konec tracku
  // se přidá klon první fotky, takže z poslední fotky se jede dál doprava
  // a pak se bez animace skočí zpět na začátek (není vidět žádný "návrat").
  // Jde chytit a táhnout myší i prstem, tečky přepínají fotky. Vertikální
  // scroll stránky nad fotkou NEBLOKUJE (kolečko se nechytá).
  function setupHeroSlider() {
    const frame = document.getElementById('heroSlider');
    const track = document.getElementById('heroSliderTrack');
    if (!frame || !track || track.children.length < 2) return;
    const dotsEl = document.querySelector('.hero-slide-dots');
    const dots = dotsEl ? Array.from(dotsEl.children) : [];
    const count = track.children.length;
    track.appendChild(track.children[0].cloneNode(true));

    let index = 0;
    let timer = null;
    const INTERVAL = 4500;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setDots(i) { dots.forEach((d, n) => d.classList.toggle('is-active', n === i % count)); }
    function setPos(px, animate) {
      track.classList.toggle('no-anim', !animate);
      track.style.transform = 'translate3d(' + px + 'px,0,0)';
    }
    function width() { return frame.clientWidth || 1; }
    function goTo(i, animate) {
      index = i;
      setPos(-index * width(), animate !== false);
      setDots(index);
    }
    track.addEventListener('transitionend', (e) => {
      if (e.target !== track) return;
      if (index >= count) { goTo(0, false); }
    });

    function play() {
      stop();
      if (reduceMotion) return;
      timer = setInterval(() => goTo(index + 1), INTERVAL);
    }
    function stop() { clearInterval(timer); timer = null; }

    // táhnutí myší / prstem (pointer events)
    let dragging = false, startX = 0, startY = 0, dx = 0, decided = false, horizontal = false;
    frame.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (index >= count) goTo(0, false);
      dragging = true; decided = false; horizontal = false;
      startX = e.clientX; startY = e.clientY; dx = 0;
      stop();
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided && (Math.abs(mx) > 6 || Math.abs(my) > 6)) {
        decided = true;
        horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal) frame.classList.add('is-dragging');
      }
      if (!horizontal) return;
      dx = mx;
      setPos(-index * width() + dx, false);
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      frame.classList.remove('is-dragging');
      if (horizontal) {
        const threshold = width() * 0.18;
        let next = index;
        if (dx < -threshold) next = Math.min(count - 1, index + 1);
        else if (dx > threshold) next = Math.max(0, index - 1);
        goTo(next);
      }
      play();
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    frame.addEventListener('dragstart', (e) => e.preventDefault());

    if (dotsEl) {
      dotsEl.addEventListener('click', (e) => {
        const dot = e.target.closest('.hero-slide-dot');
        if (!dot) return;
        goTo(dots.indexOf(dot));
        play();
      });
    }
    window.addEventListener('resize', () => goTo(index % count, false));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else play();
    });
    goTo(0, false);
    play();
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
    setupFilter('galleryFilters', 'masonryGrid', '.masonry-item', 'galleryMore');
    setupFilter('catalogFilters', 'catalogGrid', '.product-card', 'catalogMore');
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
