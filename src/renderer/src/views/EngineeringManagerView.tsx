import { useState } from 'react'
import { color, fill } from '@/styles/theme'
import { useFm } from '@/state/store'
import type { GapRecord } from '@/model/types'
import { CategoryBadge, EvidenceCard, Label, SeverityPill, mono } from '@/components/primitives'
import { Bars, Check, Warning } from '@/components/Icon'

function ScopeRow({
  g,
  selected,
  onSelect
}: {
  g: GapRecord
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  const resolved = g.status !== 'open'
  return (
    <div
      data-clickable
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '15px 16px',
        borderRadius: 11,
        marginBottom: 9,
        border: `1px solid ${selected ? fill.orangeBorder : color.border}`,
        background: selected ? fill.orange07 : color.bgInput,
        opacity: resolved ? 0.55 : 1
      }}
    >
      <CategoryBadge category={g.view.category} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: color.text, lineHeight: 1.3 }}>{g.view.title}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginTop: 8,
            ...mono,
            fontSize: 10,
            color: color.textMute
          }}
        >
          <Bars size={11} color="#7c9d8e" />
          <span style={{ color: color.orangeSoft }}>SCOPE IMPACT</span> · {g.view.scopeImpact}
        </div>
      </div>
      {resolved ? (
        <Check size={15} color={color.mint} strokeWidth={2.6} style={{ marginTop: 2 }} />
      ) : (
        <span
          style={{
            ...mono,
            fontSize: 9,
            letterSpacing: '.06em',
            color: color.orange,
            background: fill.orange13,
            padding: '4px 8px',
            borderRadius: 5,
            flex: 'none',
            marginTop: 2
          }}
        >
          BLOCKING
        </span>
      )}
    </div>
  )
}

function Inspector({ g }: { g: GapRecord }): JSX.Element {
  const resolveGap = useFm((s) => s.resolveGap)
  const deferGap = useFm((s) => s.deferGap)
  const a = g.evidence[0]
  const b = g.evidence[1]
  return (
    <div
      style={{
        width: 430,
        flex: 'none',
        background: color.bgRaised,
        borderLeft: `1px solid ${color.border}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <CategoryBadge category={g.view.category} />
          <SeverityPill severity={g.severity} />
          <span style={{ marginLeft: 'auto', ...mono, fontSize: 10, color: color.textGhost }}>
            {g.id.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3 }}>{g.view.title}</div>
        {g.view.scopeImpact && (
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 11px',
              background: fill.orange07,
              border: `1px solid rgba(246,112,53,.25)`,
              borderRadius: 8,
              fontSize: 11.5,
              color: '#e3b69d'
            }}
          >
            <Warning size={13} color={color.orange} />
            {g.view.scopeImpact}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <Label style={{ marginBottom: 10 }}>
          {g.kind === 'conflict' ? 'Evidence · 2 sources in conflict' : 'Evidence'}
        </Label>
        <EvidenceCard p={a} accent={color.mint} attribution={g.view.owner?.name} />
        {b && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 8px 6px' }}>
              <span style={{ ...mono, fontSize: 10, color: color.orange }}>⟷ contradicts</span>
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: 'repeating-linear-gradient(90deg,#F67035 0 4px,transparent 4px 8px)',
                  opacity: 0.5
                }}
              />
            </div>
            <EvidenceCard p={b} accent={color.orange} />
          </>
        )}

        <Label style={{ margin: '18px 0 9px' }}>Your call</Label>
        {g.status === 'open' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div
              data-clickable
              onClick={() => resolveGap(g.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 13px',
                borderRadius: 9,
                border: `1px solid ${fill.mintBorder}`,
                background: fill.mint06,
                color: color.mint,
                fontSize: 12.5,
                fontWeight: 500
              }}
            >
              <Check size={15} color={color.mint} strokeWidth={2.4} />
              Approve “deferred” — record &amp; re-scope
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <div
                data-clickable
                onClick={() => resolveGap(g.id)}
                style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 9, border: `1px solid ${color.borderHard}`, color: color.textDim, fontSize: 12 }}
              >
                Approve “required”
              </div>
              <div
                data-clickable
                onClick={() => deferGap(g.id)}
                style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 9, border: `1px solid ${color.borderHard}`, color: color.textDim, fontSize: 12 }}
              >
                Escalate to call
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '11px 13px',
              borderRadius: 9,
              border: `1px solid ${color.greenLine}`,
              background: fill.mint06,
              color: color.mint,
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <Check size={15} color={color.mint} strokeWidth={2.4} />
            Recorded — {g.status}. Gate updated.
          </div>
        )}
      </div>
    </div>
  )
}

/** Engineering Manager — scope inspector. Only the blocking scope conflicts;
 *  non-blocking gaps are hidden because they don't change estimates. */
export function EngineeringManagerView(): JSX.Element {
  const gaps = useFm((s) => s.engagement.gaps)
  const blocking = gaps.filter((g) => g.severity === 'blocking')
  const hiddenCount = gaps.length - blocking.length
  const [selectedId, setSelectedId] = useState(blocking[0]?.id)
  const selected = blocking.find((g) => g.id === selectedId) ?? blocking[0]
  const openCount = blocking.filter((g) => g.status === 'open').length

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: color.bg }}>
        <div
          style={{
            height: 48,
            flex: 'none',
            borderBottom: `1px solid ${color.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px'
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>Needs your review</span>
          <span style={{ ...mono, fontSize: 11, color: openCount ? color.orange : color.mint }}>
            {openCount} scope {openCount === 1 ? 'conflict' : 'conflicts'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: color.textFaint }}>
            Eng can&apos;t estimate until these resolve
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {blocking.map((g) => (
            <ScopeRow key={g.id} g={g} selected={g.id === selected?.id} onSelect={() => setSelectedId(g.id)} />
          ))}
          <div
            style={{
              marginTop: 6,
              padding: '14px 16px',
              borderRadius: 11,
              border: `1px dashed ${color.borderHard}`,
              color: color.textFaint,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 9
            }}
          >
            <Check size={14} color={color.textFaint} strokeWidth={2} />
            {hiddenCount} non-blocking gaps don&apos;t affect estimates — hidden from this view
          </div>
        </div>
      </div>
      {selected && <Inspector g={selected} />}
    </div>
  )
}
