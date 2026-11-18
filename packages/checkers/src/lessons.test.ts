import { describe, expect, it } from 'vitest';
import l05 from '../../../modules/l05-unfamiliar-topic/content.json';
import l06 from '../../../modules/l06-tasks-to-calendar/content.json';
import l07 from '../../../modules/l07-workday/content.json';
import l08 from '../../../modules/l08-connected-tools/content.json';
import l09 from '../../../modules/l09-when-not/content.json';
import l10 from '../../../modules/l10-spot-the-error/content.json';
import l11 from '../../../modules/l11-red-team/content.json';
import type { ModuleContent, OutputStep, PromptStep } from '../../schema/src/types';
import { runAutoTest } from './auto';
import { fillDates, nextWeekDates } from './dates';

type Content = ModuleContent;
const c5 = l05 as unknown as Content;
const c6 = l06 as unknown as Content;

interface QuizData {
  questions: { id: string; accept?: string; answer?: number; options?: string[] }[];
}
const quizOf = (c: Content, id: string) => (step<{ data: QuizData }>(c, id).data).questions;
const accepts = (q: { accept?: string }, text: string) => new RegExp(q.accept!, 'iu').test(text);

const step = <T,>(c: Content, id: string) => c.steps.find((s) => s.id === id) as unknown as T;
const sample = (s: OutputStep, i = 0) => s.samples![i]!.text;
const autoIds = (s: OutputStep, text: string) =>
  s.requirements.filter((r) => r.test && runAutoTest(r.test, text).pass).map((r) => r.id);
const autoAll = (s: OutputStep) => s.requirements.filter((r) => r.test).map((r) => r.id);
const docText = (c: Content, id: string) => c.docs![id]!.paragraphs.map((p) => p.text).join(' ');

describe('L05 unfamiliar topic', () => {
  it('the facts the questions rely on are in the right documents', () => {
    expect(docText(c5, 'sop')).toContain('30 דקות');
    expect(docText(c5, 'update')).toContain('45 דקות');
    expect(docText(c5, 'tech')).toContain('35 קמ״ש');
    expect(docText(c5, 'probe')).toContain('אפשר לדלג על הכיול');
    expect(docText(c5, 'sop')).toContain('חובה לפני כל הפעלה');
  });
  it('no document answers the night question', () => {
    for (const id of Object.keys(c5.docs!)) expect(docText(c5, id), id).not.toMatch(/לילה|בלילה/);
  });
  it('the update is dated after the procedure and the debrief', () => {
    expect(c5.docs!.update!.sub).toContain('14.9.2026');
    expect(c5.docs!.sop!.sub).toContain('2.3.2026');
    expect(c5.docs!.probe!.sub).toContain('20.5.2026');
  });
  it('the sample learning page meets every automatic check', () => {
    const p = step<OutputStep>(c5, 'page');
    expect(autoIds(p, sample(p))).toEqual(autoAll(p));
  });
  it('a page that skips the table fact and the calibration is missed', () => {
    const p = step<OutputStep>(c5, 'page');
    const got = autoIds(p, 'הנוהל אומר 30 והעדכון 45. מותר להפעיל בלילה. נוהל מדריך תחקיר.');
    expect(got).not.toContain('c-wind');
    expect(got).not.toContain('c-calib');
  });
  it('the from-memory samples meet the checks, and an empty-handed answer does not', () => {
    const m = step<OutputStep>(c5, 'memory');
    expect(autoIds(m, sample(m))).toEqual(autoAll(m));
    expect(autoIds(m, 'אני לא זוכר')).toEqual([]);
  });
  it('the no-sources attempt: the made-up number is detected, the honest answer is not', () => {
    const b = step<OutputStep>(c5, 'blind');
    expect(autoIds(b, sample(b, 0))).toEqual(['b-number']);
    expect(autoIds(b, sample(b, 1))).toEqual([]);
  });
  it('every question has six options and a valid answer', () => {
    const q = step<{ data: { questions: { options: string[]; answer: number }[] } }>(c5, 'ask').data.questions;
    expect(q).toHaveLength(6);
    for (const x of q) {
      expect(x.options).toHaveLength(6);
      expect(x.answer).toBeGreaterThanOrEqual(0);
      expect(x.answer).toBeLessThan(6);
    }
  });
});

describe('next-week dates for calendar files', () => {
  it('starts on the coming Sunday', () => {
    // 2026-11-19 is a Thursday
    expect(nextWeekDates(new Date(2026, 10, 19))[0]).toBe('20261122');
    expect(nextWeekDates(new Date(2026, 10, 19))[6]).toBe('20261128');
  });
  it('on a Sunday, next week is seven days later', () => {
    expect(nextWeekDates(new Date(2026, 10, 22))[0]).toBe('20261129');
  });
  it('crosses a month and a year', () => {
    expect(nextWeekDates(new Date(2026, 11, 30))[0]).toBe('20270103');
  });
  it('fills the day tokens', () => {
    expect(fillDates('{d0}T080000 {d4}', new Date(2026, 10, 19))).toBe('20261122T080000 20261126');
  });
});

describe('L06 tasks to calendar', () => {
  const ics = (c6.steps.find((s) => s.id === 'prep') as unknown as { data: { files: { text: string }[] } }).data.files[0]!.text;
  const events = ics.split('BEGIN:VEVENT').slice(1).map((e) => {
    const get = (k: string) => new RegExp(k + ':\\{d(\\d)\\}T(\\d{4})').exec(e)!;
    const s = get('DTSTART');
    const t = get('DTEND');
    return { day: s[1]!, start: Number(s[2]), end: Number(t[2]), title: /SUMMARY:(.+)/.exec(e)![1]!.trim() };
  });
  const overlaps = (a: { day: string; start: number; end: number }, b: { day: string; start: number; end: number }) =>
    a.day === b.day && a.start < b.end && b.start < a.end;

  it('has nine events', () => expect(events).toHaveLength(9));
  it('has exactly one overlap among the existing events', () => {
    let n = 0;
    for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) if (overlaps(events[i]!, events[j]!)) n++;
    expect(n).toBe(1);
  });
  it('the Tuesday 10:00 briefing overlaps the signal check, and the other three clear tasks overlap nothing', () => {
    const task = (day: string, start: number, end: number) => ({ day, start, end });
    const hits = (t: { day: string; start: number; end: number }) => events.filter((e) => overlaps(t, e)).map((e) => e.title);
    expect(hits(task('2', 1000, 1100))).toEqual(['בדיקת ציוד קשר']);
    expect(hits(task('3', 900, 1000))).toEqual([]); // equipment parade Wednesday 09:00
    expect(hits(task('4', 800, 900))).toEqual([]); // weapons check Thursday 08:00
    expect(hits(task('1', 1230, 1330))).toEqual([]); // feedback Monday 12:30
  });
  it('the Tuesday 10:00 question has one right answer, the briefing alone is wrong', () => {
    const q = quizOf(c6, 'verify');
    expect(accepts(q[0]!, 'בדיקת ציוד קשר')).toBe(true);
    expect(accepts(q[0]!, 'תדריך לצוותים ובדיקת ציוד קשר')).toBe(false);
    expect(accepts(q[0]!, 'תדריך לצוותים')).toBe(false);
    expect(accepts(q[1]!, 'חמישי 08:00')).toBe(true);
    expect(accepts(q[1]!, 'יום חמישי בשעה 8:00')).toBe(true);
    expect(accepts(q[1]!, 'חמישי 18:00')).toBe(false);
    expect(accepts(q[2]!, 'מסדר ציוד')).toBe(true);
    expect(accepts(q[2]!, 'ארוחת צוות')).toBe(false);
  });
  it('the health check accepts 2, and not 9 or 20', () => {
    const q = quizOf(c6, 'health')[0]!;
    expect(accepts(q, '2')).toBe(true);
    expect(accepts(q, 'שניים')).toBe(true);
    expect(accepts(q, '2 אירועים')).toBe(true);
    expect(accepts(q, '9')).toBe(false);
    expect(accepts(q, '20')).toBe(false);
  });
  it('the sample prompt and the sample follow-up meet every automatic check, a vague request meets few', () => {
    const p = step<PromptStep>(c6, 'prompt');
    const sample = p.samples![0]!.text;
    expect(p.requirements!.every((r) => runAutoTest(r.test!, sample).pass)).toBe(true);
    expect(p.requirements!.filter((r) => runAutoTest(r.test!, 'הכנס את המשימות ליומן.').pass).length).toBeLessThanOrEqual(1);
    const f = step<PromptStep>(c6, 'follow');
    expect(f.requirements!.every((r) => runAutoTest(r.test!, f.samples![0]!.text).pass)).toBe(true);
    expect(f.requirements!.filter((r) => runAutoTest(r.test!, 'תמשיך.').pass)).toHaveLength(0);
  });
  it('every task in the summary is in the chat message, word for word', () => {
    const chat = (c6.steps.find((s) => s.id === 'inbox') as unknown as { messages: { text: string }[] }).messages[1]!.text;
    for (const p of c6.docs!.discussion!.paragraphs) expect(chat).toContain(p.text);
  });
});

describe('L07 workday', () => {
  const c7 = l07 as unknown as Content;
  const out = (id: string) => step<OutputStep>(c7, id);
  const pr = (id: string) => step<PromptStep>(c7, id);
  const passes = (reqs: { test?: Parameters<typeof runAutoTest>[0] }[], text: string) =>
    reqs.filter((r) => r.test && runAutoTest(r.test, text).pass).length;
  const autos = (reqs: { test?: unknown }[]) => reqs.filter((r) => r.test).length;

  it('the day has five meetings and eleven tasks, and the priorities are not in the attached list', () => {
    const p = c7.docs!.day!.paragraphs;
    expect(p).toHaveLength(4);
    expect(p[0]!.title).toContain('חמש פגישות');
    const doc = docText(c7, 'day');
    expect(doc).not.toMatch(/עדיפויות|שעה שקטה/);
    const chat = (c7.steps.find((s) => s.id === 'morning') as unknown as { messages: { text: string }[] }).messages[1]!.text;
    expect(chat).toContain('בטיחות לפני הכול');
    expect(chat).toContain('שיחות אישיות עם חיילים לא מזיזים');
    expect(chat).toContain('07:00 עד 08:00');
  });
  it('all sample prompts and updates meet every automatic check', () => {
    for (const id of ['plan', 'd1', 'd2']) {
      const s = pr(id);
      expect(passes(s.requirements!, s.samples![0]!.text), id).toBe(autos(s.requirements!));
    }
  });
  it('a prompt that only attaches the list misses the priorities', () => {
    const s = pr('plan');
    expect(passes(s.requirements!, 'בנה לי תוכנית יום.')).toBeLessThanOrEqual(1);
  });
  it('the first-plan sample meets its checks, but not the safety and commander checks of the final plan', () => {
    const first = out('plan-out');
    const fin = out('final');
    const sample1 = first.samples![0]!.text;
    expect(passes(first.requirements, sample1)).toBe(autos(first.requirements));
    const byId = (id: string) => fin.requirements.find((r) => r.id === id)!.test!;
    expect(runAutoTest(byId('f-safety'), sample1).pass).toBe(false);
    expect(runAutoTest(byId('f-mg'), sample1).pass).toBe(false);
  });
  it('the final sample meets all six automatic checks', () => {
    const fin = out('final');
    expect(passes(fin.requirements, fin.samples![0]!.text)).toBe(6);
  });
  it('a plan that moved a soldier conversation, or put the safety check first thing at 07:00, is caught', () => {
    const fin = out('final');
    const byId = (id: string) => fin.requirements.find((r) => r.id === id)!.test!;
    expect(runAutoTest(byId('f-talks'), '| 10:00 עד 10:30 | שיחה אישית עם גלעד |\n| 15:45 עד 16:15 | שיחה אישית עם עומר |').pass).toBe(false);
    expect(runAutoTest(byId('f-talks'), '| 9:30 עד 10:00 | שיחה אישית עם גלעד |\n| 15:45 עד 16:15 | עומר |').pass).toBe(true);
    expect(runAutoTest(byId('f-quiet'), '| 07:00 עד 07:30 | בדיקת בלמים |').pass).toBe(false);
    expect(runAutoTest(byId('f-safety'), '| 07:00 עד 07:30 | בדיקת בלמים |').pass).toBe(false);
  });
  it('the comparison items cover the same fixed times as the checks', () => {
    const items = (step<{ data: { items: { time: string; fixed?: boolean; match: string }[] } }>(c7, 'compare').data.items);
    expect(items.filter((i) => i.fixed)).toHaveLength(10);
    const fin = out('final');
    const lines = fin.samples![0]!.text.split('\n');
    for (const i of items) expect(lines.some((l) => new RegExp(i.match, 'u').test(l)), i.match).toBe(true);
  });
});

describe('relative-day tokens', () => {
  it('fills {t-3} and {t+2} as ISO dates', () => {
    expect(fillDates('{t-3},{t+2},{t+0}', new Date(2026, 10, 19))).toBe('2026-11-16,2026-11-21,2026-11-19');
  });
  it('crosses month and year ends', () => {
    expect(fillDates('{t+4}', new Date(2026, 11, 29))).toBe('2027-01-02');
    expect(fillDates('{t-1}', new Date(2026, 2, 1))).toBe('2026-02-28');
  });
});

describe('L08 connected tools', () => {
  const c8 = l08 as unknown as Content;
  const csv = (c8.steps.find((s) => s.id === 'board-files') as unknown as { data: { files: { text: string }[] } }).data.files[0]!.text;
  const rows = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => {
      const [task, owner, due, status] = l.split(',') as [string, string, string, string];
      return { task, owner, offset: Number(/\{t([+-]\d+)\}/.exec(due)![1]), status };
    });
  const pr = (id: string) => step<PromptStep>(c8, id);
  const meets = (s: PromptStep, text: string) => s.requirements!.every((r) => runAutoTest(r.test!, text).pass);

  it('the file has twelve tasks and the answers of the board check follow from it', () => {
    expect(rows).toHaveLength(12);
    const q = quizOf(c8, 'board-check');
    const late = rows.filter((r) => r.offset < 0 && r.status !== 'בוצע');
    const done = rows.filter((r) => r.status === 'בוצע');
    const rasap = rows.filter((r) => r.owner === 'רס״פ');
    expect(late).toHaveLength(3);
    expect(done).toHaveLength(3);
    expect(rasap).toHaveLength(2);
    expect(accepts(q[0]!, '3')).toBe(true);
    expect(accepts(q[0]!, '30')).toBe(false);
    expect(accepts(q[1]!, '3 משימות')).toBe(true);
    expect(accepts(q[2]!, '2')).toBe(true);
    expect(accepts(q[2]!, '12')).toBe(false);
  });
  it('a finished task with a past date is not overdue, so the overdue count is not the count of past dates', () => {
    expect(rows.filter((r) => r.offset < 0)).toHaveLength(6);
  });
  it('after moving the transport task, the Rasap owns one task, and the transport belongs to the platoon sergeant', () => {
    const q = quizOf(c8, 'change-check');
    const after = rows.map((r) => (r.task.startsWith('הסעות') ? { ...r, owner: 'סמל מחלקה 2' } : r));
    expect(after.filter((r) => r.owner === 'רס״פ')).toHaveLength(1);
    expect(accepts(q[0]!, 'סמל מחלקה 2')).toBe(true);
    expect(accepts(q[0]!, 'רס״פ')).toBe(false);
    expect(accepts(q[1]!, '1')).toBe(true);
    expect(accepts(q[1]!, '2')).toBe(false);
  });
  it('the Canva link check accepts a Canva link only', () => {
    const l = quizOf(c8, 'invite-link')[0]!;
    expect(accepts(l, 'https://www.canva.com/design/DAF123/view')).toBe(true);
    expect(accepts(l, 'https://evil.example/canva.com')).toBe(false);
    expect(accepts(l, 'canva')).toBe(false);
  });
  it('every sample meets its automatic checks, and the correction to 18:00 is part of the invitation prompt', () => {
    for (const id of ['invite', 'board', 'change']) expect(meets(pr(id), pr(id).samples![0]!.text), id).toBe(true);
    const inv = pr('invite');
    expect(inv.samples![0]!.text).toContain('18:00');
    expect(inv.samples![0]!.text).not.toContain('17:00');
    const when = inv.requirements!.find((r) => r.id === 'r-when')!.test!;
    expect(runAutoTest(when, 'יום חמישי ב-17:00').pass).toBe(false);
  });
  it('the requirements in the chat are the six the prompt is checked on', () => {
    const chat = (c8.steps.find((s) => s.id === 'invite') as unknown as { messages: { text: string }[] }).messages[0]!.text;
    for (const part of ['יום חמישי', '17:00', 'אולם הפלוגה', 'שער 2', 'מדי א', 'הרס״פ', 'ירוק זית וזהב', 'בלי תמונות של חיילים'])
      expect(chat, part).toContain(part);
  });
  it('the weights add up to 100', () => {
    expect(c8.score!.parts.reduce((s, p) => s + p.weight, 0)).toBe(100);
  });
});

describe('L09 when not', () => {
  const c9 = l09 as unknown as Content;
  const race = step<{ data: { tasks: { id: string; key?: { items: string[] }; docIds?: string[]; prompt?: string }[] } }>(c9, 'race').data.tasks;
  const paras = (id: string) => c9.docs![id]!.paragraphs.map((p) => p.text);

  it('the two procedure versions differ in exactly six paragraphs, and the key lists six differences', () => {
    const a = paras('proc1');
    const b = paras('proc2');
    expect(a).toHaveLength(8);
    expect(b).toHaveLength(8);
    const diff = a.map((t, i) => (t === b[i] ? -1 : i)).filter((i) => i >= 0);
    expect(diff).toEqual([1, 2, 3, 4, 5, 6]);
    expect(race.find((t) => t.id === 'long')!.key!.items).toHaveLength(6);
  });
  it('each key item names a fact that really is in the paragraph it is about', () => {
    const a = paras('proc1');
    const b = paras('proc2');
    expect(a[1]).toContain('שלושה מכשירי קשר');
    expect(b[1]).toContain('ארבעה מכשירי קשר');
    expect(a[2]).toContain('06:00');
    expect(b[2]).toContain('06:30');
    expect(a[3]).toContain('30 דקות');
    expect(b[3]).toContain('20 דקות');
    expect(a[4]).toContain('קצין הקשר');
    expect(b[4]).not.toContain('קצין הקשר');
    expect(a[5]).toContain('סמל המחלקה');
    expect(b[5]).toContain('מפקד הצוות');
    expect(b[6]).toContain('מכשיר פרטי');
    expect(a[6]).not.toContain('מכשיר פרטי');
  });
  it('the long task offers both documents, and the AI prompt asks for the differences', () => {
    const t = race.find((x) => x.id === 'long')!;
    expect(t.docIds).toEqual(['proc1', 'proc2']);
    expect(t.prompt).toContain('הבדלים');
  });
  it('five cases, three options each, a reason is required, and the right answers are not all in one place', () => {
    const q = step<{ data: { questions: { options: string[]; answer: number; rationale?: boolean }[] } }>(c9, 'cases').data.questions;
    expect(q).toHaveLength(5);
    for (const x of q) {
      expect(x.options).toHaveLength(3);
      expect(x.rationale).toBe(true);
    }
    expect(new Set(q.map((x) => x.answer)).size).toBeGreaterThanOrEqual(2);
  });
  it('the weights add up to 100 and the time itself is not scored', () => {
    expect(c9.score!.parts.reduce((s, p) => s + p.weight, 0)).toBe(100);
    expect(c9.score!.parts.map((p) => p.metric)).toEqual(['casesOk', 'raced']);
  });
});

describe('L10 spot the error', () => {
  const c10 = l10 as unknown as Content;
  const mark = step<{
    data: {
      types: { id: string }[];
      paragraphs: { sentences: { id: string; text: string }[] }[];
      key: { at: string; alt?: string[]; type: string }[];
    };
  }>(c10, 'mark').data;
  const sentences = mark.paragraphs.flatMap((p) => p.sentences);
  const text = (id: string) => sentences.find((s) => s.id === id)!.text;
  const src = (i: number) => c10.docs!.sources!.paragraphs[i]!.text;
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getDay(); // 0 = Sunday

  it('has eight types and one seeded error of each, on distinct sentences that exist', () => {
    expect(mark.types).toHaveLength(8);
    expect(mark.key).toHaveLength(8);
    expect(new Set(mark.key.map((k) => k.type)).size).toBe(8);
    expect(new Set(mark.key.map((k) => k.at)).size).toBe(8);
    for (const k of mark.key) {
      expect(sentences.map((s) => s.id)).toContain(k.at);
      for (const a of k.alt ?? []) expect(sentences.map((s) => s.id)).toContain(a);
      expect(mark.types.map((t) => t.id)).toContain(k.type);
    }
  });
  it('the other nine sentences are clean', () => {
    const bad = new Set(mark.key.flatMap((k) => [k.at, ...(k.alt ?? [])]));
    expect(sentences.filter((s) => !bad.has(s.id))).toHaveLength(sentences.length - 9);
  });
  it('the weekdays in the source are right, and the wrong date is really on another day', () => {
    expect(day(2026, 3, 8)).toBe(0); // Sunday, start of the training week
    expect(day(2026, 3, 12)).toBe(4); // Thursday, end of the week
    expect(day(2026, 3, 10)).toBe(2); // Tuesday, the night navigation
    expect(text('b4')).toContain('יום חמישי, 12.3');
    expect(text('b2')).toContain('יום שלישי, 10.3');
    expect(text('b3')).toContain('יום רביעי, 13.3');
    expect(day(2026, 3, 13)).not.toBe(3); // 13.3 is not a Wednesday
  });
  it('the number error: the source says 42 and never 48', () => {
    expect(src(0)).toContain('42 לוחמים');
    expect(text('a2')).toContain('48');
    expect(JSON.stringify(c10.docs!.sources)).not.toContain('48');
  });
  it('the arithmetic: three platoons times 1,400 is 4,200, not 4,500', () => {
    expect(3 * 1400).toBe(4200);
    expect(src(2)).toContain('4,200');
    expect(text('c1')).toContain('4,200');
    expect(text('c2')).toContain('4,500');
  });
  it('the quotation is not in the appendix: the source limit is 30 and there is no night rule', () => {
    expect(src(1)).toContain('30 קמ״ש');
    expect(src(1)).not.toContain('25');
    expect(JSON.stringify(c10.docs!.sources)).not.toMatch(/בלילה|לא בלילה/);
    expect(text('d2')).toContain('25 קמ״ש');
  });
  it('the role error: the name is right and the title is wrong', () => {
    expect(src(3)).toContain('קצין הבטיחות של הפלוגה: סגן אורי כהן');
    expect(src(3)).toContain('מפקד אימון הירי: סרן דנה לוי');
    expect(text('d3')).toContain('מפקד אימון הירי, סגן אורי כהן');
  });
  it('the contradiction: the plan has a night navigation in the field and a base-only day on the same day', () => {
    expect(text('b2')).toContain('יום שלישי');
    expect(text('e1')).toContain('ביום שלישי');
    const k = mark.key.find((x) => x.type === 't6')!;
    expect([k.at, ...(k.alt ?? [])].sort()).toEqual(['b2', 'e1']);
  });
  it('the unsupported claim and the missing document are in no source', () => {
    const all = JSON.stringify(c10.docs!.sources);
    expect(all).not.toContain('יעילות');
    expect(all).not.toContain('נוהל ירי לילה פלוגתי');
    expect(c10.docs!.sources!.paragraphs).toHaveLength(5);
  });
  it('a pass needs six errors with the right type and at most one false mark: 75 is exactly that', () => {
    const w = Object.fromEntries(c10.score!.parts.map((p) => [p.metric, p.weight]));
    const pct = (caught: number, typed: number, wrong: number) =>
      Math.round((caught / 8) * w.caught! + (typed / 8) * w.typed! + (Math.max(0, 8 - 2 * wrong) / 8) * w.clean!);
    expect(pct(6, 6, 1)).toBeGreaterThanOrEqual(75);
    expect(pct(5, 5, 0)).toBeLessThan(75);
    expect(pct(6, 6, 2)).toBeLessThan(75);
    expect(pct(8, 8, 0)).toBe(100);
  });
});

describe('L11 red team', () => {
  const c11 = l11 as unknown as Content;
  const plan = (i: number) => c11.docs!.plan!.paragraphs[i]!.text;
  const claims = step<{ data: { questions: { id: string; context: string; answer: number; options: string[]; rationale?: boolean }[] } }>(c11, 'claims').data.questions;
  const pr = (id: string) => step<PromptStep>(c11, id);
  const met = (s: { requirements?: { test?: Parameters<typeof runAutoTest>[0] }[] }, text: string) =>
    s.requirements!.filter((r) => r.test && runAutoTest(r.test, text).pass).length;

  it('the plan has the six weaknesses, each in its own paragraph', () => {
    expect(plan(2)).toContain('לא מוקצה קצין בטיחות');
    expect(plan(3)).toContain('משאית אחת');
    expect(plan(4)).toContain('מכשיר קשר אחד');
    expect(plan(5)).toContain('בלי זמן רזרבה');
    expect(plan(6)).toContain('התוכנית אינה משתנה בגשם');
    expect(plan(7)).toContain('מפקד המחלקה מחליט בזמן אמת');
  });
  it('the schedule is consistent: 20:00 plus five hours is the 01:00 pickup', () => {
    expect(plan(0)).toContain('20:00');
    expect(plan(5)).toContain('5 שעות');
    expect(plan(5)).toContain('01:00');
    expect((20 + 5) % 24).toBe(1);
  });
  it('exactly two of the five claims rest on something the plan does not say, and the plan contradicts them', () => {
    expect(claims).toHaveLength(5);
    const rejected = claims.filter((c) => c.answer === 1).map((c) => c.id);
    expect(rejected).toEqual(['k3', 'k5']);
    expect(plan(1)).toContain('כל לוחם נושא פנס ראש');
    expect(plan(0)).toContain('ביום חמישי');
    expect(plan(0)).not.toContain('שישי');
    expect(claims.find((c) => c.id === 'k3')!.context).toContain('בלי פנסי ראש');
    expect(claims.find((c) => c.id === 'k5')!.context).toContain('יום שישי');
  });
  it('the accepted claims match what the plan says', () => {
    expect(plan(2)).toContain('לא מוקצה קצין בטיחות');
    expect(plan(3)).toContain('ובמקביל תביא מזון');
    expect(plan(4)).not.toContain('גיבוי');
  });
  it('every claim needs a reason, with two options, and both answers are used', () => {
    for (const c of claims) {
      expect(c.options).toHaveLength(2);
      expect(c.rationale).toBe(true);
    }
    expect(new Set(claims.map((c) => c.answer))).toEqual(new Set([0, 1]));
  });
  it('the red-team prompt sample meets all four checks, a plain "what do you think" meets none', () => {
    const b1 = pr('round-b1');
    expect(met(b1, b1.samples![0]!.text)).toBe(4);
    expect(met(b1, 'מה דעתך על התוכנית?')).toBe(0);
    const b2 = pr('round-b2');
    expect(met(b2, b2.samples![0]!.text)).toBe(2);
  });
  it('the sample changes cover three different topics, and a vague promise covers none', () => {
    const ch = step<OutputStep>(c11, 'changes');
    expect(met(ch, ch.samples![0]!.text)).toBeGreaterThanOrEqual(3);
    expect(met(ch, 'אני אשפר את התוכנית ואעדכן את כולם.')).toBe(0);
  });
  it('the checklists of both rounds use the same six weaknesses as the comparison', () => {
    const ids = (id: string) => step<{ items: { id: string }[] }>(c11, id).items.map((i) => i.id);
    const rows = step<{ data: { rows: { id: string }[] } }>(c11, 'compare').data.rows.map((r) => r.id);
    expect(ids('check-a')).toEqual(rows);
    expect(ids('check-b')).toEqual(rows);
    expect(rows).toHaveLength(6);
  });
  it('the weights add up to 100 and the number of weaknesses the tool found is not scored', () => {
    expect(c11.score!.parts.reduce((s, p) => s + p.weight, 0)).toBe(100);
    expect(c11.score!.parts.map((p) => p.metric)).not.toContain('roundA');
    expect(c11.score!.parts.map((p) => p.metric)).not.toContain('roundB');
  });
});
