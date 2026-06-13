import type { WireClaim, WireGap } from '@shared/contract'
import type { GapCategory, GapRecord, GapView } from '@/model/types'
import { isDesignGap } from '@/model/dispatch'

/**
 * Adapter: a REAL core gap (the wire shape) carries no presentation decoration —
 * the prototype's `view` fields (title/body/category/…) don't exist in the
 * pipeline contract. We derive them here so the existing role views render real
 * gaps unchanged. Orphan fields with no real source (owner, scopeImpact) are
 * dropped, not fabricated; the views already guard their absence.
 *
 * This is the seam the full model-reconciliation (T21) will formalise.
 */

const MISSING_RE = /\b(missing|absent|never (resolved|specified|defined|pinned)|undefined|no \w+ (frame|state|requirement|window))\b/i
const ASSUMPTION_RE = /\b(assume|assumed|inferred|unverified)\b/i

function deriveCategory(gap: WireGap): GapCategory {
  if (gap.kind === 'conflict') return 'conflict'
  if (isDesignGap(gap)) return 'design-gap'
  if (ASSUMPTION_RE.test(gap.summary)) return 'assumption'
  if (MISSING_RE.test(gap.summary)) return 'missing'
  return 'under-spec'
}

/** A punchy headline: the clause before the first ':' if short, else a capped summary. */
function deriveTitle(summary: string): string {
  const colonIdx = summary.indexOf(':')
  if (colonIdx > 0 && colonIdx <= 64) return summary.slice(0, colonIdx).trim()
  const firstSentence = summary.split(/(?<=[.])\s/)[0]
  if (firstSentence.length <= 70) return firstSentence
  return `${summary.slice(0, 64).trimEnd()}…`
}

/** Who the gap is conventionally waiting on, derived from its category. */
function deriveWaitingOn(category: GapCategory): string {
  switch (category) {
    case 'conflict':
      return 'PM decision'
    case 'design-gap':
    case 'under-spec':
      return 'Design'
    case 'assumption':
      return 'Verification'
    case 'missing':
      return 'Spec owner'
  }
}

export function deriveView(gap: WireGap): GapView {
  const category = deriveCategory(gap)
  const view: GapView = {
    category,
    title: deriveTitle(gap.summary),
    body: gap.summary,
    waitingOn: deriveWaitingOn(category),
    canRouteToDesign: isDesignGap(gap)
  }
  // ageDays only exists once a gap has been actioned (resolution timestamp).
  if (gap.resolution?.at) {
    const ageMs = Date.now() - Date.parse(gap.resolution.at)
    if (!Number.isNaN(ageMs)) view.ageDays = Math.max(0, Math.floor(ageMs / 86_400_000))
  }
  return view
}

/** Map a wire gap to the GapRecord the renderer views consume. */
export function toGapRecord(gap: WireGap): GapRecord {
  return {
    id: gap.id,
    kind: gap.kind,
    severity: gap.severity,
    summary: gap.summary,
    relatedClaims: gap.relatedClaims,
    evidence: gap.evidence,
    status: gap.status,
    view: deriveView(gap)
  }
}

/** Wire claims share the renderer's Claim shape verbatim — pass through. */
export function toClaims(claims: WireClaim[]): import('@/model/types').Claim[] {
  return claims.map((c) => ({ id: c.id, summary: c.summary, provenance: c.provenance }))
}
