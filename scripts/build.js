#!/usr/bin/env node
/**
 * scripts/build.js
 *
 * Přegeneruje index.html, ochrana-osobnich-udaju.html, obchodni-podminky.html,
 * reklamacni-rad.html a 404.html ze data/content.json + data/theme.json.
 * Spouští se ručně při lokální práci (`npm run build`) a automaticky
 * (stejnými funkcemi) v api/save.js při každém publikování.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildIndexHtml, buildPrivacyHtml, buildTermsHtml, buildComplaintsHtml, buildNotFoundHtml } = require('../lib/render');

const ROOT = path.join(__dirname, '..');

function main() {
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/content.json'), 'utf-8'));
  const theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/theme.json'), 'utf-8'));

  const html = buildIndexHtml(content, theme);
  fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf-8');
  console.log('index.html vygenerován (' + html.length + ' znaků).');

  const privacyHtml = buildPrivacyHtml(content, theme);
  fs.writeFileSync(path.join(ROOT, 'ochrana-osobnich-udaju.html'), privacyHtml, 'utf-8');
  console.log('ochrana-osobnich-udaju.html vygenerován (' + privacyHtml.length + ' znaků).');

  const termsHtml = buildTermsHtml(content, theme);
  fs.writeFileSync(path.join(ROOT, 'obchodni-podminky.html'), termsHtml, 'utf-8');
  console.log('obchodni-podminky.html vygenerován (' + termsHtml.length + ' znaků).');

  const complaintsHtml = buildComplaintsHtml(content, theme);
  fs.writeFileSync(path.join(ROOT, 'reklamacni-rad.html'), complaintsHtml, 'utf-8');
  console.log('reklamacni-rad.html vygenerován (' + complaintsHtml.length + ' znaků).');

  const notFoundHtml = buildNotFoundHtml(content, theme);
  fs.writeFileSync(path.join(ROOT, '404.html'), notFoundHtml, 'utf-8');
  console.log('404.html vygenerován (' + notFoundHtml.length + ' znaků).');
}

main();
