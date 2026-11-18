import { useId, useState } from 'preact/hooks';
import type {
  BonusStep,
  CardsStep,
  ChecklistStep,
  DocStep,
  FindingsStep,
  FreeTextStep,
  KeyStep,
  OutputStep,
  PromptStep,
  TextStep,
} from '@lumda/schema';
import {
  DocViewer,
  FlipCard,
  NumberMarks,
  OutputBox,
  PromptEditor,
  Rich,
  Snippet,
  copyText,
  toast,
  useInstructor,
} from '@lumda/ui';
import { addToLibrary } from './library';
import type { StepComponent, StepProps } from './types';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const bools = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, boolean>) : {});

function DocView({ step, content, data, setData }: StepProps<DocStep>) {
  const doc = content.docs?.[step.docId];
  if (!doc) return <p class="flag flag-bad">המסמך "{step.docId}" חסר בקובץ התוכן.</p>;
  return (
    <DocViewer
      doc={doc}
      highlights={Array.isArray(data.highlights) ? (data.highlights as number[]) : []}
      onHighlights={(h) => setData({ highlights: h })}
    />
  );
}

function CardsView({ step, data, setData, setMetric }: StepProps<CardsStep>) {
  const flipped: string[] = Array.isArray(data.flipped) ? (data.flipped as string[]) : [];
  const set = (ids: string[]) => {
    setData({ flipped: ids });
    if (step.metric) setMetric(step.metric, ids.length);
    if (step.saveAs) setMetric(step.saveAs, ids);
  };
  return (
    <div>
      {step.snippets?.map((s) => (
        <Snippet key={s.label} s={s} />
      ))}
      {step.mode === 'all' && flipped.length < step.cards.length && (
        <div class="row">
          <button type="button" class="btn btn-primary" onClick={() => set(step.cards.map((c) => c.id))}>
            חשוף את כל הקלפים
          </button>
        </div>
      )}
      <div class="cards-grid">
        {step.cards.map((c) => {
          const on = flipped.includes(c.id);
          return (
            <FlipCard
              key={c.id}
              card={c}
              flipped={on}
              hint={step.mode === 'all' ? 'סגור' : 'הפוך כשהכלי שאל על זה'}
              disabled={step.mode === 'all'}
              onToggle={() => set(on ? flipped.filter((x) => x !== c.id) : [...flipped, c.id])}
            />
          );
        })}
      </div>
      {step.mode === 'flip' && (
        <p class="result-sum" aria-live="polite">
          נחשפו <strong class="num">{flipped.length}</strong> מתוך{' '}
          <span class="num">{step.cards.length}</span> קלפים.
        </p>
      )}
    </div>
  );
}

function PromptView({ step, content, data, setData, setMetric, ctx }: StepProps<PromptStep>) {
  const doc = step.docId ? content.docs?.[step.docId] : undefined;
  return (
    <PromptEditor
      value={str(data.text)}
      onChange={(v) => setData({ text: v })}
      requirements={step.requirements}
      samples={step.samples}
      askFirst={step.askFirst}
      onAskFirst={ctx.askFirst}
      attach={doc && step.docId ? { label: step.attachLabel ?? 'המסמך', text: ctx.docText(step.docId) } : undefined}
      sameChat={step.sameChat}
      placeholder={step.placeholder}
      checked={Boolean(data.checked)}
      onChecked={(v) => setData({ checked: v })}
      onMet={(n) => step.metric && setMetric(step.metric, n)}
    />
  );
}

function OutputView({ step, data, setData, setMetric, ctx }: StepProps<OutputStep>) {
  return (
    <div>
      {step.snippets?.map((s) => (
        <Snippet key={s.label} s={s} />
      ))}
      <OutputBox
        value={str(data.text)}
        onChange={(v) => setData({ text: v })}
        requirements={step.requirements}
        samples={step.samples}
        numberIndex={step.numbersDoc ? ctx.numberIndex(step.numbersDoc) : undefined}
        manual={bools(data.manual)}
        onManual={(id, v) => setData({ manual: { ...bools(data.manual), [id]: v } })}
        checked={Boolean(data.checked)}
        onChecked={(v) => setData({ checked: v })}
        onMet={(n) => step.metric && setMetric(step.metric, n)}
      />
    </div>
  );
}

function FindingsView({ step, data, setData, ctx }: StepProps<FindingsStep>) {
  const list: string[] = Array.isArray(data.items) ? (data.items as string[]) : [];
  const [numbers, setNumbers] = useState(false);
  const base = useId();
  return (
    <div>
      {step.product && (
        <figure class="product">
          <figcaption class="product-title">{step.product.title}</figcaption>
          <div class="product-text">{step.product.text}</div>
          {step.numbersDoc && (
            <div class="row">
              <button type="button" class="btn btn-secondary" onClick={() => setNumbers(true)}>
                בדוק מספרים מול המסמך
              </button>
            </div>
          )}
          {numbers && step.numbersDoc && (
            <NumberMarks index={ctx.numberIndex(step.numbersDoc)} text={step.product.text} />
          )}
        </figure>
      )}
      {Array.from({ length: step.count }, (_, i) => (
        <div class="field" key={i}>
          <label class="field-label" for={`${base}-${i}`}>
            {i < step.count - 1 || step.count === 1 ? `ממצא ${i + 1}` : 'ממצאים נוספים'}
          </label>
          <textarea
            id={`${base}-${i}`}
            class="textarea"
            rows={2}
            dir="auto"
            value={list[i] ?? ''}
            placeholder="מה כתוב בתוצר, מה כתוב במקור, ובאיזו פסקה"
            onInput={(e) => {
              const next = [...list];
              next[i] = (e.currentTarget as HTMLTextAreaElement).value;
              setData({ items: next });
            }}
          />
        </div>
      ))}
      {step.hints && (
        <p class="note">
          <Rich text={step.hints} />
        </p>
      )}
    </div>
  );
}

function ChecklistView({ step, data, setData, setMetric }: StepProps<ChecklistStep>) {
  const checked = bools(data.checked);
  return (
    <div>
      {step.prompt && (
        <p>
          <Rich text={step.prompt} />
        </p>
      )}
      <ul class="checks">
        {step.items.map((it) => (
          <li key={it.id} class="check is-manual">
            <label class="check-label">
              <input
                type="checkbox"
                checked={Boolean(checked[it.id])}
                onChange={(e) => {
                  const next = { ...checked, [it.id]: (e.currentTarget as HTMLInputElement).checked };
                  setData({ checked: next });
                  setMetric(step.metric, Object.values(next).filter(Boolean).length);
                }}
              />
              <span class="check-text">
                <Rich text={it.label} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p class="result-sum" aria-live="polite">
        סומנו <strong class="num">{Object.values(checked).filter(Boolean).length}</strong> מתוך{' '}
        <span class="num">{step.items.length}</span>.
      </p>
    </div>
  );
}

function TextView({ step }: StepProps<TextStep>) {
  return (
    <div class="snippets">
      {step.snippets?.map((s) => (
        <Snippet key={s.label} s={s} />
      ))}
    </div>
  );
}

function FreeTextView({ step, content, data, setData, ctx }: StepProps<FreeTextStep>) {
  const id = useId();
  const prefill = step.prefillFrom ? str(ctx.stepData(step.prefillFrom).text) : '';
  const text = typeof data.text === 'string' ? data.text : prefill;
  return (
    <div>
      {step.snippets?.map((s) => (
        <Snippet key={s.label} s={s} />
      ))}
      <div class="field">
        <label class="field-label" for={id}>
          {step.label}
        </label>
        <textarea
          id={id}
          class="textarea"
          rows={step.rows ?? 6}
          dir="auto"
          value={text}
          placeholder={step.placeholder ?? 'הדבק או כתוב כאן'}
          onInput={(e) => setData({ text: (e.currentTarget as HTMLTextAreaElement).value })}
        />
      </div>
      {step.copyable && (
        <div class="row">
          <button
            type="button"
            class="btn btn-secondary"
            onClick={async () => {
              if (!text.trim()) return toast('כתוב קודם את התיקון');
              toast((await copyText(text)) ? 'הועתק' : 'לא הצלחתי להעתיק');
            }}
          >
            העתק לכלי
          </button>
        </div>
      )}
      {step.library && (
        <div class="row">
          <button
            type="button"
            class="btn btn-primary"
            disabled={!text.trim()}
            onClick={() => {
              addToLibrary(ctx.identity.pn, {
                module: content.id,
                title: `${content.title}: ${step.title}`,
                text,
              });
              setData({ saved: true });
              toast('נשמר בספריית ההנחיות שלך');
            }}
          >
            {data.saved ? 'נשמר. שמור שוב' : 'שמור בספריית ההנחיות'}
          </button>
        </div>
      )}
    </div>
  );
}

function KeyView({ step, data, setData, setMetric }: StepProps<KeyStep>) {
  const instructor = useInstructor();
  const revealed = Boolean(data.revealed) || instructor;
  const id = useId();
  const declId = useId();
  const total = step.items.length;
  const declared = typeof data.declared === 'number' ? data.declared : undefined;
  const n = declared ?? 0;
  const levels = step.levels ?? [];
  const level = levels.find((l) => n >= l.min)?.label;
  return (
    <div>
      {step.final && (
        <div class="field">
          <label class="field-label" for={id}>
            {step.final.label}
          </label>
          <textarea
            id={id}
            class="textarea"
            rows={step.final.rows ?? 7}
            dir="auto"
            readOnly={Boolean(data.revealed)}
            value={str(data.final)}
            onInput={(e) => setData({ final: (e.currentTarget as HTMLTextAreaElement).value })}
          />
          {Boolean(data.revealed) && <p class="note">הגרסה ננעלה כשהצגת את המפתח, כדי שההשוואה תהיה כנה.</p>}
        </div>
      )}
      {!data.revealed && (
        <div class="field">
          <label class="field-label" for={declId}>
            כמה מהבעיות בגרסה של הסמ״פ מצאת בעצמך, לפני שראית את המפתח?
          </label>
          <select
            id={declId}
            class="input"
            value={declared === undefined ? '' : String(declared)}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value;
              setData({ declared: v === '' ? undefined : Number(v) });
            }}
          >
            <option value="">בחר מספר</option>
            {Array.from({ length: total + 1 }, (_, i) => (
              <option key={i} value={String(i)}>
                {i}
              </option>
            ))}
          </select>
          <p class="note">את המספר אי אפשר לשנות אחרי שהמפתח נפתח. הוא קובע את הציון בחלק הזה.</p>
        </div>
      )}
      {!revealed && (
        <div class="row">
          <button
            type="button"
            class="btn btn-primary"
            disabled={declared === undefined}
            onClick={() => {
              setData({ revealed: true });
              setMetric(step.metric, declared ?? 0);
            }}
          >
            הצג מפתח
          </button>
        </div>
      )}
      {revealed && (
        <div class="key">
          {step.note && (
            <p class="note">
              <Rich text={step.note} />
            </p>
          )}
          <ol class="key-list">
            {step.items.map((k, i) => (
              <li key={i} class="key-item">
                <h4 class="key-title">
                  <span class="num">{i + 1}.</span> {k.title}
                  <span class={'tag ' + (k.safety ? 'tag-bad' : 'tag-warn')}>
                    {k.tag}
                    {k.safety ? ' · בטיחות' : ''}
                  </span>
                </h4>
                <dl class="key-dl">
                  <dt>במקור</dt>
                  <dd>{k.src}</dd>
                  <dt>בתוצר</dt>
                  <dd>{k.ai}</dd>
                  <dt>למה זה חשוב</dt>
                  <dd>{k.why}</dd>
                </dl>
              </li>
            ))}
          </ol>
          <p class="score-line" aria-live="polite">
            דיווחת שמצאת <strong class="num">{n}</strong> מתוך <span class="num">{total}</span> לפני המפתח
            {level ? `. רמה: ${level}.` : '.'}
          </p>
          {step.example && (
            <section class="example">
              <h4>{step.example.title}</h4>
              {step.example.paragraphs.map((p, i) => (
                <p key={i}>
                  <Rich text={p} />
                </p>
              ))}
            </section>
          )}
          {step.discussion && (
            <section>
              <h4>שאלות לדיון</h4>
              <ul class="list">
                {step.discussion.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>
          )}
          {step.message && (
            <p class="message">
              <Rich text={step.message} />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BonusView({ step }: StepProps<BonusStep>) {
  return (
    <section class="bonus" aria-label="בונוס לקצין מטה">
      <h3 class="bonus-title">למה זה חשוב לקצין מטה</h3>
      {step.lines.map((l, i) => (
        <p key={i}>
          <Rich text={l} />
        </p>
      ))}
    </section>
  );
}

const Nothing: StepComponent = () => null;

export const BUILTIN_STEPS: Record<string, StepComponent> = {
  chat: Nothing,
  doc: DocView,
  cards: CardsView,
  prompt: PromptView,
  output: OutputView,
  findings: FindingsView,
  checklist: ChecklistView,
  text: TextView,
  freetext: FreeTextView,
  key: KeyView,
  bonus: BonusView,
};
