/* =========================================================
   PLATNÉŘSTVÍ PAVEL ZÁTRAPA — admin.js
   Editace obsahu, živý náhled přes iframe, ukládání přes GitHub API (api/save-content.js)
   ========================================================= */

(function () {
  'use strict';

  const state = {
    content: null,
    theme: null,
    originalContent: null,
    originalTheme: null,
    activeTab: 'hero',
    password: null,
    previewReady: false
  };

  const ICON_OPTIONS = [
    { value: 'helmet', label: 'Přilba' },
    { value: 'armor', label: 'Zbroj' },
    { value: 'shield', label: 'Štít' },
    { value: 'sword', label: 'Meč' },
    { value: 'film', label: 'Film' },
    { value: 'dragon', label: 'Fantasy' }
  ];

  const TABS = [
    { id: 'hero', label: 'Hero' },
    { id: 'about', label: 'O mně' },
    { id: 'services', label: 'Služby' },
    { id: 'gallery', label: 'Galerie' },
    { id: 'catalog', label: 'Katalog' },
    { id: 'news', label: 'Novinky' },
    { id: 'contact', label: 'Kontakt' },
    { id: 'seo', label: 'SEO' },
    { id: 'theme', label: 'Vzhled' },
    { id: 'json', label: 'JSON (pokročilé)' }
  ];

  /* ---------------- Pomocné funkce ---------------- */

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function getPath(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
    cur[keys[keys.length - 1]] = value;
  }
  function resolveRoot(fullPath) {
    const isTheme = fullPath.startsWith('theme.');
    const root = isTheme ? state.theme : state.content;
    const subPath = fullPath.replace(/^(content|theme)\./, '');
    return { root, subPath };
  }

  const ARRAY_TEMPLATES = {
    'services.items': () => ({ icon: 'helmet', title: 'Nová služba', description: 'Popis služby.' }),
    'gallery.items': () => ({
      id: 'g' + Date.now(), category: state.content.gallery.categories[1] || 'Přilby',
      title: 'Nový exponát', material: '', year: '', image: 'https://picsum.photos/seed/' + Date.now() + '/900/1100', imageAlt: ''
    }),
    'catalog.products': () => ({
      id: 'p' + Date.now(), name: 'Nový produkt', description: '', price: '0 Kč',
      status: 'Na objednávku', image: 'https://picsum.photos/seed/' + Date.now() + '/800/800'
    }),
    'news.items': () => ({ date: '2026', title: 'Nová událost', description: '' }),
    'hero.buttons': () => ({ label: 'Tlačítko', target: 'kontakt', style: 'ghost' }),
    'nav.links': () => ({ label: 'Odkaz', target: 'kontakt' }),
    'about.stats': () => ({ value: '0', label: 'popisek' }),
    'about.paragraphs': () => '',
    'gallery.categories': () => 'Nová kategorie'
  };

  function removeArrayItem(fullPath) {
    const { root, subPath } = resolveRoot(fullPath);
    const keys = subPath.split('.');
    const idx = Number(keys.pop());
    const arr = getPath(root, keys.join('.'));
    if (Array.isArray(arr)) arr.splice(idx, 1);
  }
  function addArrayItem(fullPath) {
    const { root, subPath } = resolveRoot(fullPath);
    const arr = getPath(root, subPath);
    if (!Array.isArray(arr)) return;
    const factory = ARRAY_TEMPLATES[subPath];
    arr.push(factory ? factory() : {});
  }

  /* ---------------- Generování polí formuláře ---------------- */

  function fieldHTML(label, path, value, type, opts) {
    opts = opts || {};
    const id = 'f-' + path.replace(/\./g, '-') + (opts.suffix || '');
    if (type === 'textarea') {
      return `<div class="field-group"><label for="${id}">${esc(label)}</label><textarea id="${id}" data-bind="${path}">${esc(value)}</textarea></div>`;
    }
    if (type === 'select') {
      const options = (opts.options || []).map(o =>
        `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`
      ).join('');
      return `<div class="field-group"><label for="${id}">${esc(label)}</label><select id="${id}" data-bind="${path}">${options}</select></div>`;
    }
    if (type === 'color') {
      const safe = /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#000000';
      return `<div class="field-group"><label>${esc(label)}</label><div class="color-field">
        <input type="color" data-bind="${path}" value="${safe}">
        <input type="text" data-bind="${path}" value="${esc(value)}">
      </div></div>`;
    }
    if (type === 'image') {
      return `<div class="field-group"><label for="${id}">${esc(label)}</label>
        <input type="url" id="${id}" data-bind="${path}" data-preview="${id}-thumb" value="${esc(value)}" placeholder="https://…">
        <img class="thumb-preview" id="${id}-thumb" src="${esc(value)}" alt="" onerror="this.style.opacity=0.2">
      </div>`;
    }
    return `<div class="field-group"><label for="${id}">${esc(label)}</label><input type="text" id="${id}" data-bind="${path}" value="${esc(value)}"></div>`;
  }

  function renderArrayEditor(basePath, items, fields, itemLabelFn) {
    let html = '';
    items.forEach((item, idx) => {
      html += `<div class="repeat-card">
        <div class="repeat-card-head">
          <span class="idx">${esc(itemLabelFn ? itemLabelFn(item, idx) : '#' + (idx + 1))}</span>
          <button type="button" class="btn-admin small danger" data-remove="${basePath}.${idx}">Odebrat</button>
        </div>`;
      fields.forEach(f => {
        const path = `${basePath}.${idx}.${f.key}`;
        const val = item[f.key] == null ? '' : item[f.key];
        html += fieldHTML(f.label, path, val, f.type, f.opts);
      });
      html += `</div>`;
    });
    html += `<div class="add-btn-row"><button type="button" class="btn-admin" data-add="${basePath}">+ Přidat</button></div>`;
    return html;
  }

  function renderStringArrayEditor(basePath, items, itemLabel) {
    let html = '';
    items.forEach((val, idx) => {
      html += `<div class="repeat-card">
        <div class="repeat-card-head"><span class="idx">${esc(itemLabel)} ${idx + 1}</span>
        <button type="button" class="btn-admin small danger" data-remove="${basePath}.${idx}">Odebrat</button></div>
        <div class="field-group"><textarea data-bind="${basePath}.${idx}">${esc(val)}</textarea></div>
      </div>`;
    });
    html += `<div class="add-btn-row"><button type="button" class="btn-admin" data-add="${basePath}">+ Přidat</button></div>`;
    return html;
  }

  /* ---------------- Jednotlivé taby ---------------- */

  function tabHero() {
    const h = state.content.hero;
    return `<h2>Hero</h2><p class="editor-hint">Úvodní sekce webu — text vlevo, fotografie (např. meč) vpravo s kulatým štítkem.</p>
      ${fieldHTML('Eyebrow (text nad titulkem)', 'content.hero.eyebrow', h.eyebrow)}
      <div class="field-row">
        ${fieldHTML('Titulek — řádek 1', 'content.hero.titleLine1', h.titleLine1)}
        ${fieldHTML('Titulek — řádek 2', 'content.hero.titleLine2', h.titleLine2)}
      </div>
      ${fieldHTML('Podtitulek', 'content.hero.subtitle', h.subtitle)}
      ${fieldHTML('Popisek pod podtitulkem', 'content.hero.description', h.description, 'textarea')}
      ${fieldHTML('Fotografie vpravo (URL)', 'content.hero.image', h.image, 'image')}
      ${fieldHTML('Alt text fotografie', 'content.hero.imageAlt', h.imageAlt)}
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Kulatý štítek na fotografii</h3>
      <div class="field-row">
        ${fieldHTML('Horní řádek (např. Od)', 'content.hero.badgeTop', h.badgeTop)}
        ${fieldHTML('Rok (např. 1990)', 'content.hero.badgeYear', h.badgeYear)}
      </div>
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Tlačítka</h3>
      ${renderArrayEditor('content.hero.buttons', h.buttons, [
        { key: 'label', label: 'Text tlačítka' },
        { key: 'target', label: 'Cíl (ID sekce, např. galerie)' },
        { key: 'style', label: 'Styl', type: 'select', opts: { options: [{ value: 'primary', label: 'Primární (plné)' }, { value: 'ghost', label: 'Obrysové' }] } }
      ], (b) => b.label)}`;
  }

  function tabAbout() {
    const a = state.content.about;
    return `<h2>O mně</h2><p class="editor-hint">Krátký osobní úvod a klíčová čísla dílny.</p>
      ${fieldHTML('Eyebrow', 'content.about.eyebrow', a.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.about.title', a.title)}
      ${fieldHTML('Portrétní fotografie (URL)', 'content.about.portraitImage', a.portraitImage, 'image')}
      ${fieldHTML('Alt text portrétu', 'content.about.portraitImageAlt', a.portraitImageAlt)}
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Odstavce textu</h3>
      ${renderStringArrayEditor('content.about.paragraphs', a.paragraphs, 'Odstavec')}
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Statistiky</h3>
      ${renderArrayEditor('content.about.stats', a.stats, [
        { key: 'value', label: 'Hodnota (např. 35+)' },
        { key: 'label', label: 'Popisek (např. let zkušeností)' }
      ], (s) => s.value + ' — ' + s.label)}`;
  }

  function tabServices() {
    const s = state.content.services;
    return `<h2>Služby</h2><p class="editor-hint">Karty se šesti oblastmi řemesla.</p>
      ${fieldHTML('Eyebrow', 'content.services.eyebrow', s.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.services.title', s.title)}
      ${renderArrayEditor('content.services.items', s.items, [
        { key: 'icon', label: 'Ikona', type: 'select', opts: { options: ICON_OPTIONS } },
        { key: 'title', label: 'Název služby' },
        { key: 'description', label: 'Popis', type: 'textarea' }
      ], (it) => it.title)}`;
  }

  function tabGallery() {
    const g = state.content.gallery;
    const catOptions = g.categories.filter(c => c !== 'Vše').map(c => ({ value: c, label: c }));
    return `<h2>Galerie</h2><p class="editor-hint">Nejdůležitější část webu — realizované zakázky.</p>
      ${fieldHTML('Eyebrow', 'content.gallery.eyebrow', g.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.gallery.title', g.title)}
      ${fieldHTML('Popisek sekce', 'content.gallery.description', g.description, 'textarea')}
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Kategorie (filtr)</h3>
      <p class="editor-hint">První položka "Vše" by měla zůstat zachována.</p>
      ${renderStringArrayEditor('content.gallery.categories', g.categories, 'Kategorie')}
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Exponáty</h3>
      ${renderArrayEditor('content.gallery.items', g.items, [
        { key: 'category', label: 'Kategorie', type: 'select', opts: { options: catOptions } },
        { key: 'title', label: 'Název' },
        { key: 'material', label: 'Materiál' },
        { key: 'year', label: 'Rok' },
        { key: 'image', label: 'Fotografie (URL)', type: 'image' },
        { key: 'imageAlt', label: 'Alt text fotografie' }
      ], (it) => it.title)}`;
  }

  function tabCatalog() {
    const k = state.content.catalog;
    return `<h2>Katalog</h2><p class="editor-hint">Přehled produktů s cenou a dostupností.</p>
      ${fieldHTML('Eyebrow', 'content.catalog.eyebrow', k.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.catalog.title', k.title)}
      ${fieldHTML('Popisek sekce', 'content.catalog.description', k.description, 'textarea')}
      ${renderArrayEditor('content.catalog.products', k.products, [
        { key: 'name', label: 'Název produktu' },
        { key: 'description', label: 'Krátký popis', type: 'textarea' },
        { key: 'price', label: 'Cena (např. 8 900 Kč)' },
        { key: 'status', label: 'Dostupnost', type: 'select', opts: { options: [{ value: 'Skladem', label: 'Skladem' }, { value: 'Na objednávku', label: 'Na objednávku' }] } },
        { key: 'image', label: 'Fotografie (URL)', type: 'image' }
      ], (p) => p.name + ' — ' + p.price)}`;
  }

  function tabNews() {
    const n = state.content.news;
    return `<h2>Novinky</h2><p class="editor-hint">Časová osa dílenského deníku.</p>
      ${fieldHTML('Eyebrow', 'content.news.eyebrow', n.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.news.title', n.title)}
      ${renderArrayEditor('content.news.items', n.items, [
        { key: 'date', label: 'Datum / rok' },
        { key: 'title', label: 'Titulek události' },
        { key: 'description', label: 'Popis', type: 'textarea' }
      ], (it) => it.date + ' — ' + it.title)}`;
  }

  function tabContact() {
    const k = state.content.contact;
    return `<h2>Kontakt</h2><p class="editor-hint">Fakturační a kontaktní údaje.</p>
      ${fieldHTML('Eyebrow', 'content.contact.eyebrow', k.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.contact.title', k.title)}
      ${fieldHTML('Popisek', 'content.contact.description', k.description, 'textarea')}
      <div class="field-row">
        ${fieldHTML('Jméno', 'content.contact.name', k.name)}
        ${fieldHTML('Sídlo / město', 'content.contact.city', k.city)}
      </div>
      <div class="field-row">
        ${fieldHTML('IČO', 'content.contact.ico', k.ico)}
        ${fieldHTML('Poznámka k DPH', 'content.contact.vatNote', k.vatNote)}
      </div>
      ${fieldHTML('E‑mail', 'content.contact.email', k.email)}
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Tlačítko poptávky</h3>
      ${fieldHTML('Text tlačítka', 'content.contact.cta.label', k.cta.label)}
      ${fieldHTML('E‑mail pro tlačítko', 'content.contact.cta.email', k.cta.email)}`;
  }

  function tabSeo() {
    const s = state.content.seo;
    return `<h2>SEO</h2><p class="editor-hint">Změny se promítnou do náhledu ihned. Pro plnou SEO účinnost (Open Graph pro sociální sítě) doporučujeme stejné texty doplnit i do &lt;head&gt; v index.html před nasazením.</p>
      ${fieldHTML('Title (titulek stránky)', 'content.seo.title', s.title)}
      ${fieldHTML('Meta description', 'content.seo.description', s.description, 'textarea')}
      ${fieldHTML('Klíčová slova', 'content.seo.keywords', s.keywords)}
      ${fieldHTML('OG obrázek (URL)', 'content.seo.ogImage', s.ogImage, 'image')}
      ${fieldHTML('Kanonická URL', 'content.seo.canonicalUrl', s.canonicalUrl)}`;
  }

  function tabTheme() {
    const t = state.theme;
    const c = t.colors;
    return `<h2>Vzhled</h2><p class="editor-hint">Barevná paleta webu. Změny se v náhledu projeví okamžitě.</p>
      <div class="field-row thirds">
        ${fieldHTML('Pozadí', 'theme.colors.background', c.background, 'color')}
        ${fieldHTML('Sekce', 'theme.colors.surface', c.surface, 'color')}
        ${fieldHTML('Sekce (alt)', 'theme.colors.surfaceAlt', c.surfaceAlt, 'color')}
      </div>
      <div class="field-row thirds">
        ${fieldHTML('Akcent', 'theme.colors.accent', c.accent, 'color')}
        ${fieldHTML('Akcent (tmavší)', 'theme.colors.accentDim', c.accentDim, 'color')}
        ${fieldHTML('Okraje', 'theme.colors.border', c.border, 'color')}
      </div>
      <div class="field-row thirds">
        ${fieldHTML('Text', 'theme.colors.text', c.text, 'color')}
        ${fieldHTML('Text sekundární', 'theme.colors.textSecondary', c.textSecondary, 'color')}
        ${fieldHTML('Stav — skladem', 'theme.colors.success', c.success, 'color')}
      </div>
      <h3 style="margin-top:26px;font-family:var(--font-display);font-size:17px;">Písma (pokročilé)</h3>
      ${fieldHTML('Nadpisové písmo (CSS font-family)', 'theme.fonts.display', t.fonts.display)}
      ${fieldHTML('Textové písmo (CSS font-family)', 'theme.fonts.body', t.fonts.body)}
      ${fieldHTML('Utility písmo (CSS font-family)', 'theme.fonts.utility', t.fonts.utility)}`;
  }

  function tabJson() {
    return `<h2>JSON (pokročilé)</h2>
      <p class="editor-hint">Přímá editace celého souboru. Použijte tlačítko "Použít JSON" po úpravě — ostatní taby se poté přepočítají z tohoto obsahu. Neplatný JSON se neuloží.</p>
      <h3 style="font-family:var(--font-display);font-size:17px;">data/content.json</h3>
      <div class="json-editor"><textarea id="jsonContent">${esc(JSON.stringify(state.content, null, 2))}</textarea></div>
      <div class="add-btn-row"><button type="button" class="btn-admin primary" id="applyJsonContent">Použít JSON obsahu</button></div>
      <h3 style="margin-top:30px;font-family:var(--font-display);font-size:17px;">data/theme.json</h3>
      <div class="json-editor"><textarea id="jsonTheme">${esc(JSON.stringify(state.theme, null, 2))}</textarea></div>
      <div class="add-btn-row"><button type="button" class="btn-admin primary" id="applyJsonTheme">Použít JSON vzhledu</button></div>`;
  }

  const TAB_RENDERERS = {
    hero: tabHero, about: tabAbout, services: tabServices, gallery: tabGallery,
    catalog: tabCatalog, news: tabNews, contact: tabContact, seo: tabSeo,
    theme: tabTheme, json: tabJson
  };

  /* ---------------- Vykreslení UI ---------------- */

  function renderSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    sidebar.innerHTML = TABS.map(t =>
      `<button type="button" class="admin-tab ${t.id === state.activeTab ? 'is-active' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`
    ).join('');
    sidebar.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        renderSidebar();
        renderActiveTab();
      });
    });
  }

  function renderActiveTab() {
    const editor = document.getElementById('adminEditor');
    const fn = TAB_RENDERERS[state.activeTab] || tabHero;
    editor.innerHTML = fn();
    bindInputs(editor);
    wireJsonButtons(editor);
  }

  function bindInputs(container) {
    container.querySelectorAll('[data-bind]').forEach(el => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => handleBind(el));
    });
  }

  function handleBind(el) {
    const path = el.getAttribute('data-bind');
    const value = el.value;
    const { root, subPath } = resolveRoot(path);
    setPath(root, subPath, value);

    // synchronizace párů (barva <-> text) se stejnou cestou
    document.querySelectorAll(`[data-bind="${cssEscape(path)}"]`).forEach(sibling => {
      if (sibling !== el) sibling.value = value;
    });
    // náhled obrázku
    if (el.dataset.preview) {
      const img = document.getElementById(el.dataset.preview);
      if (img) img.src = value;
    }
    schedulePreviewUpdate();
  }

  function cssEscape(str) {
    return window.CSS && CSS.escape ? CSS.escape(str) : str.replace(/([.#[\]"'])/g, '\\$1');
  }

  // Delegace kliknutí na tlačítka "Přidat"/"Odebrat" — navázáno JEDNOU na trvalý
  // kontejner #adminEditor (viz setupArrayDelegation), aby se listener při každém
  // překreslení tabu neduplikoval.
  function setupArrayDelegation() {
    const container = document.getElementById('adminEditor');
    container.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        removeArrayItem(rm.getAttribute('data-remove'));
        renderActiveTab();
        schedulePreviewUpdate();
        return;
      }
      const add = e.target.closest('[data-add]');
      if (add) {
        addArrayItem(add.getAttribute('data-add'));
        renderActiveTab();
        schedulePreviewUpdate();
      }
    });
  }

  function wireJsonButtons(container) {
    const applyContent = container.querySelector('#applyJsonContent');
    const applyTheme = container.querySelector('#applyJsonTheme');
    if (applyContent) applyContent.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(document.getElementById('jsonContent').value);
        state.content = parsed;
        setStatus('JSON obsahu použit.', 'ok');
        schedulePreviewUpdate();
      } catch (err) {
        setStatus('Neplatný JSON: ' + err.message, 'error');
      }
    });
    if (applyTheme) applyTheme.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(document.getElementById('jsonTheme').value);
        state.theme = parsed;
        setStatus('JSON vzhledu použit.', 'ok');
        schedulePreviewUpdate();
      } catch (err) {
        setStatus('Neplatný JSON: ' + err.message, 'error');
      }
    });
  }

  function setStatus(text, type) {
    const el = document.getElementById('adminStatus');
    el.textContent = text;
    el.className = 'admin-status' + (type === 'ok' ? ' is-ok' : type === 'error' ? ' is-error' : '');
  }

  /* ---------------- Živý náhled ---------------- */

  let previewTimer = null;
  function schedulePreviewUpdate() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(sendPreviewUpdate, 180);
  }
  function sendPreviewUpdate() {
    try {
      sessionStorage.setItem('zatrapaDraftContent', JSON.stringify(state.content));
      sessionStorage.setItem('zatrapaDraftTheme', JSON.stringify(state.theme));
    } catch (e) { /* ignore */ }
    const frame = document.getElementById('previewFrame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'zatrapa-preview-update', content: state.content, theme: state.theme }, '*');
    }
  }

  function setupPreviewViewport() {
    const wrap = document.getElementById('previewWrap');
    document.querySelectorAll('.preview-viewport-btns button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preview-viewport-btns button').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        wrap.className = 'preview-frame-wrap mode-' + btn.dataset.mode;
      });
    });
  }

  /* ---------------- Načtení dat ---------------- */

  async function fetchJSON(path) {
    const res = await fetch(path + '?t=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) throw new Error('Nelze načíst ' + path);
    return res.json();
  }

  async function loadData() {
    const [content, theme] = await Promise.all([
      fetchJSON('data/content.json'),
      fetchJSON('data/theme.json')
    ]);
    state.content = content;
    state.theme = theme;
    state.originalContent = JSON.parse(JSON.stringify(content));
    state.originalTheme = JSON.parse(JSON.stringify(theme));
    renderSidebar();
    renderActiveTab();
    schedulePreviewUpdate();
  }

  /* ---------------- Přihlášení ---------------- */

  async function verifyPassword(password) {
    const res = await fetch('/api/save-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server vrátil chybu při ověřování hesla.');
    return !!data.ok;
  }

  function showShell() {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminShell').style.visibility = 'visible';
  }

  async function bootAfterLogin() {
    showShell();
    setStatus('Načítám obsah…');
    try {
      await loadData();
      setStatus('Změny se ukládají do náhledu automaticky');
    } catch (err) {
      setStatus('Chyba při načítání obsahu: ' + err.message, 'error');
    }
  }

  function setupLogin() {
    const btn = document.getElementById('loginBtn');
    const input = document.getElementById('loginPassword');
    const err = document.getElementById('loginErr');

    const existing = sessionStorage.getItem('zatrapaAdminPass');
    if (existing) {
      state.password = existing;
      bootAfterLogin();
      return;
    }

    async function tryLogin() {
      const pass = input.value.trim();
      if (!pass) { err.textContent = 'Zadejte heslo.'; return; }
      btn.disabled = true;
      btn.textContent = 'Ověřuji…';
      err.textContent = '';
      try {
        const ok = await verifyPassword(pass);
        if (ok) {
          state.password = pass;
          sessionStorage.setItem('zatrapaAdminPass', pass);
          bootAfterLogin();
        } else {
          err.textContent = 'Nesprávné heslo.';
        }
      } catch (e) {
        err.textContent = 'Nelze ověřit heslo — zkontrolujte, že je administrace nasazená na Vercelu se správně nastavenými proměnnými prostředí (viz README.md).';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Přihlásit se';
      }
    }

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
  }

  /* ---------------- Uložit / Publikovat / Zahodit ---------------- */

  async function publish() {
    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    setStatus('Publikuji na GitHub…');
    try {
      const res = await fetch('/api/save-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          password: state.password,
          files: [
            { path: 'data/content.json', content: state.content },
            { path: 'data/theme.json', content: state.theme }
          ]
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Uložení se nezdařilo.');
      state.originalContent = JSON.parse(JSON.stringify(state.content));
      state.originalTheme = JSON.parse(JSON.stringify(state.theme));
      setStatus('Publikováno — Vercel nasadí změny během chvíle.', 'ok');
    } catch (err) {
      setStatus('Chyba při publikování: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function discard() {
    if (!confirm('Zahodit všechny neuložené změny?')) return;
    state.content = JSON.parse(JSON.stringify(state.originalContent));
    state.theme = JSON.parse(JSON.stringify(state.originalTheme));
    renderActiveTab();
    schedulePreviewUpdate();
    setStatus('Změny zahozeny.', 'ok');
  }

  /* ---------------- Init ---------------- */

  document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    setupPreviewViewport();
    setupArrayDelegation();
    document.getElementById('publishBtn').addEventListener('click', publish);
    document.getElementById('discardBtn').addEventListener('click', discard);

    const frame = document.getElementById('previewFrame');
    frame.addEventListener('load', () => {
      state.previewReady = true;
      if (state.content) schedulePreviewUpdate();
    });
  });
})();
