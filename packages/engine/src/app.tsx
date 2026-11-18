import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildNumberIndex, type NumberIndex } from '@lumda/checkers';
import { config, SITE_BASE } from '@lumda/config';
import { STAGE_LABELS, type ChatMessage, type ModuleContent, type Step } from '@lumda/schema';
import { createTracker, type EventName, type Identity } from '@lumda/tracking';
import {
  budgetLabel,
  ChatSimulator,
  Chip,
  Clock,
  docBody,
  docToText,
  EntryScreen,
  InstructorContext,
  InstructorGate,
  InstructorNote,
  isInstructorUnlocked,
  MessageHistory,
  Paras,
  Rich,
  Sheet,
  ThemeToggle,
  Toaster,
  Watermark,
  Why,
  type ChatControls,
  Emblem,
} from '@lumda/ui';
import { computeScore } from './score';
import { emptyRun, loadRun, resetRun, saveRun, type RunState } from './run';
import { BUILTIN_STEPS } from './steps';
import type { MountOptions, StepComponent, StepContext } from './types';

type Tracker = ReturnType<typeof createTracker>;

export function ModuleApp({ content, plugins = {}, tracker }: { content: ModuleContent; plugins?: MountOptions['plugins']; tracker: Tracker }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [instructor, setInstructor] = useState(false);
  const [gate, setGate] = useState(false);

  const shell = (children: preact.ComponentChildren) => (
    <InstructorContext.Provider value={instructor}>
      <a class="skip-link" href="#main">
        דלג לתוכן
      </a>
      {children}
      <Watermark />
      <Toaster />
      <InstructorGate
        open={gate}
        onClose={() => setGate(false)}
        onUnlocked={() => {
          setGate(false);
          setInstructor(true);
        }}
      />
    </InstructorContext.Provider>
  );

  const toggleInstructor = () => {
    if (instructor) setInstructor(false);
    else if (isInstructorUnlocked()) setInstructor(true);
    else setGate(true);
  };

  if (!identity) {
    return shell(
      <>
        <TopBar title={content.title} />
        <main id="main" class="page">
          <EntryScreen context={`לומדה ${Number(content.id.slice(1))}: ${content.title}`} onReady={setIdentity} />
        </main>
      </>,
    );
  }

  return shell(
    <Runner
      key={identity.pn}
      content={content}
      plugins={plugins}
      identity={identity}
      instructor={instructor}
      onToggleInstructor={toggleInstructor}
      onSwitchUser={() => setIdentity(null)}
      tracker={tracker}
    />,
  );
}

function TopBar({ title, children }: { title: string; children?: preact.ComponentChildren }) {
  return (
    <header class="topbar">
      <div class="topbar-in">
        <a class="home-link" href={SITE_BASE} aria-label="לכל הלומדות">
          <Emblem size={34} />
          <span class="home-text">כל הלומדות</span>
        </a>
        <span class="topbar-title">{title}</span>
        <span class="topbar-actions">{children}</span>
      </div>
    </header>
  );
}

function Runner({
  content,
  plugins,
  identity,
  instructor,
  onToggleInstructor,
  onSwitchUser,
  tracker,
}: {
  content: ModuleContent;
  plugins: Record<string, StepComponent>;
  identity: Identity;
  instructor: boolean;
  onToggleInstructor: () => void;
  onSwitchUser: () => void;
  tracker: Tracker;
}) {
  const [run, setRunState] = useState<RunState>(() => loadRun(identity.pn, content));
  const runRef = useRef(run);
  const setRun = (fn: (r: RunState) => RunState) => {
    const next = fn(runRef.current);
    runRef.current = next;
    saveRun(identity.pn, content, next);
    setRunState(next);
  };

  const [view, setView] = useState<'steps' | 'done'>(run.completedAt ? 'done' : 'steps');
  const [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState(false);
  const [script, setScript] = useState(false);
  const [controls, setControls] = useState<ChatControls>({ speed: 1, paused: false, revealToken: 0 });
  const stepEnteredAt = useRef(Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isDraft = content.status === 'draft';

  useEffect(() => {
    if (!run.startedAt || run.completedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run.startedAt, run.completedAt]);

  const send = (event: EventName, step: number, score: number | '' = '') => {
    if (isDraft) return;
    const started = runRef.current.startedAt ?? Date.now();
    void tracker.track({
      pn: identity.pn,
      team: identity.team,
      module: content.id,
      event,
      step,
      score,
      seconds: Math.max(0, Math.round((Date.now() - started) / 1000)),
      version: content.version,
    });
  };

  const indexes = useMemo(() => {
    const map = new Map<string, NumberIndex>();
    for (const [id, d] of Object.entries(content.docs ?? {})) {
      map.set(id, buildNumberIndex(docToText(d), docBody(d), d.paragraphs.length));
    }
    return map;
  }, [content]);

  const step = content.steps[run.stepIndex]!;
  const total = content.steps.length - 1; // intro is not counted

  const goTo = (i: number, opts: { complete?: boolean } = {}) => {
    const from = runRef.current.stepIndex;
    const spent = Math.round((Date.now() - stepEnteredAt.current) / 1000);
    const fromStep = content.steps[from]!;
    if (opts.complete) send('step', from);
    setRun((r) => ({
      ...r,
      stepIndex: i,
      maxIndex: Math.max(r.maxIndex, i),
      stepSeconds: { ...r.stepSeconds, [fromStep.id]: (r.stepSeconds[fromStep.id] ?? 0) + spent },
    }));
    stepEnteredAt.current = Date.now();
    setControls((c) => ({ ...c, paused: false }));
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [run.stepIndex, view]);

  const start = () => {
    if (!runRef.current.startedAt) {
      setRun((r) => ({ ...r, startedAt: Date.now() }));
      send('start', 0);
    }
    goTo(Math.max(1, runRef.current.stepIndex));
  };

  const finish = () => {
    const sc = computeScore(content.score, runRef.current.metrics);
    const percent = sc?.percent ?? 100;
    send('step', runRef.current.stepIndex);
    setRun((r) => ({ ...r, completedAt: Date.now(), score: percent }));
    send('complete', runRef.current.stepIndex, percent);
    setView('done');
  };

  const ctx: StepContext = {
    identity,
    instructor,
    docText: (id) => {
      const d = content.docs?.[id];
      return d ? docToText(d) : '';
    },
    numberIndex: (id) => indexes.get(id) ?? buildNumberIndex(''),
    askFirst: () => {
      setRun((r) => ({ ...r, askFirstUsed: r.askFirstUsed + 1 }));
      send('ask_first', runRef.current.stepIndex);
    },
    stepData: (id) => runRef.current.data[id] ?? {},
  };

  // Messages received so far, for the history sheet.
  const received: ChatMessage[] = [];
  content.steps.forEach((s, i) => {
    if (!s.messages || i > run.maxIndex) return;
    const clock = i < run.stepIndex ? Infinity : (run.chatClock[s.id] ?? 0);
    received.push(...s.messages.filter((m) => m.t <= clock || i < run.maxIndex));
  });
  const hasMessages = content.steps.some((s) => s.messages?.length);

  const elapsed = run.startedAt ? ((run.completedAt ?? now) - run.startedAt) / 1000 : 0;
  const remaining = content.minutes * 60 - elapsed;

  const header = (
    <TopBar title={content.title}>
      {run.startedAt && view === 'steps' && <Clock remaining={remaining} />}
      {hasMessages && run.startedAt && (
        <button type="button" class="btn-icon btn-badge" aria-label={`הודעות שהתקבלו: ${received.length}`} onClick={() => setHistory(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M4 5h16v11H8l-4 4V5z" stroke-linejoin="round" />
          </svg>
          {received.length > 0 && <span class="badge num">{received.length}</span>}
        </button>
      )}
    </TopBar>
  );

  const footer = (
    <footer class="page-foot">
      <button type="button" class={'switch' + (instructor ? ' is-on' : '')} role="switch" aria-checked={instructor} onClick={onToggleInstructor}>
        <span class="switch-track" aria-hidden="true" />
        מצב מדריך
      </button>
      <ThemeToggle />
      <button type="button" class="btn btn-ghost btn-small" onClick={onSwitchUser}>
        החלף משתמש
      </button>
    </footer>
  );

  const sheets = (
    <>
      <Sheet open={history} onClose={() => setHistory(false)} title="הודעות שהתקבלו">
        <MessageHistory messages={received} />
      </Sheet>
      {content.instructorScript && (
        <Sheet open={script && instructor} onClose={() => setScript(false)} title={content.instructorScript.title}>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>דקה</th>
                  <th>מה עושים</th>
                  <th>מה אומרים</th>
                </tr>
              </thead>
              <tbody>
                {content.instructorScript.rows.map((r, i) => (
                  <tr key={i}>
                    <td class="clock">{r[0]}</td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {content.instructorScript.notes?.map((n, i) => (
            <p key={i}>
              <Rich text={n} />
            </p>
          ))}
        </Sheet>
      )}
    </>
  );

  if (view === 'done') {
    return (
      <>
        {header}
        <main id="main" class="page">
          <Completion
            content={content}
            run={run}
            headingRef={headingRef}
            onReview={() => {
              setView('steps');
              goTo(1);
            }}
            onRestart={() => {
              if (!confirm('להתחיל את הלומדה מחדש? מה שכתבת בה יימחק מהמכשיר.')) return;
              resetRun(identity.pn, content);
              const fresh = emptyRun();
              runRef.current = fresh;
              setRunState(fresh);
              setView('steps');
            }}
          />
          {footer}
        </main>
        {sheets}
      </>
    );
  }

  const isLast = run.stepIndex === content.steps.length - 1;
  const Renderer: StepComponent | undefined =
    step.type === 'custom' ? plugins[step.name] : step.type === 'intro' ? undefined : BUILTIN_STEPS[step.type];

  return (
    <>
      {header}
      {step.type !== 'intro' && <StageBar steps={content.steps} index={run.stepIndex} />}
      <main id="main" class="page">
        {instructor && (
          <InstructorBar
            content={content}
            run={run}
            controls={controls}
            setControls={setControls}
            onJump={(i) => goTo(i)}
            onScript={() => setScript(true)}
          />
        )}
        {step.type === 'intro' ? (
          <Intro content={content} run={run} onStart={start} headingRef={headingRef} isDraft={isDraft} />
        ) : (
          <article class="step" key={step.id} aria-labelledby={'h-' + step.id}>
            <header class="step-head">
              <p class="step-kicker">
                {STAGE_LABELS[step.stage]} · שלב <span class="num">{run.stepIndex}</span> מתוך <span class="num">{total}</span>
              </p>
              <div class="step-title-row">
                <h2 id={'h-' + step.id} ref={headingRef} tabIndex={-1}>
                  {step.title}
                </h2>
                {budgetLabel(step.budgetSec) && <Chip>{budgetLabel(step.budgetSec)}</Chip>}
              </div>
            </header>
            <Paras items={step.body} className="step-body" />
            {step.messages && step.messages.length > 0 && (
              <ChatSimulator
                key={step.id + '-chat'}
                messages={step.messages}
                initialClock={run.chatClock[step.id] ?? 0}
                controls={controls}
                onClock={(v) => setRun((r) => ({ ...r, chatClock: { ...r.chatClock, [step.id]: v } }))}
              />
            )}
            {Renderer ? (
              <Renderer
                step={step}
                content={content}
                data={run.data[step.id] ?? {}}
                setData={(patch) =>
                  setRun((r) => ({ ...r, data: { ...r.data, [step.id]: { ...(r.data[step.id] ?? {}), ...patch } } }))
                }
                metrics={run.metrics}
                setMetric={(k, v) => setRun((r) => ({ ...r, metrics: { ...r.metrics, [k]: v } }))}
                ctx={ctx}
              />
            ) : (
              step.type === 'custom' && <p class="flag flag-bad">רכיב "{step.name}" לא נרשם בלומדה.</p>
            )}
            <Why text={step.why} />
            <InstructorNote text={step.instructor} />
          </article>
        )}
        {step.type !== 'intro' && (
          <nav class="step-nav" aria-label="ניווט בין שלבים">
            <button type="button" class="btn btn-secondary" onClick={() => goTo(run.stepIndex - 1)}>
              חזרה
            </button>
            {isLast ? (
              isDraft ? (
                <a class="btn btn-primary" href={SITE_BASE}>
                  חזרה לכל הלומדות
                </a>
              ) : (
                <button type="button" class="btn btn-primary" onClick={finish}>
                  סיום הלומדה
                </button>
              )
            ) : (
              <button type="button" class="btn btn-primary" onClick={() => goTo(run.stepIndex + 1, { complete: true })}>
                המשך
              </button>
            )}
          </nav>
        )}
        {footer}
      </main>
      {sheets}
    </>
  );
}

function StageBar({ steps, index }: { steps: Step[]; index: number }) {
  const current = steps[index]!.stage;
  const stages = [...new Set(steps.map((s) => s.stage))];
  return (
    <div class="stagebar">
      <ol class="stagebar-in" aria-label="שלבי הלומדה">
        {stages.map((st) => (
          <li
            key={st}
            class={'stage' + (st < current ? ' is-done' : st === current ? ' is-current' : '')}
            aria-current={st === current ? 'step' : undefined}
          >
            <span class="stage-bar" aria-hidden="true" />
            <span class="stage-label">{STAGE_LABELS[st]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Intro({
  content,
  run,
  onStart,
  headingRef,
  isDraft,
}: {
  content: ModuleContent;
  run: RunState;
  onStart: () => void;
  headingRef: preact.RefObject<HTMLHeadingElement>;
  isDraft: boolean;
}) {
  const intro = content.steps[0]!;
  const plan = content.steps.slice(1);
  return (
    <article class="intro">
      <p class="intro-kicker">
        לומדה <span class="num">{Number(content.id.slice(1))}</span>
        {content.units.length > 0 && (
          <>
            {' '}
            · יחידות <bdi dir="ltr">{content.units.join(', ')}</bdi>
          </>
        )}
      </p>
      <h1 ref={headingRef} tabIndex={-1} class="intro-title">
        {content.title}
      </h1>
      {content.subtitle && <p class="intro-sub">{content.subtitle}</p>}
      <div class="chips">
        <Chip tone="accent">
          <span class="num">{content.minutes}</span> דקות
        </Chip>
        {content.tools.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <section class="outcome" aria-label="מה תדע לעשות בסוף">
        <h2 class="outcome-h">בסוף הלומדה תדע</h2>
        <p>
          <Rich text={content.outcome} />
        </p>
      </section>
      <Paras items={intro.body} className="step-body" />
      {isDraft && (
        <p class="flag flag-warn" role="note">
          הלומדה בבנייה. מוצג כאן המבנה המתוכנן לפי האפיון, בלי תרגול ובלי מעקב.
        </p>
      )}
      {plan.length > 0 && (
        <ol class="plan" aria-label="מהלך הלומדה">
          {plan.map((s, i) => (
            <li key={s.id} class={i + 1 < run.maxIndex ? 'is-done' : ''}>
              <span class="plan-n num">{i + 1}</span>
              <span class="plan-t">{s.title}</span>
              {budgetLabel(s.budgetSec) && <span class="plan-time">{budgetLabel(s.budgetSec)}</span>}
            </li>
          ))}
        </ol>
      )}
      <InstructorNote text={intro.instructor} />
      <div class="row row-cta">
        <button type="button" class="btn btn-primary btn-large" onClick={onStart}>
          {isDraft ? 'הצג את המבנה' : run.startedAt ? 'המשך מאיפה שעצרת' : 'התחל'}
        </button>
      </div>
      {!isDraft && !run.startedAt && (
        <p class="note">
          הטיימר מתחיל כשלוחצים "התחל". הכלי עצמו פתוח בחשבון שלך, והתוצרים שאתה מדביק נשארים במכשיר שלך.
        </p>
      )}
    </article>
  );
}

function InstructorBar({
  content,
  run,
  controls,
  setControls,
  onJump,
  onScript,
}: {
  content: ModuleContent;
  run: RunState;
  controls: ChatControls;
  setControls: (fn: (c: ChatControls) => ChatControls) => void;
  onJump: (i: number) => void;
  onScript: () => void;
}) {
  const hasChat = Boolean(content.steps[run.stepIndex]?.messages?.length);
  return (
    <section class="inst-bar" aria-label="כלי מדריך">
      <span class="inst-label">מדריך</span>
      {hasChat && (
        <>
          <button type="button" class="btn btn-small btn-secondary" onClick={() => setControls((c) => ({ ...c, paused: !c.paused }))}>
            {controls.paused ? 'המשך הודעות' : 'השהה הודעות'}
          </button>
          <span class="seg" role="group" aria-label="מהירות הודעות">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                type="button"
                class="seg-btn"
                aria-pressed={controls.speed === s}
                onClick={() => setControls((c) => ({ ...c, speed: s }))}
              >
                x{s}
              </button>
            ))}
          </span>
          <button
            type="button"
            class="btn btn-small btn-secondary"
            onClick={() => setControls((c) => ({ ...c, revealToken: c.revealToken + 1 }))}
          >
            כל ההודעות עכשיו
          </button>
        </>
      )}
      <label class="inst-jump">
        <span class="sr-only">קפוץ לשלב</span>
        <select
          class="input input-small"
          value={run.stepIndex}
          onChange={(e) => onJump(Number((e.currentTarget as HTMLSelectElement).value))}
        >
          {content.steps.map((s, i) => (
            <option key={s.id} value={i}>
              {i === 0 ? 'כרטיס לומדה' : `${i}. ${s.title}`}
            </option>
          ))}
        </select>
      </label>
      {content.instructorScript && (
        <button type="button" class="btn btn-small btn-secondary" onClick={onScript}>
          תסריט הצגה
        </button>
      )}
    </section>
  );
}

function Completion({
  content,
  run,
  onReview,
  onRestart,
  headingRef,
}: {
  content: ModuleContent;
  run: RunState;
  onReview: () => void;
  onRestart: () => void;
  headingRef: preact.RefObject<HTMLHeadingElement>;
}) {
  const sc = computeScore(content.score, run.metrics);
  const minutes = run.startedAt && run.completedAt ? Math.round((run.completedAt - run.startedAt) / 60000) : null;
  return (
    <article class="done">
      <p class="intro-kicker">סיום לומדה {Number(content.id.slice(1))}</p>
      <h1 ref={headingRef} tabIndex={-1} class="intro-title">
        {content.title}
      </h1>
      {sc && (
        <section class="score" aria-label="ציון לפי המחוון">
          <p class="score-big">
            <span class="clock">{sc.percent}%</span>
            {sc.level && <span class="score-level">{sc.level}</span>}
          </p>
          <ul class="bars">
            {sc.parts.map((p) => (
              <li key={p.label} class="bar-row">
                <span class="bar-label">{p.label}</span>
                <span class="bar" aria-hidden="true">
                  <span class="bar-fill" style={{ transform: `scaleX(${p.value / p.max})` }} />
                </span>
                <span class="bar-val num">
                  {p.value} מתוך {p.max}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p class="muted">
        {minutes != null && (
          <>
            זמן: <span class="num">{minutes}</span> דקות מתוך <span class="num">{content.minutes}</span>.{' '}
          </>
        )}
        {config.TRACKING_URL ? 'הסיום נשלח למעקב הסגל.' : 'המעקב עוד לא מחובר, והסיום נשמר במכשיר עד שיחובר.'}
      </p>
      <div class="row row-cta">
        <a class="btn btn-primary" href={SITE_BASE}>
          לכל הלומדות
        </a>
        <button type="button" class="btn btn-secondary" onClick={onReview}>
          עבור שוב על השלבים
        </button>
        <button type="button" class="btn btn-ghost" onClick={onRestart}>
          התחל מחדש
        </button>
      </div>
    </article>
  );
}
