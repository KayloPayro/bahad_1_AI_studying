import type { CustomStep } from '@lumda/schema';
import type { StepProps } from '@lumda/engine';
import { Matrix, type MatrixCell, type MatrixRow } from '@lumda/ui';

interface Item {
  time: string;
  end: string;
  label: string;
  /** Regex (flag u) that finds the item's line in the plan. */
  match: string;
  /** A fixed meeting, a protected conversation, or the safety task the priorities put first. */
  fixed?: boolean;
  note?: string;
}

const hhmm = (s: string) => {
  const m = /(\d{1,2}):(\d{2})/.exec(s);
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : '';
};

/** The line of the plan that belongs to an item: among matching lines, the one at the item's time, else the first. */
function lineFor(lines: string[], item: Item): string | undefined {
  const re = new RegExp(item.match, 'u');
  const hits = lines.filter((l) => re.test(l));
  return hits.find((l) => hhmm(l) === item.time) ?? hits[0];
}

/**
 * "השוואה להצעה אחת אפשרית": for every item the priorities protect, was it left at its time in the plan the cadet
 * pasted? Flexible tasks are shown for comparison only. The reading is by line (time and name together), so
 * it is a sign and not a verdict.
 */
export function Compare({ step, ctx }: StepProps<CustomStep>) {
  const finalId = String(step.data?.final ?? '');
  const plan = String(ctx.stepData(finalId).text ?? '');
  const items = (step.data?.items ?? []) as Item[];
  const lines = plan.split('\n');

  let moved = 0;
  const rows: MatrixRow[] = items.map((item) => {
    const head = 'בתוכנית שלך';
    const label = `${item.time} עד ${item.end}: ${item.label}`;
    let cell: MatrixCell;
    if (!plan.trim()) cell = { head, tone: 'na', text: 'לא הודבקה תוכנית' };
    else {
      const line = lineFor(lines, item);
      const t = line ? hhmm(line) : '';
      if (!line) cell = { head, tone: item.fixed ? 'bad' : 'na', text: 'לא נמצא בתוכנית' };
      else if (t === item.time) cell = { head, tone: 'ok', text: item.fixed ? 'נשאר במקומו' : 'באותה שעה' };
      else if (item.fixed) {
        moved++;
        cell = { head, tone: 'bad', text: t ? `הוזז ל-${t}` : 'בלי שעה' };
      } else cell = { head, tone: 'na', text: t ? `שובץ ב-${t}` : 'בלי שעה' };
    }
    return { id: item.time + item.label, label, note: item.note, cells: [cell] };
  });

  const fixed = rows.filter((_, i) => items[i]!.fixed);
  const kept = fixed.filter((r) => r.cells[0]!.tone === 'ok').length;

  return (
    <div>
      {plan.trim() && (
        <p class="result-sum" aria-live="polite">
          פריטים שהעדיפויות קבעו להם מקום: <strong class="num">{kept}</strong> מתוך <span class="num">{fixed.length}</span>{' '}
          נשארו במקומם. הוזזו: <strong class="num">{moved}</strong>.
        </p>
      )}
      <Matrix rows={rows} label="השוואה להצעה אחת אפשרית" />
      <p class="note">
        הקריאה מחפשת שעה ושם באותה שורה. שורה שכתובה אחרת לא תזוהה, ופריט גמיש ששובץ בשעה אחרת עדיין יכול להיות
        שיבוץ טוב.
      </p>
    </div>
  );
}
