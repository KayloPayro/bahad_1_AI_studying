import { getJSON, setJSON } from '@lumda/tracking';

/** The cadet's saved prompts ("ספריית ההנחיות"), per personal number, on this device only. */
export interface LibraryItem {
  module: string;
  title: string;
  text: string;
  savedAt: number;
}

const key = (pn: string) => `lumda.library.${pn}`;

export function getLibrary(pn: string): LibraryItem[] {
  return getJSON<LibraryItem[]>(key(pn), []);
}

export function addToLibrary(pn: string, item: Omit<LibraryItem, 'savedAt'>): void {
  const list = getLibrary(pn).filter((x) => !(x.module === item.module && x.title === item.title));
  setJSON(key(pn), [...list, { ...item, savedAt: Date.now() }]);
}

export function removeFromLibrary(pn: string, savedAt: number): void {
  setJSON(
    key(pn),
    getLibrary(pn).filter((x) => x.savedAt !== savedAt),
  );
}
