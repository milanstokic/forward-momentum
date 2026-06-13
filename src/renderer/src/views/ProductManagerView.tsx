import { color } from '@/styles/theme'
import { useGaps } from '@/state/store'
import { GateSidebar } from '@/components/GateSidebar'
import { GapCard } from '@/components/GapCard'
import { mono } from '@/components/primitives'

function LaneHeader({
  dot,
  label,
  count,
  tone,
  note
}: {
  dot: string
  label: string
  count: number
  tone: string
  note?: string
}): JSX.Element {
  return (
    <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span
        style={{
          ...mono,
          fontSize: 10.5,
          color: tone,
          background: `${tone}1f`,
          padding: '2px 7px',
          borderRadius: 5
        }}
      >
        {count}
      </span>
      {note && <span style={{ marginLeft: 'auto', fontSize: 11, color: color.textFaint }}>{note}</span>}
    </div>
  )
}

/**
 * Product Manager — consensus board. The friendly, decision-driving surface.
 * Resolving a blocking card here drops the gate count and (when the last one
 * clears) flips the gate OPEN in the sidebar — the live mechanic.
 */
export function ProductManagerView(): JSX.Element {
  const gaps = useGaps()
  const blocking = gaps.filter((g) => g.severity === 'blocking')
  const nonBlocking = gaps.filter((g) => g.severity === 'non-blocking')
  const openBlocking = blocking.filter((g) => g.status === 'open').length

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <GateSidebar />

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minWidth: 0,
          background: color.bgPanel
        }}
      >
        {/* blocking lane */}
        <div style={{ borderRight: `1px solid ${color.border}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <LaneHeader dot={color.orange} label="Blocking" count={openBlocking} tone={color.orange} note="holds the gate" />
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 16px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {blocking.map((g) => (
              <GapCard key={g.id} gap={g} />
            ))}
            {openBlocking === 0 && (
              <div
                className="fm-fadein"
                style={{
                  border: `1px dashed ${color.greenLine}`,
                  borderRadius: 12,
                  padding: 22,
                  textAlign: 'center',
                  color: color.mint,
                  fontSize: 13
                }}
              >
                All blocking items resolved — gate is open ✓
              </div>
            )}
          </div>
        </div>

        {/* non-blocking lane */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <LaneHeader
            dot={color.mint}
            label="Non-blocking"
            count={nonBlocking.filter((g) => g.status === 'open').length}
            tone={color.mint}
          />
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 16px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {nonBlocking.map((g) => (
              <GapCard key={g.id} gap={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
