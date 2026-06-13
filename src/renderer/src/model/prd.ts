/**
 * PRD-draft model — pipeline stage 3 (PRDDraft, the `fm-prd` skill).
 * The product's thesis: the PRD is the *receipt*. Every assertion carries a
 * provenance citation `[claim-id · sourceFile:locator]` that rests on a resolved
 * claim or a recorded decision. An uncited assertion fails the build.
 */

export interface PrdCitation {
  /** claim ids backing this assertion, e.g. ["claim-004"]. */
  claimIds: string[]
  /** when the assertion rests on a recorded resolution, the gap/conflict id. */
  decisionId?: string
  sourceFile: string // "sources/discovery-call.md" or "decisions/<file>.md"
  locator: string // timestamp / line / section
  quote: string // verbatim source span, or the recorded decision text
  /** true when this citation points at a decisions/ record rather than a source. */
  isDecision?: boolean
}

export interface Assertion {
  id: string // stable key for selection
  text: string
  citations: PrdCitation[]
  /** open question — a non-blocking gap still pending, not yet settled. */
  pending?: boolean
}

export interface PrdSection {
  title: string
  /** non-assertion connective tissue (no citation required). */
  intro?: string
  /** acceptance criteria render as a numbered list. */
  numbered?: boolean
  variant?: 'normal' | 'decisions' | 'open-questions'
  assertions: Assertion[]
}

export interface ContractField {
  id: string
  field: string // "order.accountId: string"
  note: string
  citations: PrdCitation[]
  gated?: boolean
}

export interface ContractGroup {
  name: string
  endpoint?: string
  fields: ContractField[]
}

export interface PrdDoc {
  engagement: string
  human: PrdSection[] // prd/PRD.md
  spec: PrdSection[] // spec/SPEC.md (ACs, non-goals, edge cases)
  contracts: ContractGroup[] // spec/SPEC.md — Data / API Contracts
}

/** Format a citation as the bracketed token shown at the end of an assertion. */
export function citationToken(c: PrdCitation): string {
  const ids = [...c.claimIds]
  if (c.decisionId) ids.push(c.decisionId)
  const file = c.sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '') ?? c.sourceFile
  return `${ids.join(', ')} · ${file}:${c.locator}`
}

/** Every assertion + contract line that should carry a citation, for the
 *  traceability meter (mirrors tests/golden/prd-traceability.test.ts). */
export function traceability(doc: PrdDoc): { total: number; cited: number } {
  let total = 0
  let cited = 0
  const count = (cs: PrdCitation[]): void => {
    total += 1
    if (cs.length > 0) cited += 1
  }
  for (const s of [...doc.human, ...doc.spec]) for (const a of s.assertions) count(a.citations)
  for (const g of doc.contracts) for (const f of g.fields) count(f.citations)
  return { total, cited }
}
