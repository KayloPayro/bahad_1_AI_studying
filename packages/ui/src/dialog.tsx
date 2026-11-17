import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { config } from '@lumda/config';

/** Native <dialog> as a bottom sheet on phones, centered panel on desktop. Esc and the close button dismiss. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const hid = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-labelledby={hid}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div class="sheet-body">
        <header class="sheet-head">
          <h2 id={hid}>{title}</h2>
          <button type="button" class="btn-icon" aria-label="סגור" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const KEY = 'lumda.instructor';
export function isInstructorUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function unlock() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* session only */
  }
}

/** Instructor code prompt. The code only hides notes and keys from cadets; it is not a security boundary. */
export function InstructorGate({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const id = useId();
  return (
    <Sheet open={open} onClose={onClose} title="מצב מדריך">
      <form
        class="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!window.crypto?.subtle) return setErr('הדפדפן לא תומך בבדיקת קוד בחיבור הזה');
          if ((await sha256(code.trim())) === config.INSTRUCTOR_CODE_SHA256) {
            unlock();
            setCode('');
            setErr('');
            onUnlocked();
          } else setErr('הקוד שגוי');
        }}
      >
        <div class="field">
          <label class="field-label" for={id}>
            קוד מדריך
          </label>
          <input
            id={id}
            class="input"
            type="password"
            autoComplete="off"
            value={code}
            aria-invalid={Boolean(err)}
            aria-describedby={id + '-err'}
            onInput={(e) => setCode((e.currentTarget as HTMLInputElement).value)}
          />
          <span id={id + '-err'} class="field-error" role="alert">
            {err}
          </span>
        </div>
        <button type="submit" class="btn btn-primary btn-block">
          פתח
        </button>
      </form>
    </Sheet>
  );
}
