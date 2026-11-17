import type { Sample } from '@lumda/schema';
import { copyText } from './clipboard';
import { toast } from './toast';

/** Only copying is used: passing text through the URL is unverified per the spec ("לאמת לפני הפיילוט"). */
export const TOOLS = [
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
] as const;

/**
 * "העתק ופתח": a real link (so mobile Safari does not block it as a popup) whose click also copies.
 */
export function OpenInTool({ getText, label = 'העתק ופתח ב' }: { getText: () => string; label?: string }) {
  return (
    <div class="tools" role="group" aria-label="העתקה ופתיחה בכלי">
      {TOOLS.map((t) => (
        <a
          key={t.id}
          class="btn btn-tool"
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            const text = getText();
            if (!text.trim()) return;
            void copyText(text).then((ok) => toast(ok ? `הועתק. הדבק ב-${t.name}` : 'לא הצלחתי להעתיק. העתק ידנית'));
          }}
        >
          {label}-{t.name}
        </a>
      ))}
    </div>
  );
}

/** A ready text block (prompt template, technique) with copy and open-in-tool. */
export function Snippet({ s, withTools = true }: { s: Sample; withTools?: boolean }) {
  return (
    <figure class="snippet">
      <figcaption class="snippet-label">{s.label}</figcaption>
      <blockquote class="snippet-text">{s.text}</blockquote>
      <div class="row">
        <button
          type="button"
          class="btn btn-secondary"
          onClick={async () => toast((await copyText(s.text)) ? 'הועתק' : 'לא הצלחתי להעתיק')}
        >
          העתק
        </button>
      </div>
      {withTools && <OpenInTool getText={() => s.text} />}
    </figure>
  );
}
