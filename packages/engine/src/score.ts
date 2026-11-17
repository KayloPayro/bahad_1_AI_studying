import type { ScoreSpec } from '@lumda/schema';

export interface ScoreBreakdown {
  percent: number;
  parts: { label: string; value: number; max: number; weight: number }[];
  level?: string;
}

/** Weighted rubric score in whole percent. Missing metrics count as zero; values are clamped to max. */
export function computeScore(spec: ScoreSpec | undefined, metrics: Record<string, unknown>): ScoreBreakdown | null {
  if (!spec?.parts.length) return null;
  const totalW = spec.parts.reduce((s, p) => s + p.weight, 0) || 1;
  let acc = 0;
  const parts = spec.parts.map((p) => {
    const raw = Number(metrics[p.metric] ?? 0);
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(p.max, raw)) : 0;
    acc += (value / p.max) * p.weight;
    return { label: p.label, value, max: p.max, weight: p.weight };
  });
  const percent = Math.round((acc / totalW) * 100);
  const level = spec.levels?.find((l) => percent >= l.min)?.label;
  return { percent, parts, level };
}
