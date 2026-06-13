/**
 * Handoff dispatch — design gaps → GitHub Issues, recorded in tasks/dispatch.json.
 *
 * This mirrors the core `src/github/dispatch.ts` heuristic + idempotent state
 * exactly, but is reimplemented here so the desktop bundle stays free of the
 * core's GitHub client (which pulls @octokit + the type-only vscode import).
 *
 * Dry-run is fully wired and writes the real tasks/dispatch.json. LIVE GitHub
 * dispatch is a follow-up: it needs @octokit added to desktop/ and a token via
 * safeStorage/env — until then a live request degrades to a recorded dry-run.
 */

import * as fs from 'fs'
import * as path from 'path'

import type { Gap } from '@core/model/gap'

import type { WireDispatchEntry, WireDispatchMode } from '../shared/contract'

type DispatchState = Record<string, WireDispatchEntry>

const DISPATCH_FILE = path.join('tasks', 'dispatch.json')
const DESIGN_KEYWORDS = /design|frame|mock|screen|ui\b|ux\b|figma|wireframe|layout|visual/i
const DESIGN_SOURCE = /design-references/i

/** A gap is a design task when it's a gap (not a conflict) with a design signal. */
export function isDesignGap(gap: Gap): boolean {
  if (gap.kind !== 'gap') return false
  if (DESIGN_KEYWORDS.test(gap.summary)) return true
  return gap.evidence.some((e) => DESIGN_SOURCE.test(e.sourceFile))
}

export function readDispatch(root: string): DispatchState {
  const p = path.join(root, DISPATCH_FILE)
  if (!fs.existsSync(p)) return {}
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return parsed && typeof parsed === 'object' ? (parsed as DispatchState) : {}
  } catch {
    return {}
  }
}

/**
 * Dispatch design gaps idempotently and write tasks/dispatch.json.
 * Re-dispatching an already-dispatched gap records it as skipped (issue kept).
 */
export function runDispatch(root: string, gaps: Gap[], requestedMode: WireDispatchMode): DispatchState {
  const existing = readDispatch(root)
  const state: DispatchState = { ...existing }
  const now = new Date().toISOString()

  // Live GitHub creation is a follow-up (needs @octokit + a token); for now a
  // live request is recorded as dry-run so the Handoff flow still completes.
  void requestedMode

  for (const gap of gaps.filter(isDesignGap)) {
    if (existing[gap.id]?.status === 'dispatched') {
      state[gap.id] = { ...existing[gap.id], status: 'skipped-already-dispatched' }
      continue
    }
    state[gap.id] = {
      gapId: gap.id,
      summary: gap.summary,
      mode: 'dry-run',
      issueUrl: 'dry-run',
      dispatchedAt: now,
      status: 'dispatched'
    }
  }

  const tasksDir = path.join(root, 'tasks')
  fs.mkdirSync(tasksDir, { recursive: true })
  fs.writeFileSync(path.join(root, DISPATCH_FILE), JSON.stringify(state, null, 2) + '\n', 'utf-8')
  return state
}
