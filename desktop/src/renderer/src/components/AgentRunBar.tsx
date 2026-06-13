import { color, fill, radius } from '@/styles/theme'
import { useFm } from '@/state/store'
import type { WireStageName } from '@shared/contract'
import { mono } from './primitives'

/** The current pipeline stage → the `/fm-*` command that (re)generates it. */
const STAGE_COMMAND: Partial<Record<WireStageName, string>> = {
  Extraction: '/fm-extract',
  GapAnalysis: '/fm-gaps',
  PRDDraft: '/fm-prd',
  Review: '/fm-review'
}

const STATUS_TONE = {
  idle: color.textFaint,
  running: color.orangeSoft,
  done: color.mint,
  error: color.orange
} as const

/**
 * The agent-run control: shows the current stage's Claude Code command, a Run
 * button, and the live idle/running/done/error status. This is the surface that
 * connects the app to Claude Code — running it spawns `claude /fm-<stage>` in the
 * engagement and re-reads whatever the agent wrote.
 */
export function AgentRunBar(): JSX.Element | null {
  const currentStage = useFm((s) => s.currentStage)
  const isLive = useFm((s) => s.isLive)
  const agentRun = useFm((s) => s.agentRun)
  const runStage = useFm((s) => s.runStage)

  const command = STAGE_COMMAND[currentStage]
  if (!command) return null // current stage has no agent (Intake / Resolution / Handoff)

  const running = agentRun.status === 'running' && agentRun.stage === currentStage
  const tone = agentRun.stage === currentStage ? STATUS_TONE[agentRun.status] : color.textFaint

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: color.bgRail,
        borderBottom: `1px solid ${color.border}`
      }}
    >
      <span style={{ ...mono, fontSize: 10, color: color.textFaint, letterSpacing: '.04em' }}>
        AGENT · {currentStage}
      </span>
      <span style={{ ...mono, fontSize: 11, color: color.textDim }}>{command}</span>

      <div
        data-clickable={running ? undefined : ''}
        onClick={running ? undefined : () => void runStage(currentStage)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: radius.md,
          border: `1px solid ${running ? color.borderHard : color.greenLine}`,
          background: running ? color.bgCardRaised : fill.mint08,
          color: running ? color.textFaint : color.mint,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: running ? 'progress' : 'pointer'
        }}
      >
        {running ? (
          <>
            <Spinner /> Running…
          </>
        ) : (
          <>▶ Run in Claude Code</>
        )}
      </div>

      {agentRun.stage === currentStage && agentRun.status !== 'idle' && (
        <span style={{ ...mono, fontSize: 10.5, color: tone, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agentRun.message}
        </span>
      )}

      <span style={{ marginLeft: 'auto', ...mono, fontSize: 9.5, color: color.textGhost }}>
        {isLive ? 'live · spawns claude' : 'mock · simulated run'}
      </span>
    </div>
  )
}

function Spinner(): JSX.Element {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        border: `1.6px solid ${color.borderHard}`,
        borderTopColor: color.orangeSoft,
        display: 'inline-block',
        animation: 'fmspin .7s linear infinite'
      }}
    />
  )
}
