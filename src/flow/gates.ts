/**
 * Gate evaluators for the Forward-Momentum flow controller.
 *
 * All functions are pure (no I/O). They take domain data, return a GateResult.
 *
 * Gate strictness per spec:
 *   Extraction   — waivable-by-default (Product may waive)
 *   GapAnalysis  — waivable-by-default (Product may waive)
 *   Resolution   — hard-blocking; structured waiver required
 *   Review       — hard-blocking; structured waiver required
 *
 * Structured waiver validity:
 *   A waiver is VALID only when:
 *     1. `reason` is a non-empty string
 *     2. `acknowledgements.communicatedToClient` is true
 *     3. `acknowledgements.riskAccepted` is true
 *     4. `acknowledgements.revisitScheduled` is true
 *   Any failing condition keeps the gate closed.
 */

import type { Gap, GateResult } from "../model/gap.js";
import type { Waiver } from "../model/waiver.js";

// ---------------------------------------------------------------------------
// Waivable-by-default gates
// ---------------------------------------------------------------------------

/**
 * Gate: exit Extraction.
 * Blocks if no gaps are available to evaluate (pass-through to gap analysis).
 * Per spec this gate is waivable-by-default; the gate itself is trivially
 * satisfied once the extraction step has been run (the caller signals this).
 *
 * @param sourcesAcknowledged  True when at least one source has been ingested.
 */
export function canExitExtraction(sourcesAcknowledged: boolean): GateResult {
  if (!sourcesAcknowledged) {
    return {
      ok: false,
      reason: "No sources have been acknowledged; run extraction first",
      blocking: [],
    };
  }
  return { ok: true };
}

/**
 * Gate: exit GapAnalysis.
 * Blocks while a gap report has not been produced.
 *
 * @param gapReportProduced  True when gap-report.md has been generated.
 */
export function canExitGapAnalysis(gapReportProduced: boolean): GateResult {
  if (!gapReportProduced) {
    return {
      ok: false,
      reason: "Gap report has not been produced; run gap analysis first",
      blocking: [],
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Hard-blocking gates
// ---------------------------------------------------------------------------

/**
 * Gate: exit Resolution.
 * HARD-BLOCKING: remains closed while any gap with severity "blocking" has
 * status "open". Resolved, deferred, and waived gaps do not block.
 *
 * Matches the canonical spec example exactly.
 */
export function canExitResolution(gaps: Gap[]): GateResult {
  const openBlockers = gaps.filter(
    (g) => g.severity === "blocking" && g.status === "open"
  );
  return openBlockers.length === 0
    ? { ok: true }
    : {
        ok: false,
        reason: `${openBlockers.length} blocking gap(s) still open`,
        blocking: openBlockers,
      };
}

/**
 * Gate: exit Review.
 * HARD-BLOCKING: requires explicit reviewer pass and human sign-off.
 *
 * @param reviewerPassed  True when the reviewer agent QA pass completed.
 * @param humanSignedOff  True when the human explicitly signed off.
 */
export function canExitReview(reviewerPassed: boolean, humanSignedOff: boolean): GateResult {
  const missing: string[] = [];
  if (!reviewerPassed) missing.push("reviewer agent QA pass");
  if (!humanSignedOff) missing.push("human sign-off");

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Review gate requires: ${missing.join(", ")}`,
      blocking: [],
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Structured waiver validation
// ---------------------------------------------------------------------------

export type WaiverValidationResult =
  | { valid: true }
  | { valid: false; reasons: string[] };

/**
 * Validate a structured waiver for a hard-blocking gate.
 *
 * A waiver is VALID only when:
 *   1. `reason` is non-empty
 *   2. `acknowledgements.communicatedToClient` is true
 *   3. `acknowledgements.riskAccepted` is true
 *   4. `acknowledgements.revisitScheduled` is true
 *
 * Returns a typed result; if invalid, `reasons` lists every failing condition.
 */
export function validateWaiver(waiver: Waiver): WaiverValidationResult {
  const reasons: string[] = [];

  if (!waiver.reason || waiver.reason.trim() === "") {
    reasons.push("reason must be a non-empty string");
  }

  if (!waiver.acknowledgements.communicatedToClient) {
    reasons.push("acknowledgement 'communicatedToClient' must be true");
  }
  if (!waiver.acknowledgements.riskAccepted) {
    reasons.push("acknowledgement 'riskAccepted' must be true");
  }
  if (!waiver.acknowledgements.revisitScheduled) {
    reasons.push("acknowledgement 'revisitScheduled' must be true");
  }

  return reasons.length === 0 ? { valid: true } : { valid: false, reasons };
}

/**
 * Convert a WaiverValidationResult to a GateResult.
 * Useful when you need to compose waiver validity with gate evaluation.
 */
export function waiverToGateResult(result: WaiverValidationResult): GateResult {
  if (result.valid) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `Waiver invalid: ${result.reasons.join("; ")}`,
    blocking: [],
  };
}
