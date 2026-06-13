import { color, fill } from '@/styles/theme'
import { useFm, useGate } from '@/state/store'
import { GateDonut, Label, mono } from './primitives'

function MeterRow({
  label,
  count,
  tone,
  fillPct
}: {
  label: string
  count: number
  tone: string
  fillPct: number
}): JSX.Element {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
        <span style={{ color: color.textMute }}>{label}</span>
        <span style={{ ...mono, color: tone }}>{count} open</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: color.border, overflow: 'hidden' }}>
        <div
          style={{
            width: `${fillPct}%`,
            height: '100%',
            background: tone,
            transition: 'width .4s ease'
          }}
        />
      </div>
    </div>
  )
}

/** Left rail: the Resolution gate as a physical object holding the work shut. */
export function GateSidebar({ width = 288 }: { width?: number }): JSX.Element {
  const gate = useGate()
  const advanced = useFm((s) => s.advanced)
  const advanceToPrd = useFm((s) => s.advanceToPrd)
  const accent = gate.closed ? color.orange : color.mint
  const blockingFill = gate.openBlocking === 0 ? 0 : 100
  const nonBlockingResolvedPct = Math.round(
    ((gate.total - gate.openBlocking - gate.openNonBlocking) / Math.max(gate.total, 1)) * 100
  )

  return (
    <div
      style={{
        width,
        flex: 'none',
        background: color.bgRaised,
        borderRight: `1px solid ${color.border}`,
        padding: 22,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Label style={{ marginBottom: 16 }}>Resolution gate</Label>

      <div style={{ margin: '4px auto 16px' }}>
        <GateDonut size={150} progress={gate.progress} closed={gate.closed} />
      </div>

      {gate.closed ? (
        <div style={{ textAlign: 'center', fontSize: 13, lineHeight: 1.5, color: '#d4d4ce', marginBottom: 3 }}>
          <b style={{ color: color.orange }}>
            {gate.openBlocking} blocking item{gate.openBlocking === 1 ? '' : 's'}
          </b>{' '}
          need your call.
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, lineHeight: 1.5, color: color.mint, marginBottom: 3 }}>
          Gate is <b>open</b> — Resolution stage unlocked.
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: 11.5, color: color.textFaint, marginBottom: 18 }}>
        {gate.resolved} of {gate.total} gaps resolved
      </div>

      <div style={{ height: 1, background: color.border, marginBottom: 16 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MeterRow label="Blocking" count={gate.openBlocking} tone={color.orange} fillPct={blockingFill} />
        <MeterRow
          label="Non-blocking"
          count={gate.openNonBlocking}
          tone={color.mint}
          fillPct={nonBlockingResolvedPct}
        />
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: 14,
          borderRadius: 10,
          background: gate.closed ? color.bg : fill.mint06,
          border: `1px solid ${gate.closed ? color.border : fill.mintBorder}`,
          fontSize: 11.5,
          lineHeight: 1.5,
          color: gate.closed ? color.textMute : color.mint
        }}
      >
        {gate.closed ? (
          <>
            The gate opens automatically the instant the last blocking item is resolved.{' '}
            <span style={{ color: color.textFaint }}>Nothing advances on a hunch.</span>
          </>
        ) : advanced ? (
          <>Advanced to PRD draft. Consensus is recorded with provenance.</>
        ) : (
          <>
            Consensus recorded. The PRD draft can now be generated from the resolved claims.
            <div
              data-clickable
              onClick={() => void advanceToPrd()}
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 9,
                background: color.mint,
                color: color.bgPanel,
                fontSize: 12.5,
                fontWeight: 600
              }}
            >
              Advance to PRD draft →
            </div>
          </>
        )}
      </div>
    </div>
  )
}
