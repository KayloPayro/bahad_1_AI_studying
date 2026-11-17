import { runAutoTest, type NumberIndex, checkNumbers, type TestResult } from '@lumda/checkers';
import type { Requirement } from '@lumda/schema';
import { Rich } from './rich';

export interface Evaluated {
  req: Requirement;
  auto: TestResult | null;
}

export function evaluate(reqs: Requirement[], text: string): Evaluated[] {
  return reqs.map((req) => ({ req, auto: req.test ? runAutoTest(req.test, text) : null }));
}

export function countMet(ev: Evaluated[], manual: Record<string, boolean>): number {
  return ev.filter((e) => (e.auto ? e.auto.pass : manual[e.req.id])).length;
}

/**
 * Requirement list. Auto items show a text status (never color alone); manual items are checkboxes the
 * cadet ticks after reading. `words` lets the prompt editor say "מופיע/חסר" and the output box "עומד/לא עומד".
 */
export function CheckList({
  items,
  manual = {},
  onManual,
  words = ['עומד', 'לא עומד'],
}: {
  items: Evaluated[];
  manual?: Record<string, boolean>;
  onManual?: (id: string, v: boolean) => void;
  words?: [string, string];
}) {
  return (
    <ul class="checks">
      {items.map(({ req, auto }, i) =>
        auto ? (
          <li key={req.id} class={'check ' + (auto.pass ? 'is-pass' : 'is-fail')}>
            <span class={'status ' + (auto.pass ? 'status-ok' : 'status-bad')}>{auto.pass ? words[0] : words[1]}</span>
            <span class="check-text">
              {i + 1}. <Rich text={req.label} />
              <span class="check-detail">{auto.detail}</span>
            </span>
          </li>
        ) : (
          <li key={req.id} class="check is-manual">
            <label class="check-label">
              <input
                type="checkbox"
                checked={Boolean(manual[req.id])}
                onChange={(e) => onManual?.(req.id, (e.currentTarget as HTMLInputElement).checked)}
              />
              <span class="check-text">
                {i + 1}. <Rich text={req.label} />
                <span class="check-detail">{req.hint ?? 'סמן ידנית אם התוצר עומד בדרישה'}</span>
              </span>
            </label>
          </li>
        ),
      )}
    </ul>
  );
}

/** Renders text with its numbers classified against the source. Legend explains marks in words. */
export function NumberMarks({ index, text }: { index: NumberIndex; text: string }) {
  const r = checkNumbers(index, text);
  return (
    <div class="numbers">
      {r.unknown.length > 0 && (
        <div class="flag flag-warn" role="note">
          <strong>לא במסמך ולא נגזרים ממנו:</strong>{' '}
          {r.unknown.map((x) => (
            <mark class="num-unknown" key={x}>
              {x}
            </mark>
          ))}
          <br />
          סביר שהומצאו. בדוק מול המקור.
        </div>
      )}
      {r.derived.length > 0 && (
        <div class="flag flag-derived" role="note">
          <strong>נראים מחושבים ממספרים במסמך:</strong>{' '}
          {r.derived.map((x) => (
            <mark class="num-derived" key={x}>
              {x}
            </mark>
          ))}
          <br />
          ייתכן שהחישוב נכון, אבל בדוק אותו בעצמך לפני שאתה מעביר.
        </div>
      )}
      {!r.unknown.length && !r.derived.length && (
        <div class="flag flag-ok" role="note">
          כל המספרים בתוצר מופיעים במסמך. זה לא אומר שהתוצר נכון.
        </div>
      )}
      <div class="marked" aria-label="התוצר עם סימון מספרים">
        {r.segments.map((s, i) =>
          s.kind === 'unknown' ? (
            <mark key={i} class="num-unknown" title="לא נמצא במקור">
              {s.text}
            </mark>
          ) : s.kind === 'derived' ? (
            <mark key={i} class="num-derived" title="מחושב, לבדוק">
              {s.text}
            </mark>
          ) : (
            s.text
          ),
        )}
      </div>
    </div>
  );
}
