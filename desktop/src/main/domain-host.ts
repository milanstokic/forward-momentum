/**
 * Domain Host — the file-backed spine, running inside the Electron main process.
 *
 * It reads the real engagement files on disk and runs the repo-root `src/` core
 * (model + flow) to produce a Snapshot for the renderer. The engagement files
 * are the single source of truth; the renderer only ever renders snapshots.
 *
 * Phase 6 is READ-ONLY: we read `.flow/state.json` if present and fall back to a
 * pure in-memory initial state rather than writing one, so loading an engagement
 * never mutates disk. Mutations (resolve/defer/waive/advance) arrive in Phase 7.
 */

import * as fs from 'fs'
import * as path from 'path'

import { canExitResolution } from '@core/flow/gates'
import { initialFlowState } from '@core/flow/state-machine'
import type { Claim } from '@core/model/claim'
import type { Gap } from '@core/model/gap'
import type { FlowState } from '@core/model/flow-state'

import type { Snapshot, WireGateResult } from '../shared/contract'

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
}

/** Read `.flow/state.json` without initialising it on disk (read-only spine). */
function readFlowStateReadOnly(root: string): FlowState {
  const statePath = path.join(root, '.flow', 'state.json')
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as FlowState
  }
  // Engagement has never been advanced — represent it at Intake, no write.
  return initialFlowState(new Date().toISOString())
}

/** True when `root` looks like an engagement (has analysis/gaps.json). */
export function isEngagementRoot(root: string): boolean {
  return fs.existsSync(path.join(root, 'analysis', 'gaps.json'))
}

/**
 * Read one engagement from disk and evaluate the Resolution gate via the core.
 * Throws if the folder is not an engagement so the caller can surface it.
 */
export function loadEngagement(root: string): Snapshot {
  if (!isEngagementRoot(root)) {
    throw new Error(`Not an engagement: ${root} (missing analysis/gaps.json)`)
  }

  const claims = readJson<Claim[]>(path.join(root, 'analysis', 'claims.json'), [])
  const gaps = readJson<Gap[]>(path.join(root, 'analysis', 'gaps.json'), [])
  const flow = readFlowStateReadOnly(root)

  const gate = canExitResolution(gaps)
  const resolutionGate: WireGateResult = gate.ok
    ? { ok: true, blockingIds: [] }
    : { ok: false, reason: gate.reason, blockingIds: gate.blocking.map((g) => g.id) }

  return {
    root,
    slug: path.basename(root),
    claims,
    gaps,
    flow,
    resolutionGate
  }
}
