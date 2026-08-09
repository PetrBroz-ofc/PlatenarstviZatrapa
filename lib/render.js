/**
 * lib/render.js
 *
 * Jediný zdroj pravdy pro vykreslení webu z content.json + theme.json.
 * Čistý Node modul (CommonJS), bez závislosti na DOM — používá ho:
 *   1) scripts/build.js   — lokální/manuální přegenerování index.html
 *   2) api/save.js        — přegenerování index.html při každém publikování
 *
 * Prohlížeč tento soubor nenačítá — na klientovi web NENÍ vykreslován z JSON,
 * index.html už obsahuje hotové HTML. js/main.js jen "oživuje" existující
 * DOM (scroll, menu, filtr galerie, lightbox), viz jeho hlavička.
 */

'use strict';

const ICONS = {
  helmet: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 30c0-11 6-19 14-19s14 8 14 19" /><path d="M8 30h32v3a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3v-3z"/><path d="M24 11V6" /><path d="M20 6h8"/><path d="M24 24v10"/></svg>',
  armor: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 6 12 11v8c0 11 5 18 12 23 7-5 12-12 12-23v-8L24 6z"/><path d="M24 6v36"/><path d="M16 18h16"/></svg>',
  shield: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 5 40 11v11c0 12-7 18-16 21-9-3-16-9-16-21V11L24 5z"/><path d="M24 14v20"/><path d="M15 24h18"/></svg>',
  sword: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M24 4v28"/><path d="M14 14h20"/><path d="M20 32h8v4l-4 6-4-6v-4z"/></svg>',
  film: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 16h36v22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V16z"/><path d="M6 16l4-10h6l-4 10"/><path d="M20 16l4-10h6l-4 10"/><path d="M34 16l4-10h.5a1.5 1.5 0 0 1 1.5 1.5V16"/></svg>',
  dragon: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 30c4-10 12-18 22-18 6 0 10 3 12 6-4-1-8 0-10 3 5 0 9 2 11 6-6-2-11-1-14 3-4 5-11 6-17 3"/><circle cx="30" cy="17" r="1.4" fill="currentColor" stroke="none"/><path d="M14 30c-2 4-4 6-8 7"/></svg>'
};

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

/* ---------------- Sekce ---------------- */

function renderHeader(c) {
  const links = c.nav.links.map(l => `<a href="/#${esc(l.target)}">${esc(l.label)}</a>`).join('');
  const mobileLinks = c.nav.links.map(l => `<a href="/#${esc(l.target)}" data-close-menu>${esc(l.label)}</a>`).join('');
  return `<header class="site-header" id="siteHeader">
      <div class="container">
        <a href="#" class="logo">
          <span class="logo-main">${esc(c.nav.logoText)}</span>
          <span class="logo-sub">${esc(c.nav.logoSub)}</span>
        </a>
        <nav class="nav-links" aria-label="Hlavní navigace">${links}</nav>
        <div class="nav-right">
          <a class="nav-cta" href="/#${esc(c.nav.cta.target)}">${esc(c.nav.cta.label)}</a>
          <button class="nav-toggle" id="navToggle" aria-label="Otevřít menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
    <div class="mobile-menu" id="mobileMenu">${mobileLinks}</div>`;
}

function renderHero(h) {
  const buttons = h.buttons.map(b => {
    const isPrimary = b.style === 'primary';
    const arrow = isPrimary ? ' <span class="hero-btn-arrow">→</span>' : '';
    return `<a class="btn btn-${isPrimary ? 'primary' : 'ghost'}" href="#${esc(b.target)}">${esc(b.label)}${arrow}</a>`;
  }).join('');
  return `<section class="hero" id="hero">
      <div class="hero-grain" aria-hidden="true"></div>
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow hero-eyebrow">${esc(h.eyebrow)}</p>
          <h1 class="hero-title"><span>${esc(h.titleLine1)}</span><span class="is-accent">${esc(h.titleLine2)}</span></h1>
          <p class="hero-subtitle">${esc(h.subtitle)}</p>
          <p class="hero-description">${esc(h.description)}</p>
          <div class="hero-actions">${buttons}</div>
        </div>
        <div class="hero-visual">
          <div class="hero-image-frame">
            <img src="${esc(h.image)}" alt="${esc(h.imageAlt)}" loading="eager">
          </div>
          <div class="hero-badge">
            <span class="hero-badge-top">${esc(h.badgeTop)}</span>
            <span class="hero-badge-year">${esc(h.badgeYear)}</span>
          </div>
        </div>
      </div>
    </section>`;
}

function renderAbout(a) {
  const paras = a.paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
  const stats = a.stats.map(s => `
      <div class="stat-item reveal">
        <div class="stat-value">${esc(s.value)}</div>
        <div class="stat-label">${esc(s.label)}</div>
      </div>`).join('');
  return `<section class="about section-pad" id="o-mne">
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
  return `<section class="services section-pad" id="sluzby">
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
  const filters = g.categories.map((cat, idx) =>
    `<button class="filter-btn ${idx === 0 ? 'is-active' : ''}" data-filter="${esc(cat)}">${esc(cat)}</button>`
  ).join('');
  const items = g.items.map((it, idx) => `
      <figure class="masonry-item reveal" data-category="${esc(it.category)}" data-index="${idx}"
        data-title="${esc(it.title)}" data-material="${esc(it.material || '')}" data-year="${esc(it.year || '')}">
        <img src="${esc(it.image)}" alt="${esc(it.imageAlt)}" loading="lazy">
        <figcaption class="masonry-caption">
          <div class="cat">${esc(it.category)}</div>
          <div class="name">${esc(it.title)}</div>
        </figcaption>
      </figure>`).join('');
  return `<section class="gallery section-pad" id="galerie">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow reveal">${esc(g.eyebrow)}</p>
          <h2 class="section-title reveal">${esc(g.title)}</h2>
          <p class="lede reveal">${esc(g.description)}</p>
        </div>
        <div class="gallery-filters reveal" id="galleryFilters">${filters}</div>
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
  const filters = k.categories.map((cat, idx) =>
    `<button class="filter-btn ${idx === 0 ? 'is-active' : ''}" data-filter="${esc(cat)}">${esc(cat)}</button>`
  ).join('');
  const cards = k.products.map(p => {
    const isStock = p.status === 'Skladem';
    return `
      <div class="product-card reveal" data-category="${esc(p.category || 'Ostatní')}">
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
  return `<section class="catalog section-pad" id="katalog">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow reveal">${esc(k.eyebrow)}</p>
          <h2 class="section-title reveal">${esc(k.title)}</h2>
          <p class="lede reveal">${esc(k.description)}</p>
        </div>
        <div class="gallery-filters reveal" id="catalogFilters">${filters}</div>
        <div class="catalog-grid" id="catalogGrid">${cards}</div>
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
  return `<section class="news section-pad" id="novinky">
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
  const phoneRow = k.phone ? `<div class="contact-row"><span>Telefon</span><a href="tel:${esc(k.phone.replace(/\s+/g, ''))}">${esc(k.phone)}</a></div>` : '';
  const dataBoxRow = k.dataBox ? `<div class="contact-row"><span>Datová schránka</span><span>${esc(k.dataBox)}</span></div>` : '';
  return `<section class="contact section-pad" id="kontakt">
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
          ${phoneRow}
          ${dataBoxRow}
          <div class="contact-row"><span>E‑mail</span><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></div>
        </div>
      </div>
    </section>`;
}

function renderFooter(content) {
  const f = content.footer;
  const c = content.contact;
  const links = content.nav.links.map(l => `<li><a href="/#${esc(l.target)}">${esc(l.label)}</a></li>`).join('');
  const phoneLine = c.phone ? `
          <div class="footer-contact-line">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5c0 8.5 6.5 15 15 15l2-4-5-2-2 2c-2-1-4-3-5-5l2-2-2-5-4 1z"/></svg>
            <a href="tel:${esc(c.phone.replace(/\s+/g, ''))}">${esc(c.phone)}</a>
          </div>` : '';
  return `<footer class="site-footer">
      <div class="container footer-grid-top">
        <div class="footer-col footer-brand">
          <div class="footer-brand-name">${esc(f.brand)}</div>
          <p class="footer-tagline">${esc(f.tagline)}</p>
        </div>
        <div class="footer-col">
          <h4 class="footer-col-title">${esc(f.linksLabel)}</h4>
          <ul class="footer-links">${links}</ul>
        </div>
        <div class="footer-col">
          <h4 class="footer-col-title">${esc(f.contactLabel)}</h4>
          <div class="footer-contact-name">${esc(c.name)}</div>${phoneLine}
          <div class="footer-contact-line">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6l8 6 8-6" /><rect x="3" y="4" width="18" height="16" rx="2"/></svg>
            <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>
          </div>
          <div class="footer-contact-line">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <span>${esc(c.city)}</span>
          </div>
          <div class="footer-legal">
            <span>IČO: ${esc(c.ico)}</span>
            ${c.dataBox ? `<span>Datová schránka: ${esc(c.dataBox)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>${esc(f.copyright)}</span>
        <div class="footer-bottom-right">
          <a href="${esc(content.legal.footerPrivacyLabel ? '/ochrana-osobnich-udaju.html' : '#')}">${esc(content.legal.footerPrivacyLabel)}</a>
          <a href="${esc(f.creditUrl)}" target="_blank" rel="noopener">${esc(f.credit)}</a>
          <a href="/admin.html" class="footer-admin-link" aria-label="Administrace" title="Administrace">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </a>
        </div>
      </div>
    </footer>`;
}

/* ---------------- Theme → inline CSS proměnné ---------------- */

function renderThemeStyle(theme) {
  if (!theme || !theme.colors) return '';
  const c = theme.colors;
  const f = theme.fonts || {};
  const lines = [
    c.background && `--color-bg: ${c.background};`,
    c.surface && `--color-surface: ${c.surface};`,
    c.surfaceAlt && `--color-surface-alt: ${c.surfaceAlt};`,
    c.accent && `--color-accent: ${c.accent};`,
    c.accentDim && `--color-accent-dim: ${c.accentDim};`,
    c.text && `--color-text: ${c.text};`,
    c.textSecondary && `--color-text-secondary: ${c.textSecondary};`,
    c.border && `--color-border: ${c.border};`,
    c.success && `--color-success: ${c.success};`,
    c.danger && `--color-danger: ${c.danger};`,
    f.display && `--font-display: ${f.display};`,
    f.body && `--font-body: ${f.body};`,
    f.utility && `--font-utility: ${f.utility};`
  ].filter(Boolean).join('\n      ');
  return `<style>\n    :root {\n      ${lines}\n    }\n    </style>`;
}

/* ---------------- Absolutní URL pomocník ---------------- */

function absUrl(path, base) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  try {
    return new URL(path, base).toString();
  } catch (e) {
    return path;
  }
}

function renderCookieBanner(legal) {
  const b = legal.cookieBanner;
  return `<div class="cookie-banner" id="cookieBanner" role="region" aria-label="Souhlas s cookies" hidden>
      <div class="cookie-banner-inner">
        <p>${esc(b.text)} <a href="${esc(b.linkUrl)}">${esc(b.linkLabel)}</a></p>
        <button type="button" class="btn btn-primary" id="cookieBannerBtn">${esc(b.buttonLabel)}</button>
      </div>
    </div>`;
}

function renderPrivacyArticle(legal) {
  const p = legal.privacyPage;
  const sections = p.sections.map(s => `
        <section class="legal-section">
          <h2>${esc(s.heading)}</h2>
          <p>${esc(s.text)}</p>
        </section>`).join('');
  return `<article class="legal-page section-pad">
      <div class="container legal-container">
        <p class="eyebrow">Právní informace</p>
        <h1 class="section-title">${esc(p.title)}</h1>
        <p class="legal-updated">Poslední aktualizace: ${esc(p.updated)}</p>
        <p class="legal-intro">${esc(p.intro)}</p>
        ${sections}
      </div>
    </article>`;
}

/* ---------------- Celá stránka (index.html) ---------------- */

function buildIndexHtml(content, theme) {
  const seo = content.seo;
  const base = seo.canonicalUrl || 'https://platnerstvi-zatrapa.cz/';
  const ogImage = absUrl(seo.ogImage, base);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: content.site.name,
    image: ogImage,
    description: seo.description,
    founder: { '@type': 'Person', name: content.contact.name, jobTitle: 'Platnéř' },
    address: { '@type': 'PostalAddress', addressLocality: content.contact.city, addressCountry: 'CZ' },
    email: content.contact.email,
    url: base,
    priceRange: '3000-30000 CZK',
    knowsAbout: content.services.items.map(s => s.title)
  };

  const body = [
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
    renderFooter(content),
    renderCookieBanner(content.legal)
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="${esc(content.site.language || 'cs')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(seo.title)}</title>
<meta name="description" content="${esc(seo.description)}">
<meta name="keywords" content="${esc(seo.keywords)}">
<meta name="author" content="${esc(content.contact.name)}">
<link rel="canonical" href="${esc(base)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(content.site.name)}">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="cs_CZ">
<meta property="og:url" content="${esc(base)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(content.site.name)}">
<meta name="twitter:description" content="${esc(seo.description)}">
<meta name="twitter:image" content="${esc(ogImage)}">

<link rel="icon" type="image/svg+xml" href="${esc(content.site.favicon || '/favicon.svg')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
    ${renderThemeStyle(theme)}

<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
</head>
<body>
<a class="skip-link" href="#main">Přeskočit na obsah</a>

${body}

<script src="js/main.js" defer></script>
</body>
</html>
`;
}

/* ---------------- Stránka Ochrana osobních údajů ---------------- */

function buildPrivacyHtml(content, theme) {
  const legal = content.legal;
  const base = content.seo.canonicalUrl || 'https://platnerstvi-zatrapa.cz/';
  const pageUrl = base.replace(/\/$/, '') + '/ochrana-osobnich-udaju.html';
  const title = `${legal.privacyPage.title} — ${content.site.name}`;

  const body = [
    renderHeader(content),
    '<main id="main">',
    renderPrivacyArticle(legal),
    '</main>',
    renderFooter(content),
    renderCookieBanner(legal)
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="${esc(content.site.language || 'cs')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(legal.privacyPage.intro)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${esc(pageUrl)}">

<link rel="icon" type="image/svg+xml" href="${esc(content.site.favicon || '/favicon.svg')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
    ${renderThemeStyle(theme)}
</head>
<body>
<a class="skip-link" href="#main">Přeskočit na obsah</a>

${body}

<script src="js/main.js" defer></script>
</body>
</html>
`;
}

module.exports = {
  ICONS, esc,
  renderHeader, renderHero, renderAbout, renderServices, renderGallery,
  renderCatalog, renderNews, renderContact, renderFooter,
  renderCookieBanner, renderPrivacyArticle,
  renderThemeStyle, absUrl, buildIndexHtml, buildPrivacyHtml
};
