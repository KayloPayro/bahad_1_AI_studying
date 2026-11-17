import { describe, expect, it } from 'vitest';
import { semanticCheck } from './semantic';
import type { ModuleContent } from './types';

const base = (): ModuleContent => ({
  id: 'L99',
  slug: 'l99',
  version: '1.0',
  status: 'ready',
  title: 't',
  minutes: 10,
  tools: ['Claude'],
  units: [],
  outcome: 'o',
  steps: [
    { id: 'card', type: 'intro', stage: 1, title: 't' },
    { id: 'b', type: 'bonus', stage: 7, title: 'b', lines: ['x'] },
  ],
});

describe('semanticCheck', () => {
  it('accepts a minimal ready module', () => {
    expect(semanticCheck(base())).toEqual([]);
  });
  it('catches unknown docs, bad regex, backwards stages and dangling corrections', () => {
    const c = base();
    c.steps.splice(
      1,
      0,
      { id: 'd', type: 'doc', stage: 3, title: 'd', docId: 'missing' },
      {
        id: 'o',
        type: 'output',
        stage: 2,
        title: 'o',
        requirements: [{ id: 'r', label: 'r', test: { type: 'rule', rule: { any: ['(unclosed'] } } }],
        messages: [{ id: 'm2', t: 1, from: 'x', text: 'y', replaces: 'm1' }],
      },
    );
    const errs = semanticCheck(c).join('\n');
    expect(errs).toMatch(/unknown doc "missing"/);
    expect(errs).toMatch(/invalid regex/);
    expect(errs).toMatch(/stage goes backwards/);
    expect(errs).toMatch(/replaces unknown/);
  });
  it('requires score metrics to be produced by a step', () => {
    const c = base();
    c.score = { parts: [{ metric: 'nope', max: 1, weight: 1, label: 'x' }] };
    expect(semanticCheck(c).join()).toMatch(/metric "nope"/);
  });
});
