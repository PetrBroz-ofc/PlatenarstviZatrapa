/* =========================================================
   PLATNÉŘSTVÍ PAVEL ZÁTRAPA — admin.js
   Přihlášení vždy vyžadováno po načtení stránky (i s platnou cookie).
   Ukládání jde přes /api/save (GitHub Contents/Git Data API na serveru),
   nahrávání fotek přes /api/upload-image. Session cookie je httpOnly —
   klient s ní nijak nemanipuluje, jen ji prohlížeč automaticky posílá.
   ========================================================= */

(function () {
  'use strict';

  const state = {
    content: null,
    theme: null,
    originalContent: null,
    originalTheme: null,
    activeTab: 'hero'
  };

  const ICON_OPTIONS = [
    { value: 'helmet', label: 'Přilba' },
    { value: 'armor', label: 'Zbroj' },
    { value: 'shield', label: 'Štít' },
    { value: 'sword', label: 'Meč' },
    { value: 'film', label: 'Film' },
    { value: 'dragon', label: 'Fantasy' }
  ];

  const NAV_GROUPS = [
    {
      label: 'Obsah stránky',
      items: [
        { id: 'nav', label: 'Navigace' },
        { id: 'hero', label: 'Hero' },
        { id: 'about', label: 'O mně' },
        { id: 'services', label: 'Služby' },
        { id: 'gallery', label: 'Galerie' },
        { id: 'catalog', label: 'Katalog' },
        { id: 'news', label: 'Novinky' },
        { id: 'contact', label: 'Kontakt' }
      ]
    },
    {
      label: 'Nastavení',
      items: [
        { id: 'seo', label: 'SEO' },
        { id: 'theme', label: 'Vzhled' },
        { id: 'legal', label: 'Právní texty' },
        { id: 'notfound', label: 'Stránka 404' }
      ]
    },
    {
      label: 'Pokročilé',
      items: [
        { id: 'json', label: 'JSON' }
      ]
    }
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
  function cssEscape(str) {
    return window.CSS && CSS.escape ? CSS.escape(str) : str.replace(/([.#[\]"'])/g, '\\$1');
  }

  const ARRAY_TEMPLATES = {
    'services.items': () => ({ icon: 'helmet', title: 'Nová služba', description: 'Popis služby.' }),
    'gallery.items': () => ({
      id: 'g' + Date.now(), category: state.content.gallery.categories[1] || 'Přilby',
      title: 'Nový exponát', material: '', year: '', image: '', imageAlt: ''
    }),
    'catalog.products': () => ({
      id: 'p' + Date.now(), name: 'Nový produkt', category: state.content.catalog.categories[1] || 'Přilby', description: '', price: '0 Kč',
      status: 'Na objednávku', image: ''
    }),
    'news.items': () => ({ date: '2026', title: 'Nová událost', description: '' }),
    'hero.buttons': () => ({ label: 'Tlačítko', target: 'kontakt', style: 'ghost' }),
    'hero.images': () => ({ image: '', alt: '' }),
    'nav.links': () => ({ label: 'Odkaz', target: 'kontakt' }),
    'about.stats': () => ({ value: '0', label: 'popisek' }),
    'about.paragraphs': () => '',
    'gallery.categories': () => 'Nová kategorie',
    'catalog.categories': () => 'Nová kategorie',
    'legal.privacyPage.sections': () => ({ heading: 'Nová kapitola', text: '' })
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

  /* ---------------- Generování polí ---------------- */

  const ICON_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
  const ICON_REMOVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
  const ICON_UPLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
  const ICON_GRIP = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>';
  const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15l6-6 6 6"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';

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
        <input type="url" id="${id}" data-bind="${path}" data-preview="${id}-thumb" value="${esc(value)}" placeholder="https:// nebo /assets/…">
        <div class="upload-row">
          <label class="btn-admin small" for="${id}-file">${ICON_UPLOAD} Nahrát soubor</label>
          <input type="file" id="${id}-file" accept="image/*" data-upload-target="${path}" data-upload-input="${id}">
          <span class="upload-status" id="${id}-status"></span>
        </div>
        <img class="thumb-preview" id="${id}-thumb" src="${esc(value)}" alt="">
      </div>`;
    }
    return `<div class="field-group"><label for="${id}">${esc(label)}</label><input type="text" id="${id}" data-bind="${path}" value="${esc(value)}"></div>`;
  }

  // basePath.idx zakódováno v data-move-up/data-move-down/data-remove atributech,
  // draggable karty navíc nesou data-array-path + data-item-index pro přetažení myší.
  function reorderHead(basePath, idx, total, label) {
    const upDisabled = idx === 0 ? 'disabled' : '';
    const downDisabled = idx === total - 1 ? 'disabled' : '';
    return `<div class="repeat-card-head">
      <span class="drag-handle" draggable="true" title="Přetáhněte pro změnu pořadí">${ICON_GRIP}</span>
      <span class="idx">${esc(label)}</span>
      <span class="reorder-btns">
        <button type="button" class="btn-admin small" data-move-up="${basePath}.${idx}" ${upDisabled} aria-label="Posunout nahoru">${ICON_UP}</button>
        <button type="button" class="btn-admin small" data-move-down="${basePath}.${idx}" ${downDisabled} aria-label="Posunout dolů">${ICON_DOWN}</button>
        <button type="button" class="btn-admin small danger" data-remove="${basePath}.${idx}">${ICON_REMOVE} Odebrat</button>
      </span>
    </div>`;
  }

  function renderArrayEditor(basePath, items, fields, itemLabelFn) {
    let html = '';
    items.forEach((item, idx) => {
      const label = itemLabelFn ? itemLabelFn(item, idx) : '#' + (idx + 1);
      html += `<div class="repeat-card" data-array-path="${basePath}" data-item-index="${idx}">
        ${reorderHead(basePath, idx, items.length, label)}`;
      fields.forEach(f => {
        const path = `${basePath}.${idx}.${f.key}`;
        const val = item[f.key] == null ? '' : item[f.key];
        html += fieldHTML(f.label, path, val, f.type, f.opts);
      });
      html += `</div>`;
    });
    html += `<div class="add-btn-row"><button type="button" class="btn-admin" data-add="${basePath}">${ICON_ADD} Přidat</button></div>`;
    return html;
  }

  function renderStringArrayEditor(basePath, items, itemLabel) {
    let html = '';
    items.forEach((val, idx) => {
      html += `<div class="repeat-card" data-array-path="${basePath}" data-item-index="${idx}">
        ${reorderHead(basePath, idx, items.length, itemLabel + ' ' + (idx + 1))}
        <div class="field-group"><textarea data-bind="${basePath}.${idx}">${esc(val)}</textarea></div>
      </div>`;
    });
    html += `<div class="add-btn-row"><button type="button" class="btn-admin" data-add="${basePath}">${ICON_ADD} Přidat</button></div>`;
    return html;
  }

  function card(inner, subhead) {
    return `<div class="admin-card">${subhead ? `<h3 class="card-subhead">${esc(subhead)}</h3>` : ''}${inner}</div>`;
  }

  function heading(title, bannerText) {
    return `<h2 class="section-heading">${esc(title)}</h2><div class="section-banner">${esc(bannerText)}</div>`;
  }

  /* ---------------- Jednotlivé taby ---------------- */

  function tabNav() {
    const n = state.content.nav;
    let html = heading('Navigace', 'Logo, horní menu a tlačítko poptávky v hlavičce webu.');
    html += card(`
      <div class="field-row">
        ${fieldHTML('Logo — hlavní text', 'content.nav.logoText', n.logoText)}
        ${fieldHTML('Logo — podtext', 'content.nav.logoSub', n.logoSub)}
      </div>
    `, 'Logo');
    html += card(renderArrayEditor('content.nav.links', n.links, [
      { key: 'label', label: 'Text odkazu' },
      { key: 'target', label: 'Cíl (ID sekce, např. galerie)' }
    ], (l) => l.label), 'Odkazy v menu');
    html += card(`
      <div class="field-row">
        ${fieldHTML('Text tlačítka', 'content.nav.cta.label', n.cta.label)}
        ${fieldHTML('Cíl tlačítka (ID sekce)', 'content.nav.cta.target', n.cta.target)}
      </div>
    `, 'Tlačítko poptávky v hlavičce');
    return html;
  }

  function tabHero() {
    const h = state.content.hero;
    let html = heading('Hero', 'Úvodní sekce webu — text vlevo, fotografie vpravo s kulatým štítkem.');
    html += card(`
      <div class="field-row">
        ${fieldHTML('Titulek — řádek 1', 'content.hero.titleLine1', h.titleLine1)}
        ${fieldHTML('Titulek — řádek 2', 'content.hero.titleLine2', h.titleLine2)}
      </div>
      ${fieldHTML('Podtitulek', 'content.hero.subtitle', h.subtitle)}
      ${fieldHTML('Popisek pod podtitulkem', 'content.hero.description', h.description, 'textarea')}
    `, 'Texty');
    html += card(`
      <div class="field-row">
        ${fieldHTML('Štítek — horní řádek (např. Od)', 'content.hero.badgeTop', h.badgeTop)}
        ${fieldHTML('Štítek — rok (např. 1990)', 'content.hero.badgeYear', h.badgeYear)}
      </div>
    `, 'Štítek na fotografii');
    html += card(renderArrayEditor('content.hero.images', h.images, [
      { key: 'image', label: 'Fotografie', type: 'image' },
      { key: 'alt', label: 'Alt text fotografie' }
    ], (img, idx) => 'Fotografie ' + (idx + 1)) +
      '<p style="font-size:12px;color:var(--color-text-secondary);margin-top:10px;">Fotky se ve vpravo v Hero střídají samy (prolínání po pár vteřinách). U jedné fotky se přepínání skryje automaticky.</p>', 'Fotografie (karusel)');
    html += card(renderArrayEditor('content.hero.buttons', h.buttons, [
      { key: 'label', label: 'Text tlačítka' },
      { key: 'target', label: 'Cíl (ID sekce, např. galerie)' },
      { key: 'style', label: 'Styl', type: 'select', opts: { options: [{ value: 'primary', label: 'Primární (plné)' }, { value: 'ghost', label: 'Obrysové' }] } }
    ], (b) => b.label), 'Tlačítka');
    return html;
  }

  function tabAbout() {
    const a = state.content.about;
    let html = heading('O mně', 'Krátký osobní úvod a klíčová čísla dílny.');
    html += card(`
      ${fieldHTML('Eyebrow', 'content.about.eyebrow', a.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.about.title', a.title)}
    `, 'Texty');
    html += card(renderStringArrayEditor('content.about.paragraphs', a.paragraphs, 'Odstavec'), 'Odstavce textu');
    html += card(`
      ${fieldHTML('Portrétní fotografie', 'content.about.portraitImage', a.portraitImage, 'image')}
      ${fieldHTML('Alt text portrétu', 'content.about.portraitImageAlt', a.portraitImageAlt)}
    `, 'Fotografie');
    html += card(renderArrayEditor('content.about.stats', a.stats, [
      { key: 'value', label: 'Hodnota (např. 35+)' },
      { key: 'label', label: 'Popisek (např. let zkušeností)' }
    ], (s) => s.value + ' — ' + s.label), 'Statistiky');
    return html;
  }

  function tabServices() {
    const s = state.content.services;
    let html = heading('Služby', 'Karty se šesti oblastmi řemesla.');
    html += card(`
      ${fieldHTML('Eyebrow', 'content.services.eyebrow', s.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.services.title', s.title)}
    `, 'Texty');
    html += card(renderArrayEditor('content.services.items', s.items, [
      { key: 'icon', label: 'Ikona', type: 'select', opts: { options: ICON_OPTIONS } },
      { key: 'title', label: 'Název služby' },
      { key: 'description', label: 'Popis', type: 'textarea' }
    ], (it) => it.title), 'Jednotlivé služby');
    return html;
  }

  function tabGallery() {
    const g = state.content.gallery;
    const catOptions = g.categories.filter(c => c !== 'Vše').map(c => ({ value: c, label: c }));
    let html = heading('Galerie', 'Nejdůležitější část webu — realizované zakázky.');
    html += card(`
      ${fieldHTML('Eyebrow', 'content.gallery.eyebrow', g.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.gallery.title', g.title)}
      ${fieldHTML('Popisek sekce', 'content.gallery.description', g.description, 'textarea')}
    `, 'Texty');
    html += card(renderStringArrayEditor('content.gallery.categories', g.categories, 'Kategorie') +
      '<p style="font-size:12px;color:var(--color-text-secondary);margin-top:10px;">První položka „Vše“ by měla zůstat zachována.</p>', 'Kategorie (filtr)');
    html += card(renderArrayEditor('content.gallery.items', g.items, [
      { key: 'category', label: 'Kategorie', type: 'select', opts: { options: catOptions } },
      { key: 'title', label: 'Název' },
      { key: 'material', label: 'Materiál' },
      { key: 'year', label: 'Rok' },
      { key: 'image', label: 'Fotografie', type: 'image' },
      { key: 'imageAlt', label: 'Alt text fotografie' }
    ], (it) => it.title), 'Exponáty');
    return html;
  }

  function tabCatalog() {
    const k = state.content.catalog;
    const catOptions = k.categories.filter(c => c !== 'Vše').map(c => ({ value: c, label: c }));
    let html = heading('Katalog', 'Přehled produktů s cenou a dostupností.');
    html += card(`
      ${fieldHTML('Eyebrow', 'content.catalog.eyebrow', k.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.catalog.title', k.title)}
      ${fieldHTML('Popisek sekce', 'content.catalog.description', k.description, 'textarea')}
    `, 'Texty');
    html += card(renderStringArrayEditor('content.catalog.categories', k.categories, 'Kategorie') +
      '<p style="font-size:12px;color:var(--color-text-secondary);margin-top:10px;">První položka „Vše“ by měla zůstat zachována.</p>', 'Kategorie (filtr)');
    html += card(renderArrayEditor('content.catalog.products', k.products, [
      { key: 'name', label: 'Název produktu' },
      { key: 'category', label: 'Kategorie', type: 'select', opts: { options: catOptions } },
      { key: 'description', label: 'Krátký popis', type: 'textarea' },
      { key: 'price', label: 'Cena (např. 8 900 Kč)' },
      { key: 'status', label: 'Dostupnost', type: 'select', opts: { options: [{ value: 'Skladem', label: 'Skladem' }, { value: 'Na objednávku', label: 'Na objednávku' }] } },
      { key: 'image', label: 'Fotografie', type: 'image' }
    ], (p) => p.name + ' — ' + p.price), 'Produkty');
    return html;
  }

  function tabNews() {
    const n = state.content.news;
    let html = heading('Novinky', 'Časová osa dílenského deníku.');
    html += card(`
      ${fieldHTML('Eyebrow', 'content.news.eyebrow', n.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.news.title', n.title)}
    `, 'Texty');
    html += card(renderArrayEditor('content.news.items', n.items, [
      { key: 'date', label: 'Datum / rok' },
      { key: 'title', label: 'Titulek události' },
      { key: 'description', label: 'Popis', type: 'textarea' }
    ], (it) => it.date + ' — ' + it.title), 'Události');
    return html;
  }

  function tabContact() {
    const k = state.content.contact;
    let html = heading('Kontakt', 'Fakturační a kontaktní údaje.');
    html += card(`
      ${fieldHTML('Eyebrow', 'content.contact.eyebrow', k.eyebrow)}
      ${fieldHTML('Nadpis sekce', 'content.contact.title', k.title)}
      ${fieldHTML('Popisek', 'content.contact.description', k.description, 'textarea')}
    `, 'Texty');
    html += card(`
      <div class="field-row">
        ${fieldHTML('Jméno', 'content.contact.name', k.name)}
        ${fieldHTML('Sídlo / město', 'content.contact.city', k.city)}
      </div>
      <div class="field-row">
        ${fieldHTML('IČO', 'content.contact.ico', k.ico)}
        ${fieldHTML('Poznámka k DPH', 'content.contact.vatNote', k.vatNote)}
      </div>
      <div class="field-row">
        ${fieldHTML('Telefon', 'content.contact.phone', k.phone)}
        ${fieldHTML('ID datové schránky', 'content.contact.dataBox', k.dataBox)}
      </div>
      ${fieldHTML('E‑mail', 'content.contact.email', k.email)}
    `, 'Údaje');
    html += card(`
      ${fieldHTML('Text tlačítka', 'content.contact.cta.label', k.cta.label)}
      ${fieldHTML('E‑mail pro tlačítko', 'content.contact.cta.email', k.cta.email)}
    `, 'Tlačítko poptávky');
    const f = state.content.footer;
    html += card(`
      ${fieldHTML('Název značky', 'content.footer.brand', f.brand)}
      ${fieldHTML('Podtitulek (tagline)', 'content.footer.tagline', f.tagline)}
      <div class="field-row">
        ${fieldHTML('Popisek — rychlé odkazy', 'content.footer.linksLabel', f.linksLabel)}
        ${fieldHTML('Popisek — kontakt', 'content.footer.contactLabel', f.contactLabel)}
      </div>
      <div class="field-row">
        ${fieldHTML('Text kreditu tvůrce webu', 'content.footer.credit', f.credit)}
        ${fieldHTML('Odkaz kreditu (URL)', 'content.footer.creditUrl', f.creditUrl)}
      </div>
      ${fieldHTML('Copyright text', 'content.footer.copyright', f.copyright)}
    `, 'Patička (footer)');
    return html;
  }

  function tabSeo() {
    const s = state.content.seo;
    const site = state.content.site;
    let html = heading('SEO', 'Titulek, popis a náhledový obrázek pro vyhledávače a sociální sítě. Při publikování se promítne přímo do hlavičky index.html.');
    html += card(`
      ${fieldHTML('Název firmy (používá se v metadatech)', 'content.site.name', site.name)}
    `, 'Firma');
    html += card(`
      ${fieldHTML('Title (titulek stránky)', 'content.seo.title', s.title)}
      ${fieldHTML('Meta description', 'content.seo.description', s.description, 'textarea')}
      ${fieldHTML('Klíčová slova', 'content.seo.keywords', s.keywords)}
      ${fieldHTML('Kanonická URL', 'content.seo.canonicalUrl', s.canonicalUrl)}
    `, 'Základní údaje');
    html += card(fieldHTML('OG obrázek (pro sdílení na sítích)', 'content.seo.ogImage', s.ogImage, 'image'), 'Náhledový obrázek');
    return html;
  }

  function tabTheme() {
    const t = state.theme;
    const c = t.colors;
    let html = heading('Vzhled', 'Barevná paleta a písma webu. Projeví se po publikování.');
    html += card(`
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
    `, 'Barvy');
    html += card(`
      ${fieldHTML('Nadpisové písmo (CSS font-family)', 'theme.fonts.display', t.fonts.display)}
      ${fieldHTML('Textové písmo (CSS font-family)', 'theme.fonts.body', t.fonts.body)}
      ${fieldHTML('Utility písmo (CSS font-family)', 'theme.fonts.utility', t.fonts.utility)}
    `, 'Písma (pokročilé)');
    return html;
  }

  function tabLegal() {
    const l = state.content.legal;
    const cb = l.cookieBanner;
    const pp = l.privacyPage;
    let html = heading('Právní texty', 'Cookie lišta a stránka „Ochrana osobních údajů“ (/ochrana-osobnich-udaju.html). Nejsem právník — obsah před ostrým nasazením doporučuju nechat zkontrolovat.');
    html += card(`
      ${fieldHTML('Text cookie lišty', 'content.legal.cookieBanner.text', cb.text, 'textarea')}
      <div class="field-row">
        ${fieldHTML('Text tlačítka souhlasu', 'content.legal.cookieBanner.buttonLabel', cb.buttonLabel)}
        ${fieldHTML('Text odkazu „více informací“', 'content.legal.cookieBanner.linkLabel', cb.linkLabel)}
      </div>
    `, 'Cookie lišta');
    html += card(`
      ${fieldHTML('Text odkazu v patičce', 'content.legal.footerPrivacyLabel', l.footerPrivacyLabel)}
    `, 'Odkaz v patičce webu');
    html += card(`
      <div class="field-row">
        ${fieldHTML('Nadpis stránky', 'content.legal.privacyPage.title', pp.title)}
        ${fieldHTML('Datum poslední aktualizace', 'content.legal.privacyPage.updated', pp.updated)}
      </div>
      ${fieldHTML('Úvodní text', 'content.legal.privacyPage.intro', pp.intro, 'textarea')}
    `, 'Stránka — základní údaje');
    html += card(renderArrayEditor('content.legal.privacyPage.sections', pp.sections, [
      { key: 'heading', label: 'Nadpis kapitoly' },
      { key: 'text', label: 'Text kapitoly', type: 'textarea' }
    ], (s) => s.heading), 'Stránka — jednotlivé kapitoly');
    return html;
  }

  function tabNotFound() {
    const n = state.content.notFound;
    let html = heading('Stránka 404', 'Zobrazí se, když někdo zadá neexistující adresu (např. překlep v odkazu).');
    html += card(`
      ${fieldHTML('Eyebrow', 'content.notFound.eyebrow', n.eyebrow)}
      ${fieldHTML('Velké číslo (obvykle „404“)', 'content.notFound.code', n.code)}
      ${fieldHTML('Nadpis', 'content.notFound.title', n.title)}
      ${fieldHTML('Text', 'content.notFound.message', n.message, 'textarea')}
    `, 'Texty');
    html += card(`
      ${fieldHTML('Text tlačítka zpět na web', 'content.notFound.homeLabel', n.homeLabel)}
      ${fieldHTML('Popisek nad rychlými odkazy', 'content.notFound.linksLabel', n.linksLabel)}
      <p style="font-size:12px;color:var(--color-text-secondary);margin-top:10px;">Rychlé odkazy pod tlačítkem se přebírají automaticky ze záložky „Navigace“.</p>
    `, 'Tlačítko a odkazy');
    return html;
  }

  function tabJson() {
    let html = heading('JSON', 'Přímá editace celého souboru — pojistka pro cokoliv, co chybí ve formulářích.');
    html += card(`
      <h3 class="card-subhead">data/content.json</h3>
      <div class="json-editor"><textarea id="jsonContent">${esc(JSON.stringify(state.content, null, 2))}</textarea></div>
      <div class="add-btn-row"><button type="button" class="btn-admin primary" id="applyJsonContent">Použít JSON obsahu</button></div>
    `);
    html += card(`
      <h3 class="card-subhead">data/theme.json</h3>
      <div class="json-editor"><textarea id="jsonTheme">${esc(JSON.stringify(state.theme, null, 2))}</textarea></div>
      <div class="add-btn-row"><button type="button" class="btn-admin primary" id="applyJsonTheme">Použít JSON vzhledu</button></div>
    `);
    return html;
  }

  const TAB_RENDERERS = {
    nav: tabNav, hero: tabHero, about: tabAbout, services: tabServices, gallery: tabGallery,
    catalog: tabCatalog, news: tabNews, contact: tabContact, seo: tabSeo,
    theme: tabTheme, legal: tabLegal, notfound: tabNotFound, json: tabJson
  };

  /* ---------------- Vykreslení UI ---------------- */

  function renderNav() {
    const nav = document.getElementById('adminNav');
    nav.innerHTML = NAV_GROUPS.map(group => `
      <div class="admin-nav-group">
        <div class="admin-nav-group-label">${esc(group.label)}</div>
        ${group.items.map(it =>
          `<button type="button" class="admin-tab ${it.id === state.activeTab ? 'is-active' : ''}" data-tab="${it.id}">${esc(it.label)}</button>`
        ).join('')}
      </div>`).join('');
    nav.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        renderNav();
        renderActiveTab();
        document.getElementById('adminContent').scrollTop = 0;
      });
    });
  }

  function renderActiveTab() {
    const content = document.getElementById('adminContent');
    const fn = TAB_RENDERERS[state.activeTab] || tabHero;
    content.innerHTML = fn();
    bindInputs(content);
    wireJsonButtons(content);
    wireDragAndDrop(content);
  }

  function bindInputs(container) {
    container.querySelectorAll('[data-bind]').forEach(el => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => handleBind(el));
    });
    container.querySelectorAll('[data-upload-target]').forEach(el => {
      el.addEventListener('change', () => handleUpload(el));
    });
  }

  function handleBind(el) {
    const path = el.getAttribute('data-bind');
    const value = el.value;
    const { root, subPath } = resolveRoot(path);
    setPath(root, subPath, value);
    document.querySelectorAll(`[data-bind="${cssEscape(path)}"]`).forEach(sibling => {
      if (sibling !== el) sibling.value = value;
    });
    if (el.dataset.preview) {
      const img = document.getElementById(el.dataset.preview);
      if (img) img.src = value;
    }
    markDirty();
  }

  async function handleUpload(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const path = fileInput.getAttribute('data-upload-target');
    const inputId = fileInput.getAttribute('data-upload-input');
    const textInput = document.getElementById(inputId);
    const statusEl = document.getElementById(inputId + '-status');
    const thumbEl = document.getElementById(inputId + '-thumb');

    if (file.size > 6 * 1024 * 1024) {
      statusEl.textContent = 'Soubor je moc velký (max 6 MB).';
      return;
    }
    statusEl.textContent = 'Nahrávám…';

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, contentBase64: base64 })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Nahrání se nezdařilo.');

      textInput.value = data.path;
      const { root, subPath } = resolveRoot(path);
      setPath(root, subPath, data.path);
      if (thumbEl) thumbEl.src = data.path;
      statusEl.textContent = 'Nahráno ✓';
      markDirty();
    } catch (err) {
      statusEl.textContent = 'Chyba: ' + err.message;
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = String(result).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function moveArrayItem(fullPath, direction) {
    const { root, subPath } = resolveRoot(fullPath);
    const keys = subPath.split('.');
    const idx = Number(keys.pop());
    const arr = getPath(root, keys.join('.'));
    if (!Array.isArray(arr)) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  }

  function wireArrayDelegation() {
    const container = document.getElementById('adminContent');
    container.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        removeArrayItem(rm.getAttribute('data-remove'));
        renderActiveTab();
        markDirty();
        return;
      }
      const add = e.target.closest('[data-add]');
      if (add) {
        addArrayItem(add.getAttribute('data-add'));
        renderActiveTab();
        markDirty();
        return;
      }
      const up = e.target.closest('[data-move-up]');
      if (up && !up.disabled) {
        moveArrayItem(up.getAttribute('data-move-up'), -1);
        renderActiveTab();
        markDirty();
        return;
      }
      const down = e.target.closest('[data-move-down]');
      if (down && !down.disabled) {
        moveArrayItem(down.getAttribute('data-move-down'), 1);
        renderActiveTab();
        markDirty();
      }
    });
  }

  // Přetažení myší (desktop) — funguje vedle šipek, které jsou spolehlivá
  // varianta i pro dotyková zařízení. Tažení se smí spustit jen z úchytu
  // (drag-handle) — kdyby bylo draggable na celé kartě, klik do textového
  // pole uvnitř by prohlížeč vyhodnotil jako výběr textu, ne přetažení.
  function wireDragAndDrop(container) {
    const cards = container.querySelectorAll('.repeat-card');
    let dragged = null;
    cards.forEach(card => {
      const handle = card.querySelector(':scope > .repeat-card-head .drag-handle');
      if (handle) {
        handle.addEventListener('dragstart', (e) => {
          dragged = card;
          card.classList.add('is-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.itemIndex || '');
          }
        });
        handle.addEventListener('dragend', () => {
          card.classList.remove('is-dragging');
          cards.forEach(c => c.classList.remove('is-drag-over'));
          dragged = null;
        });
      }
      card.addEventListener('dragover', (e) => {
        if (!dragged || dragged === card) return;
        if (dragged.dataset.arrayPath !== card.dataset.arrayPath) return;
        e.preventDefault();
        card.classList.add('is-drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('is-drag-over');
        if (!dragged || dragged === card) return;
        const basePath = card.dataset.arrayPath;
        if (dragged.dataset.arrayPath !== basePath) return;
        const fromIdx = Number(dragged.dataset.itemIndex);
        const toIdx = Number(card.dataset.itemIndex);
        const { root, subPath } = resolveRoot(basePath);
        const arr = getPath(root, subPath);
        if (!Array.isArray(arr)) return;
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        renderActiveTab();
        markDirty();
      });
    });
  }

  function wireJsonButtons(container) {
    const applyContent = container.querySelector('#applyJsonContent');
    const applyTheme = container.querySelector('#applyJsonTheme');
    if (applyContent) applyContent.addEventListener('click', () => {
      try {
        state.content = JSON.parse(document.getElementById('jsonContent').value);
        setStatus('JSON obsahu použit.', 'ok');
        markDirty();
      } catch (err) {
        setStatus('Neplatný JSON: ' + err.message, 'error');
      }
    });
    if (applyTheme) applyTheme.addEventListener('click', () => {
      try {
        state.theme = JSON.parse(document.getElementById('jsonTheme').value);
        setStatus('JSON vzhledu použit.', 'ok');
        markDirty();
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
  function markDirty() {
    setStatus('Neuložené změny');
  }

  /* ---------------- Načtení dat ---------------- */

  async function loadData() {
    const res = await fetch('/api/save', { credentials: 'same-origin', cache: 'no-cache' });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setStatus('Session vypršela — přihlas se prosím znovu.', 'error');
      setTimeout(() => window.location.reload(), 1200);
      throw new Error('Nepřihlášeno.');
    }
    if (!res.ok || !data.ok) throw new Error(data.error || 'Nelze načíst obsah.');
    state.content = data.content;
    state.theme = data.theme;
    state.contentSha = data.contentSha;
    state.themeSha = data.themeSha;
    state.originalContent = JSON.parse(JSON.stringify(data.content));
    state.originalTheme = JSON.parse(JSON.stringify(data.theme));
    renderNav();
    renderActiveTab();
    setStatus('Vše uloženo');
  }

  /* ---------------- Přihlášení (VŽDY vyžadováno) ---------------- */

  function showShell() {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminShell').style.display = 'grid';
  }

  async function bootAfterLogin() {
    showShell();
    setStatus('Načítám obsah…');
    try {
      await loadData();
    } catch (err) {
      setStatus('Chyba při načítání obsahu: ' + err.message, 'error');
    }
  }

  function setupLogin() {
    // Přihlašovací obrazovka se zobrazuje VŽDY po načtení stránky —
    // i kdyby ještě platila session cookie z minula. Žádná kontrola
    // existující session se při startu neprovádí.
    const btn = document.getElementById('loginBtn');
    const input = document.getElementById('loginPassword');
    const err = document.getElementById('loginErr');

    async function tryLogin() {
      const pass = input.value.trim();
      if (!pass) { err.textContent = 'Zadejte heslo.'; return; }
      btn.disabled = true;
      btn.textContent = 'Ověřuji…';
      err.textContent = '';
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          err.textContent = data.error || 'Příliš mnoho pokusů. Zkuste to prosím později.';
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          input.value = '';
          bootAfterLogin();
        } else {
          err.textContent = 'Nesprávné heslo.';
        }
      } catch (e) {
        err.textContent = 'Nelze se spojit se serverem — zkontrolujte nasazení na Vercelu a proměnné prostředí (viz README.md).';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Přihlásit se';
      }
    }

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    input.focus();
  }

  async function logout() {
    try {
      await fetch('/api/login', { method: 'DELETE', credentials: 'same-origin' });
    } catch (e) { /* ignore */ }
    window.location.reload();
  }

  /* ---------------- Uložit / Publikovat / Zahodit ---------------- */

  async function publish() {
    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    setStatus('Publikuji…');
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: state.content,
          theme: state.theme,
          contentSha: state.contentSha,
          themeSha: state.themeSha
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setStatus('Session vypršela — přihlas se prosím znovu.', 'error');
        setTimeout(() => window.location.reload(), 1500);
        return;
      }
      if (res.status === 409) {
        setStatus(data.error + ' Klikni na „Zahodit změny“ a stránku obnov.', 'error');
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Uložení se nezdařilo.');
      state.originalContent = JSON.parse(JSON.stringify(state.content));
      state.originalTheme = JSON.parse(JSON.stringify(state.theme));
      // po úspěšném publikování si znovu natáhneme čerstvé sha, ať lze rovnou uložit znovu
      try {
        const fresh = await fetch('/api/save', { credentials: 'same-origin', cache: 'no-cache' }).then(r => r.json());
        if (fresh.ok) { state.contentSha = fresh.contentSha; state.themeSha = fresh.themeSha; }
      } catch (e) { /* není kritické */ }
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
    setStatus('Vše uloženo');
  }

  /* ---------------- Init ---------------- */

  function setupSidebarToggle() {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !toggle || !backdrop) return;

    function open() {
      sidebar.classList.add('is-open');
      backdrop.classList.add('is-visible');
      toggle.setAttribute('aria-expanded', 'true');
    }
    function close() {
      sidebar.classList.remove('is-open');
      backdrop.classList.remove('is-visible');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', () => {
      sidebar.classList.contains('is-open') ? close() : open();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    // po výběru sekce v menu se na mobilu zásuvka sama zavře
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.admin-tab')) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    wireArrayDelegation();
    setupSidebarToggle();
    document.getElementById('publishBtn').addEventListener('click', publish);
    document.getElementById('discardBtn').addEventListener('click', discard);
    document.getElementById('logoutBtn').addEventListener('click', logout);
  });
})();
