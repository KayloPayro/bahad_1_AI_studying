import { describe, expect, it } from 'vitest';
import l01 from '../../../modules/l01-decision-page/content.json';
import l02 from '../../../modules/l02-ask-me-first/content.json';
import l03 from '../../../modules/l03-two-prompts/content.json';
import l04 from '../../../modules/l04-follow-up-rounds/content.json';
import type { ModuleContent, OutputStep, PromptStep } from '../../schema/src/types';
import { buildNumberIndex, checkNumbers } from './numbers';
import { countCitations, firstLine, matchRule, timeWindowViolations, wordCount } from './text';
import { runAutoTest } from './auto';

const c1 = l01 as unknown as ModuleContent;
const c2 = l02 as unknown as ModuleContent;
const c3 = l03 as unknown as ModuleContent;
const c4 = l04 as unknown as ModuleContent;
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

describe('L03 eight details of the commander message', () => {
  const s = step<OutputStep>(c3, 'weak');
  const strong = step<OutputStep>(c3, 'strong');
  const autos = s.requirements.filter((r) => r.test);
  const pass = (text: string) => autos.filter((r) => runAutoTest(r.test!, text).pass).length;
  it('has six automatic and two manual checks, the same in both attempts', () => {
    expect(autos).toHaveLength(6);
    expect(s.requirements.map((r) => r.id)).toEqual(strong.requirements.map((r) => r.id));
  });
  it('the one-sentence sample meets none of the automatic checks', () => expect(pass(sample(s, 0))).toBe(0));
  it('the professional sample meets all six', () => expect(pass(sample(strong, 0))).toBe(6));
  it('flags dates, apologies and a seventh line', () => {
    const byId = (id: string) => s.requirements.find((r) => r.id === id)!.test!;
    expect(runAutoTest(byId('d-dates'), 'יוצאים ב-14.5').pass).toBe(false);
    expect(runAutoTest(byId('d-dates'), 'יוצאים בשבוע הבא').pass).toBe(true);
    expect(runAutoTest(byId('d-tone'), 'אנו מצטערים').pass).toBe(false);
    expect(runAutoTest(byId('d-lines'), 'א\nב\nג\nד\nה\nו\nז').pass).toBe(false);
    expect(runAutoTest(byId('d-lines'), 'א\n\nב').pass).toBe(true);
  });
  it('the chat transcript and the attachable doc are the same text', () => {
    const chat = (c3.steps.find((x) => x.id === 'voice') as { messages: { text: string }[] }).messages[1]!.text;
    expect(c3.docs!.voice!.paragraphs[0]!.text).toBe(chat);
  });
  it('six prompt components are detected in the sample prompt', () => {
    const p = step<PromptStep>(c3, 'prompt');
    const text = p.samples![0]!.text;
    expect(p.requirements!.every((r) => runAutoTest(r.test!, text).pass)).toBe(true);
    expect(p.requirements!.filter((r) => runAutoTest(r.test!, 'כתוב הודעה לחיילים על ביטול יציאה.').pass)).toHaveLength(1);
  });
});

describe('L04 rounds', () => {
  const out = (id: string) => step<OutputStep>(c4, id);
  const autoPass = (s: OutputStep, text: string) =>
    s.requirements.filter((r) => r.test).map((r) => [r.id, runAutoTest(r.test!, text).pass] as const);
  const draft = (c4.steps.find((x) => x.id === 'setup') as { snippets: { text: string }[] }).snippets[0]!.text;
  it('the draft is longer than the 220 word limit', () => expect(wordCount(draft)).toBeGreaterThan(220));
  it('each sample meets its own round, and what earlier rounds fixed', () => {
    for (const id of ['r1-output', 'r2-output', 'r3-output']) {
      const s = out(id);
      const res = autoPass(s, sample(s, 0));
      expect(res.filter(([, ok]) => !ok), id).toEqual([]);
    }
  });
  it('round 1 sample does not yet have the round 2 fixes; round 2 sample still has the injury', () => {
    const r2 = out('r2-output');
    const on1 = Object.fromEntries(autoPass(r2, sample(out('r1-output'), 0)));
    expect(on1.owner).toBe(false);
    expect(on1.tone).toBe(false);
    const r3 = out('r3-output');
    expect(Object.fromEntries(autoPass(r3, sample(r2, 0))).injury).toBe(false);
  });
  it('the draft itself fails the round 1 checks', () => {
    const res = Object.fromEntries(autoPass(out('r1-output'), draft));
    expect(res.len).toBe(false);
    expect(res.table).toBe(false);
  });
  it('requirement ids that repeat across rounds carry the same test', () => {
    const tests = new Map<string, string>();
    for (const id of ['r1-output', 'r2-output', 'r3-output'])
      for (const r of out(id).requirements.filter((x) => x.test)) {
        const j = JSON.stringify(r.test);
        expect(tests.get(r.id) ?? j, r.id).toBe(j);
        tests.set(r.id, j);
      }
  });
  it('follow-up prompt: vague fails, focused samples pass', () => {
    for (const id of ['r1-prompt', 'r2-prompt', 'r3-prompt']) {
      const p = step<PromptStep>(c4, id);
      expect(p.requirements!.filter((r) => runAutoTest(r.test!, 'תשפר את הסיכום.').pass), id).toHaveLength(0);
      const focused = p.samples!.find((x) => x.label.includes('ממוקדת'))!.text;
      expect(p.requirements!.every((r) => runAutoTest(r.test!, focused).pass), id).toBe(true);
    }
  });
});
