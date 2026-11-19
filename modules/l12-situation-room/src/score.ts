import { runAutoTest } from '@lumda/checkers';
import type { Requirement, Sample } from '@lumda/schema';

/** Settings of the shift step, read from content.json (`data`). */
export interface ShiftConfig {
  opening: Sample;
  interim: { requirements: Requirement[]; samples?: Sample[]; limitMin: number };
  final: { requirements: Requirement[]; samples?: Sample[]; numbersDoc?: string; limitMin: number };
  /** The rubric components of the final brief: which requirement ids belong to which metric. */
  groups: { key: string; metric: string; label: string; weight: number; ids: string[] }[];
  interimMetric: string;
}

/** What the shift step stores for this cadet. Times are epoch milliseconds. */
export interface ShiftData {
  t0?: number;
  interimText?: string;
  interimChecked?: boolean;
  interimAt?: number;
  finalText?: string;
  finalChecked?: boolean;
  finalManual?: Record<string, boolean>;
  finalAt?: number;
}

export interface ShiftScore {
  interimDone: boolean;
  interimMet: number;
  interimTotal: number;
  interimOnTime: boolean;
  /** 0 to 1: requirements met of all of them. Zero until submitted. The time is information only. */
  interimFrac: number;
  groups: { key: string; metric: string; label: string; weight: number; met: number; total: number; frac: number }[];
  finalDone: boolean;
  onTime: boolean;
  /** Minutes from the start of the shift to the final submission. */
  finalMinutes: number | null;
}

export const auto = (reqs: Requirement[], text: string) =>
  reqs.map((req) => ({ req, auto: req.test ? runAutoTest(req.test, text) : null }));

/**
 * Everything the score takes from the shift, computed from the cadet's own actions: what the interim update and the
 * final brief contain, and whether each was submitted within its time. The tool's behaviour does not enter.
 * Nothing counts before the cadet submits.
 */
export function scoreShift(cfg: ShiftConfig, d: ShiftData): ShiftScore {
  const t0 = d.t0 ?? 0;
  const iev = auto(cfg.interim.requirements, d.interimText ?? '');
  const interimDone = typeof d.interimAt === 'number';
  const interimMet = iev.filter((e) => e.auto?.pass).length;
  const interimOnTime = interimDone && (d.interimAt as number) - t0 <= cfg.interim.limitMin * 60_000;
  const interimTotal = iev.length;
  const interimFrac = interimDone ? interimMet / interimTotal : 0;

  const fev = auto(cfg.final.requirements, d.finalText ?? '');
  const manual = d.finalManual ?? {};
  const metOf = (id: string) => {
    const e = fev.find((x) => x.req.id === id);
    return e ? (e.auto ? e.auto.pass : Boolean(manual[id])) : false;
  };
  const finalDone = typeof d.finalAt === 'number';
  const groups = cfg.groups.map((g) => {
    const met = g.ids.filter(metOf).length;
    return { key: g.key, metric: g.metric, label: g.label, weight: g.weight, met, total: g.ids.length, frac: finalDone ? met / g.ids.length : 0 };
  });
  const finalMinutes = finalDone ? ((d.finalAt as number) - t0) / 60_000 : null;
  const onTime = finalDone && (d.finalAt as number) - t0 <= cfg.final.limitMin * 60_000;
  return { interimDone, interimMet, interimTotal, interimOnTime, interimFrac, groups, finalDone, onTime, finalMinutes };
}
