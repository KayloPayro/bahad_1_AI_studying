import { useEffect, useId, useState } from 'preact/hooks';
import type { CustomStep } from '@lumda/schema';
import type { StepProps } from '@lumda/engine';
import { CheckList, Matrix, NumberMarks, Snippet, toast, type MatrixRow } from '@lumda/ui';
import { auto, scoreShift, type ShiftConfig, type ShiftData } from './score';

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The shift: the messages arrive in the chat above this step over about 18 minutes (the step's own `messages`), and
 * everything the cadet submits happens here, so the clock and the chat are the same clock. The cadet works with the
 * AI tool in another tab and comes back to hand in two products: the interim update and the final brief.
 */
export function Shift(props: StepProps<CustomStep>) {
  const { step, data, setData, setMetric, metrics, ctx } = props;
  const cfg = step.data as unknown as ShiftConfig;
  const d = data as ShiftData;
  const base = useId();
  const [now, setNow] = useState(Date.now());
  const [numbers, setNumbers] = useState(false);

  // The shift starts when the cadet first opens this step.
  useEffect(() => {
    if (!d.t0) setData({ t0: Date.now() });
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sc = scoreShift(cfg, d);
  // Hand the rubric to the score. Only changed values are written, so this settles after one render.
  const values: Record<string, number> = {
    [cfg.interimMetric]: sc.interimFrac,
    [cfg.onTimeMetric]: sc.onTime ? 1 : 0,
    ...Object.fromEntries(sc.groups.map((g) => [g.metric, g.frac])),
  };
  const signature = JSON.stringify(values);
  useEffect(() => {
    for (const [k, v] of Object.entries(values)) if (metrics[k] !== v) setMetric(k, v);
  }, [signature]);

  const elapsed = d.t0 ? (d.finalAt ?? now) - d.t0 : 0;
  const manual = d.finalManual ?? {};
  const interimText = d.interimText ?? '';
  const finalText = d.finalText ?? '';
  const iev = auto(cfg.interim.requirements, interimText);
  const fev = auto(cfg.final.requirements, finalText);
  const finalMet = fev.filter((e) => (e.auto ? e.auto.pass : manual[e.req.id])).length;

  return (
    <div class="shift">
      <p class="result-sum" aria-live="off">
        זמן משמרת: <span class="clock">{mmss(elapsed)}</span> מתוך <span class="num">{cfg.final.limitMin}:00</span>
        {d.finalAt ? ' (התדריך הוגש)' : ''}
      </p>

      <details class="race-doc">
        <summary>דוגמה להנחיית פתיחה, אם אתה צריך</summary>
        <Snippet s={cfg.opening} />
      </details>

      <section class="shift-part" aria-labelledby={`${base}-i`}>
        <h3 id={`${base}-i`} class="race-title">
          עדכון ביניים למ״פ
        </h3>
        <p>כשהמ״פ מבקשת עדכון ביניים, כתוב אותו כאן (או הדבק את מה שהכלי ניסח) והגש. הוא בשתי שורות.</p>
        <div class="field">
          <label class="field-label" for={`${base}-it`}>
            העדכון שלך
          </label>
          <textarea
            id={`${base}-it`}
            class="textarea"
            rows={3}
            dir="auto"
            readOnly={sc.interimDone}
            value={interimText}
            onInput={(e) => setData({ interimText: (e.currentTarget as HTMLTextAreaElement).value, interimChecked: false })}
          />
        </div>
        {!sc.interimDone && (
          <div class="row">
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => (interimText.trim() ? setData({ interimChecked: true }) : toast('כתוב קודם את העדכון'))}
            >
              בדוק עדכון
            </button>
            {(cfg.interim.samples ?? []).map((s) => (
              <button
                key={s.label}
                type="button"
                class="btn btn-ghost"
                onClick={() => setData({ interimText: s.text, interimChecked: true })}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              class="btn btn-primary"
              disabled={!interimText.trim()}
              onClick={() => setData({ interimAt: Date.now() })}
            >
              הגש עדכון ביניים
            </button>
          </div>
        )}
        {d.interimChecked && !sc.interimDone && interimText.trim() && (
          <div class="result" aria-live="polite">
            <CheckList items={iev} words={['נמצא סימן', 'לא נמצא סימן']} />
          </div>
        )}
        {sc.interimDone && (
          <p class="result-sum" aria-live="polite">
            הוגש בדקה <strong class="num">{mmss((d.interimAt as number) - (d.t0 ?? 0))}</strong> של המשמרת.{' '}
            {sc.interimOnTime ? 'בתוך הזמן.' : 'אחרי הזמן שנקבע.'}
          </p>
        )}
      </section>

      <section class="shift-part" aria-labelledby={`${base}-f`}>
        <h3 id={`${base}-f`} class="race-title">
          תדריך סופי למ״פ
        </h3>
        <p>
          החלטה בשורה הראשונה, ההמלצה, מה שעלה מההודעות, ופעולות אימות עם אחראי לכל אחת. אחרי ההגשה התדריך ננעל.
        </p>
        <div class="field">
          <label class="field-label" for={`${base}-ft`}>
            התדריך שלך
          </label>
          <textarea
            id={`${base}-ft`}
            class="textarea"
            rows={11}
            dir="auto"
            readOnly={sc.finalDone}
            value={finalText}
            onInput={(e) => setData({ finalText: (e.currentTarget as HTMLTextAreaElement).value, finalChecked: false })}
          />
        </div>
        {!sc.finalDone && (
          <div class="row">
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => (finalText.trim() ? setData({ finalChecked: true }) : toast('כתוב קודם את התדריך'))}
            >
              בדוק מול הדרישות
            </button>
            {cfg.final.numbersDoc && (
              <button
                type="button"
                class="btn btn-secondary"
                onClick={() => (finalText.trim() ? setNumbers(true) : toast('כתוב קודם את התדריך'))}
              >
                בדוק מספרים מול ההודעות
              </button>
            )}
            {(cfg.final.samples ?? []).map((s) => (
              <button
                key={s.label}
                type="button"
                class="btn btn-ghost"
                onClick={() => setData({ finalText: s.text, finalChecked: true })}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {d.finalChecked && finalText.trim() && (
          <div class="result" aria-live="polite">
            <CheckList
              items={fev}
              manual={manual}
              onManual={(id, v) => !sc.finalDone && setData({ finalManual: { ...manual, [id]: v } })}
              words={['נמצא סימן', 'לא נמצא סימן']}
            />
            <p class="result-sum">
              סומנו <strong class="num">{finalMet}</strong> מתוך <span class="num">{fev.length}</span> הדרישות.
            </p>
            <p class="note">
              הסימון האוטומטי מחפש מילים ומספרים. הוא לא מבטיח שהדרישה קוימה: קרא את התדריך ובדוק את המשמעות.
            </p>
          </div>
        )}
        {numbers && cfg.final.numbersDoc && finalText.trim() && (
          <NumberMarks index={ctx.numberIndex(cfg.final.numbersDoc)} text={finalText} />
        )}
        {!sc.finalDone && (
          <div class="row">
            <button
              type="button"
              class="btn btn-primary"
              disabled={!finalText.trim()}
              onClick={() => setData({ finalAt: Date.now() })}
            >
              הגש תדריך סופי
            </button>
          </div>
        )}
        {sc.finalDone && (
          <p class="result-sum" aria-live="polite">
            התדריך הוגש אחרי <strong class="num">{mmss(elapsed)}</strong> דקות.{' '}
            {sc.onTime ? 'בתוך הזמן.' : `אחרי ${cfg.final.limitMin} דקות.`}
          </p>
        )}
        {!sc.finalDone && <p class="note">בלי הגשה, התדריך לא נכנס לציון.</p>}
      </section>
    </div>
  );
}

/**
 * "מה היה בתדריך": the six components of the rubric, each with what the cadet's own brief and interim update met,
 * the weight in the score, and the time check. Computed from the same data the score uses.
 */
export function Review(props: StepProps<CustomStep>) {
  const shiftId = String(props.step.data?.shift ?? '');
  const shiftStep = props.content.steps.find((s) => s.id === shiftId) as CustomStep | undefined;
  if (!shiftStep) return <p class="flag flag-bad">שלב המשמרת חסר בקובץ התוכן.</p>;
  const cfg = shiftStep.data as unknown as ShiftConfig;
  const sc = scoreShift(cfg, props.ctx.stepData(shiftId) as ShiftData);

  const cell = (head: string, met: number, total: number, done: boolean) =>
    !done
      ? { head, tone: 'na' as const, text: 'לא הוגש' }
      : met === total
        ? { head, tone: 'ok' as const, text: total > 1 ? `נמצא סימן, ${met} מתוך ${total}` : 'נמצא סימן' }
        : met === 0
          ? { head, tone: 'bad' as const, text: 'לא נמצא סימן' }
          : { head, tone: 'na' as const, text: `חלקי, ${met} מתוך ${total}` };

  const rows: MatrixRow[] = [
    ...sc.groups.map((g) => ({
      id: g.key,
      label: g.label,
      note: `משקל בציון: ${g.weight}%`,
      cells: [cell('בתדריך שלך', g.met, g.total, sc.finalDone)],
    })),
    {
      id: 'interim',
      label: '**עדכון ביניים:** שתי שורות, ובתוך הזמן',
      note: `משקל בציון: ${props.content.score?.parts.find((p) => p.metric === cfg.interimMetric)?.weight ?? 0}%`,
      cells: [cell('העדכון שלך', sc.interimMet + (sc.interimOnTime ? 1 : 0), sc.interimTotal + 1, sc.interimDone)],
    },
    {
      id: 'time',
      label: `**זמן כולל:** התדריך הוגש בתוך ${cfg.final.limitMin} דקות`,
      note: `משקל בציון: ${props.content.score?.parts.find((p) => p.metric === cfg.onTimeMetric)?.weight ?? 0}%`,
      cells: [
        sc.finalDone
          ? { head: 'ההגשה שלך', tone: sc.onTime ? 'ok' : 'bad', text: `${Math.round((sc.finalMinutes ?? 0) * 10) / 10} דקות` }
          : { head: 'ההגשה שלך', tone: 'na', text: 'לא הוגש' },
      ],
    },
  ];

  return (
    <div>
      <Matrix rows={rows} label="רכיבי התדריך והציון" />
      <p class="note">
        הסימונים האוטומטיים מחפשים מילים ומספרים. שני סעיפים נבדקו לפי מה שסימנת בעצמך אחרי קריאה. מה שלא סומן בתדריך שלך
        יכול עדיין להיות כתוב בדרך אחרת: קרא אותו שוב מול הרשימה.
      </p>
    </div>
  );
}
