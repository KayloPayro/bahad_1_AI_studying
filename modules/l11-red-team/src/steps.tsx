import type { CustomStep } from '@lumda/schema';
import type { StepProps } from '@lumda/engine';
import { Matrix, type MatrixCell, type MatrixRow } from '@lumda/ui';

const bools = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, boolean>) : {});

function visited(props: StepProps<CustomStep>, id: string): boolean {
  return Object.keys(props.ctx.stepData(id)).length > 0;
}

/**
 * "מה הוסיפה הבקשה המכוונת": each weakness of the plan and whether it came up in the general question (round A)
 * and in the red-team requests (round B). Only what the cadet ticked is shown. It is an observation, not a score.
 */
export function Compare(props: StepProps<CustomStep>) {
  const aId = String(props.step.data?.a ?? '');
  const bId = String(props.step.data?.b ?? '');
  const rows = (props.step.data?.rows ?? []) as { id: string; label: string }[];
  const a = bools(props.ctx.stepData(aId).checked);
  const b = bools(props.ctx.stepData(bId).checked);
  const seenA = visited(props, aId);
  const seenB = visited(props, bId);

  const cell = (head: string, seen: boolean, v: boolean | undefined): MatrixCell =>
    !seen ? { head, tone: 'na', text: 'לא סומן' } : v ? { head, tone: 'ok', text: 'עלתה' } : { head, tone: 'bad', text: 'לא עלתה' };

  const matrix: MatrixRow[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    cells: [cell('סבב א׳, בקשה כללית', seenA, a[r.id]), cell('סבב ב׳, צוות אדום', seenB, b[r.id])],
  }));
  const count = (m: Record<string, boolean>) => rows.filter((r) => m[r.id]).length;
  const neither = rows.filter((r) => !a[r.id] && !b[r.id]).length;

  return (
    <div>
      <p class="result-sum" aria-live="polite">
        בסבב א׳ עלו <strong class="num">{count(a)}</strong> מתוך <span class="num">{rows.length}</span> חולשות. בסבב ב׳ עלו{' '}
        <strong class="num">{count(b)}</strong> מתוך <span class="num">{rows.length}</span>.
        {neither > 0 && (
          <>
            {' '}
            חולשות שלא עלו באף סבב: <strong class="num">{neither}</strong>.
          </>
        )}
      </p>
      <Matrix rows={matrix} label="החולשות של התוכנית בשני הסבבים" />
      <p class="note">
        המספרים משתנים מכלי לכלי ומשיחה לשיחה, והם אינם ציון. ניסיון נוסף יכול להעלות חולשה אחרת.
      </p>
    </div>
  );
}
