/**
 * api/save.js
 *
 * GET  → vrátí ŽIVOU verzi content.json + theme.json přímo z GitHubu
 *        (ne z CDN cache statického webu) spolu s jejich git sha —
 *        admin z tohohle vychází při editaci.
 * POST → uloží nový obsah. PŘED zápisem vždy znovu stáhne aktuální sha
 *        obou souborů z GitHubu a porovná je se sha, ze kterých klient
 *        vycházel — pokud se mezitím obsah změnil (např. jiný běžící
 *        admin panel), uložení odmítne (409), ať nikdy nedojde
 *        k tichému přepsání cizí změny. Po úspěšné kontrole se
 *        content.json, theme.json a přegenerované index.html zapíšou
 *        v jednom atomickém commitu (viz lib/github.js).
 *
 * Obě metody vyžadují platnou session cookie (viz api/login.js).
 *
 * Potřebné proměnné prostředí: ADMIN_PASSWORD, SESSION_SECRET,
 * GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (volitelné).
 */

'use strict';

const auth = require('../lib/auth');
const github = require('../lib/github');
const { buildIndexHtml, buildPrivacyHtml, buildTermsHtml, buildComplaintsHtml, buildNotFoundHtml } = require('../lib/render');
const { validateContentShape, validateThemeShape } = require('../lib/validate');

const CONTENT_PATH = 'data/content.json';
const THEME_PATH = 'data/theme.json';
const INDEX_PATH = 'index.html';
const PRIVACY_PATH = 'ochrana-osobnich-udaju.html';
const TERMS_PATH = 'obchodni-podminky.html';
const COMPLAINTS_PATH = 'reklamacni-rad.html';
const NOT_FOUND_PATH = '404.html';

function requireSession(req, res) {
  const { SESSION_SECRET } = process.env;
  if (!SESSION_SECRET) {
    res.status(500).json({ ok: false, error: 'Na serveru chybí proměnná SESSION_SECRET.' });
    return false;
  }
  if (!auth.verifySession(req, SESSION_SECRET)) {
    res.status(401).json({ ok: false, error: 'Nejste přihlášeni (session vypršela). Přihlaste se prosím znovu.' });
    return false;
  }
  return true;
}


module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!requireSession(req, res)) return;

  const cfg = github.envConfig();
  if (cfg.missing.length) {
    res.status(500).json({ ok: false, error: 'Na serveru chybí proměnné prostředí: ' + cfg.missing.join(', ') });
    return;
  }

  if (req.method === 'GET') {
    try {
      const [contentResult, themeResult] = await Promise.all([
        github.getFileWithSha(cfg, CONTENT_PATH),
        github.getFileWithSha(cfg, THEME_PATH)
      ]);
      res.status(200).json({
        ok: true,
        content: contentResult.json,
        theme: themeResult.json,
        contentSha: contentResult.sha,
        themeSha: themeResult.sha
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'Nepodařilo se načíst obsah z GitHubu.' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Povoleno je GET nebo POST.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const { content, theme, contentSha, themeSha } = body;

  const contentErr = validateContentShape(content);
  if (contentErr) { res.status(400).json({ ok: false, error: contentErr }); return; }
  const themeErr = validateThemeShape(theme);
  if (themeErr) { res.status(400).json({ ok: false, error: themeErr }); return; }

  try {
    // VŽDY nejdřív znovu ověřit aktuální (živý) stav na GitHubu —
    // pokud se mezi načtením do admin panelu a publikováním obsah
    // změnil (jiná session, ruční commit…), uložení se odmítne.
    const [liveContent, liveTheme] = await Promise.all([
      github.getFileWithSha(cfg, CONTENT_PATH),
      github.getFileWithSha(cfg, THEME_PATH)
    ]);

    if (contentSha && liveContent.sha !== contentSha) {
      res.status(409).json({ ok: false, error: 'Obsah byl mezitím na GitHubu změněn. Načtěte prosím stránku znovu a proveďte úpravy znovu.' });
      return;
    }
    if (themeSha && liveTheme.sha !== themeSha) {
      res.status(409).json({ ok: false, error: 'Vzhled (theme.json) byl mezitím na GitHubu změněn. Načtěte prosím stránku znovu.' });
      return;
    }

    const indexHtml = buildIndexHtml(content, theme);
    const privacyHtml = buildPrivacyHtml(content, theme);
    const termsHtml = buildTermsHtml(content, theme);
    const complaintsHtml = buildComplaintsHtml(content, theme);
    const notFoundHtml = buildNotFoundHtml(content, theme);

    const result = await github.commitFiles(cfg, [
      { path: CONTENT_PATH, content: JSON.stringify(content, null, 2) + '\n' },
      { path: THEME_PATH, content: JSON.stringify(theme, null, 2) + '\n' },
      { path: INDEX_PATH, content: indexHtml },
      { path: PRIVACY_PATH, content: privacyHtml },
      { path: TERMS_PATH, content: termsHtml },
      { path: COMPLAINTS_PATH, content: complaintsHtml },
      { path: NOT_FOUND_PATH, content: notFoundHtml }
    ], 'Aktualizace obsahu webu přes administraci');

    res.status(200).json({ ok: true, commitSha: result.commitSha });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Neznámá chyba při ukládání do GitHubu.' });
  }
};
