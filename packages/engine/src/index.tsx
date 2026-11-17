import '@lumda/theme/all.css';
import { render } from 'preact';
import { config, SITE_BASE } from '@lumda/config';
import type { ModuleContent } from '@lumda/schema';
import { createTracker } from '@lumda/tracking';
import { applyTheme } from '@lumda/ui';
import { ModuleApp } from './app';
import type { MountOptions } from './types';

export type { StepComponent, StepContext, StepProps, MountOptions } from './types';
export { computeScore } from './score';
export { runStatus, runKey, type RunState, type RunStatus } from './run';
export { getLibrary, addToLibrary, removeFromLibrary, type LibraryItem } from './library';

let tracker: ReturnType<typeof createTracker> | null = null;
export function getTracker() {
  tracker ??= createTracker(config.TRACKING_URL);
  return tracker;
}

/** Registers the site-wide service worker (generated at build time by scripts/build-all.ts). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SITE_BASE + 'sw.js', { scope: SITE_BASE }).catch(() => {
      /* offline support is best-effort */
    });
  });
}

/** Entry point every module calls from its main.tsx. */
export function mountModule(content: ModuleContent, opts: MountOptions = {}) {
  applyTheme();
  registerServiceWorker();
  document.title = `${content.title} · ${config.SITE_TITLE}`;
  const root = document.getElementById(opts.rootId ?? 'app');
  if (!root) throw new Error('mount element not found');
  render(<ModuleApp content={content} plugins={opts.plugins} tracker={getTracker()} />, root);
}
