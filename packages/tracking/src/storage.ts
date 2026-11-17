/**
 * localStorage can be missing or throw (private mode, blocked site data). Every access goes through here,
 * and the app keeps working with an in-memory fallback.
 */
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const k = '__lumda_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function getItem(key: string): string | null {
  try {
    const s = ls();
    if (s) return s.getItem(key);
  } catch {
    /* fall through */
  }
  return memory.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  try {
    const s = ls();
    if (s) {
      s.setItem(key, value);
      return;
    }
  } catch {
    /* fall through */
  }
  memory.set(key, value);
}

export function removeItem(key: string): void {
  try {
    ls()?.removeItem(key);
  } catch {
    /* ignore */
  }
  memory.delete(key);
}

export function getJSON<T>(key: string, fallback: T): T {
  const v = getItem(key);
  if (v == null) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  setItem(key, JSON.stringify(value));
}
