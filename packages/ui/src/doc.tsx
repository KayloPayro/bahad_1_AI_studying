import { useRef } from 'preact/hooks';
import type { Doc } from '@lumda/schema';
import { copyText } from './clipboard';
import { toast } from './toast';

export function docToText(doc: Doc): string {
  return (
    doc.title +
    '\n' +
    (doc.sub ? doc.sub + '\n' : '') +
    '\n' +
    doc.paragraphs.map((p, i) => `${i + 1}. ${p.title}. ${p.text}`).join('\n')
  );
}

/** Body only, used for number derivations. */
export function docBody(doc: Doc): string {
  return doc.paragraphs.map((p) => p.text).join(' ');
}

const LONG_PRESS_MS = 500;

/**
 * Numbered document. Tap a number to copy that paragraph; long-press (or Enter on a focused paragraph)
 * highlights it. Highlights are the cadet's own reading marks and persist with the step.
 */
export function DocViewer({
  doc,
  highlights = [],
  onHighlights,
}: {
  doc: Doc;
  highlights?: number[];
  onHighlights?: (h: number[]) => void;
}) {
  const toggle = (i: number) => {
    if (!onHighlights) return;
    onHighlights(highlights.includes(i) ? highlights.filter((x) => x !== i) : [...highlights, i].sort((a, b) => a - b));
  };
  return (
    <div class="doc">
      <div class="doc-head">
        <div>
          <h3 class="doc-title">{doc.title}</h3>
          {doc.sub && <p class="doc-sub">{doc.sub}</p>}
        </div>
        <button
          type="button"
          class="btn btn-secondary"
          onClick={async () => toast((await copyText(docToText(doc))) ? 'המסמך הועתק' : 'לא הצלחתי להעתיק. סמן ידנית')}
        >
          העתק את המסמך
        </button>
      </div>
      {onHighlights && (
        <p class="doc-help" id="para-help">
          לחיצה על מספר מעתיקה את הפסקה. לחיצה ארוכה על פסקה, או Enter במקלדת, מסמנת אותה.
        </p>
      )}
      <ol class="doc-paras">
        {doc.paragraphs.map((p, i) => (
          <Para key={i} n={i + 1} title={p.title} text={p.text} on={highlights.includes(i + 1)} onToggle={() => toggle(i + 1)} />
        ))}
      </ol>
    </div>
  );
}

function Para({ n, title, text, on, onToggle }: { n: number; title: string; text: string; on: boolean; onToggle: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  return (
    <li class={'para' + (on ? ' is-marked' : '')}>
      <button
        type="button"
        class="para-num"
        aria-label={`העתק פסקה ${n}`}
        onClick={async () => toast((await copyText(`${n}. ${title}. ${text}`)) ? `פסקה ${n} הועתקה` : 'לא הצלחתי להעתיק')}
      >
        {n}
      </button>
      <div
        class="para-body"
        tabIndex={0}
        role="button"
        aria-pressed={on}
        aria-describedby="para-help"
        onPointerDown={(e) => {
          fired.current = false;
          start.current = { x: e.clientX, y: e.clientY };
          timer.current = setTimeout(() => {
            fired.current = true;
            navigator.vibrate?.(10);
            onToggle();
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel();
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => {
          if (fired.current) e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <strong>{title}.</strong> {text}
        {on && <span class="sr-only"> (מסומנת)</span>}
      </div>
    </li>
  );
}
