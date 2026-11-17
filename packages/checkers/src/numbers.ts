/**
 * Number check: every number in the cadet's output is classified against the source document.
 *  - source:  appears in the source text (or is a paragraph number)
 *  - derived: can be produced from two source numbers by + − × or a time ± minutes; must be verified
 *  - unknown: neither, probably invented
 * Ported from the module 1 working version. It catches invented numbers only, not stale ones or omissions.
 */

export type NumberKind = 'source' | 'derived' | 'unknown';

export interface NumberSegment {
  text: string;
  kind?: NumberKind;
}

export interface NumberIndex {
  allowed: Set<string>;
  derived: Set<string>;
}

export interface NumberResult {
  segments: NumberSegment[];
  unknown: string[];
  derived: string[];
}

const NUM = /\d{1,2}:\d{2}|\d[\d,]*(?:\.\d+)?/g;
const norm = (x: string) => x.replace(/,/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * @param fullText    Everything the cadet received (titles included); numbers here are allowed.
 * @param bodyText    The factual body; derivations are computed from these numbers only.
 * @param paragraphs  Paragraph count, so citations like "פסקה 12" are allowed.
 */
export function buildNumberIndex(fullText: string, bodyText = fullText, paragraphs = 0): NumberIndex {
  const allowed = new Set((fullText.match(NUM) ?? []).map(norm));
  for (let i = 1; i <= paragraphs; i++) allowed.add(String(i));

  const plain = [
    ...new Set(
      (bodyText.match(NUM) ?? [])
        .map(norm)
        .filter((x) => !x.includes(':'))
        .map(Number),
    ),
  ].filter((n) => n > 0);
  const times = [...new Set(bodyText.match(/\d{1,2}:\d{2}/g) ?? [])];

  const derived = new Set<string>();
  for (const a of plain)
    for (const b of plain) {
      derived.add(String(a * b));
      derived.add(String(a + b));
      derived.add(String(Math.abs(a - b)));
    }
  for (const t of times) {
    const [hh, mm] = t.split(':').map(Number) as [number, number];
    for (const d of plain.filter((n) => n <= 240))
      for (const sg of [1, -1]) {
        const tot = (hh * 60 + mm + sg * d + 1440) % 1440;
        derived.add(pad(Math.floor(tot / 60)) + ':' + pad(tot % 60));
        derived.add(Math.floor(tot / 60) + ':' + pad(tot % 60));
      }
  }
  return { allowed, derived };
}

export function checkNumbers(index: NumberIndex, text: string): NumberResult {
  const segments: NumberSegment[] = [];
  const unknown: string[] = [];
  const derived: string[] = [];
  const rx = new RegExp(NUM.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const before = text.slice(0, m.index);
    const after = text[m.index + m[0].length];
    // List numbering at line start ("1." / "2)") is structure, not data.
    if (/(^|\n)\s*$/.test(before) && (after === '.' || after === ')')) continue;
    const v = norm(m[0]);
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    let kind: NumberKind;
    if (index.allowed.has(v)) kind = 'source';
    else if (index.derived.has(v) || index.derived.has(m[0])) {
      kind = 'derived';
      derived.push(m[0]);
    } else {
      kind = 'unknown';
      unknown.push(m[0]);
    }
    segments.push({ text: m[0], kind });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return { segments, unknown: [...new Set(unknown)], derived: [...new Set(derived)] };
}
