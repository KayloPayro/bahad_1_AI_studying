import type { ModuleContent, Step } from './types';

/**
 * Checks the JSON Schema cannot express: cross references, regex validity, metric wiring.
 * Returns a list of human-readable problems (empty = OK).
 */
export function semanticCheck(c: ModuleContent): string[] {
  const errs: string[] = [];
  const stepIds = new Set<string>();
  const metrics = new Set<string>();
  const docs = c.docs ?? {};

  if (c.slug !== c.id.toLowerCase()) errs.push(`slug "${c.slug}" does not match id "${c.id}"`);

  const checkRegex = (src: string, where: string, flags = 'u') => {
    try {
      new RegExp(src, flags);
    } catch (e) {
      errs.push(`${where}: invalid regex ${JSON.stringify(src)} (${(e as Error).message})`);
    }
  };

  const messageIds = new Set<string>();
  c.steps.forEach((s: Step, i) => {
    const where = `steps[${i}] "${s.id}"`;
    if (stepIds.has(s.id)) errs.push(`${where}: duplicate step id`);
    stepIds.add(s.id);

    if (i > 0 && s.stage < c.steps[i - 1]!.stage) errs.push(`${where}: stage goes backwards`);

    for (const m of s.messages ?? []) {
      if (messageIds.has(m.id)) errs.push(`${where}: duplicate message id "${m.id}"`);
      if (m.replaces && !messageIds.has(m.replaces))
        errs.push(`${where}: message "${m.id}" replaces unknown or later message "${m.replaces}"`);
      messageIds.add(m.id);
    }

    const docRef = 'docId' in s ? s.docId : 'numbersDoc' in s ? s.numbersDoc : undefined;
    if (docRef && !docs[docRef]) errs.push(`${where}: unknown doc "${docRef}"`);

    if ('requirements' in s && s.requirements) {
      for (const r of s.requirements) {
        const t = r.test;
        if (!t) continue;
        if (t.type === 'rule' || t.type === 'firstLine') {
          const f = t.rule.flags ?? 'u';
          [...(t.rule.any ?? []), ...(t.rule.all ?? []), ...(t.rule.none ?? [])].forEach((x) =>
            checkRegex(x, `${where} req ${r.id}`, f),
          );
        }
        if (t.type === 'noTimeWindow') [...t.keywords, ...(t.unless ?? [])].forEach((x) => checkRegex(x, where));
      }
    }
    if ('metric' in s && s.metric) metrics.add(s.metric);
    if (s.type === 'custom' && Array.isArray(s.data?.produces)) for (const m of s.data.produces) metrics.add(String(m));
  });

  if (c.steps[0]?.type !== 'intro') errs.push('first step must be type "intro"');
  if (c.status === 'ready' && c.steps.at(-1)?.type !== 'bonus') errs.push('a ready module must end with a "bonus" step');

  for (const p of c.score?.parts ?? []) {
    if (!metrics.has(p.metric)) errs.push(`score part "${p.label}" uses metric "${p.metric}" no step produces`);
  }
  return errs;
}
