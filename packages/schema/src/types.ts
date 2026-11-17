import type { AutoTest } from '@lumda/checkers';

/**
 * A module (לומדה) is one JSON file. The engine renders it; module code only adds custom step types.
 * Text fields support a tiny inline markup: **bold** and line breaks.
 */
export interface ModuleContent {
  id: string; // "L01"
  slug: string; // "l01" — also the URL path
  version: string; // content version, sent with every tracking event
  status: 'ready' | 'draft';
  title: string;
  subtitle?: string;
  minutes: number;
  tools: string[];
  units: number[];
  /** One sentence: what the cadet can do at the end. */
  outcome: string;
  docs?: Record<string, Doc>;
  steps: Step[];
  score?: ScoreSpec;
  instructorScript?: InstructorScript;
}

export interface Doc {
  title: string;
  sub?: string;
  paragraphs: { title: string; text: string }[];
}

export interface ChatMessage {
  id: string;
  /** Seconds from the moment the step opens. */
  t: number;
  from: string;
  role?: string;
  /** Clock time inside the scenario, e.g. "21:42". */
  time?: string;
  text: string;
  /** Id of an earlier message this one corrects. */
  replaces?: string;
}

export interface Requirement {
  id: string;
  label: string;
  /** When absent the requirement is marked manually by the cadet. */
  test?: AutoTest;
  hint?: string;
}

export interface Sample {
  label: string;
  text: string;
}

export interface Card {
  id: string;
  topic: string;
  text: string;
}

export interface KeyItem {
  title: string;
  tag: string;
  safety?: boolean;
  src: string;
  ai: string;
  why: string;
}

export interface ScorePart {
  metric: string;
  max: number;
  weight: number;
  label: string;
}

export interface ScoreSpec {
  parts: ScorePart[];
  /** Thresholds on the final percent, highest first. */
  levels?: { min: number; label: string }[];
}

export interface InstructorScript {
  title: string;
  rows: [string, string, string][];
  notes?: string[];
}

interface StepBase {
  id: string;
  title: string;
  /** Which of the 7 uniform stages this screen belongs to (1 card … 7 bonus). */
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  budgetSec?: number;
  body?: string[];
  /** "Why this is right" — opens on tap. */
  why?: string;
  /** Instructor-only note. */
  instructor?: string;
  /** Messages that arrive in the chat while this step is open. */
  messages?: ChatMessage[];
}

export interface IntroStep extends StepBase {
  type: 'intro';
}
export interface ChatStep extends StepBase {
  type: 'chat';
  messages: ChatMessage[];
}
export interface DocStep extends StepBase {
  type: 'doc';
  docId: string;
}
export interface CardsStep extends StepBase {
  type: 'cards';
  cards: Card[];
  /** "all": a single reveal button; "flip": each card flips on tap and the count is recorded. */
  mode: 'all' | 'flip';
  metric?: string;
  /** Metric key that stores which card ids were flipped (for later steps). */
  saveAs?: string;
  /** Prompt templates shown above the cards (copy + open in tool). */
  snippets?: Sample[];
}
export interface PromptStep extends StepBase {
  type: 'prompt';
  requirements?: Requirement[];
  samples?: Sample[];
  /** Shows the "ask me first" button that appends the reverse-prompting line. */
  askFirst?: boolean;
  /** Doc to offer for copying together with the prompt. */
  docId?: string;
  metric?: string;
  placeholder?: string;
}
export interface OutputStep extends StepBase {
  type: 'output';
  requirements: Requirement[];
  samples?: Sample[];
  /** Run the number check against this doc. */
  numbersDoc?: string;
  metric?: string;
}
export interface FindingsStep extends StepBase {
  type: 'findings';
  count: number;
  hints?: string;
  /** A ready product "prepared by another officer" to verify. */
  product?: { title: string; text: string };
  /** Run the number check on the product against this doc. */
  numbersDoc?: string;
}
export interface ChecklistStep extends StepBase {
  type: 'checklist';
  items: { id: string; label: string }[];
  metric: string;
  /** Text shown above the list, e.g. what to compare against. */
  prompt?: string;
}
export interface TextStep extends StepBase {
  type: 'text';
  snippets?: Sample[];
}
export interface FreeTextStep extends StepBase {
  type: 'freetext';
  label: string;
  rows?: number;
  placeholder?: string;
  snippets?: Sample[];
  /** Saves the text into the per-cadet prompt library. */
  library?: boolean;
}
export interface KeyStep extends StepBase {
  type: 'key';
  final?: { label: string; rows?: number };
  items: KeyItem[];
  note?: string;
  metric: string;
  levels?: { min: number; label: string }[];
  example?: { title: string; paragraphs: string[] };
  discussion?: string[];
  message?: string;
}
export interface BonusStep extends StepBase {
  type: 'bonus';
  lines: string[];
}
export interface CustomStep extends StepBase {
  type: 'custom';
  name: string;
  data?: Record<string, unknown>;
  metric?: string;
}

export type Step =
  | IntroStep
  | ChatStep
  | DocStep
  | CardsStep
  | PromptStep
  | OutputStep
  | FindingsStep
  | ChecklistStep
  | TextStep
  | FreeTextStep
  | KeyStep
  | BonusStep
  | CustomStep;

export type StepType = Step['type'];

export const STAGE_LABELS: Record<Step['stage'], string> = {
  1: 'כרטיס לומדה',
  2: 'תרחיש פתיחה',
  3: 'רקע',
  4: 'עבודה בכלי',
  5: 'בדיקה',
  6: 'מפתח ומשוב',
  7: 'בונוס וסיום',
};
