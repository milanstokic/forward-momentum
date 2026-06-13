/**
 * Domain Host mutations — the write half of the spine.
 *
 * Each function mutates the engagement files on disk through the repo-root core
 * (flow/gates, flow/state-machine, flow/store), mirroring the VS Code extension's
 * gap-queue-panel + resolution-form behavior exactly so the standalone app stays
 * at parity:
 *   resolve/defer → set gap.status + resolution{by,reason,at}, rewrite gaps.json
 *   waive         → validateWaiver → mark gap waived + gate record + waive gate
 *   advance       → canExitResolution → passGate + advanceStage + state + record
 *
 * The renderer never writes; it sends an Intent and re-renders the returned read.
 */

import * as fs from 'fs'
import * as path from 'path'

import { canExitResolution, canExitReview, validateWaiver } from '@core/flow/gates'
import { advanceStage, passGate, waiveGate } from '@core/flow/state-machine'
import { readFlowState, writeFlowState, writeGateRecord } from '@core/flow/store'
import type { Gap } from '@core/model/gap'
import type { Waiver } from '@core/model/waiver'

import type { Intent, MutationResult, WireAcknowledgements } from '../shared/contract'
import { loadEngagement } from './domain-host'
import { parseReview } from './review-parser'

function gapsPath(root: string): string {
  return path.join(root, 'analysis', 'gaps.json')
}

function readGaps(root: string): Gap[] {
  const p = gapsPath(root)
  if (!fs.existsSync(p)) return []
  const parsed: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'))
  return Array.isArray(parsed) ? (parsed as Gap[]) : []
}

function writeGaps(root: string, gaps: Gap[]): void {
  const p = gapsPath(root)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(gaps, null, 2), 'utf-8')
}

function ok(root: string): MutationResult {
  return { ok: true, snapshot: loadEngagement(root) }
}

function fail(root: string, error: string, validationErrors?: string[]): MutationResult {
  return { ok: false, error, validationErrors, snapshot: loadEngagement(root) }
}

/** resolve / defer: set status + a resolution receipt, rewrite gaps.json. */
function setStatus(
  root: string,
  gapId: string,
  status: 'resolved' | 'deferred',
  by: string,
  reason?: string
): MutationResult {
  const gaps = readGaps(root)
  const target = gaps.find((g) => g.id === gapId)
  if (!target) return fail(root, `Gap "${gapId}" not found.`)

  target.status = status
  target.resolution = {
    by,
    reason: reason ?? (status === 'deferred' ? 'Deferred via desktop app.' : 'Resolved via desktop app.'),
    at: new Date().toISOString()
  }
  writeGaps(root, gaps)
  return ok(root)
}

/** waive: structured-waiver path for a blocking gap (opens the hard gate). */
function waive(
  root: string,
  gapId: string,
  by: string,
  reason: string,
  acks: WireAcknowledgements
): MutationResult {
  const now = new Date().toISOString()
  const waiver: Waiver = {
    gate: 'Resolution',
    by,
    reason,
    at: now,
    acknowledgements: acks
  }

  const validation = validateWaiver(waiver)
  if (!validation.valid) {
    return fail(root, 'Waiver invalid.', validation.reasons)
  }

  const gaps = readGaps(root)
  const target = gaps.find((g) => g.id === gapId)
  if (!target) return fail(root, `Gap "${gapId}" not found.`)

  target.status = 'waived'
  target.resolution = { by, reason, at: now }
  writeGaps(root, gaps)

  // Receipt to decisions/, and reflect the waiver in flow state if at Resolution.
  writeGateRecord(root, { gate: 'Resolution', waived: true, waiver, passedAt: now, passedBy: by })
  try {
    const state = readFlowState(root, now)
    if (
      state.currentStage === 'Resolution' ||
      state.gates.Resolution === 'pending' ||
      state.gates.Resolution === 'blocked'
    ) {
      writeFlowState(root, waiveGate(state, 'Resolution', now))
    }
  } catch {
    // Non-fatal: a state-write failure must not void the waiver receipt.
  }
  return ok(root)
}

/** advance: enforce the Resolution gate, then pass it and move to PRDDraft. */
function advance(root: string, by: string): MutationResult {
  const gaps = readGaps(root)
  const gate = canExitResolution(gaps)
  if (!gate.ok) return fail(root, `Cannot advance: ${gate.reason}`)

  const now = new Date().toISOString()
  const state = readFlowState(root, now)
  if (state.currentStage !== 'Resolution') {
    return fail(root, `Cannot advance: flow is at "${state.currentStage}", not Resolution.`)
  }

  const advanced = advanceStage(passGate(state, 'Resolution', now), now)
  if (!advanced.ok) return fail(root, `Transition failed: ${advanced.reason}`)

  writeFlowState(root, advanced.state)
  writeGateRecord(root, { gate: 'Resolution', waived: false, passedAt: now, passedBy: by })
  return ok(root)
}

/** handToReview: PRDDraft → Review. No gate guards PRDDraft's exit. */
function handToReview(root: string, _by: string): MutationResult {
  const now = new Date().toISOString()
  const state = readFlowState(root, now)
  if (state.currentStage === 'Review') return ok(root) // idempotent
  if (state.currentStage !== 'PRDDraft') {
    return fail(root, `Cannot hand to Review: flow is at "${state.currentStage}", not PRDDraft.`)
  }
  const advanced = advanceStage(state, now)
  if (!advanced.ok) return fail(root, `Transition failed: ${advanced.reason}`)
  writeFlowState(root, advanced.state)
  return ok(root)
}

/** signOffReview: human sign-off on top of the reviewer PASS → Review gate opens. */
function signOffReview(root: string, by: string): MutationResult {
  const review = parseReview(root, 'engagement')
  const reviewerPassed = review?.verdict === 'PASS'
  const gate = canExitReview(reviewerPassed, true) // human sign-off = this action
  if (!gate.ok) return fail(root, `Cannot sign off: ${gate.reason}`)

  const now = new Date().toISOString()
  const state = readFlowState(root, now)
  if (state.currentStage !== 'Review') {
    return fail(root, `Cannot sign off: flow is at "${state.currentStage}", not Review.`)
  }

  const advanced = advanceStage(passGate(state, 'Review', now), now)
  if (!advanced.ok) return fail(root, `Transition failed: ${advanced.reason}`)
  writeFlowState(root, advanced.state)
  writeGateRecord(root, { gate: 'Review', waived: false, passedAt: now, passedBy: by })
  return ok(root)
}

/** Apply any Intent and return the post-mutation read. */
export function applyMutation(root: string, intent: Intent): MutationResult {
  const by = intent.by && intent.by.trim() !== '' ? intent.by : 'desktop'
  switch (intent.type) {
    case 'resolveGap':
      return setStatus(root, intent.gapId, 'resolved', by, intent.reason)
    case 'deferGap':
      return setStatus(root, intent.gapId, 'deferred', by, intent.reason)
    case 'waiveGap':
      return waive(root, intent.gapId, by, intent.reason, intent.acknowledgements)
    case 'advanceResolution':
      return advance(root, by)
    case 'handToReview':
      return handToReview(root, by)
    case 'signOffReview':
      return signOffReview(root, by)
  }
}
