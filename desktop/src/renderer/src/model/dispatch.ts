/**
 * Handoff model — pipeline stage 5 (Handoff, the `fm-tasks` skill).
 * Dispatches design gaps to a GitHub Project as Issues and records the result
 * in tasks/dispatch.json. Runs live (with a credential) or dry-run (without).
 */
import type { Gap } from './types'

export type DispatchMode = 'live' | 'dry-run'
export type DispatchStatus = 'dispatched' | 'skipped-already-dispatched'

export interface DispatchEntry {
  gapId: string
  summary: string
  mode: DispatchMode
  issueNumber?: number // only when mode === "live"
  issueUrl: string // GitHub issue URL (live) or "dry-run"
  dispatchedAt: string // ISO
  status: DispatchStatus
}

/** The skill's documented design-task signal. */
const DESIGN_RE = /design|frame|mock|screen|ui\b|ux\b|figma|wireframe|layout|visual/i

/**
 * A gap is a design task when ALL hold (per fm-tasks):
 *  1. kind === "gap"  (conflicts are product/architecture disputes, not Figma tasks)
 *  2. its summary matches the design signal, OR a source is a design reference.
 */
export function isDesignGap(g: Gap): boolean {
  if (g.kind !== 'gap') return false
  if (DESIGN_RE.test(g.summary)) return true
  return g.evidence.some((e) => /design/i.test(e.sourceFile))
}

/** Why a gap was excluded from design dispatch (for heuristic transparency). */
export function exclusionReason(g: Gap): string {
  if (g.kind === 'conflict') return 'conflict — product/architecture dispute, not a Figma task'
  return 'requirement gap — no design signal in summary or sources'
}

/** GitHub issue title: "[Design] <summary truncated at 120>". */
export function issueTitle(summary: string): string {
  const t = summary.length > 120 ? `${summary.slice(0, 117)}…` : summary
  return `[Design] ${t}`
}

export const DISPATCH_LABELS = ['design', 'forward-momentum'] as const
export const GITHUB_REPO = 'htec/checkout-v2'
