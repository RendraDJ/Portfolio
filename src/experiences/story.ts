/**
 * ★ The story of an experience (shown by board.ts): a short hook, then
 * chapters — each one a tile of the board that zooms open, with its visual;
 * the tour plays them one after the other. One file per experience in
 * ./stories, written from its report.
 */

/** What a chapter is about: sets its colour and label. */
export type ChapterTag = 'context' | 'architecture' | 'ai' | 'software' | 'robotics' | 'algorithm' | 'results' | 'demo' | 'app';

/** A block of a pipeline / architecture diagram. */
export interface PipelineStep {
  label: string;
  /** One short technical line under the label. */
  detail: string;
  kind: 'hardware' | 'data' | 'ai' | 'software' | 'ui';
}

export type Visual =
  /** Blocks joined by arrows, lighting up one by one (data flow, architecture). */
  | { type: 'pipeline'; steps: PipelineStep[] }
  /** Big numbers that count up. `value` starts with the number: "0.08 m", "24", "≈ 2 s". */
  | { type: 'stats'; items: { value: string; label: string }[] }
  /** A comparison table; the `best` row is highlighted at the end. */
  | { type: 'compare'; columns: string[]; rows: { label: string; values: string[]; best?: boolean }[]; caption?: string }
  /** A short, simplified code excerpt, typed out line by line. */
  | { type: 'code'; lang: string; code: string; caption?: string }
  /** Numbered steps, revealed one by one (how a model or algorithm works). */
  | { type: 'steps'; items: { title: string; text: string }[] }
  /** The experience's live demo (signs/demos.ts), playing by itself. */
  | { type: 'demo' }
  /** A working replica of the project's own application (apps/), driven by a
   *  guided cursor that narrates each screen. */
  | { type: 'app' };

export interface Chapter {
  tag: ChapterTag;
  title: string;
  /** The technical explanation: 2 to 4 sentences. */
  text: string;
  /** The same idea in plain words, for a non-specialist (optional). */
  plain?: string;
  /** Technical details, as short bullets (optional). */
  points?: string[];
  visual?: Visual;
}

export interface Story {
  slug: string;
  /** One punchy line: what was built and why it matters. */
  hook: string;
  chapters: Chapter[];
}
