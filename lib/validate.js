/**
 * lib/validate.js
 * Lehká strukturální validace content.json / theme.json — používá ji
 * api/save.js (odmítne uložit zjevně poškozený obsah) i automatické
 * testy v tests/.
 */

'use strict';

const CONTENT_REQUIRED_KEYS = [
  'site', 'seo', 'nav', 'hero', 'about', 'services',
  'gallery', 'catalog', 'news', 'contact', 'footer', 'legal', 'notFound'
];

function validateContentShape(content) {
  if (!content || typeof content !== 'object') return 'content musí být objekt.';
  for (const key of CONTENT_REQUIRED_KEYS) {
    if (!(key in content)) return `content.json postrádá klíč "${key}".`;
  }
  if (!Array.isArray(content.gallery.items)) return 'content.gallery.items musí být pole.';
  if (!Array.isArray(content.gallery.categories)) return 'content.gallery.categories musí být pole.';
  if (!Array.isArray(content.catalog.products)) return 'content.catalog.products musí být pole.';
  if (!Array.isArray(content.catalog.categories)) return 'content.catalog.categories musí být pole.';
  if (!Array.isArray(content.services.items)) return 'content.services.items musí být pole.';
  if (!Array.isArray(content.news.items)) return 'content.news.items musí být pole.';
  if (!Array.isArray(content.hero.buttons)) return 'content.hero.buttons musí být pole.';
  if (!Array.isArray(content.nav.links)) return 'content.nav.links musí být pole.';
  if (!content.legal || !content.legal.cookieBanner || !content.legal.privacyPage) return 'content.legal musí obsahovat cookieBanner a privacyPage.';
  if (!Array.isArray(content.legal.privacyPage.sections)) return 'content.legal.privacyPage.sections musí být pole.';
  return null;
}

function validateThemeShape(theme) {
  if (!theme || typeof theme !== 'object') return 'theme musí být objekt.';
  if (!theme.colors || typeof theme.colors !== 'object') return 'theme.colors chybí.';
  const requiredColors = ['background', 'surface', 'accent', 'accentDim', 'text', 'textSecondary', 'border'];
  for (const key of requiredColors) {
    if (!theme.colors[key]) return `theme.colors.${key} chybí.`;
  }
  return null;
}

module.exports = { validateContentShape, validateThemeShape, CONTENT_REQUIRED_KEYS };
