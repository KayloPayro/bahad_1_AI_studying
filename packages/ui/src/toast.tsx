import { useEffect, useState } from 'preact/hooks';

interface ToastItem {
  id: number;
  text: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(t: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l(items);
}

/** Fire-and-forget toast. Polite live region, never steals focus. */
export function toast(text: string, ms = 2400) {
  const item = { id: nextId++, text };
  items = [...items.slice(-2), item];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== item.id);
    emit();
  }, ms);
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => void listeners.delete(setList);
  }, []);
  return (
    <div class="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div class="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
