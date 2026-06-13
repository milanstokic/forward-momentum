/**
 * Core domain model — mirrors the real Forward-Momentum pipeline contracts
 * (.claude/skills/fm-extraction + fm-gap-analysis). Keeping these faithful means
 * the UI can swap mock data for a real engagement's analysis/claims.json and
 * analysis/gaps.json with no refactor.
 */

/** A verbatim receipt tying a claim/gap back to its source span. */
export interface Provenance {
  sourceFile: string // e.g. "sources/kickoff-call.md"
  locator: string // line range ("L31") or timestamp ("00:12:04")
  quote: string // verbatim excerpt — copied exactly
}

/** Stage 1 output (fm-extraction). One atomic assertion + its receipts. */
export interface Claim {
  id: string // "claim-001"
  summary: string
  provenance: Provenance[] // >= 1, REQUIRED
}

export type GapKind = 'gap' | 'conflict'
export type GapSeverity = 'blocking' | 'non-blocking'
/** "open" is the only state on first emission; the others are resolution outcomes. */
export type GapStatus = 'open' | 'resolved' | 'deferred' | 'waived' | 'routed'

/** Stage 2 output (fm-gap-analysis). The reviewable unit the gate forces clear. */
export interface Gap {
  id: string // "gap-001"
  kind: GapKind
  severity: GapSeverity
  summary: string
  relatedClaims: string[]
  evidence: Provenance[] // both sides for a conflict
  status: GapStatus
}

/* ────────────────────────────────────────────────────────────────────────
 * View-model layer — display-only fields the prototypes add on top of the
 * core contract (category labels, owners, ages, body copy). These never
 * travel back into the pipeline; they decorate a Gap for the role views.
 * ──────────────────────────────────────────────────────────────────────── */

/** Finer taxonomy shown as the row badge. Derived from kind + content. */
export type GapCategory =
  | 'conflict'
  | 'missing'
  | 'assumption'
  | 'under-spec'
  | 'design-gap'

export interface Person {
  name: string
  initials: string
  role: string
}

/** Optional decoration attached to a Gap for presentation. */
export interface GapView {
  category: GapCategory
  title: string // punchy headline (the summary is the neutral restatement)
  body: string // 1-2 line elaboration
  owner?: Person
  waitingOn?: string
  ageDays?: number
  scopeImpact?: string // EM view — what build surface it touches
  canRouteToDesign?: boolean // surfaces "Send to Design"
}

/** A Gap joined with its presentation decoration — what the views render. */
export interface GapRecord extends Gap {
  view: GapView
}

/* ── Pipeline ─────────────────────────────────────────────────────────── */

export type StageStatus = 'done' | 'current' | 'locked' | 'todo'

export interface PipelineStage {
  key: string
  name: string
  status: StageStatus
  /** Project-manager view: short health note under the stage cell. */
  note?: string
}

/* ── Engagement (the loaded document) ─────────────────────────────────── */

export interface Engagement {
  slug: string // "checkout-v2"
  branch: string // "main"
  claims: Claim[]
  gaps: GapRecord[]
  stages: PipelineStage[]
}

export type Persona = 'pm' | 'pgm' | 'em' | 'dev' | 'design'

export const PERSONA_LABEL: Record<Persona, string> = {
  pm: 'Product Manager',
  pgm: 'Project Manager',
  em: 'Engineering Manager',
  dev: 'Developer',
  design: 'Designer'
}
