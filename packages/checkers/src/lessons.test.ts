import { describe, expect, it } from 'vitest';
import l05 from '../../../modules/l05-unfamiliar-topic/content.json';
import l06 from '../../../modules/l06-tasks-to-calendar/content.json';
import l07 from '../../../modules/l07-workday/content.json';
import l08 from '../../../modules/l08-connected-tools/content.json';
import l09 from '../../../modules/l09-when-not/content.json';
import l10 from '../../../modules/l10-spot-the-error/content.json';
import l11 from '../../../modules/l11-red-team/content.json';
import l12 from '../../../modules/l12-situation-room/content.json';
import { scoreShift, type ShiftConfig, type ShiftData } from '../../../modules/l12-situation-room/src/score';
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
  it('the final sample meets all seven automatic checks', () => {
    const fin = out('final');
    expect(passes(fin.requirements, fin.samples![0]!.text)).toBe(7);
    expect(fin.requirements).toHaveLength(8);
  });
  it('a plan that keeps the cancelled Rasap meeting is caught, and the braking task may be placed before 10:30 only', () => {
    const fin = out('final');
    const byId = (id: string) => fin.requirements.find((r) => r.id === id)!.test!;
    expect(runAutoTest(byId('f-cancel'), '| 12:30 עד 13:15 | פגישה עם הרס״פ על לוגיסטיקה |').pass).toBe(false);
    expect(runAutoTest(byId('f-cancel'), '12:30 עד 13:15 פגישת הרס״פ בוטלה, והזמן שוחרר.').pass).toBe(true);
    expect(runAutoTest(byId('f-safety'), '| 09:00 עד 09:30 | בדיקת בלמים |').pass).toBe(true);
    expect(runAutoTest(byId('f-safety'), '| 08:30 עד 09:00 | בדיקת בלמים |').pass).toBe(true);
    expect(runAutoTest(byId('f-safety'), '| 18:30 עד 19:00 | בדיקת בלמים |').pass).toBe(false);
    expect(runAutoTest(byId('f-safety'), '| 11:00 עד 11:30 | בדיקת בלמים |').pass).toBe(false);
  });
  it('a plan that moved a soldier conversation, or put the safety check first thing at 07:00, is caught', () => {
    const fin = out('final');
    const byId = (id: string) => fin.requirements.find((r) => r.id === id)!.test!;
    expect(runAutoTest(byId('f-talks'), '| 10:00 עד 10:30 | שיחה אישית עם גלעד |\n| 15:45 עד 16:15 | שיחה אישית עם עומר |').pass).toBe(false);
    expect(runAutoTest(byId('f-talks'), '| 9:30 עד 10:00 | שיחה אישית עם גלעד |\n| 15:45 עד 16:15 | עומר |').pass).toBe(true);
    expect(runAutoTest(byId('f-quiet'), '| 07:00 עד 07:30 | בדיקת בלמים |').pass).toBe(false);
    expect(runAutoTest(byId('f-safety'), '| 07:00 עד 07:30 | בדיקת בלמים |').pass).toBe(false);
  });
  it('the plan from another tool has the four planted problems, with the answers in different places', () => {
    const q = quizOf(c7, 'other');
    expect(q).toHaveLength(4);
    expect(new Set(q.map((x) => x.answer)).size).toBeGreaterThanOrEqual(3);
    const right = (i: number) => q[i]!.options![q[i]!.answer!]!;
    expect(right(0)).toContain('הרס״פ');
    expect(right(1)).toContain('סגן המג״ד');
    expect(right(2)).toContain('גלעד');
    expect(right(3)).toContain('11:00 עד 11:30');
    // the invented item is really absent from the source
    expect(docText(c7, 'day')).not.toContain('סגן המג״ד');
  });
  it('the message to the commander: the sample meets its checks, a long message does not', () => {
    const m = out('msg');
    expect(passes(m.requirements, m.samples![0]!.text)).toBe(autos(m.requirements));
    const byId = (id: string) => m.requirements.find((r) => r.id === id)!.test!;
    expect(runAutoTest(byId('g-short'), 'א\nב\nג\nד').pass).toBe(false);
    expect(runAutoTest(byId('g-short'), 'א\nב\nג').pass).toBe(true);
  });
  it('the weights add up to 100', () => {
    expect(c7.score!.parts.reduce((x, p) => x + p.weight, 0)).toBe(100);
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
      const m = /\{t([+-]\d+)\}/.exec(due);
      return { task, owner, offset: m ? Number(m[1]) : null, status };
    });
  const pr = (id: string) => step<PromptStep>(c8, id);
  const meets = (s: PromptStep, text: string) => s.requirements!.every((r) => runAutoTest(r.test!, text).pass);

  it('the file has thirteen tasks, one of them without a date, and the answers of the board check follow from it', () => {
    expect(rows).toHaveLength(13);
    const q = quizOf(c8, 'board-check');
    const late = rows.filter((r) => r.offset !== null && r.offset < 0 && r.status !== 'בוצע');
    const done = rows.filter((r) => r.status === 'בוצע');
    const rasap = rows.filter((r) => r.owner === 'רס״פ');
    const noDate = rows.filter((r) => r.offset === null);
    expect(late).toHaveLength(3);
    expect(done).toHaveLength(3);
    expect(rasap).toHaveLength(2);
    expect(noDate).toHaveLength(1);
    expect(accepts(q[0]!, '13')).toBe(true);
    expect(accepts(q[0]!, '12')).toBe(false);
    expect(accepts(q[1]!, '3')).toBe(true);
    expect(accepts(q[1]!, '30')).toBe(false);
    expect(accepts(q[2]!, '2')).toBe(true);
    expect(accepts(q[2]!, '12')).toBe(false);
    expect(accepts(q[3]!, '1')).toBe(true);
    expect(accepts(q[3]!, '0')).toBe(false);
    expect(accepts(q[4]!, '23%')).toBe(true);
    expect(accepts(q[4]!, '25%')).toBe(false);
  });
  it('a finished task with a past date is not overdue, so the overdue count is not the count of past dates', () => {
    expect(rows.filter((r) => r.offset !== null && r.offset < 0)).toHaveLength(6);
  });
  it('the three permission questions put the right answer in different places', () => {
    const q = quizOf(c8, 'perms');
    expect(new Set(q.map((x) => x.answer)).size).toBeGreaterThanOrEqual(2);
  });
  it('the connection step comes after the permission reading and before the typed screen', () => {
    const ids = c8.steps.map((s) => s.id);
    expect(ids.indexOf('perms')).toBeLessThan(ids.indexOf('connect'));
    expect(ids.indexOf('connect')).toBeLessThan(ids.indexOf('permtext'));
    expect(ids.indexOf('permtext')).toBeLessThan(ids.indexOf('invite'));
  });
  it('the correction to 18:00 is not announced in the invitation step', () => {
    const inv = step<{ body: string[] }>(c8, 'invite');
    expect(inv.body.join(' ')).not.toContain('מתקנת');
  });
  it('the design check accepts 18:00 and rejects 17:00', () => {
    const q = quizOf(c8, 'invite-check');
    expect(accepts(q[0]!, 'יום חמישי 18:00')).toBe(true);
    expect(accepts(q[0]!, 'יום חמישי 17:00')).toBe(false);
    expect(accepts(q[1]!, 'חסר')).toBe(true);
    expect(accepts(q[2]!, 'הרס״פ 050-000-0000')).toBe(true);
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
  type Task = { id: string; key?: { items: string[] }; aiKey?: { items: string[] }; docIds?: string[]; aiDocIds?: string[]; prompt?: string };
  const race = step<{ data: { tasks: Task[] } }>(c9, 'race').data.tasks;
  const paras = (id: string) => c9.docs![id]!.paragraphs.map((p) => p.text);
  const diffs = (x: string, y: string) =>
    paras(x)
      .map((t, i) => (t === paras(y)[i] ? -1 : i))
      .filter((i) => i >= 0);

  it('each pair has ten paragraphs and seven differences, and the key lists seven for each pair', () => {
    for (const [x, y] of [
      ['procA1', 'procA2'],
      ['procB1', 'procB2'],
    ] as const) {
      expect(paras(x)).toHaveLength(10);
      expect(paras(y)).toHaveLength(10);
      expect(diffs(x, y)).toHaveLength(7);
    }
    const t = race.find((x) => x.id === 'long')!;
    expect(t.key!.items).toHaveLength(7);
    expect(t.aiKey!.items).toHaveLength(7);
  });
  it('the manual run and the AI run use different pairs, and the AI prompt asks for the differences', () => {
    const t = race.find((x) => x.id === 'long')!;
    expect(t.docIds).toEqual(['procA1', 'procA2']);
    expect(t.aiDocIds).toEqual(['procB1', 'procB2']);
    expect(t.prompt).toContain('הבדלים');
  });
  it('key facts are really in the paragraphs', () => {
    const a1 = paras('procA1');
    const a2 = paras('procA2');
    expect(a1[1]).toContain('שלושה מכשירי קשר');
    expect(a2[1]).toContain('ארבעה מכשירי קשר');
    expect(a1[2]).toContain('06:00');
    expect(a2[2]).toContain('06:30');
    expect(a1[4]).toContain('קצין הקשר');
    expect(a2[4]).not.toContain('קצין הקשר');
    expect(a2[6]).toContain('מכשיר פרטי');
    expect(a1[8]).toContain('עד 10 דקות');
    expect(a2[8]).toContain('עד 15 דקות');
    const b1 = paras('procB1');
    const b2 = paras('procB2');
    expect(b1[1]).toContain('חמישה רכבים');
    expect(b2[1]).toContain('שישה רכבים');
    expect(b1[2]).toContain('05:45');
    expect(b2[2]).toContain('היציאה מהמגרש בשעה 05:30');
    expect(b1[4]).toContain('40 קמ״ש בדרך עפר');
    expect(b2[4]).toContain('30 קמ״ש בדרך עפר');
    expect(b1[5]).toContain('רכב ליווי');
    expect(b2[5]).not.toContain('רכב ליווי');
    expect(b2[8]).toContain('רכב חילוץ');
  });
  it('the list from another tool: five lines are true, the sixth was invented (the clause is identical), two differences are missing', () => {
    const q = step<{ data: { questions: { answer: number; options: string[] }[] } }>(c9, 'listcheck').data.questions;
    expect(q).toHaveLength(7);
    expect(q.slice(0, 5).every((x) => x.answer === 0)).toBe(true);
    expect(q[5]!.answer).toBe(1);
    expect(paras('procA1')[7]).toBe(paras('procA2')[7]);
    expect(q[6]!.options[q[6]!.answer]).toContain('שני הבדלים');
    // the differences the list leaves out are the ones in clauses 6 and 8
    expect(diffs('procA1', 'procA2')).toEqual([1, 2, 3, 4, 5, 6, 8]);
  });
  it('five cases, three options each, a reason is required, the right answers are spread, and the personal-data case needs approval and removal of names', () => {
    const q = step<{ data: { questions: { id: string; options: string[]; answer: number; rationale?: boolean; why: string }[] } }>(c9, 'cases').data.questions;
    expect(q).toHaveLength(5);
    for (const x of q) {
      expect(x.options).toHaveLength(3);
      expect(x.rationale).toBe(true);
    }
    expect(new Set(q.map((x) => x.answer)).size).toBeGreaterThanOrEqual(3);
    const c4 = q.find((x) => x.id === 'c4')!;
    expect(c4.options[c4.answer]).toMatch(/אושר/);
    expect(c4.options[c4.answer]).toMatch(/הסרת שמות/);
    expect(c4.why).not.toMatch(/חוסך שעות/);
  });
  it('the questions before opening a tool start with approval', () => {
    const t = step<{ body: string[] }>(c9, 'rule');
    expect(t.body.join(' ')).toContain('1. **האם מותר להעביר את החומר לכלי חיצוני?**');
  });
  it('the weights add up to 100 and the time itself is not scored', () => {
    expect(c9.score!.parts.reduce((s, p) => s + p.weight, 0)).toBe(100);
    expect(c9.score!.parts.map((p) => p.metric)).toEqual(['casesOk', 'listOk', 'raced']);
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

describe('L12 situation room', () => {
  const c12 = l12 as unknown as Content;
  const shift = c12.steps.find((s) => s.id === 'shift') as unknown as {
    messages: { id: string; t: number; text: string; replaces?: string }[];
    data: ShiftConfig;
  };
  const cfg = shift.data;
  const finalSample = cfg.final.samples![0]!.text;
  const interimSample = cfg.interim.samples![0]!.text;
  const MIN = 60_000;
  const base = 1_000_000_000_000;
  const done = (over: Partial<ShiftData> = {}): ShiftData => ({
    t0: base,
    interimText: interimSample,
    interimAt: base + 11 * MIN,
    finalText: finalSample,
    finalManual: { 'r-pat-man': true, 'r-numbers': true, 'r-owner': true },
    finalAt: base + 19 * MIN,
    ...over,
  });
  const frac = (d: ShiftData, key: string) => scoreShift(cfg, d).groups.find((g) => g.key === key)!.frac;

  it('the facts log is the list of messages, word for word, in order', () => {
    const docs = c12.docs!.facts!.paragraphs.map((p) => p.text);
    expect(docs).toEqual(shift.messages.map((m) => m.text));
  });
  it('the timeline: opening, one every minute and a half, interim at 10, correction at 12, last mention at 14, deadline at 18', () => {
    const at = (id: string) => shift.messages.find((m) => m.id === id)!.t;
    expect(at('m4')).toBeLessThan(30);
    expect([at('m5'), at('m6'), at('m7'), at('m8')]).toEqual([180, 270, 360, 450]);
    expect(at('m9')).toBe(600);
    expect(at('m10')).toBe(720);
    expect(at('m11')).toBe(840);
    expect(at('m12')).toBe(1080);
    expect(shift.messages.map((m) => m.t)).toEqual([...shift.messages.map((m) => m.t)].sort((a, b) => a - b));
  });
  it('the correction replaces the 36, and the old number stays readable', () => {
    const m10 = shift.messages.find((m) => m.id === 'm10')!;
    expect(m10.replaces).toBe('m8');
    expect(m10.text).toContain('38');
    expect(shift.messages.find((m) => m.id === 'm8')!.text).toContain('36');
  });
  it('צוער ר׳ appears in four separate messages, from the first minute to minute 14', () => {
    const hits = shift.messages.filter((m) => m.text.includes('צוער ר׳'));
    expect(hits.map((m) => m.id)).toEqual(['m3', 'm5', 'm7', 'm11']);
    expect(hits[0]!.t).toBeLessThan(30);
    expect(hits[3]!.t).toBe(840);
  });
  it('the sample brief meets every automatic check of the final requirements', () => {
    for (const r of cfg.final.requirements.filter((x) => x.test)) expect(runAutoTest(r.test!, finalSample).pass, r.id).toBe(true);
  });
  it('the sample brief has no wrong number: 36 never appears and every number is in the log', () => {
    expect(finalSample).not.toMatch(/(^|\D)36(\D|$)/);
    const known = JSON.stringify(c12.docs!.facts);
    for (const n of finalSample.match(/\d+/g) ?? []) expect(known, n).toContain(n);
  });
  it('the interim sample is two lines and a third line breaks the limit', () => {
    const lines = cfg.interim.requirements.find((r) => r.id === 'i-lines')!.test!;
    expect(runAutoTest(lines, interimSample).pass).toBe(true);
    expect(runAutoTest(lines, interimSample + '\nשורה שלישית').pass).toBe(false);
  });
  it('a submitted sample brief on time scores every component fully', () => {
    const s = scoreShift(cfg, done());
    expect(s.groups.map((g) => g.frac)).toEqual([1, 1, 1, 1]);
    expect(s.interimFrac).toBe(1);
    expect(s.onTime).toBe(true);
    expect(s.finalMinutes).toBe(19);
  });
  it('nothing counts before the brief is submitted', () => {
    const s = scoreShift(cfg, done({ finalAt: undefined, interimAt: undefined }));
    expect(s.groups.map((g) => g.frac)).toEqual([0, 0, 0, 0]);
    expect(s.interimFrac).toBe(0);
    expect(s.onTime).toBe(false);
  });
  it('a brief that keeps 36 and drops the pattern loses those components', () => {
    const text = 'המלצה: יוצאים. 36 לוחמים כשירים. לוודא קשר, אחראי: קצין הקשר.';
    const d = done({ finalText: text, finalManual: { 'r-owner': true } });
    expect(frac(d, 'decision')).toBe(1);
    expect(frac(d, 'pattern')).toBe(0);
    expect(frac(d, 'correction')).toBe(0);
    expect(frac(d, 'verify')).toBe(1);
  });
  it('manual items count only when the cadet ticked them', () => {
    expect(frac(done({ finalManual: {} }), 'pattern')).toBe(0.5);
    expect(frac(done({ finalManual: {} }), 'correction')).toBe(0.5);
    expect(frac(done({ finalManual: {} }), 'verify')).toBe(0.5);
  });
  it('late submissions lose only the time components', () => {
    const s = scoreShift(cfg, done({ interimAt: base + 14 * MIN, finalAt: base + 21 * MIN }));
    expect(s.interimOnTime).toBe(false);
    expect(s.interimFrac).toBeCloseTo(2 / 3);
    expect(s.onTime).toBe(false);
    expect(s.groups.map((g) => g.frac)).toEqual([1, 1, 1, 1]);
  });
  it('the weights follow the spec: 20, 20, 20, 15, 15, 10', () => {
    const w = Object.fromEntries(c12.score!.parts.map((p) => [p.metric, p.weight]));
    expect(w).toEqual({ mDecision: 20, mPattern: 20, mCorrection: 20, mInterim: 15, mVerify: 15, mOnTime: 10 });
    for (const g of cfg.groups) expect(g.weight, g.key).toBe(w[g.metric]);
  });
});
