/**
 * api/login.js
 *
 * POST   { password } → ověří proti ADMIN_PASSWORD (konstantní čas),
 *                        s rate limitingem (max 8 pokusů / 10 minut,
 *                        bezstavově přes podepsanou cookie), na úspěch
 *                        nastaví httpOnly session cookie.
 * DELETE               → odhlášení (smaže session cookie).
 *
 * Potřebné proměnné prostředí:
 *   ADMIN_PASSWORD  — heslo do administrace (obyčejný text, lze kdykoliv
 *                      změnit ve Vercelu, nikde se nehashuje pro uložení)
 *   SESSION_SECRET  — náhodný dlouhý řetězec pro podepisování cookie
 *                      (vygeneruj např. `openssl rand -hex 32`)
 */

'use strict';

const auth = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { ADMIN_PASSWORD, SESSION_SECRET } = process.env;
  if (!ADMIN_PASSWORD || !SESSION_SECRET) {
    res.status(500).json({ ok: false, error: 'Na serveru chybí ADMIN_PASSWORD nebo SESSION_SECRET.' });
    return;
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', auth.logoutCookie(req));
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Povoleno je POST (přihlášení) nebo DELETE (odhlášení).' });
    return;
  }

  const { limited, cookie } = auth.checkAndBumpRateLimit(req, SESSION_SECRET);
  if (limited) {
    res.setHeader('Set-Cookie', cookie);
    res.status(429).json({ ok: false, error: `Příliš mnoho pokusů. Zkuste to znovu za pár minut.` });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const providedPassword = typeof body.password === 'string' ? body.password : '';
  const isValid = auth.timingSafeEqualStr(providedPassword, ADMIN_PASSWORD);

  if (!isValid) {
    res.setHeader('Set-Cookie', cookie);
    res.status(401).json({ ok: false, error: 'Nesprávné heslo.' });
    return;
  }

  const resetCookie = auth.resetRateLimit(req, SESSION_SECRET);
  const sessionCookie = auth.createSessionCookie(req, SESSION_SECRET);
  res.setHeader('Set-Cookie', [resetCookie, sessionCookie]);
  res.status(200).json({ ok: true });
};
