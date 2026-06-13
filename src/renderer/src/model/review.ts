/**
 * Review model — pipeline stage 4 (Review, the `fm-reviewer` skill).
 * The Review gate is HARD-BLOCKING and dual-key: it needs BOTH a reviewer pass
 * (Verdict: PASS across the three axes) AND an explicit human sign-off.
 * This models the reviewer-pass half (decisions/prd-review.md).
 */

export type Verdict = 'PASS' | 'FAIL'
export type FindingSeverity = 'blocker' | 'warning'
export type ReviewAxis = 'traceability' | 'consistency' | 'leakage'

export const AXIS_LABEL: Record<ReviewAxis, string> = {
  traceability: 'Traceability',
  consistency: 'Internal consistency',
  leakage: 'Unresolved-gap leakage'
}

export interface Finding {
  severity: FindingSeverity
  axis: ReviewAxis
  location: string // file:locator
  finding: string
}

export interface AxisResult {
  axis: ReviewAxis
  pass: boolean
  note: string
}

export interface ReviewReport {
  engagement: string
  verdict: Verdict
  reviewedAt: string // ISO
  reviewer: string
  summary: string
  axes: AxisResult[]
  findings: Finding[]
}

/** FAIL iff there is any blocker finding; warnings are allowed under PASS. */
export function computeVerdict(findings: Finding[]): Verdict {
  return findings.some((f) => f.severity === 'blocker') ? 'FAIL' : 'PASS'
}
