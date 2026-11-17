import type { ComponentType } from 'preact';
import type { NumberIndex } from '@lumda/checkers';
import type { ModuleContent, Step } from '@lumda/schema';
import type { Identity } from '@lumda/tracking';

export interface StepContext {
  identity: Identity;
  instructor: boolean;
  /** Full text of a doc for copying. */
  docText: (id: string) => string;
  numberIndex: (id: string) => NumberIndex;
  /** Records the "ask the tool first" habit (tracked as an ask_first event). */
  askFirst: () => void;
  /** Read-only view of other steps' data, e.g. which cards were flipped earlier. */
  stepData: (stepId: string) => Record<string, unknown>;
}

export interface StepProps<S extends Step = Step> {
  step: S;
  content: ModuleContent;
  data: Record<string, unknown>;
  setData: (patch: Record<string, unknown>) => void;
  metrics: Record<string, unknown>;
  setMetric: (key: string, value: unknown) => void;
  ctx: StepContext;
}

export type StepComponent = ComponentType<StepProps<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface MountOptions {
  /** Custom step renderers, keyed by `name` of steps with type "custom". */
  plugins?: Record<string, StepComponent>;
  /** Element id to mount into (default "app"). */
  rootId?: string;
}
