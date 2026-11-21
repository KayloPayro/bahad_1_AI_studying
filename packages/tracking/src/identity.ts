import { getJSON, removeItem, setJSON } from './storage';

/** Not authentication: only a tag for progress. No password, per the spec. */
export interface Identity {
  pn: string;
  team: string;
}

const KEY = 'lumda.identity';

export function getIdentity(): Identity | null {
  const v = getJSON<Identity | null>(KEY, null);
  return v && typeof v.pn === 'string' && typeof v.team === 'string' ? v : null;
}

export function setIdentity(id: Identity): void {
  setJSON(KEY, id);
  // Best effort: ask the browser to keep this device's storage (identity and progress) when space is short.
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

export function clearIdentity(): void {
  removeItem(KEY);
}

/** Returns a Hebrew error message, or null when valid. */
export function validatePn(pn: string, length: number): string | null {
  if (new RegExp(`^\\d{${length}}$`).test(pn)) return null;
  return `מספר אישי הוא ${length} ספרות, בלי אותיות ורווחים`;
}

/** "9324493" → "XXXX493" */
export function maskPn(pn: string): string {
  const keep = 3;
  return pn.length <= keep ? pn : 'X'.repeat(pn.length - keep) + pn.slice(-keep);
}
