import {
  countCitations,
  countLines,
  firstLine,
  matchRule,
  re,
  timeWindowViolations,
  wordCount,
  type Rule,
  type TimeWindowOptions,
} from './text';

/** Automatic tests a content file can attach to a requirement. Declared as data in content.json. */
export type AutoTest =
  | { type: 'rule'; rule: Rule }
  | { type: 'firstLine'; rule: Rule }
  | { type: 'minCitations'; n: number }
  | { type: 'maxWords'; n: number }
  | { type: 'minWords'; n: number }
  | { type: 'maxLines'; n: number }
  | ({ type: 'noTimeWindow' } & TimeWindowOptions);

export interface TestResult {
  pass: boolean;
  /** Short Hebrew explanation shown under the requirement. */
  detail: string;
}

export function runAutoTest(test: AutoTest, text: string): TestResult {
  switch (test.type) {
    case 'rule': {
      const pass = matchRule(text, test.rule);
      const { any, all, none } = test.rule;
      if (none?.length && !any?.length && !all?.length) {
        // A "must not appear" rule: say what was found, not "found in text" for a pass.
        const flags = test.rule.flags ?? 'u';
        const hit = none.map((s) => re(s, flags).exec(text)?.[0]).find(Boolean);
        return { pass, detail: pass ? 'לא נמצאו מילים שאסור שיופיעו' : `נמצא: "${hit}"` };
      }
      return { pass, detail: pass ? 'נמצא בטקסט' : 'לא נמצא בטקסט' };
    }
    case 'firstLine': {
      const line = firstLine(text);
      const pass = matchRule(line, test.rule);
      const shown = line.length > 60 ? line.slice(0, 60) + '…' : line;
      return { pass, detail: `השורה הראשונה: "${shown}"` };
    }
    case 'minCitations': {
      const n = countCitations(text);
      return { pass: n >= test.n, detail: `נמצאו ${n} הפניות לפסקאות (נדרשות ${test.n} לפחות)` };
    }
    case 'maxWords': {
      const n = wordCount(text);
      return { pass: n <= test.n, detail: `אורך: ${n} מילים (עד ${test.n})` };
    }
    case 'minWords': {
      const n = wordCount(text);
      return { pass: n >= test.n, detail: `אורך: ${n} מילים (לפחות ${test.n})` };
    }
    case 'maxLines': {
      const n = countLines(text);
      return { pass: n <= test.n, detail: `אורך: ${n} שורות (עד ${test.n})` };
    }
    case 'noTimeWindow': {
      const lines = timeWindowViolations(text, test);
      return lines.length
        ? { pass: false, detail: `נמצא בין ${test.from} ל-${test.to}: "${lines[0]}"` }
        : { pass: true, detail: `אין שיבוץ בין ${test.from} ל-${test.to}` };
    }
  }
}
