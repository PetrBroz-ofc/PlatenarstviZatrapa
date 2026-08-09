/**
 * lib/auth.js
 *
 * Bezstavová autentizace admin panelu — žádná databáze, žádná session
 * uložená na serveru. Session je podepsaný token v httpOnly cookie
 * (HMAC přes SESSION_SECRET), který si server sám ověří podle podpisu
 * a expirace. Rate limiting na přihlašování je taky bezstavový —
 * počet pokusů + čas okna se drží v podepsané cookie, takže funguje
 * napříč serverless invokacemi bez nutnosti Vercel KV/Redis.
 *
 * Heslo (ADMIN_PASSWORD) se NEHASHUJE pro uložení — je to obyčejná
 * proměnná prostředí, kterou lze kdykoliv změnit přímo ve Vercelu.
 * Porovnání proti zadanému heslu ale probíhá v konstantním čase
 * (přes hash obou hodnot + crypto.timingSafeEqual), aby nešlo heslo
 * uhodnout postupným měřením času odpovědi.
 */

'use strict';

const crypto = require('crypto');

const SESSION_COOKIE = 'pz_session';
const ATTEMPTS_COOKIE = 'pz_la';
const SESSION_TTL_SECONDS = 4 * 60 * 60; // 4 hodiny
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60; // 10 minut
const RATE_LIMIT_MAX_ATTEMPTS = 8;

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function timingSafeEqualStr(a, b) {
  const ah = crypto.createHash('sha256').update(String(a)).digest();
  const bh = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function parseCookies(req) {
  const header = (req.headers && req.headers.cookie) || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isLocalRequest(req) {
  const host = (req.headers && req.headers.host) || '';
  return !process.env.VERCEL_ENV || host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function buildCookie(req, name, value, maxAgeSeconds) {
  let str = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict`;
  if (!isLocalRequest(req)) str += '; Secure';
  if (maxAgeSeconds != null) str += `; Max-Age=${maxAgeSeconds}`;
  return str;
}

function clearCookie(req, name) {
  return buildCookie(req, name, '', 0);
}

/* ---------------- Session ---------------- */

function createSessionCookie(req, secret) {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = String(expires);
  const token = payload + '.' + sign(payload, secret);
  return buildCookie(req, SESSION_COOKIE, token, SESSION_TTL_SECONDS);
}

function verifySession(req, secret) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = sign(payload, secret);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires)) return false;
  return Date.now() < expires;
}

function logoutCookie(req) {
  return clearCookie(req, SESSION_COOKIE);
}

/* ---------------- Rate limiting (bezstavové, přes cookie) ---------------- */

function readAttempts(req, secret) {
  const cookies = parseCookies(req);
  const raw = cookies[ATTEMPTS_COOKIE];
  if (!raw) return { count: 0, windowStart: Date.now() };
  const parts = raw.split('.');
  if (parts.length !== 3) return { count: 0, windowStart: Date.now() };
  const [count, windowStart, sig] = parts;
  const expected = sign(count + '.' + windowStart, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { count: 0, windowStart: Date.now() };
  }
  const windowStartNum = Number(windowStart);
  if (Date.now() - windowStartNum > RATE_LIMIT_WINDOW_SECONDS * 1000) {
    return { count: 0, windowStart: Date.now() };
  }
  return { count: Number(count), windowStart: windowStartNum };
}

function buildAttemptsCookie(req, secret, count, windowStart) {
  const payload = count + '.' + windowStart;
  const sig = sign(payload, secret);
  return buildCookie(req, ATTEMPTS_COOKIE, payload + '.' + sig, RATE_LIMIT_WINDOW_SECONDS);
}

/**
 * Vrátí { limited: boolean, cookie: string } — cookie se vždy pošle zpět
 * (buď se zvýšeným počtem pokusů, nebo nová/resetovaná).
 */
function checkAndBumpRateLimit(req, secret) {
  const { count, windowStart } = readAttempts(req, secret);
  const nextCount = count + 1;
  const limited = count >= RATE_LIMIT_MAX_ATTEMPTS;
  const cookie = buildAttemptsCookie(req, secret, limited ? count : nextCount, windowStart);
  return { limited, cookie };
}

function resetRateLimit(req, secret) {
  return buildAttemptsCookie(req, secret, 0, Date.now());
}

module.exports = {
  timingSafeEqualStr,
  parseCookies,
  createSessionCookie,
  verifySession,
  logoutCookie,
  checkAndBumpRateLimit,
  resetRateLimit,
  RATE_LIMIT_WINDOW_SECONDS
};
