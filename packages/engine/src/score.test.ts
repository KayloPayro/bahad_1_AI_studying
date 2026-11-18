import { describe, expect, it } from 'vitest';
import l01 from '../../../modules/l01-decision-page/content.json';
import type { ModuleContent } from '../../schema/src/types';
import { computeScore } from './score';

const c = l01 as unknown as ModuleContent;

describe('computeScore', () => {
  it('returns null without a rubric', () => {
    expect(computeScore(undefined, {})).toBeNull();
  });
  it('full marks → 100% and top level', () => {
    const s = computeScore(c.score, { promptReqs: 6, outputReqs: 6, keyFound: 8, finalChecks: 3 })!;
    expect(s.percent).toBe(100);
    expect(s.level).toBe('מצוין');
  });
  it('weights the parts and clamps out-of-range values', () => {
    // 25*(6/6) + 15*(2/6) + 50*(4/8) + 10*(0/3) = 25 + 5 + 25 = 55
    const s = computeScore(c.score, { promptReqs: 9, outputReqs: 2, keyFound: 4 })!;
    expect(s.percent).toBe(55);
    expect(s.parts[0]!.value).toBe(6);
    expect(s.level).toBe('עומד במינימום');
  });
});
