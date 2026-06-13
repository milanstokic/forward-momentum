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

/** One full read of an engagement, pushed to the renderer. */
export interface Snapshot {
  /** Absolute path to the engagement root on disk. */
  root: string
  /** Last path segment — a human-friendly engagement slug. */
  slug: string
  claims: WireClaim[]
  gaps: WireGap[]
  flow: WireFlowState
  /** Live evaluation of the hard-blocking Resolution gate. */
  resolutionGate: WireGateResult
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

/** IPC channel names — referenced by main, preload, and (indirectly) renderer. */
export const FM_CHANNELS = {
  /** renderer -> main (invoke): load/refresh the current engagement snapshot */
  requestSnapshot: 'fm:requestSnapshot',
  /** renderer -> main (invoke): pick a new engagement folder, returns Snapshot | null */
  openEngagement: 'fm:openEngagement',
  /** renderer -> main (invoke): apply an Intent, returns MutationResult */
  mutate: 'fm:mutate',
  /** main -> renderer (send): a fresh snapshot was produced (e.g. after a mutation) */
  snapshot: 'fm:snapshot'
} as const
