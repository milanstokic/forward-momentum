import { create } from 'zustand'
import type {
  Engagement,
  GapRecord,
  GapStatus,
  PipelineStage,
  Persona
} from '@/model/types'
import { checkoutV2 } from '@/data/checkoutV2'

/** A blocking gap holds the gate shut only while it is still open. */
const isOpenBlocker = (g: GapRecord): boolean =>
  g.severity === 'blocking' && g.status === 'open'

const gateClosed = (gaps: GapRecord[]): boolean => gaps.some(isOpenBlocker)

/**
 * Recompute pipeline stage states from the live gate.
 * Gap-analysis stays done once we're past it; Resolution unlocks the moment the
 * last blocking item clears; once the team Advances, Resolution is done and
 * PRD draft becomes the new "current" frontier.
 */
function deriveStages(
  base: PipelineStage[],
  gaps: GapRecord[],
  advanced: boolean
): PipelineStage[] {
  const closed = gateClosed(gaps)
  const openBlockers = gaps.filter(isOpenBlocker).length
  return base.map((s) => {
    if (s.key === 'gap-analysis') {
      return { ...s, status: closed ? 'current' : 'done', note: `${gaps.length} surfaced` }
    }
    if (s.key === 'resolution') {
      return {
        ...s,
        status: closed ? 'locked' : advanced ? 'done' : 'current',
        note: closed ? `${openBlockers} blocking` : advanced ? 'cleared ✓' : 'gate open ✓'
      }
    }
    if (s.key === 'prd-draft') {
      return {
        ...s,
        status: !closed && advanced ? 'current' : 'todo',
        note: closed ? 'waiting' : advanced ? 'drafting' : 'unlocked next'
      }
    }
    return s
  })
}

interface GateStats {
  closed: boolean
  total: number
  resolved: number
  openBlocking: number
  openNonBlocking: number
  /** 0..1 — share of all gaps that are no longer open. */
  progress: number
}

interface FmState {
  engagement: Engagement
  /** persisted base stage definitions (pre-derivation) */
  baseStages: PipelineStage[]
  persona: Persona

  // selectors-as-state, recomputed on every mutation
  gate: GateStats
  /** true for the one render-cycle window after the gate flips closed->open,
   *  until the celebration is acknowledged. Drives the gate-open moment. */
  justOpened: boolean
  /** the team has Advanced past Resolution into PRD draft. */
  advanced: boolean

  // actions
  setPersona: (p: Persona) => void
  setGapStatus: (id: string, status: GapStatus) => void
  resolveGap: (id: string) => void
  deferGap: (id: string) => void
  routeToDesign: (id: string) => void
  dismissCelebration: () => void
  advanceToPrd: () => void
  reset: () => void
}

function computeGate(gaps: GapRecord[]): GateStats {
  const blocking = gaps.filter((g) => g.severity === 'blocking')
  const nonBlocking = gaps.filter((g) => g.severity === 'non-blocking')
  const resolved = gaps.filter((g) => g.status !== 'open').length
  return {
    closed: gateClosed(gaps),
    total: gaps.length,
    resolved,
    openBlocking: blocking.filter((g) => g.status === 'open').length,
    openNonBlocking: nonBlocking.filter((g) => g.status === 'open').length,
    progress: gaps.length === 0 ? 1 : resolved / gaps.length
  }
}

function withGaps(state: FmState, gaps: GapRecord[]): Partial<FmState> {
  const gate = computeGate(gaps)
  // Detect the closed -> open transition; latch justOpened until acknowledged.
  const justOpened = state.gate.closed && !gate.closed ? true : state.justOpened
  return {
    engagement: {
      ...state.engagement,
      gaps,
      stages: deriveStages(state.baseStages, gaps, state.advanced)
    },
    gate,
    justOpened
  }
}

function mutateStatus(state: FmState, id: string, status: GapStatus): Partial<FmState> {
  const gaps = state.engagement.gaps.map((g) => (g.id === id ? { ...g, status } : g))
  return withGaps(state, gaps)
}

const freshEngagement = (): Engagement => ({
  ...checkoutV2,
  stages: deriveStages(checkoutV2.stages, checkoutV2.gaps, false)
})

export const useFm = create<FmState>((set) => ({
  engagement: freshEngagement(),
  baseStages: checkoutV2.stages,
  persona: 'pm',
  gate: computeGate(checkoutV2.gaps),
  justOpened: false,
  advanced: false,

  setPersona: (persona) => set({ persona }),
  setGapStatus: (id, status) => set((s) => mutateStatus(s, id, status)),
  resolveGap: (id) => set((s) => mutateStatus(s, id, 'resolved')),
  deferGap: (id) => set((s) => mutateStatus(s, id, 'deferred')),
  routeToDesign: (id) => set((s) => mutateStatus(s, id, 'routed')),
  dismissCelebration: () => set({ justOpened: false }),
  advanceToPrd: () =>
    set((s) => ({
      advanced: true,
      justOpened: false,
      engagement: {
        ...s.engagement,
        stages: deriveStages(s.baseStages, s.engagement.gaps, true)
      }
    })),
  reset: () =>
    set(() => ({
      engagement: freshEngagement(),
      gate: computeGate(checkoutV2.gaps),
      justOpened: false,
      advanced: false
    }))
}))

// convenience hooks
export const useGaps = (): GapRecord[] => useFm((s) => s.engagement.gaps)
export const useGate = (): GateStats => useFm((s) => s.gate)
