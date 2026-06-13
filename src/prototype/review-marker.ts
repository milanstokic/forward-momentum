/**
 * Soft "prototype reviewed" marker.
 *
 * Per the Prototype Module spec (§8): a "prototype reviewed" note MAY be recorded
 * but it is a SOFT signal — it must NOT hard-block Handoff or any gate. It lives
 * here, deliberately OUTSIDE the flow controller's gate machinery (gates.ts /
 * store.ts), so it can never become a gate input. It is written to decisions/ as
 * human-readable provenance only.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface PrototypeReviewMarker {
  /** Who recorded the review (identity string). */
  reviewedBy: string;
  /** ISO8601 timestamp. */
  at: string;
  /** Optional free-text note. */
  note?: string;
}

const DECISIONS_DIR = "decisions";

/**
 * Records a soft "prototype reviewed" marker as Markdown under decisions/.
 * Returns the path written. This is provenance only — it changes no gate.
 */
export function writePrototypeReviewMarker(
  repoRoot: string,
  marker: PrototypeReviewMarker
): string {
  const dir = path.join(repoRoot, DECISIONS_DIR);
  fs.mkdirSync(dir, { recursive: true });

  const safeStamp = marker.at.replace(/[:.]/g, "-");
  const filepath = path.join(dir, `${safeStamp}-prototype-reviewed.md`);

  const lines = [
    "# Prototype Reviewed (soft marker)",
    "",
    "> **Non-blocking.** This is a soft signal that a throwaway prototype was",
    "> reviewed. It does NOT gate Resolution, Review, or Handoff.",
    "",
    `| Field       | Value |`,
    `|-------------|-------|`,
    `| Reviewed by | ${marker.reviewedBy} |`,
    `| At          | ${marker.at} |`,
    "",
  ];
  if (marker.note && marker.note.trim().length > 0) {
    lines.push("## Note", "", marker.note.trim(), "");
  }

  fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
  return filepath;
}

/** True if at least one soft prototype-review marker exists. Informational only. */
export function hasPrototypeReviewMarker(repoRoot: string): boolean {
  const dir = path.join(repoRoot, DECISIONS_DIR);
  if (!fs.existsSync(dir)) return false;
  return fs
    .readdirSync(dir)
    .some((f) => f.endsWith("-prototype-reviewed.md"));
}
