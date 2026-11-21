import { createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import { config } from '@lumda/config';
import { Rich } from './rich';
import { toolsFor } from './tools';
import emblemUrl from './emblem.svg';

/** The Bahad 1 symbol. It carries its own black ring, so it sits on any surface in both themes. */
export function Emblem({ size = 32 }: { size?: number }) {
  return <img class="emblem" src={emblemUrl} alt="" width={size} height={size} decoding="async" />;
}

export const InstructorContext = createContext(false);
export const useInstructor = () => useContext(InstructorContext);

/** Fixed credit line on every screen. Never blocks taps, clears the iPhone home indicator. */
export function Watermark() {
  return (
    <div class="watermark" dir="ltr" lang="en" aria-hidden="true">
      {config.WATERMARK}
    </div>
  );
}

/** "Why this is right" — collapsed by default, opens on tap. */
export function Why({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <details class="why">
      <summary>למה זה נכון</summary>
      <p>
        <Rich text={text} />
      </p>
    </details>
  );
}

/**
 * Shared card for every screen that sends the cadet out to an external AI tool: the security rule up front,
 * then the same six hand-off steps each time, so no lesson has to explain them again.
 */
export function ToolGuide({ tools, why, links }: { tools?: string[]; why?: string; links?: boolean }) {
  const offered = toolsFor(tools);
  const names = offered.map((t) => t.name);
  const named = Boolean(tools?.length);
  return (
    <section class="tool-guide" aria-label="עבודה עם כלי AI">
      <p class="flag flag-warn" role="note">
        <strong>אבטחת מידע:</strong> התרגיל מבוסס על חומר מדומה בלבד. אל תעתיק לכלי AI חיצוני מידע צבאי אמיתי,
        מידע אישי או פרטי יחידה, אלא אם השימוש אושר לך במפורש.
      </p>
      {(named || why) && (
        <p class="note">
          {named && <strong>{names.length === 1 ? 'הכלי לשלב הזה: ' : 'הכלים לשלב הזה: '}</strong>}
          {named && `${names.join(', ')}.`}
          {why ? ` ${why}` : ''}
        </p>
      )}
      {named && links && (
        <div class="tools" role="group" aria-label="פתיחת הכלי">
          {offered.map((t) => (
            <a key={t.id} class="btn btn-tool" href={t.url} target="_blank" rel="noopener noreferrer">
              פתח את {t.name}
            </a>
          ))}
        </div>
      )}
      <details class="tool-guide-steps">
        <summary>איך עובדים עם כלי ה-AI (6 צעדים)</summary>
        <ol>
          <li>
            {!named
              ? 'בחר כלי אחד: ChatGPT, Claude או Gemini. מספיק אחד.'
              : names.length === 1
                ? `פתח את ${names[0]}. זה הכלי שהשלב הזה צריך.`
                : `בחר אחד מהכלים שמופיעים בשלב: ${names.join(', ')}.`}
          </li>
          <li>פתח שיחה חדשה כשמתבקשים לעשות זאת.</li>
          <li>העתק מהאתר את ההנחיה והדבק אותה בשיחה.</li>
          <li>אם מתבקשים לצרף מסמך, העתק גם אותו והדבק.</li>
          <li>שלח, והעתק את התשובה.</li>
          <li>חזור לאתר והדבק אותה בשדה המתאים.</li>
        </ol>
        <p>התשובה של הכלי לא חייבת להיות זהה לדוגמה באתר. בדוק מה שקיבלת, לפי הדרישות ולפי המקור.</p>
      </details>
    </section>
  );
}

export function InstructorNote({ text, children }: { text?: string; children?: ComponentChildren }) {
  const on = useInstructor();
  if (!on || (!text && !children)) return null;
  return (
    <aside class="inst-note" aria-label="הערת מדריך">
      <span class="inst-label">מדריך</span>
      {text && <Rich text={text} />}
      {children}
    </aside>
  );
}

export function Chip({
  children,
  tone,
}: {
  children: ComponentChildren;
  tone?: 'accent' | 'ok' | 'warn' | 'bad';
}) {
  return <span class={'chip' + (tone ? ' chip-' + tone : '')}>{children}</span>;
}

export function formatClock(totalSec: number): string {
  const neg = totalSec < 0;
  const s = Math.abs(Math.round(totalSec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return (neg ? '+' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

/** Countdown against a budget. Over budget shows "+mm:ss" in the warning color, with a text label. */
export function Clock({ remaining, label = 'זמן שנותר' }: { remaining: number; label?: string }) {
  const over = remaining < 0;
  const low = !over && remaining <= 120;
  return (
    <span class={'clock-box' + (over ? ' is-over' : low ? ' is-low' : '')}>
      <span class="sr-only">{over ? 'חריגה מהזמן' : label}</span>
      <span class="clock" aria-hidden="false">
        {formatClock(remaining)}
      </span>
    </span>
  );
}

export function budgetLabel(sec?: number): string | null {
  if (!sec) return null;
  if (sec < 60) return `${sec} שנ'`;
  const m = Math.round(sec / 60);
  return m === 1 ? 'דקה' : `${m} דק'`;
}
