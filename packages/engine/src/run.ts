import { getJSON, removeItem, setJSON } from '@lumda/tracking';
import type { ModuleContent } from '@lumda/schema';

/**
 * Everything the cadet did in one module, kept on the device (pasted products never leave it).
 * Keyed by cadet + module + content version, so a content update starts a fresh run.
 */
export interface RunState {
  stepIndex: number;
  /** Highest step index reached, for the instructor jump list and back navigation. */
  maxIndex: number;
  startedAt: number | null;
  completedAt: number | null;
  score: number | null;
  data: Record<string, Record<string, unknown>>;
  metrics: Record<string, unknown>;
  chatClock: Record<string, number>;
  stepSeconds: Record<string, number>;
  askFirstUsed: number;
}

export const runKey = (pn: string, c: Pick<ModuleContent, 'id' | 'version'>) => `lumda.run.${pn}.${c.id}.${c.version}`;

export function emptyRun(): RunState {
  return {
    stepIndex: 0,
    maxIndex: 0,
    startedAt: null,
    completedAt: null,
    score: null,
    data: {},
    metrics: {},
    chatClock: {},
    stepSeconds: {},
    askFirstUsed: 0,
  };
}

export function loadRun(pn: string, c: ModuleContent): RunState {
  const r = getJSON<Partial<RunState> | null>(runKey(pn, c), null);
  const run = { ...emptyRun(), ...(r ?? {}) };
  run.stepIndex = Math.min(Math.max(0, run.stepIndex), c.steps.length - 1);
  return run;
}

export function saveRun(pn: string, c: ModuleContent, run: RunState) {
  setJSON(runKey(pn, c), run);
}

export function resetRun(pn: string, c: ModuleContent) {
  removeItem(runKey(pn, c));
}

/** Summary used by the home page and the staff view: not started / in progress / done. */
export type RunStatus = 'none' | 'progress' | 'done';
export function runStatus(pn: string, c: Pick<ModuleContent, 'id' | 'version'>): { status: RunStatus; score: number | null } {
  const r = getJSON<Partial<RunState> | null>(runKey(pn, c), null);
  if (!r || !r.startedAt) return { status: 'none', score: null };
  if (r.completedAt) return { status: 'done', score: r.score ?? null };
  return { status: 'progress', score: null };
}
