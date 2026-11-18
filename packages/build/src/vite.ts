import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, UserConfig } from 'vite';
import preact from '@preact/preset-vite';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Site root on the host, e.g. "/bahad_1_AI_studying/" for GitHub Pages. Always starts and ends with "/". */
export function siteBase(): string {
  let b = process.env.BASE_PATH ?? '/';
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b += '/';
  return b;
}

/** Site name shown in the UI. A preview build (the dev branch) sets SITE_TITLE to tell itself apart from the real site. */
export const siteTitle = (): string | undefined => process.env.SITE_TITLE || undefined;

/** Replaces %SITE_BASE% and %SITE_TITLE% in index.html (manifest, icons, theme bootstrap, page title). */
function siteBaseHtml(base: string): Plugin {
  return {
    name: 'lumda-site-base',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%SITE_BASE%', base)
        .replaceAll('%SITE_TITLE%', siteTitle() ?? 'לומדות AI לצוערים')
        .replaceAll('%SITE_SHORT%', process.env.SITE_SHORT || 'לומדות AI'),
  };
}

/**
 * Shared Vite config for every workspace that ships pages.
 * @param root  The workspace directory (pass `import.meta.dirname` / __dirname).
 * @param path  Path under the site root: "l01/" for a module, "" for the site itself.
 */
export function lumdaConfig(root: string, path: string, extra: UserConfig = {}): UserConfig {
  const base = siteBase();
  return {
    ...extra,
    root,
    base: base + path,
    plugins: [preact(), siteBaseHtml(base), ...(extra.plugins ?? [])],
    define: {
      __SITE_BASE__: JSON.stringify(base),
      __SITE_TITLE__: JSON.stringify(siteTitle() ?? ''),
      // The real site and the preview share one host, so the preview keeps its own saved progress.
      __STORAGE_NS__: JSON.stringify(process.env.STORAGE_NS ?? ''),
      ...extra.define,
    },
    // All workspaces emit hashed assets that build-all merges into one shared /assets/ folder, so identical
    // files (fonts, shared chunks) exist once on the site and once in the offline cache.
    experimental: {
      renderBuiltUrl: (filename: string, { hostType }: { hostType: string }) =>
        hostType === 'html' || hostType === 'css' || hostType === 'js' ? base + filename : { relative: true },
    },
    server: { fs: { allow: [repoRoot] }, ...extra.server },
    // One Preact instance across all workspaces, or hooks break.
    resolve: { dedupe: ['preact', 'preact/hooks', 'preact/compat'], ...extra.resolve },
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: true,
      target: ['es2020', 'safari14'],
      cssTarget: ['safari14'],
      assetsInlineLimit: 0,
      ...extra.build,
    },
  };
}
