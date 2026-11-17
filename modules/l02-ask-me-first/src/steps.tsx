import type { CardsStep, CustomStep } from '@lumda/schema';
import type { StepProps } from '@lumda/engine';
import { FlipCard } from '@lumda/ui';

const bools = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, boolean>) : {});

function cardsOf(props: StepProps<CustomStep>): CardsStep | undefined {
  const id = String(props.step.data?.cardsStep ?? '');
  const s = props.content.steps.find((x) => x.id === id);
  return s?.type === 'cards' ? s : undefined;
}

/**
 * "מה הכלי לא שאל": the cards left closed in the questions round, face up, each with "I added it myself".
 * Produces addedCards and coverage (asked + added).
 */
export function Unasked(props: StepProps<CustomStep>) {
  const { step, data, setData, setMetric, ctx } = props;
  const cardsStep = cardsOf(props);
  if (!cardsStep) return <p class="flag flag-bad">חסר שלב הקלפים בקובץ התוכן.</p>;
  const flipped = (ctx.stepData(cardsStep.id).flipped as string[] | undefined) ?? [];
  const unasked = cardsStep.cards.filter((c) => !flipped.includes(c.id));
  const added = bools(data.added);

  if (!unasked.length) {
    return (
      <p class="flag flag-ok" role="note">
        הכלי שאל על כל שמונת הקלפים. ובכל זאת: האם היית עונה על כולן בלי הכרטיס? מה שבראש שלך, הכלי לא רואה.
      </p>
    );
  }

  const update = (next: Record<string, boolean>) => {
    setData({ added: next });
    const n = unasked.filter((c) => next[c.id]).length;
    if (step.metric) setMetric(step.metric, n);
    setMetric('coverage', flipped.length + n);
  };

  return (
    <div>
      <p class="result-sum">
        הכלי שאל על <strong class="num">{flipped.length}</strong> קלפים. נשארו סגורים{' '}
        <strong class="num">{unasked.length}</strong>:
      </p>
      <div class="cards-grid">
        {unasked.map((c) => (
          <div key={c.id} class="unasked">
            <FlipCard card={c} flipped disabled />
            <label class="inline-check">
              <input
                type="checkbox"
                checked={Boolean(added[c.id])}
                onChange={(e) => update({ ...added, [c.id]: (e.currentTarget as HTMLInputElement).checked })}
              />
              הוספתי בעצמי
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Three bars (quick round, questions round, final) plus revealed-vs-added. Bars carry their numbers in text. */
export function Summary({ step, metrics }: StepProps<CustomStep>) {
  const total = Number(step.data?.total ?? 8);
  const n = (k: string) => Math.max(0, Math.min(total, Number(metrics[k] ?? 0)));
  const rows = [
    { label: 'הסבב המהיר', value: n('quickMet'), note: 'אילוצים שהלו״ז קיים' },
    { label: 'סבב השאלות', value: n('askedCards'), note: 'אילוצים שהכלי קיבל דרך שאלות' },
    { label: 'הגרסה הסופית', value: n('finalMet'), note: 'אילוצים שהלו״ז הסופי קיים' },
  ];
  const asked = n('askedCards');
  const added = Math.max(0, n('coverage') - asked);
  return (
    <div class="summary">
      <ul class="bars" aria-label="אילוצים בכל סבב">
        {rows.map((r) => (
          <li key={r.label} class="bar-row">
            <span class="bar-label">
              {r.label}
              <span class="bar-note">{r.note}</span>
            </span>
            <span class="bar" aria-hidden="true">
              <span class="bar-fill" style={{ transform: `scaleX(${r.value / total})` }} />
            </span>
            <span class="bar-val num">
              {r.value} מתוך {total}
            </span>
          </li>
        ))}
      </ul>
      <div class="split" aria-label="מי חשף את הקלפים">
        <div class="split-cell">
          <span class="split-n clock">{asked}</span>
          <span class="split-l">קלפים שהכלי חשף בשאלות</span>
        </div>
        <div class="split-cell">
          <span class="split-n clock">{added}</span>
          <span class="split-l">קלפים שהוספת בעצמך</span>
        </div>
        <div class="split-cell">
          <span class="split-n clock">{Math.max(0, total - asked - added)}</span>
          <span class="split-l">לא נמסרו לכלי</span>
        </div>
      </div>
    </div>
  );
}
