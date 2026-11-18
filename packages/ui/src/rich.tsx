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

/** **bold** and [text](https://link). Only https links are turned into anchors. */
function bold(s: string) {
  return s.split(/(\*\*.+?\*\*|\[[^\]]+\]\(https:\/\/[^\s)]+\))/g).map((p, i) => {
    if (i % 2 === 0) return p;
    const link = /^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(p);
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    }
    return <strong key={i}>{p.slice(2, -2)}</strong>;
  });
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
