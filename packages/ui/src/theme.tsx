import { useState } from 'preact/hooks';
import { getItem, setItem } from '@lumda/tracking';

export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'lumda.theme';

export function getThemePref(): ThemePref {
  const v = getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const root = document.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

const LABEL: Record<ThemePref, string> = { auto: 'לפי המכשיר', light: 'בהיר', dark: 'כהה' };

/** Cycles auto → light → dark. Useful when projecting to a classroom screen. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  return (
    <button
      type="button"
      class="btn btn-ghost btn-small"
      onClick={() => {
        const next: ThemePref = pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto';
        setPref(next);
        setItem(KEY, next);
        applyTheme(next);
      }}
    >
      תצוגה: {LABEL[pref]}
    </button>
  );
}
