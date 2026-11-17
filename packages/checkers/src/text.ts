/** Text-level checks used by the prompt editor and the output box. All pure functions. */

export interface Rule {
  /** At least one of these regex sources must match (if given). */
  any?: string[];
  /** Every one of these regex sources must match. */
  all?: string[];
  /** None of these may match. */
  none?: string[];
  /** RegExp flags, default "u". */
  flags?: string;
}

const cache = new Map<string, RegExp>();
export function re(source: string, flags = 'u'): RegExp {
  const key = flags + '\u0000' + source;
  let r = cache.get(key);
  if (!r) {
    r = new RegExp(source, flags);
    cache.set(key, r);
  }
  return r;
}

export function matchRule(text: string, rule: Rule): boolean {
  const flags = rule.flags ?? 'u';
  if (rule.all && !rule.all.every((s) => re(s, flags).test(text))) return false;
  if (rule.any && rule.any.length && !rule.any.some((s) => re(s, flags).test(text))) return false;
  if (rule.none && rule.none.some((s) => re(s, flags).test(text))) return false;
  return Boolean(rule.all?.length || rule.any?.length || rule.none?.length);
}

/** First non-empty line, with leading markdown markers (#, *, -) removed. */
export function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return line.replace(/^[#*\-\s>]+/, '').trim();
}

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

/** Counts paragraph citations: "פסקה 3", "פסקאות 4, 11" or a bare "(3, 12)". */
export function countCitations(text: string): number {
  return (text.match(/פסק(?:ה|אות)\s*\d|\(\s*\d+(?:\s*,\s*\d+)*\s*\)/gu) ?? []).length;
}

/** Minutes since midnight for "HH:MM". */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface TimeWindowOptions {
  from: string;
  to: string;
  /** Regex sources; a line is relevant if any matches. */
  keywords: string[];
  /** Lines matching any of these are ignored (e.g. "תפוס" restating the constraint). */
  unless?: string[];
}

/**
 * Lines that schedule a keyword activity inside [from, to).
 * A line with two times is treated as a range; a line with one time as a start time.
 */
export function timeWindowViolations(text: string, opt: TimeWindowOptions): string[] {
  const from = toMinutes(opt.from);
  const to = toMinutes(opt.to);
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!opt.keywords.some((k) => re(k).test(line))) continue;
    if (opt.unless?.some((k) => re(k).test(line))) continue;
    const times = (line.match(/\b\d{1,2}:\d{2}\b/g) ?? []).map(toMinutes);
    if (!times.length) continue;
    const a = times[0]!;
    const b = times.length > 1 ? times[1]! : a;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    const hits = start === end ? start >= from && start < to : start < to && end > from;
    if (hits) out.push(line);
  }
  return out;
}
