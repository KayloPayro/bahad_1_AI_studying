/**
 * Creates the package files of a module workspace (package.json, vite.config.ts, index.html, src/main.tsx).
 * Never overwrites content.json or existing files unless --force.
 *
 *   npx tsx scripts/new-module.ts l13-example "כותרת הלומדה"
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function scaffold(folder: string, title: string, force = false) {
  const m = /^l(\d{2})-[a-z0-9-]+$/.exec(folder);
  if (!m) throw new Error(`folder must look like "l03-two-prompts", got "${folder}"`);
  const slug = 'l' + m[1];
  const id = 'L' + m[1];
  const dir = resolve(root, 'modules', folder);
  mkdirSync(resolve(dir, 'src'), { recursive: true });

  const files: Record<string, string> = {
    'package.json':
      JSON.stringify(
        {
          name: `@lumda/${slug}`,
          version: '0.1.0',
          private: true,
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
          dependencies: { '@lumda/build': '*', '@lumda/engine': '*', '@lumda/schema': '*' },
        },
        null,
        2,
      ) + '\n',
    'vite.config.ts': `import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { lumdaConfig } from '@lumda/build';

export default defineConfig(lumdaConfig(fileURLToPath(new URL('.', import.meta.url)), '${slug}/'));
`,
    'index.html': indexHtml(title),
    'src/main.tsx': `import { mountModule } from '@lumda/engine';
import type { ModuleContent } from '@lumda/schema';
import content from '../content.json';

mountModule(content as unknown as ModuleContent);
`,
  };
  for (const [name, body] of Object.entries(files)) {
    const p = resolve(dir, name);
    if (existsSync(p) && !force) continue;
    writeFileSync(p, body);
  }
  const contentPath = resolve(dir, 'content.json');
  if (!existsSync(contentPath)) {
    writeFileSync(
      contentPath,
      JSON.stringify(
        {
          $schema: '../../packages/schema/src/content.schema.json',
          id,
          slug,
          version: '0.1',
          status: 'draft',
          title,
          minutes: 15,
          tools: ['Claude', 'ChatGPT', 'Gemini'],
          units: [],
          outcome: 'משפט אחד: מה הצוער ידע לעשות בסוף.',
          steps: [{ id: 'card', type: 'intro', stage: 1, title }],
        },
        null,
        2,
      ) + '\n',
    );
  }
  return dir;
}

export function indexHtml(title: string, entry = './src/main.tsx') {
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#2f5a4c" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0f151a" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="לומדות AI לצוערים" />
    <title>${title}</title>
    <link rel="manifest" href="%SITE_BASE%manifest.webmanifest" />
    <link rel="icon" href="%SITE_BASE%icons/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="%SITE_BASE%icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <script>
      (function () {
        try {
          var t = localStorage.getItem('lumda.theme');
          if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <noscript>הלומדה צריכה JavaScript. פתח אותה בדפדפן רגיל.</noscript>
    <script type="module" src="${entry}"></script>
  </body>
</html>
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [folder, title, flag] = process.argv.slice(2);
  if (!folder || !title) {
    console.error('usage: tsx scripts/new-module.ts <lNN-name> "<title>" [--force]');
    process.exit(1);
  }
  console.log('created', scaffold(folder, title, flag === '--force'));
}
