#!/usr/bin/env node
/**
 * scripts/build.js
 *
 * Přegeneruje index.html ze data/content.json + data/theme.json.
 * Spouští se ručně při lokální práci (`npm run build`) a automaticky
 * (stejnou funkcí `buildIndexHtml`) v api/save.js při každém publikování.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildIndexHtml } = require('../lib/render');

const ROOT = path.join(__dirname, '..');

function main() {
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/content.json'), 'utf-8'));
  const theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/theme.json'), 'utf-8'));
  const html = buildIndexHtml(content, theme);
  fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf-8');
  console.log('index.html vygenerován (' + html.length + ' znaků).');
}

main();
