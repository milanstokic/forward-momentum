import { color, fill, radius } from '@/styles/theme'
import type { GapRecord, GapStatus } from '@/model/types'
import { useFm } from '@/state/store'
import { CategoryBadge, ProvenanceChip, mono } from './primitives'
import { Check, Send } from './Icon'

const STATUS_LABEL: Record<GapStatus, string> = {
  open: 'OPEN',
  resolved: 'RESOLVED',
  deferred: 'DEFERRED',
  waived: 'WAIVED',
  routed: 'SENT TO DESIGN'
}

/** Resolved/deferred/routed cards collapse into a quiet, mint-ticked receipt. */
function ResolvedReceipt({ gap }: { gap: GapRecord }): JSX.Element {
  const routed = gap.status === 'routed'
  const tone = gap.status === 'deferred' ? color.textFaint : color.mint
  return (
    <div
      className="fm-fadein"
      style={{
        background: color.bgInput,
        border: `1px solid ${gap.status === 'deferred' ? color.borderSoft : color.greenLine}`,
        borderRadius: radius.xl,
        padding: '13px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        opacity: 0.92
      }}
    >
      <span style={{ color: tone, display: 'flex', flex: 'none' }}>
        {routed ? <Send size={15} color={tone} /> : <Check size={15} color={tone} strokeWidth={2.6} />}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: color.textDim,
            textDecoration: gap.status === 'deferred' ? 'none' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {gap.view.title}
        </div>
        <div style={{ ...mono, fontSize: 9.5, color: color.textFaint, marginTop: 2 }}>
          {gap.id} · {STATUS_LABEL[gap.status]}
        </div>
      </div>
    </div>
  )
}

export function GapCard({ gap }: { gap: GapRecord }): JSX.Element {
  const resolveGap = useFm((s) => s.resolveGap)
  const deferGap = useFm((s) => s.deferGap)
  const routeToDesign = useFm((s) => s.routeToDesign)
  const openWaive = useFm((s) => s.openWaive)

  if (gap.status !== 'open') return <ResolvedReceipt gap={gap} />

  const blocking = gap.severity === 'blocking'
  const isConflict = gap.kind === 'conflict'
  const conflictEvidence = gap.evidence[1]

  return (
    <div
      className="fm-fadein"
      style={{
        background: blocking ? color.bgCardRaised : color.bgCard,
        border: `1px solid ${blocking ? '#313131' : color.borderSoft}`,
        borderTop: blocking ? `2px solid ${color.orange}` : `1px solid ${color.borderSoft}`,
        borderRadius: radius.xl,
        padding: blocking ? '15px 16px' : '14px 16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: blocking ? 9 : 8 }}>
        <CategoryBadge category={gap.view.category} />
        <span style={{ marginLeft: 'auto', ...mono, fontSize: 9, color: color.textGhost }}>{gap.id}</span>
      </div>

      <div
        style={{
          fontSize: blocking ? 14 : 13.5,
          fontWeight: 600,
          letterSpacing: '-.01em',
          lineHeight: 1.3,
          marginBottom: blocking ? 7 : 6
        }}
      >
        {gap.view.title}
      </div>
      <div
        style={{
          fontSize: blocking ? 12 : 11.5,
          lineHeight: 1.5,
          color: blocking ? '#a8a8a2' : color.textMute,
          marginBottom: blocking ? 12 : 11
        }}
      >
        {gap.view.body}
      </div>

      {/* provenance receipts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: blocking ? 13 : 12 }}>
        <ProvenanceChip p={gap.evidence[0]} tone="mint" />
        {isConflict && conflictEvidence && (
          <div
            style={{
              ...mono,
              fontSize: 10,
              color: color.textMute,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: color.bgInput,
              border: `1px solid ${fill.orangeBorder}`,
              borderRadius: 7,
              padding: '7px 9px'
            }}
          >
            <span style={{ color: color.orange, flex: 'none' }}>⟷</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {conflictEvidence.sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '')} · {conflictEvidence.locator}
            </span>
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 7 }}>
        {gap.view.canRouteToDesign ? (
          <div
            data-clickable
            onClick={() => routeToDesign(gap.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 9,
              borderRadius: radius.md,
              border: `1px solid ${color.greenLine}`,
              color: color.mint,
              fontSize: 12,
              fontWeight: 500
            }}
          >
            <Send size={12} color={color.mint} />
            Send to Design
          </div>
        ) : (
          <div
            data-clickable
            onClick={() => resolveGap(gap.id)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: 9,
              borderRadius: radius.md,
              background: color.mint,
              color: color.bgPanel,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            Resolve
          </div>
        )}
        <div
          data-clickable
          onClick={() => deferGap(gap.id)}
          style={{
            padding: '9px 13px',
            borderRadius: radius.md,
            border: `1px solid ${color.borderHard}`,
            color: color.textDim,
            fontSize: 12
          }}
        >
          Defer
        </div>
        {blocking && (
          <div
            data-clickable
            onClick={() => openWaive(gap.id)}
            title="Open the structured-waiver path for this blocking gap"
            style={{
              padding: '9px 13px',
              borderRadius: radius.md,
              border: `1px solid ${fill.orangeBorder}`,
              color: color.orangeSoft,
              fontSize: 12
            }}
          >
            Waive
          </div>
        )}
      </div>
    </div>
  )
}
