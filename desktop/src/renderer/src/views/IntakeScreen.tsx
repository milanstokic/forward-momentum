import { color, fill, radius } from '@/styles/theme'
import { useFm } from '@/state/store'
import { Label, mono } from '@/components/primitives'
import { Check, FileIcon } from '@/components/Icon'

/**
 * Intake — the entry surface for an engagement. Shows the raw `sources/` material
 * and kicks off the pipeline: run Extraction (sources → claims) then Gap Analysis
 * (claims → gaps) via Claude Code. Once gaps exist the flow lands at Resolution
 * and the role views take over.
 */
export function IntakeScreen(): JSX.Element {
  const slug = useFm((s) => s.engagement.slug)
  const sources = useFm((s) => s.sources)
  const claims = useFm((s) => s.engagement.claims)
  const gaps = useFm((s) => s.engagement.gaps)
  const agentRun = useFm((s) => s.agentRun)
  const runStage = useFm((s) => s.runStage)
  const setActiveStage = useFm((s) => s.setActiveStage)
  const isLive = useFm((s) => s.isLive)

  const hasClaims = claims.length > 0
  const hasGaps = gaps.length > 0
  const busy = agentRun.status === 'running'

  const runExtraction = (): void => void runStage('Extraction')
  const runGaps = async (): Promise<void> => {
    const res = await runStage('GapAnalysis')
    if (res.ok) setActiveStage('gap-analysis')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: color.bgPanel }}>
      <div style={{ padding: '22px 28px 16px', borderBottom: `1px solid ${color.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>Intake · {slug}</div>
        <div style={{ fontSize: 12, color: color.textFaint, marginTop: 3 }}>
          The raw inputs the pipeline reads. Run the agents to turn sources into claims, then gaps.
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px', display: 'flex', gap: 22 }}>
        {/* sources */}
        <div style={{ width: 320, flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Label style={{ fontSize: 9 }}>Sources · {sources.length}</Label>
          {sources.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: radius.lg,
                border: `1px dashed ${color.borderHard}`,
                color: color.textFaint,
                fontSize: 12,
                lineHeight: 1.5
              }}
            >
              No source files yet. Add inputs (call notes, docs) to the engagement&apos;s{' '}
              <span style={mono}>sources/</span> folder on disk, then run Extraction.
            </div>
          ) : (
            sources.map((f) => (
              <div
                key={f}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 13px',
                  borderRadius: radius.lg,
                  background: color.bgCard,
                  border: `1px solid ${color.borderSoft}`
                }}
              >
                <FileIcon size={14} color={color.textMute} />
                <span style={{ fontSize: 12.5, color: color.textDim, ...mono }}>{f}</span>
              </div>
            ))
          )}
        </div>

        {/* pipeline kickoff */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Label style={{ fontSize: 9 }}>Start the pipeline</Label>

          <Step
            n={1}
            title="Extraction"
            command="/fm-extract"
            done={hasClaims}
            doneNote={`${claims.length} claims extracted`}
            todoNote="Read the sources into atomic claims with provenance."
            disabled={busy || sources.length === 0}
            onRun={runExtraction}
          />
          <Step
            n={2}
            title="Gap Analysis"
            command="/fm-gaps"
            done={hasGaps}
            doneNote={`${gaps.length} gaps surfaced`}
            todoNote="Find conflicts and missing requirements across the claims."
            disabled={busy || !hasClaims}
            onRun={() => void runGaps()}
          />

          {hasGaps && (
            <div
              data-clickable
              onClick={() => setActiveStage('gap-analysis')}
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                padding: '9px 15px',
                borderRadius: radius.md,
                background: color.mint,
                color: color.bgPanel,
                fontSize: 12.5,
                fontWeight: 600
              }}
            >
              Go to gap review →
            </div>
          )}

          {agentRun.status !== 'idle' && agentRun.stage && (
            <div
              style={{
                ...mono,
                fontSize: 11,
                color:
                  agentRun.status === 'error'
                    ? color.orange
                    : agentRun.status === 'done'
                      ? color.mint
                      : color.orangeSoft
              }}
            >
              {agentRun.stage}: {agentRun.message}
            </div>
          )}

          <div style={{ ...mono, fontSize: 9.5, color: color.textGhost, marginTop: 'auto' }}>
            {isLive ? 'runs spawn the local claude CLI in this engagement' : 'mock · simulated runs (browser dev)'}
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  command,
  done,
  doneNote,
  todoNote,
  disabled,
  onRun
}: {
  n: number
  title: string
  command: string
  done: boolean
  doneNote: string
  todoNote: string
  disabled: boolean
  onRun: () => void
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '15px 17px',
        borderRadius: radius.xl,
        background: color.bgCard,
        border: `1px solid ${done ? color.greenLine : color.borderSoft}`
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          flex: 'none',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: done ? fill.mint10 : color.bgCardRaised,
          color: done ? color.mint : color.textFaint,
          ...mono,
          fontSize: 11,
          fontWeight: 700
        }}
      >
        {done ? <Check size={12} color={color.mint} strokeWidth={3} /> : n}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
          <span style={{ ...mono, fontSize: 10, color: color.textFaint }}>{command}</span>
        </div>
        <div style={{ fontSize: 11.5, color: done ? color.mint : color.textMute, marginTop: 2 }}>
          {done ? doneNote : todoNote}
        </div>
      </div>
      <div
        data-clickable={disabled ? undefined : ''}
        onClick={disabled ? undefined : onRun}
        style={{
          flex: 'none',
          padding: '8px 14px',
          borderRadius: radius.md,
          border: `1px solid ${disabled ? color.borderHard : color.greenLine}`,
          background: disabled ? 'transparent' : fill.mint08,
          color: disabled ? color.textGhost : color.mint,
          fontSize: 12,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        {done ? 'Re-run' : 'Run'}
      </div>
    </div>
  )
}
