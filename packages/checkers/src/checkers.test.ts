import { describe, expect, it } from 'vitest';
import l01 from '../../../modules/l01-decision-page/content.json';
import l02 from '../../../modules/l02-ask-me-first/content.json';
import type { ModuleContent, OutputStep, PromptStep } from '../../schema/src/types';
import { buildNumberIndex, checkNumbers } from './numbers';
import { countCitations, firstLine, matchRule, timeWindowViolations, wordCount } from './text';
import { runAutoTest } from './auto';

const c1 = l01 as unknown as ModuleContent;
const c2 = l02 as unknown as ModuleContent;
const doc = c1.docs!.background!;
const fullText = doc.title + '\n' + doc.sub + '\n\n' + doc.paragraphs.map((p, i) => `${i + 1}. ${p.title}. ${p.text}`).join('\n');
const body = doc.paragraphs.map((p) => p.text).join(' ');
const index = buildNumberIndex(fullText, body, doc.paragraphs.length);

const step = <T>(c: ModuleContent, id: string) => c.steps.find((s) => s.id === id) as T;
const promptStep = step<PromptStep>(c1, 'prompt');
const outputStep = step<OutputStep>(c1, 'run-check');
const verify = c1.steps.find((s) => s.id === 'verify') as { product: { text: string } };
const sample = (s: { samples?: { label: string; text: string }[] }, i: number) => s.samples![i]!.text;

describe('text helpers', () => {
  it('firstLine strips markdown markers', () => {
    expect(firstLine('\n\n## המלצה: יוצאים\nשורה 2')).toBe('המלצה: יוצאים');
  });
  it('wordCount', () => {
    expect(wordCount('  אחת  שתיים\nשלוש ')).toBe(3);
  });
  it('countCitations counts paragraph references and bare (n, m)', () => {
    expect(countCitations('א (פסקה 3). ב (פסקאות 4, 11). ג (1, 2)')).toBe(3);
  });
  it('matchRule all/any/none', () => {
    expect(matchRule('חסמים לפי חומרה', { all: ['חסמ', 'חומרה|סדר'] })).toBe(true);
    expect(matchRule('חסמים', { all: ['חסמ', 'חומרה|סדר'] })).toBe(false);
    expect(matchRule('בלי תקלות', { none: ['תקל'] })).toBe(false);
    expect(matchRule('לו״ז נקי', { none: ['תקל'] })).toBe(true);
    expect(matchRule('x', {})).toBe(false);
  });
});

describe('L01 prompt requirements', () => {
  const met = (text: string) => promptStep.requirements!.filter((r) => runAutoTest(r.test!, text).pass).length;
  it('"סכם לי" carries none of the six requirements', () => {
    expect(met(sample(promptStep, 0))).toBe(0);
  });
  it('the detailed sample prompt carries all six', () => {
    expect(met(sample(promptStep, 1))).toBe(6);
  });
});

describe('L01 output check', () => {
  const autos = outputStep.requirements.filter((r) => r.test);
  it('has three automatic requirements', () => expect(autos).toHaveLength(3));
  it('the "סכם לי" sample fails all three automatic checks', () => {
    expect(autos.map((r) => runAutoTest(r.test!, sample(outputStep, 0)).pass)).toEqual([false, false, false]);
  });
  it("the deputy's version passes all three form checks (the trap is in the content)", () => {
    expect(autos.map((r) => runAutoTest(r.test!, verify.product.text).pass)).toEqual([true, true, true]);
  });
});

describe('number check (L01)', () => {
  it('flags 40 minutes as not in the source', () => {
    const r = checkNumbers(index, 'נסיעה של כ-40 דקות.');
    expect(r.unknown).toEqual(['40']);
  });
  it('marks 80 and 06:50 as derived', () => {
    const r = checkNumbers(index, '5 משאיות הן 80 מקומות. הגעה ב-06:50.');
    expect(r.derived).toEqual(['80', '06:50']);
    expect(r.unknown).toEqual([]);
  });
  it('accepts source numbers, thousands separators and paragraph numbers', () => {
    const r = checkNumbers(index, '85 כשירים, 3,200 ליטר (פסקאות 6, 12).');
    expect(r.unknown).toEqual([]);
    expect(r.derived).toEqual([]);
  });
  it('ignores list numbering at line start', () => {
    const r = checkNumbers(index, '1. המלצה\n2) חסמים\n13. סוף');
    expect(r.unknown).toEqual([]);
  });
  it("finds exactly 40 in the deputy's version", () => {
    expect(checkNumbers(index, verify.product.text).unknown).toEqual(['40']);
  });
  it('segments reassemble the original text', () => {
    const t = 'נסיעה 40 דקות, 85 לוחמים';
    expect(
      checkNumbers(index, t)
        .segments.map((s) => s.text)
        .join(''),
    ).toBe(t);
  });
});

describe('time window (L02 range constraint)', () => {
  const opt = { from: '11:00', to: '12:00', keywords: ['ירי', 'מטווח'], unless: ['תפוס'] };
  it('flags range activity inside the window', () => {
    expect(timeWindowViolations('11:00 תצפית על אימון במטווח', opt)).toHaveLength(1);
    expect(timeWindowViolations('10:30-11:30 ירי במטווח', opt)).toHaveLength(1);
  });
  it('allows range activity outside the window and lines restating the constraint', () => {
    expect(timeWindowViolations('12:30 תרגיל ירי במטווח', opt)).toHaveLength(0);
    expect(timeWindowViolations('10:00-11:00 ירי', opt)).toHaveLength(0);
    expect(timeWindowViolations('11:00 סיור (המטווח תפוס בין 11:00 ל-12:00)', opt)).toHaveLength(0);
  });
});

describe('L02 eight constraints', () => {
  const s = step<OutputStep>(c2, 'final-check');
  const autos = s.requirements.filter((r) => r.test);
  const pass = (text: string) => autos.filter((r) => runAutoTest(r.test!, text).pass).length;
  it('has seven automatic checks', () => expect(autos).toHaveLength(7));
  it('the quick-round sample meets few constraints', () => {
    expect(pass(sample(s, 0))).toBeLessThanOrEqual(2);
  });
  it('the after-questions sample meets all seven automatic constraints', () => {
    expect(pass(sample(s, 1))).toBe(7);
  });
});
