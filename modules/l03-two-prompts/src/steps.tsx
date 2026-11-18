import type { CustomStep, OutputStep } from '@lumda/schema';
import type { StepProps } from '@lumda/engine';
import { Matrix, evaluate, type MatrixCell, type MatrixRow } from '@lumda/ui';

const bools = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, boolean>) : {});

function outputStep(props: StepProps<CustomStep>, key: string): OutputStep | undefined {
  const id = String(props.step.data?.[key] ?? '');
  const s = props.content.steps.find((x) => x.id === id);
  return s?.type === 'output' ? s : undefined;
}

/** One attempt's result for one requirement: automatic sign, or the cadet's own tick for manual ones. */
function cellFor(head: string, step: OutputStep, props: StepProps<CustomStep>, reqId: string): MatrixCell {
  const data = props.ctx.stepData(step.id);
  const text = typeof data.text === 'string' ? data.text : '';
  if (!text.trim()) return { head, tone: 'na', text: 'לא הודבק' };
  const ev = evaluate(step.requirements, text).find((e) => e.req.id === reqId);
  if (!ev) return { head, tone: 'na', text: 'לא נבדק' };
  if (ev.auto) return ev.auto.pass ? { head, tone: 'ok', text: 'נמצא סימן' } : { head, tone: 'bad', text: 'לא נמצא סימן' };
  return bools(data.manual)[reqId] ? { head, tone: 'ok', text: 'סימנת' } : { head, tone: 'na', text: 'לא סימנת' };
}

/**
 * "השוואה: מה הגיע להודעה": the eight details of the commander's message, with the result of the one-sentence
 * attempt and of the six-component attempt side by side, and where each detail can enter the prompt.
 */
export function Compare(props: StepProps<CustomStep>) {
  const weak = outputStep(props, 'weak');
  const strong = outputStep(props, 'strong');
  if (!weak || !strong) return <p class="flag flag-bad">חסרים שלבי התוצר בקובץ התוכן.</p>;
  const notes = (props.step.data?.notes ?? {}) as Record<string, string>;
  const n = (k: string) => Number(props.metrics[k] ?? 0);

  const rows: MatrixRow[] = strong.requirements.map((r) => ({
    id: r.id,
    label: r.label,
    note: notes[r.id] ? `אפשר להכניס בהנחיה דרך: ${notes[r.id]}` : undefined,
    cells: [cellFor('משפט אחד', weak, props, r.id), cellFor('הנחיה מקצועית', strong, props, r.id)],
  }));

  return (
    <div>
      <p class="result-sum">
        הודעה ראשונה: <strong class="num">{n('weakMet')}</strong> מתוך <span class="num">{rows.length}</span>. אחרי
        ההנחיה המקצועית: <strong class="num">{n('strongMet')}</strong> מתוך <span class="num">{rows.length}</span>.
      </p>
      <Matrix rows={rows} label="שמונת הפרטים בשתי ההודעות" />
      <p class="note">הסימונים האוטומטיים מחפשים מילים ולא מבטיחים שהפרט נכתב נכון.</p>
    </div>
  );
}
