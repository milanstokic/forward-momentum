import { create } from 'zustand'
import type {
  Engagement,
  GapRecord,
  GapStatus,
  PipelineStage,
  Persona
} from '@/model/types'
import { checkoutV2 } from '@/data/checkoutV2'

/** Stages that have their own work-surface screen. */
export type ActiveStage = 'gap-analysis' | 'prd-draft' | 'review'

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
interface FlowFlags {
  advanced: boolean // cleared the Resolution gate, into PRD draft
  handedToReview: boolean // PRD handed to the Review stage
  reviewSignedOff: boolean // Review gate cleared (reviewer pass + human sign-off)
}

/**
 * Recompute pipeline stage states from the live gates + flow flags.
 * Resolution unlocks the moment the last blocking gap clears; Advancing pushes
 * the frontier to PRD draft; handoff-to-Review and the Review sign-off push it
 * on through Review into Handoff.
 */
function deriveStages(base: PipelineStage[], gaps: GapRecord[], f: FlowFlags): PipelineStage[] {
  const closed = gateClosed(gaps)
  const openBlockers = gaps.filter(isOpenBlocker).length
  const { advanced, handedToReview, reviewSignedOff } = f
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
        status: !closed && advanced ? (handedToReview ? 'done' : 'current') : 'todo',
        note: closed ? 'waiting' : handedToReview ? 'drafted ✓' : advanced ? 'drafting' : 'unlocked next'
      }
    }
    if (s.key === 'review') {
      return {
        ...s,
        status: reviewSignedOff ? 'done' : handedToReview ? 'current' : 'todo',
        note: reviewSignedOff ? 'signed off ✓' : handedToReview ? 'sign-off pending' : 'waiting'
      }
    }
    if (s.key === 'handoff') {
      return {
        ...s,
        status: reviewSignedOff ? 'current' : 'todo',
        note: reviewSignedOff ? 'unlocked next' : 'waiting'
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
  /** which pipeline stage's screen is on the work surface. */
  activeStage: ActiveStage
  /** the PRD has been handed to the Review stage. */
  handedToReview: boolean
  /** the Review gate is cleared: reviewer pass + explicit human sign-off. */
  reviewSignedOff: boolean

  // actions
  setPersona: (p: Persona) => void
  setActiveStage: (s: ActiveStage) => void
  handToReview: () => void
  signOffReview: () => void
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
      stages: deriveStages(state.baseStages, gaps, flagsOf(state))
    },
    gate,
    justOpened
  }
}

/** Pull the flow flags off the live state. */
function flagsOf(s: FmState): FlowFlags {
  return {
    advanced: s.advanced,
    handedToReview: s.handedToReview,
    reviewSignedOff: s.reviewSignedOff
  }
}

function mutateStatus(state: FmState, id: string, status: GapStatus): Partial<FmState> {
  const gaps = state.engagement.gaps.map((g) => (g.id === id ? { ...g, status } : g))
  return withGaps(state, gaps)
}

const FRESH_FLAGS: FlowFlags = { advanced: false, handedToReview: false, reviewSignedOff: false }

const freshEngagement = (): Engagement => ({
  ...checkoutV2,
  stages: deriveStages(checkoutV2.stages, checkoutV2.gaps, FRESH_FLAGS)
})

export const useFm = create<FmState>((set) => ({
  engagement: freshEngagement(),
  baseStages: checkoutV2.stages,
  persona: 'pm',
  gate: computeGate(checkoutV2.gaps),
  justOpened: false,
  advanced: false,
  activeStage: 'gap-analysis',
  handedToReview: false,
  reviewSignedOff: false,

  setPersona: (persona) => set({ persona }),
  setActiveStage: (activeStage) => set({ activeStage }),
  setGapStatus: (id, status) => set((s) => mutateStatus(s, id, status)),
  resolveGap: (id) => set((s) => mutateStatus(s, id, 'resolved')),
  deferGap: (id) => set((s) => mutateStatus(s, id, 'deferred')),
  routeToDesign: (id) => set((s) => mutateStatus(s, id, 'routed')),
  dismissCelebration: () => set({ justOpened: false }),
  advanceToPrd: () =>
    set((s) => {
      const flags = { ...flagsOf(s), advanced: true }
      return {
        ...flags,
        justOpened: false,
        activeStage: 'prd-draft',
        engagement: { ...s.engagement, stages: deriveStages(s.baseStages, s.engagement.gaps, flags) }
      }
    }),
  handToReview: () =>
    set((s) => {
      const flags = { ...flagsOf(s), handedToReview: true }
      return {
        ...flags,
        activeStage: 'review',
        engagement: { ...s.engagement, stages: deriveStages(s.baseStages, s.engagement.gaps, flags) }
      }
    }),
  signOffReview: () =>
    set((s) => {
      const flags = { ...flagsOf(s), reviewSignedOff: true }
      return {
        ...flags,
        engagement: { ...s.engagement, stages: deriveStages(s.baseStages, s.engagement.gaps, flags) }
      }
    }),
  reset: () =>
    set(() => ({
      engagement: freshEngagement(),
      gate: computeGate(checkoutV2.gaps),
      justOpened: false,
      ...FRESH_FLAGS,
      activeStage: 'gap-analysis'
    }))
}))

// convenience hooks
export const useGaps = (): GapRecord[] => useFm((s) => s.engagement.gaps)
export const useGate = (): GateStats => useFm((s) => s.gate)
