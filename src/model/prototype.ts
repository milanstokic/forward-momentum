// Prototype module data contracts (Extension A).
// The prototype is throwaway scratch: regenerated on demand from PRD + claims + gaps.
// These types describe the two on-disk artifacts the module reads/writes —
// /prototype/manifest.json (what paths were forced) and /prototype/reactions.jsonl
// (teammate reactions anchored to a screen).

/**
 * A path chosen through one open BLOCKING gap to make the prototype clickable.
 * Recorded in the manifest and surfaced in-UI as a provisional banner.
 */
export interface ProvisionalChoice {
  /** The blocking gap this choice forces, e.g. "gap-001". */
  gapId: string;
  /** The path taken, e.g. "guest checkout". */
  choice: string;
  /** Why this path was chosen, e.g. "call @06:30". */
  rationale: string;
}

/** The prototype manifest — what was forced, and how to render the banners. */
export interface PrototypeManifest {
  /** ISO8601 timestamp of when this prototype was generated. */
  generatedAt: string;
  /** Gap ids this generation was asked to force. */
  targetGapIds: string[];
  /** One entry per forced blocking gap (may be empty when none were targeted). */
  choices: ProvisionalChoice[];
  /** Screen-ids present in this prototype — used for stale-anchor checks downstream. */
  screens: string[];
}

/** A teammate reaction, anchored to a screen (optionally an element within it). */
export interface Reaction {
  /** Stable identifier. */
  id: string;
  /** Identity string of the author (single-user demo: a config string). */
  author: string;
  /** Screen-id the reaction anchors to. */
  screen: string;
  /** Optional element selector/label within the screen. */
  element?: string;
  /** The comment text. */
  text: string;
  /** ISO8601 timestamp. */
  ts: string;
}

/**
 * Provenance anchor for downstream gap-analysis use: "prototype@<screen-id>".
 * Gaps surfaced by a reaction carry this so they trace back to the click that found them.
 */
export const protoAnchor = (screenId: string): string => `prototype@${screenId}`;
