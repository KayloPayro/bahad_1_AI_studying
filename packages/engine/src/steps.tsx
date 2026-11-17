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
          נחשפו <strong class="num">{flipped.length}</strong> מתוך <span class="num">{step.cards.length}</span> קלפים.
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
      attach={doc && step.docId ? { label: 'המסמך', text: ctx.docText(step.docId) } : undefined}
      placeholder={step.placeholder}
      checked={Boolean(data.checked)}
      onChecked={(v) => setData({ checked: v })}
      onMet={(n) => step.metric && setMetric(step.metric, n)}
    />
  );
}

function OutputView({ step, data, setData, setMetric, ctx }: StepProps<OutputStep>) {
  return (
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
          {numbers && step.numbersDoc && <NumberMarks index={ctx.numberIndex(step.numbersDoc)} text={step.product.text} />}
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
            placeholder="מה הבעיה, ובאיזו פסקה במקור"
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
  const text = str(data.text);
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
      {step.library && (
        <div class="row">
          <button
            type="button"
            class="btn btn-primary"
            disabled={!text.trim()}
            onClick={() => {
              addToLibrary(ctx.identity.pn, { module: content.id, title: `${content.title}: ${step.title}`, text });
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
  const found = bools(data.found);
  const revealed = Boolean(data.revealed) || instructor;
  const id = useId();
  const n = Object.values(found).filter(Boolean).length;
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
            value={str(data.final)}
            onInput={(e) => setData({ final: (e.currentTarget as HTMLTextAreaElement).value })}
          />
        </div>
      )}
      {!revealed && (
        <div class="row">
          <button type="button" class="btn btn-primary" onClick={() => setData({ revealed: true })}>
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
                <label class="inline-check">
                  <input
                    type="checkbox"
                    checked={Boolean(found[i])}
                    onChange={(e) => {
                      const next = { ...found, [i]: (e.currentTarget as HTMLInputElement).checked };
                      setData({ found: next });
                      setMetric(step.metric, Object.values(next).filter(Boolean).length);
                    }}
                  />
                  איתרתי או וידאתי מול המקור
                </label>
              </li>
            ))}
          </ol>
          <p class="score-line" aria-live="polite">
            איתרת <strong class="num">{n}</strong> מתוך <span class="num">{step.items.length}</span>
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
