import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ChatMessage } from '@lumda/schema';
import { getItem, setItem } from '@lumda/tracking';
import { Rich } from './rich';

export interface ChatControls {
  speed: number;
  paused: boolean;
  /** Increment to jump the clock past the last message. */
  revealToken: number;
}

interface Props {
  messages: ChatMessage[];
  /** Virtual seconds already elapsed (restored after reload). */
  initialClock?: number;
  controls: ChatControls;
  onClock?: (v: number) => void;
  onAllArrived?: () => void;
  title?: string;
}

const TYPING_LEAD = 1.6;
const TICK_MS = 200;

/**
 * Incoming-messages panel. Messages arrive by their `t` on a virtual clock that the instructor can pause,
 * speed up or skip. A message with `replaces` marks the earlier one as corrected instead of deleting it:
 * the cadet must notice the correction, as in a real ops room.
 */
export function ChatSimulator({ messages, initialClock = 0, controls, onClock, onAllArrived, title = 'הודעות נכנסות' }: Props) {
  const lastT = useMemo(() => messages.reduce((m, x) => Math.max(m, x.t), 0), [messages]);
  const [v, setV] = useState(initialClock);
  const vRef = useRef(v);
  vRef.current = v;

  useEffect(() => {
    if (controls.paused || v > lastT) return;
    const id = setInterval(() => {
      setV((x) => x + (TICK_MS / 1000) * controls.speed);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [controls.paused, controls.speed, v > lastT]);

  useEffect(() => {
    if (controls.revealToken) setV((x) => Math.max(x, lastT + 0.01));
  }, [controls.revealToken]);

  // Persist the clock about once a second.
  const lastSaved = useRef(-1);
  useEffect(() => {
    const whole = Math.floor(v);
    if (whole !== lastSaved.current) {
      lastSaved.current = whole;
      onClock?.(v);
    }
  }, [v]);

  const arrived = messages.filter((m) => m.t <= v);
  const done = arrived.length === messages.length;
  const doneFired = useRef(false);
  useEffect(() => {
    if (done && !doneFired.current) {
      doneFired.current = true;
      onClock?.(v);
      onAllArrived?.();
    }
  }, [done]);

  const typing = !done ? messages.find((m) => m.t > v && m.t - TYPING_LEAD <= v) : undefined;
  const replacedBy = new Map<string, ChatMessage>();
  for (const m of arrived) if (m.replaces) replacedBy.set(m.replaces, m);

  // Unread: arrived but not yet seen on screen for a moment.
  const [seen, setSeen] = useState<Set<string>>(() => new Set(messages.filter((m) => m.t <= initialClock).map((m) => m.id)));
  const markSeen = (id: string) => setSeen((s) => (s.has(id) ? s : new Set(s).add(id)));
  const unread = arrived.filter((m) => !seen.has(m.id)).length;

  // Sound is opt-in.
  const [sound, setSound] = useState(() => getItem('lumda.sound') === '1');
  const prevCount = useRef(arrived.length);
  useEffect(() => {
    if (arrived.length > prevCount.current && sound) beep();
    prevCount.current = arrived.length;
  }, [arrived.length]);

  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const last = logRef.current?.lastElementChild as HTMLElement | null;
    if (!last) return;
    const r = last.getBoundingClientRect();
    const vh = window.innerHeight;
    // Follow new messages only if the panel is already in view, never yank the page.
    if (r.top < vh && r.bottom > vh - 40) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [arrived.length, Boolean(typing)]);

  return (
    <section class="chat" aria-label={title}>
      <header class="chat-head">
        <span class="chat-title">{title}</span>
        <span class="chat-meta">
          {unread > 0 && (
            <span class="chat-unread" role="status">
              {unread === 1 ? 'הודעה אחת לא נקראה' : `${unread} הודעות לא נקראו`}
            </span>
          )}
          <button
            type="button"
            class="btn-icon"
            aria-pressed={sound}
            aria-label={sound ? 'כבה צליל הודעה' : 'הפעל צליל הודעה'}
            onClick={() => {
              setSound(!sound);
              setItem('lumda.sound', sound ? '0' : '1');
            }}
          >
            <SoundIcon on={sound} />
          </button>
        </span>
      </header>
      <ol class="chat-log" ref={logRef}>
        {arrived.map((m) => {
          const fixedBy = replacedBy.get(m.id);
          const corrects = m.replaces ? messages.find((x) => x.id === m.replaces) : undefined;
          return (
            <Bubble
              key={m.id}
              m={m}
              isNew={!seen.has(m.id)}
              onSeen={() => markSeen(m.id)}
              fixedBy={fixedBy}
              corrects={corrects}
            />
          );
        })}
        {typing && (
          <li class="typing" aria-live="off">
            <span class="typing-from">{typing.from}</span> מקליד
            <span class="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </li>
        )}
        {!arrived.length && !typing && <li class="chat-empty">ממתין להודעות…</li>}
      </ol>
    </section>
  );
}

function Bubble({
  m,
  isNew,
  onSeen,
  fixedBy,
  corrects,
}: {
  m: ChatMessage;
  isNew: boolean;
  onSeen: () => void;
  fixedBy?: ChatMessage;
  corrects?: ChatMessage;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!isNew) return;
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (typeof IntersectionObserver === 'undefined') {
      timer = setTimeout(onSeen, 2500);
      return () => clearTimeout(timer);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) timer = setTimeout(onSeen, 1500);
        else if (timer) clearTimeout(timer);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [isNew]);

  return (
    <li ref={ref} class={'bubble' + (fixedBy ? ' is-replaced' : '') + (corrects ? ' is-correction' : '')}>
      <div class="bubble-head">
        <span class="bubble-from">
          {m.from}
          {m.role && <span class="bubble-role"> · {m.role}</span>}
        </span>
        <span class="bubble-tags">
          {corrects && <span class="tag tag-warn">תיקון</span>}
          {isNew && <span class="tag tag-new">חדש</span>}
          {m.time && <span class="clock bubble-time">{m.time}</span>}
        </span>
      </div>
      <div class="bubble-text">
        <Rich text={m.text} />
      </div>
      {fixedBy && (
        <div class="bubble-fixed">
          תוקן בהודעה מ-{fixedBy.from}
          {fixedBy.time ? ` (${fixedBy.time})` : ''}
        </div>
      )}
    </li>
  );
}

/** Static list for the history drawer. */
export function MessageHistory({ messages }: { messages: ChatMessage[] }) {
  const replaced = new Set(messages.map((m) => m.replaces).filter(Boolean) as string[]);
  if (!messages.length) return <p class="muted">עוד לא התקבלו הודעות.</p>;
  return (
    <ol class="chat-log">
      {messages.map((m) => (
        <li key={m.id} class={'bubble' + (replaced.has(m.id) ? ' is-replaced' : '') + (m.replaces ? ' is-correction' : '')}>
          <div class="bubble-head">
            <span class="bubble-from">
              {m.from}
              {m.role && <span class="bubble-role"> · {m.role}</span>}
            </span>
            <span class="bubble-tags">
              {m.replaces && <span class="tag tag-warn">תיקון</span>}
              {m.time && <span class="clock bubble-time">{m.time}</span>}
            </span>
          </div>
          <div class="bubble-text">
            <Rich text={m.text} />
          </div>
          {replaced.has(m.id) && <div class="bubble-fixed">תוקן בהודעה מאוחרת יותר</div>}
        </li>
      ))}
    </ol>
  );
}

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.2);
  } catch {
    /* audio is optional */
  }
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linejoin="round" />
      {on ? (
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round" />
      ) : (
        <path d="M17 9l5 6M22 9l-5 6" stroke-linecap="round" />
      )}
    </svg>
  );
}
