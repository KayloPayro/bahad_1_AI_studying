import type { CustomStep, OutputStep, Sample } from '@lumda/schema';
import type { StepProps } from '@lumda/engine';
import { Matrix, Snippet, evaluate, type MatrixCell, type MatrixRow } from '@lumda/ui';

interface Row {
  id: string;
  label: string;
}

type Result = 'pass' | 'fail' | 'na-none' | 'na-missing';

/** Result of one requirement in one round, from the text the cadet pasted for that round. */
function resultFor(step: OutputStep | undefined, text: string, reqId: string): Result {
  if (!step) return 'na-none';
  const ev = evaluate(step.requirements, text).find((e) => e.req.id === reqId);
  if (!ev?.auto) return 'na-none'; // not part of that round's checks
  if (!text.trim()) return 'na-missing';
  return ev.auto.pass ? 'pass' : 'fail';
}

/**
 * "מה נשמר בין הסבבים": for every property the rounds asked for, its status in each round. A property that
 * passed in an earlier round and fails in a later one is marked as broken.
 */
export function Progress({ step, content, ctx }: StepProps<CustomStep>) {
  const roundIds = (step.data?.rounds ?? []) as string[];
  const rows = (step.data?.rows ?? []) as Row[];
  const snippet = step.data?.snippet as Sample | undefined;

  const rounds = roundIds.map((id) => {
    const s = content.steps.find((x) => x.id === id);
    const text = String(ctx.stepData(id).text ?? '');
    return { step: s?.type === 'output' ? s : undefined, text };
  });

  let broken = 0;
  const matrix: MatrixRow[] = rows.map((row) => {
    let everPassed = false;
    let brokeAt = 0;
    const cells: MatrixCell[] = rounds.map((r, i) => {
      const head = `סבב ${i + 1}`;
      const res = resultFor(r.step, r.text, row.id);
      if (res === 'na-none') return { head, tone: 'na', text: 'לא נדרש' };
      if (res === 'na-missing') return { head, tone: 'na', text: 'לא הודבק' };
      if (res === 'pass') {
        everPassed = true;
        return { head, tone: 'ok', text: 'נמצא סימן' };
      }
      if (everPassed) {
        brokeAt ||= i + 1;
        return { head, tone: 'bad', text: 'נשבר' };
      }
      return { head, tone: 'bad', text: 'לא נמצא סימן' };
    });
    if (brokeAt) broken++;
    return { id: row.id, label: row.label, note: brokeAt ? `נמצא בסבב קודם ונעלם בסבב ${brokeAt}` : undefined, cells };
  });

  return (
    <div>
      <Matrix rows={matrix} label="מה נשמר בין הסבבים" />
      <p class="result-sum" aria-live="polite">
        {broken
          ? `תיקונים שנשברו בין סבבים: ${broken}. הדבק לכלי הנחיה שמחזירה אותם, או פתח שיחה חדשה כמו בדוגמה.`
          : 'לא נמצא תיקון שנשבר בין הסבבים.'}
      </p>
      <p class="note">הסימונים האוטומטיים מחפשים מילים וסימנים. הם לא מחליפים קריאה של הגרסה.</p>
      {snippet && <Snippet s={snippet} />}
    </div>
  );
}
