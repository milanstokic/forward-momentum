/**
 * Pure state-machine for the Forward-Momentum flow controller.
 *
 * Stages (in order):
 *   Intake → Extraction → GapAnalysis → Resolution → PRDDraft → Review → Handoff
 *
 * Rules:
 * - Forward transitions follow the linear order above.
 * - Backward transitions are only allowed explicitly (e.g. loopback).
 * - Illegal transitions (forward-skip, invalid targets) are rejected.
 * - Loopback: when a new source arrives the flow re-opens at Extraction and
 *   every gate at or after the loopback point is reset to "pending".
 *
 * All functions are pure: they take state + event, return new state or an error.
 * No I/O is performed here.
 */

import type { FlowState, GateStatus, PerGateStatus, StageName } from "../model/flow-state.js";

// ---------------------------------------------------------------------------
// Stage ordering
// ---------------------------------------------------------------------------

export const STAGE_ORDER: StageName[] = [
  "Intake",
  "Extraction",
  "GapAnalysis",
  "Resolution",
  "PRDDraft",
  "Review",
  "Handoff",
];

export function stageIndex(name: StageName): number {
  return STAGE_ORDER.indexOf(name);
}

// ---------------------------------------------------------------------------
// Allowed forward transitions
// ---------------------------------------------------------------------------

/** The single valid next stage for each stage, or null for the terminal stage. */
const NEXT_STAGE: Record<StageName, StageName | null> = {
  Intake: "Extraction",
  Extraction: "GapAnalysis",
  GapAnalysis: "Resolution",
  Resolution: "PRDDraft",
  PRDDraft: "Review",
  Review: "Handoff",
  Handoff: null,
};

/** The single valid previous stage for each stage, or null for the initial stage. */
const PREV_STAGE: Record<StageName, StageName | null> = {
  Intake: null,
  Extraction: "Intake",
  GapAnalysis: "Extraction",
  Resolution: "GapAnalysis",
  PRDDraft: "Resolution",
  Review: "PRDDraft",
  Handoff: "Review",
};

// ---------------------------------------------------------------------------
// Transition result type
// ---------------------------------------------------------------------------

export type TransitionResult =
  | { ok: true; state: FlowState }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Gate key helper
// ---------------------------------------------------------------------------

/**
 * Returns the gate key that guards the EXIT of a given stage, or null if the
 * stage does not have an associated exit gate.
 *
 * Gate layout per spec:
 *   Extraction exit  → "Extraction" gate
 *   GapAnalysis exit → "GapAnalysis" gate
 *   Resolution exit  → "Resolution" gate
 *   Review exit      → "Review" gate
 */
function exitGateFor(stage: StageName): keyof PerGateStatus | null {
  const map: Partial<Record<StageName, keyof PerGateStatus>> = {
    Extraction: "Extraction",
    GapAnalysis: "GapAnalysis",
    Resolution: "Resolution",
    Review: "Review",
  };
  return map[stage] ?? null;
}

// ---------------------------------------------------------------------------
// initialFlowState
// ---------------------------------------------------------------------------

export function initialFlowState(updatedAt: string): FlowState {
  return {
    currentStage: "Intake",
    gates: {
      Extraction: "pending",
      GapAnalysis: "pending",
      Resolution: "pending",
      Review: "pending",
    },
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// advanceStage — move forward one stage
// ---------------------------------------------------------------------------

/**
 * Attempt to advance the flow from the current stage to the next stage.
 *
 * The caller is responsible for ensuring the exit gate has already been
 * evaluated (passed/waived) before calling this — or for accepting that the
 * gate check is intentionally skipped (e.g. Intake has no gate).
 *
 * @param state  Current flow state.
 * @param updatedAt  Caller-supplied timestamp; never call Date.now() internally.
 */
export function advanceStage(state: FlowState, updatedAt: string): TransitionResult {
  const next = NEXT_STAGE[state.currentStage];
  if (next === null) {
    return {
      ok: false,
      reason: `Cannot advance from terminal stage "${state.currentStage}"`,
    };
  }

  const gateKey = exitGateFor(state.currentStage);
  if (gateKey !== null) {
    const gateStatus = state.gates[gateKey];
    if (gateStatus !== "passed" && gateStatus !== "waived") {
      return {
        ok: false,
        reason: `Gate "${gateKey}" must be passed or waived before advancing from "${state.currentStage}" (current status: ${gateStatus})`,
      };
    }
  }

  return {
    ok: true,
    state: { ...state, currentStage: next, updatedAt },
  };
}

// ---------------------------------------------------------------------------
// retreatStage — move backward one stage
// ---------------------------------------------------------------------------

/**
 * Retreat the flow to the previous stage. Gate statuses are NOT reset here —
 * use loopbackOnNewInput for a full loopback.
 */
export function retreatStage(state: FlowState, updatedAt: string): TransitionResult {
  const prev = PREV_STAGE[state.currentStage];
  if (prev === null) {
    return {
      ok: false,
      reason: `Cannot retreat from initial stage "${state.currentStage}"`,
    };
  }
  return {
    ok: true,
    state: { ...state, currentStage: prev, updatedAt },
  };
}

// ---------------------------------------------------------------------------
// transitionTo — explicit stage jump (for testing / admin use)
// ---------------------------------------------------------------------------

/**
 * Jump directly to a target stage. Only forward-adjacent and backward-adjacent
 * moves are allowed (i.e. a single step forward or backward). Larger jumps are
 * rejected to prevent accidental gate-skipping.
 *
 * For loopbacks spanning multiple stages use loopbackOnNewInput.
 */
export function transitionTo(
  state: FlowState,
  target: StageName,
  updatedAt: string
): TransitionResult {
  if (target === state.currentStage) {
    return {
      ok: false,
      reason: `Already at stage "${target}"`,
    };
  }

  const currentIdx = stageIndex(state.currentStage);
  const targetIdx = stageIndex(target);
  const delta = targetIdx - currentIdx;

  // Only single-step moves allowed through transitionTo
  if (delta === 1) {
    return advanceStage(state, updatedAt);
  }
  if (delta === -1) {
    return retreatStage(state, updatedAt);
  }

  return {
    ok: false,
    reason: `Illegal transition from "${state.currentStage}" to "${target}" — only single-step moves are allowed via transitionTo; use loopbackOnNewInput for multi-step loopbacks`,
  };
}

// ---------------------------------------------------------------------------
// loopbackOnNewInput — re-open flow when a new source arrives
// ---------------------------------------------------------------------------

/**
 * When a new input source is added, the flow re-opens at Extraction.
 * All gates at or after Extraction are reset to "pending" so that the
 * downstream analysis must be re-run.
 *
 * The loopback target is always Extraction (per spec: "new input re-opens
 * earlier stages" — specifically, Extraction is the earliest affected stage
 * because new sources require re-extraction and re-gap-analysis).
 */
export const LOOPBACK_TARGET: StageName = "Extraction";

export function loopbackOnNewInput(state: FlowState, updatedAt: string): FlowState {
  const loopbackIdx = stageIndex(LOOPBACK_TARGET);

  const updatedGates: PerGateStatus = { ...state.gates };

  // Reset all gates whose stage index is >= loopbackIdx
  const gateEntries: Array<[keyof PerGateStatus, StageName]> = [
    ["Extraction", "Extraction"],
    ["GapAnalysis", "GapAnalysis"],
    ["Resolution", "Resolution"],
    ["Review", "Review"],
  ];

  for (const [gateKey, gateStageName] of gateEntries) {
    if (stageIndex(gateStageName) >= loopbackIdx) {
      updatedGates[gateKey] = "pending" as GateStatus;
    }
  }

  return {
    currentStage: LOOPBACK_TARGET,
    gates: updatedGates,
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// passGate / waiveGate — record gate passage in state
// ---------------------------------------------------------------------------

/**
 * Mark a gate as passed. No validation is done here — the caller must have
 * already run the appropriate gate evaluator from gates.ts.
 */
export function passGate(
  state: FlowState,
  gate: keyof PerGateStatus,
  updatedAt: string
): FlowState {
  return {
    ...state,
    gates: { ...state.gates, [gate]: "passed" as GateStatus },
    updatedAt,
  };
}

/**
 * Mark a gate as waived. No validation is done here — the caller must have
 * already called validateWaiver from gates.ts and confirmed it is valid.
 */
export function waiveGate(
  state: FlowState,
  gate: keyof PerGateStatus,
  updatedAt: string
): FlowState {
  return {
    ...state,
    gates: { ...state.gates, [gate]: "waived" as GateStatus },
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// validNextStages — introspection helper
// ---------------------------------------------------------------------------

/**
 * Returns the set of stage names reachable from the current stage via a
 * single forward move (without gate checks). Useful for UI rendering.
 */
export function validNextStages(current: StageName): StageName[] {
  const next = NEXT_STAGE[current];
  return next !== null ? [next] : [];
}

/**
 * Returns the set of stage names reachable from the current stage via a
 * single backward move. Useful for UI rendering.
 */
export function validPrevStages(current: StageName): StageName[] {
  const prev = PREV_STAGE[current];
  return prev !== null ? [prev] : [];
}
