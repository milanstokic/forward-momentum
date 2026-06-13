import { create } from 'zustand'
import type {
  Engagement,
  GapRecord,
  GapStatus,
  PipelineStage,
  Persona
} from '@/model/types'
import { checkoutV2 } from '@/data/checkoutV2'
import {
  GITHUB_REPO,
  isDesignGap,
  type DispatchEntry,
  type DispatchMode
} from '@/model/dispatch'
import { PERSONA_LABEL } from '@/model/types'
import type { MutationResult, Snapshot, WireAcknowledgements } from '@shared/contract'
import { transport } from '@/transport'
import { toClaims, toGapRecord } from '@/transport/deriveView'

/** Stages whose flow position means Resolution is already behind us. */
const PAST_RESOLUTION = new Set(['PRDDraft', 'Review', 'Handoff'])

/** Acknowledgement + reason payload the waiver modal submits. */
export interface WaiverForm {
  reason: string
  acknowledgements: WireAcknowledgements
}

/** Stages that have their own work-surface screen. */
export type ActiveStage = 'gap-analysis' | 'prd-draft' | 'review' | 'handoff'

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
  dispatched: boolean // design tasks dispatched at Handoff
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
  const { advanced, handedToReview, reviewSignedOff, dispatched } = f
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
        status: dispatched ? 'done' : reviewSignedOff ? 'current' : 'todo',
        note: dispatched ? 'dispatched ✓' : reviewSignedOff ? 'ready to dispatch' : 'waiting'
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
  /** Absolute path to the engagement on disk (null until a live snapshot loads). */
  root: string | null
  /** True for the live Electron/IPC backend; false for the in-browser mock. */
  isLive: boolean
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
  /** the gap id whose structured-waiver modal is open, or null. */
  waivingGapId: string | null
  /** the PRD has been handed to the Review stage. */
  handedToReview: boolean
  /** the Review gate is cleared: reviewer pass + explicit human sign-off. */
  reviewSignedOff: boolean
  /** Handoff: GitHub credential present (live) or not (dry-run). */
  dispatchMode: DispatchMode
  /** Handoff dispatch results, keyed by gap id (tasks/dispatch.json). */
  dispatched: Record<string, DispatchEntry>

  // actions
  /** Replace all engagement state from a host snapshot (read path). */
  hydrate: (snap: Snapshot) => void
  /** Load the current/default engagement via the transport, then hydrate. */
  loadEngagement: () => Promise<void>
  /** Prompt for an engagement folder via the transport, then hydrate. */
  openEngagement: () => Promise<void>
  setPersona: (p: Persona) => void
  setActiveStage: (s: ActiveStage) => void
  handToReview: () => void
  signOffReview: () => void
  connectGitHub: () => void
  dispatchTasks: () => void
  setGapStatus: (id: string, status: GapStatus) => void
  resolveGap: (id: string) => void
  deferGap: (id: string) => void
  /** Open / close the structured-waiver modal for a gap. */
  openWaive: (id: string) => void
  closeWaive: () => void
  /** Structured-waiver path for a blocking gap; returns validation/result. */
  waiveGap: (id: string, form: WaiverForm) => Promise<MutationResult>
  routeToDesign: (id: string) => void
  dismissCelebration: () => void
  advanceToPrd: () => Promise<MutationResult>
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
    reviewSignedOff: s.reviewSignedOff,
    dispatched: Object.keys(s.dispatched).length > 0
  }
}

function mutateStatus(state: FmState, id: string, status: GapStatus): Partial<FmState> {
  const gaps = state.engagement.gaps.map((g) => (g.id === id ? { ...g, status } : g))
  return withGaps(state, gaps)
}

const FRESH_FLAGS: FlowFlags = {
  advanced: false,
  handedToReview: false,
  reviewSignedOff: false,
  dispatched: false
}

const freshEngagement = (): Engagement => ({
  ...checkoutV2,
  stages: deriveStages(checkoutV2.stages, checkoutV2.gaps, FRESH_FLAGS)
})

/**
 * Map a host Snapshot into renderer state. `fresh` (a new engagement load) clears
 * the justOpened latch; a mutation refresh keeps the closed→open transition so
 * the gate-open celebration still fires when the last blocker clears on disk.
 */
function applySnapshot(s: FmState, snap: Snapshot, opts: { fresh: boolean }): Partial<FmState> {
  const gaps = snap.gaps.map(toGapRecord)
  const gate = computeGate(gaps)
  const advanced = PAST_RESOLUTION.has(snap.flow.currentStage)
  const justOpened = opts.fresh ? false : s.gate.closed && !gate.closed ? true : s.justOpened
  const flags: FlowFlags = {
    advanced,
    handedToReview: s.handedToReview,
    reviewSignedOff: s.reviewSignedOff,
    dispatched: Object.keys(s.dispatched).length > 0
  }
  return {
    root: snap.root,
    engagement: {
      slug: snap.slug,
      branch: 'main',
      claims: toClaims(snap.claims),
      gaps,
      stages: deriveStages(checkoutV2.stages, gaps, flags)
    },
    baseStages: checkoutV2.stages,
    gate,
    advanced,
    justOpened
  }
}

/** Provenance identity recorded against the active persona. */
function byOf(s: FmState): string {
  return PERSONA_LABEL[s.persona]
}

export const useFm = create<FmState>((set, get) => ({
  engagement: freshEngagement(),
  baseStages: checkoutV2.stages,
  root: null,
  isLive: transport.isLive,
  persona: 'pm',
  gate: computeGate(checkoutV2.gaps),
  justOpened: false,
  advanced: false,
  activeStage: 'gap-analysis',
  waivingGapId: null,
  handedToReview: false,
  reviewSignedOff: false,
  dispatchMode: 'dry-run',
  dispatched: {},

  hydrate: (snap) =>
    set((s) => {
      const base = applySnapshot(s, snap, { fresh: true })
      return {
        ...base,
        activeStage: base.advanced ? 'prd-draft' : 'gap-analysis',
        handedToReview: false,
        reviewSignedOff: false,
        dispatched: {}
      }
    }),
  loadEngagement: async () => {
    const snap = await transport.loadSnapshot()
    if (snap) get().hydrate(snap)
  },
  openEngagement: async () => {
    const snap = await transport.openEngagement()
    if (snap) get().hydrate(snap)
  },
  setPersona: (persona) => set({ persona }),
  setActiveStage: (activeStage) => set({ activeStage }),
  setGapStatus: (id, status) => set((s) => mutateStatus(s, id, status)),
  resolveGap: (id) => {
    void transport
      .mutate({ type: 'resolveGap', gapId: id, by: byOf(get()) })
      .then((res) => {
        if (res.snapshot) set((s) => applySnapshot(s, res.snapshot!, { fresh: false }))
      })
  },
  deferGap: (id) => {
    void transport
      .mutate({ type: 'deferGap', gapId: id, by: byOf(get()) })
      .then((res) => {
        if (res.snapshot) set((s) => applySnapshot(s, res.snapshot!, { fresh: false }))
      })
  },
  openWaive: (id) => set({ waivingGapId: id }),
  closeWaive: () => set({ waivingGapId: null }),
  waiveGap: async (id, form) => {
    const res = await transport.mutate({
      type: 'waiveGap',
      gapId: id,
      by: byOf(get()),
      reason: form.reason,
      acknowledgements: form.acknowledgements
    })
    if (res.snapshot) set((s) => applySnapshot(s, res.snapshot!, { fresh: false }))
    if (res.ok) set({ waivingGapId: null })
    return res
  },
  routeToDesign: (id) => set((s) => mutateStatus(s, id, 'routed')),
  dismissCelebration: () => set({ justOpened: false }),
  advanceToPrd: async () => {
    const res = await transport.mutate({ type: 'advanceResolution', by: byOf(get()) })
    if (res.ok && res.snapshot) {
      set((s) => ({
        ...applySnapshot(s, res.snapshot!, { fresh: false }),
        justOpened: false,
        activeStage: 'prd-draft'
      }))
    }
    return res
  },
  handToReview: () =>
    set((s) => {
      const flags = { ...flagsOf(s), handedToReview: true }
      return {
        handedToReview: true,
        activeStage: 'review',
        engagement: { ...s.engagement, stages: deriveStages(s.baseStages, s.engagement.gaps, flags) }
      }
    }),
  signOffReview: () =>
    set((s) => {
      const flags = { ...flagsOf(s), reviewSignedOff: true }
      return {
        reviewSignedOff: true,
        engagement: { ...s.engagement, stages: deriveStages(s.baseStages, s.engagement.gaps, flags) }
      }
    }),
  connectGitHub: () => set({ dispatchMode: 'live' }),
  dispatchTasks: () =>
    set((s) => {
      const designGaps = s.engagement.gaps.filter(isDesignGap)
      const now = new Date().toISOString()
      const next: Record<string, DispatchEntry> = { ...s.dispatched }
      // issue numbers continue from any already assigned (idempotent re-run).
      let issueSeq =
        128 + Object.values(next).filter((e) => e.issueNumber !== undefined).length
      for (const g of designGaps) {
        if (next[g.id]) {
          // already dispatched — record the skip, keep the original issue.
          next[g.id] = { ...next[g.id], status: 'skipped-already-dispatched' }
          continue
        }
        const live = s.dispatchMode === 'live'
        const issueNumber = live ? issueSeq++ : undefined
        next[g.id] = {
          gapId: g.id,
          summary: g.summary,
          mode: s.dispatchMode,
          issueNumber,
          issueUrl: live ? `https://github.com/${GITHUB_REPO}/issues/${issueNumber}` : 'dry-run',
          dispatchedAt: now,
          status: 'dispatched'
        }
      }
      const flags = { ...flagsOf(s), dispatched: Object.keys(next).length > 0 }
      return {
        dispatched: next,
        engagement: { ...s.engagement, stages: deriveStages(s.baseStages, s.engagement.gaps, flags) }
      }
    }),
  reset: () =>
    set(() => ({
      engagement: freshEngagement(),
      gate: computeGate(checkoutV2.gaps),
      justOpened: false,
      advanced: false,
      handedToReview: false,
      reviewSignedOff: false,
      activeStage: 'gap-analysis',
      waivingGapId: null,
      dispatchMode: 'dry-run',
      dispatched: {}
    }))
}))

// convenience hooks
export const useGaps = (): GapRecord[] => useFm((s) => s.engagement.gaps)
export const useGate = (): GateStats => useFm((s) => s.gate)
