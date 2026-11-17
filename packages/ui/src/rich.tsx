import { Fragment } from 'preact';

/** Renders the content files' tiny markup: **bold** and newlines. Never uses innerHTML. */
export function Rich({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {bold(line)}
        </Fragment>
      ))}
    </>
  );
}

function bold(s: string) {
  return s.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
}

export function Paras({ items, className }: { items?: string[]; className?: string }) {
  if (!items?.length) return null;
  return (
    <div class={className}>
      {items.map((t, i) => (
        <p key={i}>
          <Rich text={t} />
        </p>
      ))}
    </div>
  );
}
