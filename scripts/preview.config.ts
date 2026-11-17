/** `npm run preview`: serves the assembled dist/ exactly as GitHub Pages would. */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { siteBase } from '../packages/build/src/vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  root,
  base: siteBase(),
  build: { outDir: resolve(root, 'dist') },
  preview: { port: Number(process.env.PORT ?? 4173), strictPort: true, host: true },
});
