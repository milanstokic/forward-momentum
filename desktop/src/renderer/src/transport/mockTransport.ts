import type { Intent, MutationResult, Snapshot, WireGap, WireGapStatus } from '@shared/contract'
import { checkoutV2 } from '@/data/checkoutV2'
import type { GapRecord } from '@/model/types'
import type { Transport } from './types'

/** Strip the renderer-only `view` decoration back down to the core wire gap. */
function toWireGap(g: GapRecord): WireGap {
  // The mock never carries the invented `routed` status, but coerce defensively.
  const status: WireGapStatus = g.status === 'routed' ? 'deferred' : g.status
  return {
    id: g.id,
    kind: g.kind,
    severity: g.severity,
    summary: g.summary,
    relatedClaims: g.relatedClaims,
    evidence: g.evidence,
    status
  }
}

function recomputeGate(snap: Snapshot): void {
  const blockingIds = snap.gaps
    .filter((g) => g.severity === 'blocking' && g.status === 'open')
    .map((g) => g.id)
  snap.resolutionGate =
    blockingIds.length === 0
      ? { ok: true, blockingIds: [] }
      : { ok: false, reason: `${blockingIds.length} blocking gap(s) still open`, blockingIds }
}

function freshSnapshot(): Snapshot {
  const snap: Snapshot = {
    root: '(mock)/checkout-v2',
    slug: checkoutV2.slug,
    claims: checkoutV2.claims.map((c) => ({
      id: c.id,
      summary: c.summary,
      provenance: c.provenance
    })),
    gaps: checkoutV2.gaps.map(toWireGap),
    flow: {
      currentStage: 'Resolution',
      gates: { Extraction: 'passed', GapAnalysis: 'passed', Resolution: 'pending', Review: 'pending' },
      updatedAt: new Date().toISOString()
    },
    resolutionGate: { ok: true, blockingIds: [] }
  }
  recomputeGate(snap)
  return snap
}

// In-memory engagement the mock backend mutates, so browser dev exercises the
// same Intent API as the live Electron host.
let current: Snapshot = freshSnapshot()

function snap(): MutationResult {
  return { ok: true, snapshot: structuredClone(current) }
}

function applyMock(intent: Intent): MutationResult {
  const now = new Date().toISOString()
  if (intent.type === 'advanceResolution') {
    if (!current.resolutionGate.ok) {
      return { ok: false, error: `Cannot advance: ${current.resolutionGate.reason}`, snapshot: structuredClone(current) }
    }
    current.flow = { ...current.flow, currentStage: 'PRDDraft', gates: { ...current.flow.gates, Resolution: 'passed' }, updatedAt: now }
    return snap()
  }

  const gap = current.gaps.find((g) => g.id === intent.gapId)
  if (!gap) return { ok: false, error: `Gap "${intent.gapId}" not found.`, snapshot: structuredClone(current) }

  if (intent.type === 'waiveGap') {
    const a = intent.acknowledgements
    const errs: string[] = []
    if (!intent.reason || intent.reason.trim() === '') errs.push('reason must be a non-empty string')
    if (!a.communicatedToClient) errs.push("acknowledgement 'communicatedToClient' must be true")
    if (!a.riskAccepted) errs.push("acknowledgement 'riskAccepted' must be true")
    if (!a.revisitScheduled) errs.push("acknowledgement 'revisitScheduled' must be true")
    if (errs.length > 0) return { ok: false, error: 'Waiver invalid.', validationErrors: errs, snapshot: structuredClone(current) }
    gap.status = 'waived'
    gap.resolution = { by: intent.by ?? 'desktop', reason: intent.reason, at: now }
    current.flow = { ...current.flow, gates: { ...current.flow.gates, Resolution: 'waived' } }
  } else {
    gap.status = intent.type === 'resolveGap' ? 'resolved' : 'deferred'
    gap.resolution = { by: intent.by ?? 'desktop', reason: intent.reason ?? `${gap.status} via mock`, at: now }
  }
  recomputeGate(current)
  return snap()
}

/** In-browser backend: serves + mutates the bundled checkoutV2 fixture in memory. */
export const mockTransport: Transport = {
  isLive: false,
  loadSnapshot: () => {
    current = freshSnapshot()
    return Promise.resolve(structuredClone(current))
  },
  openEngagement: () => {
    current = freshSnapshot()
    return Promise.resolve(structuredClone(current))
  },
  mutate: (intent) => Promise.resolve(applyMock(intent)),
  onSnapshot: () => () => {}
}
