import { useEffect, useId, useMemo, useState } from 'preact/hooks';
import type { CustomStep, Sample } from '@lumda/schema';
import { fillDates } from '@lumda/checkers';
import { Rich, Snippet, copyText, toast } from '@lumda/ui';
import type { StepComponent, StepProps } from './types';

/**
 * Step types several lessons share. They are `custom` steps in content.json (name "x-…", settings in `data`),
 * so the JSON schema stays the same and a lesson needs no code of its own to use them.
 */

const rec = <T,>(v: unknown): Record<string, T> => (v && typeof v === 'object' ? (v as Record<string, T>) : {});
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/* ------------------------------------------------------------------ x-quiz */

interface QuizQuestion {
  id: string;
  q: string;
  /** Shown above the question, e.g. the case being judged. */
  context?: string;
  kind?: 'choice' | 'text';
  options?: string[];
  /** choice: index of the recommended option. */
  answer?: number;
  /** text: a regex (flags iu) that a matching answer must satisfy. */
  accept?: string;
  /** text: the expected answer, shown after checking. */
  expected?: string;
  /** Adds a button that copies the question text, e.g. to paste it into a tool. */
  copy?: boolean;
  /** Asks for a one-line reason before the answer can be checked. The reason is not scored. */
  rationale?: boolean;
  why: string;
}

/**
 * Questions with a fixed answer: choose an option, or type a short answer that is compared by pattern.
 * Nothing is revealed until every question is answered; after "בדוק" the answers lock.
 * data: { questions, metric via step.metric, words?: [ok, bad], checkLabel?, note? }
 */
export function Quiz({ step, data, setData, setMetric }: StepProps<CustomStep>) {
  const base = useId();
  const qs = (step.data?.questions ?? []) as QuizQuestion[];
  const words = (step.data?.words as [string, string] | undefined) ?? ['נכון', 'לא נכון'];
  const answers = rec<string | number>(data.answers);
  const notes = rec<string>(data.notes);
  const done = Boolean(data.done);
  const retry = Boolean(step.data?.retry);
  const isRight = (q: QuizQuestion) =>
    q.kind === 'text'
      ? Boolean(q.accept && new RegExp(q.accept, 'iu').test(String(answers[q.id] ?? '')))
      : answers[q.id] === q.answer;
  const answered = (q: QuizQuestion) =>
    q.kind === 'text' ? String(answers[q.id] ?? '').trim() !== '' : typeof answers[q.id] === 'number';
  const ready = qs.every((q) => answered(q) && (!q.rationale || (notes[q.id] ?? '').trim() !== ''));
  const right = qs.filter(isRight).length;

  return (
    <div class="quiz">
      {qs.map((q, n) => {
        const ok = isRight(q);
        return (
          <fieldset key={q.id} class="quiz-q" disabled={done}>
            <legend class="quiz-legend">
              <span class="num">{n + 1}.</span> <Rich text={q.q} />
            </legend>
            {q.copy && (
              <div class="row">
                <button
                  type="button"
                  class="btn btn-ghost btn-small"
                  onClick={async () => toast((await copyText(q.q)) ? 'הועתק' : 'לא הצלחתי להעתיק')}
                >
                  העתק את השאלה
                </button>
              </div>
            )}
            {q.context && (
              <p class="quiz-context">
                <Rich text={q.context} />
              </p>
            )}
            {q.kind === 'text' ? (
              <input
                class="input"
                dir="auto"
                aria-label={`תשובה לשאלה ${n + 1}`}
                value={String(answers[q.id] ?? '')}
                onInput={(e) => setData({ answers: { ...answers, [q.id]: (e.currentTarget as HTMLInputElement).value } })}
              />
            ) : (
              <ul class="checks">
                {(q.options ?? []).map((o, i) => (
                  <li key={i} class="check is-manual">
                    <label class="check-label">
                      <input
                        type="radio"
                        name={`${base}-${q.id}`}
                        checked={answers[q.id] === i}
                        onChange={() => setData({ answers: { ...answers, [q.id]: i } })}
                      />
                      <span class="check-text">
                        <Rich text={o} />
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {q.rationale && (
              <div class="field">
                <label class="field-label" for={`${base}-${q.id}-n`}>
                  נמק בשורה אחת
                </label>
                <input
                  id={`${base}-${q.id}-n`}
                  class="input"
                  dir="auto"
                  value={notes[q.id] ?? ''}
                  onInput={(e) => setData({ notes: { ...notes, [q.id]: (e.currentTarget as HTMLInputElement).value } })}
                />
              </div>
            )}
            {done && (
              <div class="quiz-result" aria-live="polite">
                <span class={'status ' + (ok ? 'status-ok' : 'status-bad')}>{ok ? words[0] : words[1]}</span>
                <p>
                  {q.kind === 'text' ? (
                    <>
                      <strong>התשובה הצפויה:</strong> {q.expected}
                    </>
                  ) : (
                    <>
                      <strong>התשובה המומלצת:</strong> <Rich text={(q.options ?? [])[q.answer ?? 0] ?? ''} />
                    </>
                  )}
                </p>
                <p>
                  <Rich text={q.why} />
                </p>
              </div>
            )}
          </fieldset>
        );
      })}
      {!done && (
        <div class="row">
          <button
            type="button"
            class="btn btn-primary"
            disabled={!ready}
            onClick={() => {
              setData({ done: true });
              if (step.metric) setMetric(step.metric, right);
            }}
          >
            {String(step.data?.checkLabel ?? 'בדוק תשובות')}
          </button>
        </div>
      )}
      {!done && !ready && <p class="note">ענה על כל השאלות כדי לבדוק. התשובות נועלות אחרי הבדיקה.</p>}
      {done && (
        <p class="result-sum" aria-live="polite">
          {words[0]}: <strong class="num">{right}</strong> מתוך <span class="num">{qs.length}</span>.
        </p>
      )}
      {done && retry && right < qs.length && (
        <div class="row">
          <button type="button" class="btn btn-secondary" onClick={() => setData({ done: false })}>
            נסה שוב
          </button>
        </div>
      )}
      {done && typeof step.data?.note === 'string' && <p class="note">{step.data.note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ x-stopwatch */

interface RaceTask {
  id: string;
  title: string;
  /** What the task is. */
  text: string;
  /** Docs shown as the material (manual) and attached to the prompt (AI). */
  docIds?: string[];
  /** Prompt for the AI run; the docs are appended to it when copying. */
  prompt?: string;
  /** What the cadet reports at the end of each run. */
  report: { kind: 'text' | 'count'; label: string; max?: number };
  /** Shown after both runs. */
  key?: { text: string; items?: string[] };
}

interface RunTimes {
  manual?: number;
  ai?: number;
}

/**
 * Two timed runs of the same task, by hand and with an AI tool. The clock covers everything the cadet does,
 * including opening the tool and checking the result. The score only asks that both runs were done.
 * data: { tasks, note? }, metric = number of tasks with both runs timed.
 */
export function Stopwatch({ step, content, data, setData, setMetric, ctx }: StepProps<CustomStep>) {
  const tasks = (step.data?.tasks ?? []) as RaceTask[];
  const times = rec<RunTimes>(data.times);
  const reports = rec<string>(data.reports);
  const [run, setRun] = useState<{ id: string; mode: 'manual' | 'ai'; at: number } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [run]);

  const both = (id: string) => times[id]?.manual !== undefined && times[id]?.ai !== undefined;
  const bothCount = tasks.filter((t) => both(t.id)).length;

  const stop = () => {
    if (!run) return;
    const sec = Math.max(1, Math.round((Date.now() - run.at) / 1000));
    const next = { ...times, [run.id]: { ...times[run.id], [run.mode]: sec } };
    setData({ times: next });
    setRun(null);
    if (step.metric) setMetric(step.metric, tasks.filter((x) => next[x.id]?.manual !== undefined && next[x.id]?.ai !== undefined).length);
  };

  return (
    <div class="race">
      {tasks.map((t) => {
        const tm = times[t.id] ?? {};
        const aiPrompt = [t.prompt, ...(t.docIds ?? []).map((d) => ctx.docText(d))].filter(Boolean).join('\n\n');
        const sample: Sample = { label: 'ההנחיה לריצה עם AI', text: aiPrompt };
        return (
          <section key={t.id} class="race-task" aria-label={t.title}>
            <h3 class="race-title">{t.title}</h3>
            <p>
              <Rich text={t.text} />
            </p>
            {(t.docIds ?? []).map((d) => {
              const doc = content.docs?.[d];
              return doc ? (
                <details key={d} class="race-doc">
                  <summary>{doc.title}</summary>
                  {doc.paragraphs.map((p, i) => (
                    <p key={i}>
                      <span class="num">{i + 1}.</span> <strong>{p.title}.</strong> {p.text}
                    </p>
                  ))}
                </details>
              ) : null;
            })}
            <div class="field">
              <label class="field-label" for={`rep-${t.id}`}>
                {t.report.label}
              </label>
              {t.report.kind === 'count' ? (
                <select
                  id={`rep-${t.id}`}
                  class="input"
                  value={reports[t.id] ?? ''}
                  onChange={(e) => setData({ reports: { ...reports, [t.id]: (e.currentTarget as HTMLSelectElement).value } })}
                >
                  <option value="">בחר מספר</option>
                  {Array.from({ length: (t.report.max ?? 8) + 1 }, (_, i) => (
                    <option key={i} value={String(i)}>
                      {i}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  id={`rep-${t.id}`}
                  class="textarea"
                  rows={3}
                  dir="auto"
                  value={reports[t.id] ?? ''}
                  onInput={(e) => setData({ reports: { ...reports, [t.id]: (e.currentTarget as HTMLTextAreaElement).value } })}
                />
              )}
              <p class="field-help">עדכן את השדה בסוף כל ריצה, לפני שאתה עוצר את השעון.</p>
            </div>
            {(['manual', 'ai'] as const).map((mode) => {
              const active = run?.id === t.id && run.mode === mode;
              const val = tm[mode];
              return (
                <div key={mode} class="race-run">
                  <strong class="race-mode">{mode === 'manual' ? 'ידני' : 'עם AI'}</strong>
                  <span class="clock race-time" aria-live="off">
                    {active ? mmss((Date.now() - run!.at) / 1000) : val !== undefined ? mmss(val) : '–:––'}
                  </span>
                  {active ? (
                    <button type="button" class="btn btn-primary" onClick={stop}>
                      עצור שעון
                    </button>
                  ) : (
                    <button
                      type="button"
                      class="btn btn-secondary"
                      disabled={Boolean(run)}
                      onClick={() => {
                        setRun({ id: t.id, mode, at: Date.now() });
                      }}
                    >
                      {val !== undefined ? 'מדוד שוב' : 'התחל שעון'}
                    </button>
                  )}
                </div>
              );
            })}
            {t.prompt && (
              <details class="race-doc">
                <summary>ההנחיה לריצה עם AI</summary>
                <Snippet s={sample} />
              </details>
            )}
            {both(t.id) && (
              <div class="race-sum" aria-live="polite">
                <p class="result-sum">
                  ידני: <strong class="num">{mmss(tm.manual!)}</strong>. עם AI: <strong class="num">{mmss(tm.ai!)}</strong>.
                </p>
                {t.key && (
                  <>
                    <p>
                      <strong>מה היה נכון:</strong> <Rich text={t.key.text} />
                    </p>
                    {t.key.items && (
                      <ol class="list">
                        {t.key.items.map((it, i) => (
                          <li key={i}>
                            <Rich text={it} />
                          </li>
                        ))}
                      </ol>
                    )}
                    <p class="note">
                      מה שדיווחת: <bdi>{reports[t.id] || 'לא דיווחת'}</bdi>
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}
      <p class="result-sum" aria-live="polite">
        נמדדו שתי ריצות ב-<strong class="num">{bothCount}</strong> מתוך <span class="num">{tasks.length}</span> משימות.
      </p>
      {typeof step.data?.note === 'string' && <p class="note">{step.data.note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ x-mark */

interface MarkSentence {
  id: string;
  text: string;
}
interface MarkKeyItem {
  /** Sentence the error is in. */
  at: string;
  type: string;
  why: string;
}

/**
 * Tap a suspect sentence, then choose which type of error it is. The key opens only after the cadet finishes,
 * and every sentence is then coloured in words: caught, missed, or marked by mistake.
 * data: { title, paragraphs: [{ sentences }], types: [{ id, label, hint? }], key, docId? }
 * metrics (step.data.produces): caught, typed, clean.
 */
export function Mark({ step, content, data, setData, setMetric }: StepProps<CustomStep>) {
  const paragraphs = (step.data?.paragraphs ?? []) as { title?: string; sentences: MarkSentence[] }[];
  const types = (step.data?.types ?? []) as { id: string; label: string; hint?: string }[];
  const key = (step.data?.key ?? []) as MarkKeyItem[];
  const docId = typeof step.data?.docId === 'string' ? step.data.docId : '';
  const marks = rec<string>(data.marks); // sentence id -> type id ('' = marked, type not chosen yet)
  const done = Boolean(data.done);
  const [open, setOpen] = useState<string>('');
  const seeded = new Map(key.map((k) => [k.at, k]));
  const typeLabel = (id: string) => types.find((t) => t.id === id)?.label ?? 'לא נבחר סוג';

  const finish = () => {
    const caught = key.filter((k) => k.at in marks).length;
    const typed = key.filter((k) => marks[k.at] === k.type).length;
    const wrong = Object.keys(marks).filter((id) => !seeded.has(id)).length;
    setData({ done: true });
    setMetric('caught', caught);
    setMetric('typed', typed);
    setMetric('clean', Math.max(0, key.length - wrong));
    setOpen('');
  };

  const toggle = (id: string) => {
    if (done) return;
    if (id in marks) {
      setOpen(open === id ? '' : id);
    } else {
      setData({ marks: { ...marks, [id]: '' } });
      setOpen(id);
    }
  };
  const unmark = (id: string) => {
    const next = { ...marks };
    delete next[id];
    setData({ marks: next });
    setOpen('');
  };

  const caught = key.filter((k) => k.at in marks).length;
  const typed = key.filter((k) => marks[k.at] === k.type).length;
  const wrong = Object.keys(marks).filter((id) => !seeded.has(id)).length;
  const doc = docId ? content.docs?.[docId] : undefined;

  return (
    <div class="mark">
      {doc && (
        <details class="race-doc">
          <summary>{doc.title}</summary>
          {doc.paragraphs.map((p, i) => (
            <p key={i}>
              <span class="num">{i + 1}.</span> <strong>{p.title}.</strong> {p.text}
            </p>
          ))}
        </details>
      )}
      <article class="product mark-product" aria-label={String(step.data?.title ?? 'התוצר')}>
        <h3 class="product-title">{String(step.data?.title ?? '')}</h3>
        {paragraphs.map((p, pi) => (
          <div key={pi} class="mark-para">
            {p.title && <p class="mark-para-title">{p.title}</p>}
            <p>
              {p.sentences.map((s) => {
                const marked = s.id in marks;
                const k = seeded.get(s.id);
                const state = !done ? '' : k ? (marked ? ' is-caught' : ' is-missed') : marked ? ' is-false' : '';
                return (
                  <span key={s.id} class="mark-wrap">
                    <button
                      type="button"
                      class={'sentence' + (marked ? ' is-marked' : '') + state}
                      aria-pressed={marked}
                      aria-label={`${marked ? 'מסומן כחשוד: ' : ''}${s.text}`}
                      onClick={() => toggle(s.id)}
                    >
                      {s.text}
                    </button>
                    {done && (k || marked) && (
                      <span class="sentence-state">
                        {k ? (marked ? (marks[s.id] === k.type ? ' (נתפס)' : ' (נתפס, סוג אחר)') : ' (פוספס)') : ' (סומן בטעות)'}
                      </span>
                    )}{' '}
                  </span>
                );
              })}
            </p>
          </div>
        ))}
      </article>

      {open && !done && (
        <div class="mark-pick" role="group" aria-label="סוג הטעות במשפט שסימנת">
          <p class="mark-pick-text">{paragraphs.flatMap((p) => p.sentences).find((s) => s.id === open)?.text}</p>
          <p class="field-label">איזה סוג טעות זה?</p>
          <div class="row">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                class={'btn ' + (marks[open] === t.id ? 'btn-primary' : 'btn-secondary')}
                aria-pressed={marks[open] === t.id}
                onClick={() => {
                  setData({ marks: { ...marks, [open]: t.id } });
                  setOpen('');
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div class="row">
            <button type="button" class="btn btn-ghost" onClick={() => unmark(open)}>
              בטל סימון
            </button>
          </div>
        </div>
      )}

      <p class="result-sum" aria-live="polite">
        סימנת <strong class="num">{Object.keys(marks).length}</strong> משפטים.
        {Object.values(marks).some((v) => v === '') && ' בחלקם עוד לא בחרת סוג טעות.'}
      </p>

      {!done && (
        <div class="row">
          <button type="button" class="btn btn-primary" disabled={Object.keys(marks).length === 0} onClick={finish}>
            סיימתי, הצג מפתח
          </button>
        </div>
      )}
      {!done && <p class="note">אחרי הלחיצה הסימונים ננעלים והמפתח נפתח.</p>}

      {done && (
        <div class="key">
          <p class="result-sum" aria-live="polite">
            נתפסו <strong class="num">{caught}</strong> מתוך <span class="num">{key.length}</span> הטעויות
            {caught > 0 ? `, ב-${typed} מהן בחרת את הסוג הנכון` : ''}. סימונים שגויים: <strong class="num">{wrong}</strong>.
          </p>
          <ol class="key-list">
            {key.map((k, i) => {
              const s = paragraphs.flatMap((p) => p.sentences).find((x) => x.id === k.at);
              const m = k.at in marks;
              return (
                <li key={k.at} class="key-item">
                  <h4 class="key-title">
                    <span class="num">{i + 1}.</span> {typeLabel(k.type)}
                    <span class={'status ' + (m ? 'status-ok' : 'status-bad')}>{m ? 'נתפס' : 'פוספס'}</span>
                  </h4>
                  <dl class="key-dl">
                    <dt>במשפט</dt>
                    <dd>{s?.text}</dd>
                    <dt>למה זו טעות</dt>
                    <dd>{k.why}</dd>
                    {m && (
                      <>
                        <dt>הסוג שבחרת</dt>
                        <dd>{typeLabel(marks[k.at] ?? '')}</dd>
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ x-download */

interface DownloadFile {
  name: string;
  mime: string;
  label: string;
  /** Plain text. `{d0}` to `{d6}` become the dates (YYYYMMDD) of next week's Sunday to Saturday. */
  text: string;
}

/**
 * Files built in the browser from text in the content file (no binary assets), and the lesson's own documents
 * offered as text files. data: { files?: DownloadFile[], docs?: { docId, name, label }[], preview?: boolean,
 * bundle?: { label, prompt } } where bundle copies one prompt followed by all the docs.
 */
export function Downloads({ step, content, ctx }: StepProps<CustomStep>) {
  const docs = (step.data?.docs ?? []) as { docId: string; name: string; label: string }[];
  const files: DownloadFile[] = [
    ...((step.data?.files ?? []) as DownloadFile[]),
    ...docs.map((d) => ({ name: d.name, mime: 'text/plain', label: d.label, text: ctx.docText(d.docId) })),
  ];
  const bundle = step.data?.bundle as { label: string; prompt: string } | undefined;
  const urls = useMemo(
    () =>
      files.map((f) => {
        const bom = f.mime.includes('csv') ? '﻿' : '';
        return URL.createObjectURL(new Blob([bom + fillDates(f.text)], { type: f.mime + ';charset=utf-8' }));
      }),
    [step.id],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <div class="downloads">
      <div class="row">
        {files.map((f, i) => (
          <a key={f.name} class="btn btn-secondary" href={urls[i]} download={f.name}>
            {f.label}
          </a>
        ))}
      </div>
      <div class="row">
        {files.map((f) => (
          <button
            key={f.name + '-c'}
            type="button"
            class="btn btn-ghost"
            onClick={async () => toast((await copyText(fillDates(f.text))) ? 'הועתק' : 'לא הצלחתי להעתיק')}
          >
            העתק כטקסט: {f.name}
          </button>
        ))}
        {bundle && (
          <button
            type="button"
            class="btn btn-ghost"
            onClick={async () => {
              const all = [bundle.prompt, ...docs.map((d) => ctx.docText(d.docId))].join('\n\n');
              toast((await copyText(all)) ? 'הועתק' : 'לא הצלחתי להעתיק');
            }}
          >
            {bundle.label}
          </button>
        )}
      </div>
      {Boolean(step.data?.preview) &&
        docs.map((d) => {
          const doc = content.docs?.[d.docId];
          return doc ? (
            <details key={d.docId} class="race-doc">
              <summary>{doc.title}</summary>
              {doc.sub && <p class="note">{doc.sub}</p>}
              {doc.paragraphs.map((p, i) => (
                <p key={i}>
                  <span class="num">{i + 1}.</span> <strong>{p.title}.</strong> {p.text}
                </p>
              ))}
            </details>
          ) : null;
        })}
    </div>
  );
}

export const SHARED_STEPS: Record<string, StepComponent> = {
  'x-quiz': Quiz,
  'x-stopwatch': Stopwatch,
  'x-mark': Mark,
  'x-downloads': Downloads,
};
