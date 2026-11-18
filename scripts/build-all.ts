/**
 * Builds the site and every module, then assembles one static site in dist/:
 *   dist/index.html, dist/staff/   ← apps/site
 *   dist/l01/ … dist/l12/          ← modules/*
 *   dist/assets/                   ← shared hashed assets (deduplicated)
 *   dist/sw.js                     ← offline cache for all of the above
 * BASE_PATH sets the site root (e.g. "/bahad_1_AI_studying/" on GitHub Pages; default "/").
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { generateSW } from 'workbox-build';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');

const modules = readdirSync(resolve(root, 'modules'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^l\d{2}-/.test(d.name))
  .map((d) => d.name)
  .sort();
const only = process.argv.slice(2);
const targets = [
  { dir: 'apps/site', path: '' },
  ...modules.map((m) => ({ dir: `modules/${m}`, path: m.slice(0, 3) + '/' })),
].filter((t) => !only.length || only.some((o) => t.dir.includes(o)));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const t of targets) {
  const dir = resolve(root, t.dir);
  const started = Date.now();
  await build({ configFile: resolve(dir, 'vite.config.ts'), root: dir, logLevel: 'warn' });
  const dist = resolve(dir, 'dist');
  // Shared assets go to dist/assets; everything else (html, public files) under the workspace path.
  for (const entry of readdirSync(dist, { withFileTypes: true })) {
    const from = resolve(dist, entry.name);
    if (entry.name === 'assets') cpSync(from, resolve(out, 'assets'), { recursive: true, force: false, errorOnExist: false });
    else cpSync(from, resolve(out, t.path, entry.name), { recursive: true });
  }
  console.log(`built ${t.dir.padEnd(32)} → /${t.path}  (${Date.now() - started} ms)`);
}

// A preview build renames the installed app, so it is not mistaken for the real one on the home screen.
if (process.env.SITE_TITLE) {
  const mf = resolve(out, 'manifest.webmanifest');
  const m = JSON.parse(readFileSync(mf, 'utf8'));
  m.name = process.env.SITE_TITLE;
  m.short_name = process.env.SITE_SHORT || process.env.SITE_TITLE;
  writeFileSync(mf, JSON.stringify(m, null, 2));
}

// GitHub Pages: serve files starting with "_" and skip Jekyll.
writeFileSync(resolve(out, '.nojekyll'), '');
if (existsSync(resolve(out, 'index.html'))) cpSync(resolve(out, 'index.html'), resolve(out, '404.html'));

const sw = await generateSW({
  globDirectory: out,
  globPatterns: ['**/*.{html,js,css,woff2,svg,png,webmanifest,json,ics,csv,pdf,mp3}'],
  globIgnores: ['sw.js', 'workbox-*.js', '404.html'],
  swDest: resolve(out, 'sw.js'),
  directoryIndex: 'index.html',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  ignoreURLParametersMatching: [/.*/],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  inlineWorkboxRuntime: true,
  sourcemap: false,
});
console.log(`service worker: ${sw.count} files, ${(sw.size / 1024).toFixed(0)} KB precached`);
for (const w of sw.warnings) console.warn('workbox:', w);
