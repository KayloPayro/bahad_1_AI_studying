/**
 * Renders the PWA icons from Bahad_1_Symbol.svg with the installed Chromium (Playwright).
 * Output goes to apps/site/public/icons and is committed; rerun only when the symbol changes.
 *   npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'apps/site/public/icons');
const BG = '#14212a';
mkdirSync(out, { recursive: true });

const svg = readFileSync(resolve(root, 'Bahad_1_Symbol.svg'), 'utf8')
  .replace(/<\?xml[^>]*>/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<!DOCTYPE[^>]*>/, '')
  .trim();
writeFileSync(resolve(out, 'symbol.svg'), svg + '\n');

// favicon: symbol on a rounded dark square
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
writeFileSync(
  resolve(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" rx="160" fill="${BG}"/><g transform="translate(60 60) scale(0.85)">${inner}</g></svg>\n`,
);

const targets: { file: string; size: number; pad: number; radius: number }[] = [
  { file: 'icon-192.png', size: 192, pad: 0.08, radius: 0 },
  { file: 'icon-512.png', size: 512, pad: 0.08, radius: 0 },
  { file: 'maskable-512.png', size: 512, pad: 0.2, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.1, radius: 0 },
];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const p = Math.round(t.size * t.pad);
  await page.setContent(
    `<html><body style="margin:0;background:${BG};display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
      <img src="${dataUrl}" style="width:${t.size - 2 * p}px;height:${t.size - 2 * p}px"></body></html>`,
  );
  await page.waitForLoadState('load');
  await page.screenshot({ path: resolve(out, t.file), omitBackground: false });
  console.log('wrote', t.file);
}
await browser.close();
