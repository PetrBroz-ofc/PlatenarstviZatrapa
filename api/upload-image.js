/**
 * api/upload-image.js
 *
 * POST { filename, mimeType, contentBase64 } → uloží obrázek do
 * assets/img/uploads/ v GitHub repozitáři a vrátí jeho cestu, kterou
 * pak admin panel vloží do příslušného pole v content.json.
 *
 * Vyžaduje platnou session cookie (viz api/login.js).
 * Potřebné proměnné prostředí: SESSION_SECRET, GITHUB_TOKEN,
 * GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (volitelné).
 */

'use strict';

const auth = require('../lib/auth');
const github = require('../lib/github');

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif'
};

function sanitizeFilename(name) {
  const base = String(name || 'obrazek')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // odstranit diakritiku
    .replace(/[^a-z0-9.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'obrazek';
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { SESSION_SECRET } = process.env;
  if (!SESSION_SECRET) {
    res.status(500).json({ ok: false, error: 'Na serveru chybí proměnná SESSION_SECRET.' });
    return;
  }
  if (!auth.verifySession(req, SESSION_SECRET)) {
    res.status(401).json({ ok: false, error: 'Nejste přihlášeni (session vypršela).' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Povolena je pouze metoda POST.' });
    return;
  }

  const cfg = github.envConfig();
  if (cfg.missing.length) {
    res.status(500).json({ ok: false, error: 'Na serveru chybí proměnné prostředí: ' + cfg.missing.join(', ') });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const { filename, mimeType, contentBase64 } = body;

  if (!contentBase64 || typeof contentBase64 !== 'string') {
    res.status(400).json({ ok: false, error: 'Chybí obsah souboru.' });
    return;
  }
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) {
    res.status(400).json({ ok: false, error: 'Nepodporovaný typ souboru. Povoleny jsou JPEG, PNG, WebP, GIF, SVG.' });
    return;
  }

  const approxBytes = Math.ceil((contentBase64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    res.status(400).json({ ok: false, error: 'Soubor je příliš velký (max 6 MB).' });
    return;
  }

  const safeBase = sanitizeFilename((filename || 'obrazek').replace(/\.[a-z0-9]+$/i, ''));
  const path = `assets/img/uploads/${Date.now()}-${safeBase}.${ext}`;

  try {
    await github.putSingleFile(cfg, path, contentBase64, `Nahrání obrázku přes administraci: ${path}`);
    res.status(200).json({ ok: true, path: '/' + path });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Nahrání se nezdařilo.' });
  }
};
