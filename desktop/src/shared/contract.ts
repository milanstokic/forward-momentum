/**
 * IPC contract between the Electron main process (Domain Host) and the renderer.
 *
 * This is the single wire format both sides agree on. The shapes mirror the
 * repo-root `src/` core (model/claim, model/gap, model/flow-state) exactly so
 * the Domain Host can hand core values straight across structurally — but they
 * are declared here, not imported, so the renderer never has to reach outside
 * `desktop/` into the core's CommonJS build.
 */

export interface WireProvenance {
  sourceFile: string
  locator: string
  quote: string
}

export interface WireClaim {
  id: string
  summary: string
  provenance: WireProvenance[]
}

export type WireGapKind = 'gap' | 'conflict'
export type WireGapSeverity = 'blocking' | 'non-blocking'
/** The REAL gap lifecycle — note: no invented `routed` state (that is a dispatch concern). */
export type WireGapStatus = 'open' | 'resolved' | 'deferred' | 'waived'

export interface WireGap {
  id: string
  kind: WireGapKind
  severity: WireGapSeverity
  summary: string
  relatedClaims: string[]
  evidence: WireProvenance[]
  status: WireGapStatus
  resolution?: {
    by: string
    reason: string
    at: string
  }
}

export type WireStageName =
  | 'Intake'
  | 'Extraction'
  | 'GapAnalysis'
  | 'Resolution'
  | 'PRDDraft'
  | 'Review'
  | 'Handoff'

export type WireGateStatus = 'pending' | 'passed' | 'waived' | 'blocked'

export interface WireFlowState {
  currentStage: WireStageName
  gates: {
    Extraction: WireGateStatus
    GapAnalysis: WireGateStatus
    Resolution: WireGateStatus
    Review: WireGateStatus
  }
  updatedAt: string
}

/** Flattened GateResult for the wire: ok + reason + the ids of blocking gaps. */
export interface WireGateResult {
  ok: boolean
  reason?: string
  blockingIds: string[]
}

/* ── PRD / SPEC (parsed from prd/PRD.md + spec/SPEC.md) ──────────────────────
 * Structurally identical to the renderer's @/model/prd types, so a parsed
 * WirePrdDoc satisfies PrdDoc directly (and the prd.ts helpers operate on it).
 */
export interface WirePrdCitation {
  claimIds: string[]
  decisionId?: string
  sourceFile: string
  locator: string
  quote: string
  isDecision?: boolean
}
export interface WireAssertion {
  id: string
  text: string
  citations: WirePrdCitation[]
  pending?: boolean
}
export interface WirePrdSection {
  title: string
  intro?: string
  numbered?: boolean
  variant?: 'normal' | 'decisions' | 'open-questions'
  assertions: WireAssertion[]
}
export interface WireContractField {
  id: string
  field: string
  note: string
  citations: WirePrdCitation[]
  gated?: boolean
}
export interface WireContractGroup {
  name: string
  endpoint?: string
  fields: WireContractField[]
}
export interface WirePrdDoc {
  engagement: string
  human: WirePrdSection[]
  spec: WirePrdSection[]
  contracts: WireContractGroup[]
}

/* ── Review (parsed from decisions/prd-review.md) ───────────────────────────── */
export type WireVerdict = 'PASS' | 'FAIL'
export type WireFindingSeverity = 'blocker' | 'warning'
export type WireReviewAxis = 'traceability' | 'consistency' | 'leakage'
export interface WireFinding {
  severity: WireFindingSeverity
  axis: WireReviewAxis
  location: string
  finding: string
}
export interface WireAxisResult {
  axis: WireReviewAxis
  pass: boolean
  note: string
}
export interface WireReviewReport {
  engagement: string
  verdict: WireVerdict
  reviewedAt: string
  reviewer: string
  summary: string
  axes: WireAxisResult[]
  findings: WireFinding[]
}

/* ── Handoff dispatch (tasks/dispatch.json) ─────────────────────────────────── */
export type WireDispatchMode = 'live' | 'dry-run'
export type WireDispatchStatus = 'dispatched' | 'skipped-already-dispatched'
export interface WireDispatchEntry {
  gapId: string
  summary: string
  mode: WireDispatchMode
  issueNumber?: number
  issueUrl: string
  dispatchedAt: string
  status: WireDispatchStatus
}

/** One full read of an engagement, pushed to the renderer. */
export interface Snapshot {
  /** Absolute path to the engagement root on disk. */
  root: string
  /** Last path segment — a human-friendly engagement slug. */
  slug: string
  /** Filenames present in the engagement's sources/ dir (the Intake material). */
  sources: string[]
  claims: WireClaim[]
  gaps: WireGap[]
  flow: WireFlowState
  /** Live evaluation of the hard-blocking Resolution gate. */
  resolutionGate: WireGateResult
  /** Parsed PRD + SPEC (null until prd/PRD.md exists). */
  prd: WirePrdDoc | null
  /** Parsed reviewer report (null until decisions/prd-review.md exists). */
  review: WireReviewReport | null
  /** Handoff dispatch state from tasks/dispatch.json, keyed by gap id. */
  dispatch: Record<string, WireDispatchEntry>
}

/** Three acknowledgements that make a hard-gate waiver valid. */
export interface WireAcknowledgements {
  communicatedToClient: boolean
  riskAccepted: boolean
  revisitScheduled: boolean
}

/**
 * A mutation the renderer asks the Domain Host to apply to the engagement files.
 * The host runs the core (gates / state-machine) and rewrites gaps.json /
 * .flow/state.json / decisions/ accordingly — the renderer never writes.
 */
export type Intent =
  | { type: 'resolveGap'; gapId: string; by?: string; reason?: string }
  | { type: 'deferGap'; gapId: string; by?: string; reason?: string }
  | {
      type: 'waiveGap'
      gapId: string
      by?: string
      reason: string
      acknowledgements: WireAcknowledgements
    }
  | { type: 'advanceResolution'; by?: string }
  /** PRDDraft → Review (no gate; the PRD has been drafted). */
  | { type: 'handToReview'; by?: string }
  /** Review → Handoff: human sign-off on top of the reviewer PASS (dual-key gate). */
  | { type: 'signOffReview'; by?: string }
  /** Handoff: dispatch design gaps to GitHub Issues (idempotent), writing tasks/dispatch.json. */
  | { type: 'dispatchTasks'; mode?: WireDispatchMode; by?: string }

/** Result of applying an Intent. On success `snapshot` is the fresh read. */
export interface MutationResult {
  ok: boolean
  /** Human-readable failure (e.g. gate still closed, gap not found). */
  error?: string
  /** Per-field waiver validation failures (waiveGap only). */
  validationErrors?: string[]
  /** The post-mutation snapshot (also returned on a no-op failure for re-render). */
  snapshot: Snapshot | null
}

/** Result of running a pipeline stage's agent (the `claude` CLI) via the host. */
export interface AgentRunResult {
  ok: boolean
  stage: WireStageName
  /** The slash command that was run, e.g. "/fm-gaps". */
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
  /** Set when the run could not start / timed out / had no command. */
  error?: string
  /** Fresh read after the agent regenerated files (gaps.json, PRD.md, …). */
  snapshot: Snapshot | null
}

/** IPC channel names — referenced by main, preload, and (indirectly) renderer. */
export const FM_CHANNELS = {
  /** renderer -> main (invoke): load/refresh the current engagement snapshot */
  requestSnapshot: 'fm:requestSnapshot',
  /** renderer -> main (invoke): pick a new engagement folder, returns Snapshot | null */
  openEngagement: 'fm:openEngagement',
  /** renderer -> main (invoke): apply an Intent, returns MutationResult */
  mutate: 'fm:mutate',
  /** renderer -> main (invoke): run a stage's agent (claude CLI), returns AgentRunResult */
  runStage: 'fm:runStage',
  /** main -> renderer (send): a fresh snapshot was produced (e.g. after a mutation) */
  snapshot: 'fm:snapshot'
} as const
