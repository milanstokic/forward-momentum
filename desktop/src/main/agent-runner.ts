/**
 * AgentRunner — the seam between the app and Claude Code (the agent runtime).
 *
 * Generating pipeline artifacts (Extraction / GapAnalysis / PRDDraft / Review)
 * goes through this interface. The shipping impl, ClaudeCodeRunner, wraps the
 * core `cli-runner` which spawns `claude /fm-<stage> --print` in the engagement
 * directory. The spawn fn is injectable, so the runner is unit-testable with a
 * mock subprocess (no real `claude` needed) — see scripts/verify-agent.mjs.
 *
 * The Domain Host stays the source of truth: after a run, we re-read the
 * engagement and hand back a fresh Snapshot reflecting whatever the agent wrote.
 */

import { runCliCommand, type SpawnFn } from '@core/agents/cli-runner'

import type { AgentRunResult, WireStageName } from '../shared/contract'
import { loadEngagement } from './domain-host'

/** Which `/fm-*` command regenerates each stage's artifacts. */
const STAGE_COMMAND: Partial<Record<WireStageName, string>> = {
  Extraction: '/fm-extract',
  GapAnalysis: '/fm-gaps',
  PRDDraft: '/fm-prd',
  Review: '/fm-review'
}

export interface RunStageOptions {
  timeoutMs?: number
  /** Injectable spawn (tests). Defaults to the real `claude` subprocess. */
  spawnFn?: SpawnFn
}

export interface AgentRunner {
  runStage(root: string, stage: WireStageName, opts?: RunStageOptions): Promise<AgentRunResult>
}

export class ClaudeCodeRunner implements AgentRunner {
  constructor(private readonly defaultSpawnFn?: SpawnFn) {}

  async runStage(
    root: string,
    stage: WireStageName,
    opts: RunStageOptions = {}
  ): Promise<AgentRunResult> {
    const command = STAGE_COMMAND[stage]
    const base = { stage, command: command ?? '', exitCode: null as number | null, stdout: '', stderr: '' }

    if (!command) {
      return { ...base, ok: false, error: `No agent command for stage "${stage}".`, snapshot: safeLoad(root) }
    }

    try {
      const res = await runCliCommand(command, {
        cwd: root,
        timeoutMs: opts.timeoutMs,
        spawnFn: opts.spawnFn ?? this.defaultSpawnFn
      })
      return {
        ok: res.ok,
        stage,
        command,
        exitCode: res.exitCode,
        stdout: res.stdout,
        stderr: res.stderr,
        snapshot: safeLoad(root)
      }
    } catch (err) {
      return {
        ...base,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        snapshot: safeLoad(root)
      }
    }
  }
}

function safeLoad(root: string): AgentRunResult['snapshot'] {
  try {
    return loadEngagement(root)
  } catch {
    return null
  }
}

export const claudeCodeRunner = new ClaudeCodeRunner()
