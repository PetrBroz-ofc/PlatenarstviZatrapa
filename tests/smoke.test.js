/**
 * tests/smoke.test.js
 *
 * Spusť před KAŽDÝM publikováním změn přímo do GitHubu:
 *   npm test
 *
 * Bez závislosti na žádném test frameworku (žádný Jest/Mocha) — je to
 * prostý Node skript s vlastním minimalistickým assert-runnerem, ať
 * není potřeba nic dalšího instalovat. Jediná závislost je jsdom.
 *
 * Co se testuje:
 *  1) data/content.json a data/theme.json jsou validní JSON se
 *     správným tvarem (lib/validate.js — stejná kontrola jako v api/save.js).
 *  2) lib/render.js vygeneruje z aktuálního obsahu validní index.html,
 *     které v jsdom obsahuje očekávaný počet sekcí/položek odpovídající
 *     content.json (žádné rozjetí šablony vs. dat).
 *  3) js/main.js se v jsdom spustí bez chyby a jeho interaktivita
 *     (mobilní menu, filtr galerie, lightbox) reálně funguje na
 *     vygenerovaném DOM.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { buildIndexHtml } = require('../lib/render');
const { validateContentShape, validateThemeShape } = require('../lib/validate');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log('  ✗ ' + name);
    console.log('    ' + err.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'nerovnost') + ` — očekáváno ${JSON.stringify(expected)}, dostal jsem ${JSON.stringify(actual)}`);
  }
}

/* ---------------- Načtení dat ---------------- */

const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/content.json'), 'utf-8'));
const theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/theme.json'), 'utf-8'));

console.log('\ndata/content.json a data/theme.json');
test('content.json má validní tvar', () => {
  const err = validateContentShape(content);
  assert(err === null, err);
});
test('theme.json má validní tvar', () => {
  const err = validateThemeShape(theme);
  assert(err === null, err);
});

/* ---------------- Generování HTML ---------------- */

console.log('\nGenerování index.html z lib/render.js');
const html = buildIndexHtml(content, theme);
test('buildIndexHtml vrátí neprázdné HTML', () => {
  assert(typeof html === 'string' && html.length > 1000, 'HTML je prázdné nebo příliš krátké');
});
test('HTML obsahuje DOCTYPE a <html lang="cs">', () => {
  assert(html.startsWith('<!DOCTYPE html>'), 'chybí DOCTYPE');
  assert(html.includes('<html lang="cs">'), 'chybí lang="cs"');
});

const dom = new JSDOM(html, {
  url: 'https://platnerstvi-zatrapa.cz/',
  runScripts: 'outside-only',
  resources: 'usable'
});
const { window } = dom;
const { document } = window;

/* ---------------- Strukturální testy DOM ---------------- */

console.log('\nStruktura vykresleného DOM');

test('titulek stránky odpovídá content.seo.title', () => {
  assertEqual(document.title, content.seo.title);
});

test('počet odkazů v hlavní navigaci odpovídá content.nav.links', () => {
  const links = document.querySelectorAll('.nav-links a');
  assertEqual(links.length, content.nav.links.length);
});

test('Hero titulek odpovídá content.hero.titleLine1/2', () => {
  const spans = document.querySelectorAll('.hero-title span');
  assertEqual(spans[0].textContent, content.hero.titleLine1);
  assertEqual(spans[1].textContent, content.hero.titleLine2);
});

test('počet karet služeb odpovídá content.services.items', () => {
  const cards = document.querySelectorAll('.service-card');
  assertEqual(cards.length, content.services.items.length);
});

test('počet položek v galerii odpovídá content.gallery.items', () => {
  const items = document.querySelectorAll('.masonry-item');
  assertEqual(items.length, content.gallery.items.length);
});

test('počet filtračních tlačítek odpovídá content.gallery.categories', () => {
  const btns = document.querySelectorAll('.filter-btn');
  assertEqual(btns.length, content.gallery.categories.length);
});

test('počet produktů v katalogu odpovídá content.catalog.products', () => {
  const cards = document.querySelectorAll('.product-card');
  assertEqual(cards.length, content.catalog.products.length);
});

test('počet položek na časové ose odpovídá content.news.items', () => {
  const items = document.querySelectorAll('.timeline-item');
  assertEqual(items.length, content.news.items.length);
});

test('patička obsahuje content.footer.copyright', () => {
  const footer = document.querySelector('.footer-bottom');
  assert(footer.textContent.includes(content.footer.copyright), 'copyright text chybí v patičce');
});

test('patička obsahuje stejný počet rychlých odkazů jako content.nav.links', () => {
  const links = document.querySelectorAll('.footer-links a');
  assertEqual(links.length, content.nav.links.length);
});

test('žádný <img> mimo lightbox nemá prázdné src', () => {
  const imgs = document.querySelectorAll('img:not(#lightboxImg)');
  imgs.forEach((img, i) => {
    assert(img.getAttribute('src') && img.getAttribute('src').length > 0, `obrázek #${i} má prázdné src`);
  });
});

/* ---------------- Spuštění main.js a test interaktivity ---------------- */

console.log('\nOživení přes js/main.js (interaktivita)');

test('js/main.js se spustí v jsdom bez chyby', () => {
  const mainJsSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf-8');
  window.eval(mainJsSrc);
  // main.js čeká na DOMContentLoaded — jsdom ho spouští automaticky při parsování,
  // ale pro jistotu ho vyvoláme ručně, kdyby už proběhlo dřív, než jsme skript vložili.
  document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
});

test('mobilní menu se po kliknutí otevře', () => {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert(menu.classList.contains('is-open'), 'mobilní menu se neotevřelo');
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert(!menu.classList.contains('is-open'), 'mobilní menu se nezavřelo');
});

if (content.gallery.items.length > 0) {
  test('kliknutí na položku galerie otevře lightbox se správným titulkem', () => {
    const firstItem = document.querySelector('.masonry-item');
    const lightbox = document.getElementById('lightbox');
    firstItem.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert(lightbox.classList.contains('is-open'), 'lightbox se neotevřel');
    const title = document.getElementById('lightboxTitle').textContent;
    assertEqual(title, content.gallery.items[0].title);
    document.getElementById('lightboxClose').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert(!lightbox.classList.contains('is-open'), 'lightbox se nezavřel');
  });
}

if (content.gallery.categories.length > 1) {
  test('filtr galerie skryje položky mimo vybranou kategorii', () => {
    const secondCategory = content.gallery.categories[1];
    const btn = Array.from(document.querySelectorAll('.filter-btn')).find(b => b.dataset.filter === secondCategory);
    assert(btn, 'tlačítko pro kategorii "' + secondCategory + '" nenalezeno');
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const items = Array.from(document.querySelectorAll('.masonry-item'));
    const matching = content.gallery.items.filter(it => it.category === secondCategory).length;
    const visible = items.filter(el => el.style.display !== 'none').length;
    assertEqual(visible, matching);
  });
}

/* ---------------- Shrnutí ---------------- */

console.log('\n' + '-'.repeat(50));
console.log(`Výsledek: ${passed} OK, ${failed} chyb`);
if (failed > 0) {
  console.log('\nNEPROŠLÉ TESTY — před nahráním na GitHub je nutné opravit:');
  failures.forEach(f => console.log(' - ' + f.name + ': ' + f.err.message));
  process.exit(1);
}
process.exit(0);
