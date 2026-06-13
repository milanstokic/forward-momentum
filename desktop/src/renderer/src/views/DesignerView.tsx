import { useState } from 'react'
import { color, fill, font } from '@/styles/theme'
import { useFm } from '@/state/store'
import type { GapRecord } from '@/model/types'
import { CategoryBadge, Label, ProvenanceChip, mono } from '@/components/primitives'
import { Check, Figma } from '@/components/Icon'

/** Acceptance criteria authored per design task (display-only demo content). */
const ACCEPTANCE: Record<string, { req: string; criteria: string[]; context: string }> = {
  'gap-004': {
    req: 'REQ-018',
    context: 'checkout-v2 · payment step',
    criteria: [
      'Inline error copy beneath the card field',
      'Retry affordance — no full-page reset',
      'Uses the error token from the system'
    ]
  },
  'gap-005': {
    req: 'REQ-022',
    context: 'checkout-v2 · express-drawer frames',
    criteria: [
      'Empty state with a clear "Browse products" CTA',
      'Reuses the drawer container + type scale',
      'Covers first-open and last-item-removed'
    ]
  }
}

function FrameThumb({ caption }: { caption: string }): JSX.Element {
  return (
    <div
      style={{
        width: 56,
        height: 42,
        borderRadius: 6,
        flex: 'none',
        overflow: 'hidden',
        border: `1px solid ${color.borderHard}`,
        background: 'repeating-linear-gradient(135deg,#242424 0 6px,#1c1c1c 6px 12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <span style={{ ...mono, fontSize: 6.5, lineHeight: 1.25, color: '#5f8f7d', textAlign: 'center', whiteSpace: 'pre-line' }}>
        {caption}
      </span>
    </div>
  )
}

function TaskCard({ g }: { g: GapRecord }): JSX.Element {
  const [connected, setConnected] = useState(false)
  const meta = ACCEPTANCE[g.id]
  const routed = g.status === 'routed'

  return (
    <div
      style={{
        flex: 1,
        background: color.bgCard,
        border: `1px solid ${color.borderHard}`,
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CategoryBadge category={g.view.category} />
        <span style={{ ...mono, fontSize: 9, color: color.textGhost }}>from {g.id}</span>
        <span style={{ marginLeft: 'auto', ...mono, fontSize: 9.5, color: routed ? color.mint : color.textFaint }}>
          {routed ? 'NEW' : 'CANDIDATE'}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 8 }}>
        {g.view.title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: '#a8a8a2', marginBottom: 16 }}>{g.view.body}</div>

      <Label style={{ marginBottom: 9, fontSize: 9 }}>Acceptance</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {meta.criteria.map((c) => (
          <div key={c} style={{ display: 'flex', gap: 9, fontSize: 12, color: '#cfcfca' }}>
            <span style={{ color: color.mint, flex: 'none' }}>▸</span>
            {c}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <ProvenanceChip p={{ sourceFile: meta.context, locator: 'context', quote: '' }} tone="mute" />
      </div>

      <div style={{ marginTop: 'auto' }}>
        {connected ? (
          <>
            <div
              className="fm-fadein"
              style={{
                display: 'flex',
                gap: 11,
                alignItems: 'center',
                padding: '10px 11px',
                borderRadius: 10,
                background: '#161616',
                border: `1px solid ${color.greenLine}`,
                marginBottom: 10
              }}
            >
              <FrameThumb caption={g.id === 'gap-005' ? 'empty\nstate' : 'decline\nerror'} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Figma size={11} />
                  <span style={{ fontSize: 11.5, color: '#e4e4de', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {g.id === 'gap-005' ? 'express-drawer-v2' : 'payment-step-v2'}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    ...mono,
                    fontSize: 8.5,
                    letterSpacing: '.04em',
                    color: color.mint,
                    background: fill.mint10,
                    padding: '3px 6px',
                    borderRadius: 4,
                    display: 'inline-block'
                  }}
                >
                  ↳ ATTACHED TO PRD · {meta.req}
                </div>
              </div>
              <Check size={14} color={color.mint} strokeWidth={2.6} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                data-clickable
                style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 9, border: `1px solid ${color.greenLine}`, color: color.mint, fontSize: 12, fontWeight: 500 }}
              >
                View in PRD →
              </div>
              <div
                data-clickable
                onClick={() => setConnected(false)}
                style={{ padding: '10px 13px', borderRadius: 9, border: `1px solid ${color.borderHard}`, color: color.textFaint, fontSize: 12 }}
              >
                Detach
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              data-clickable
              onClick={() => setConnected(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 11,
                borderRadius: 9,
                background: color.mint,
                color: color.bgPanel,
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 8
              }}
            >
              <Figma size={13} />
              Connect Figma frame
            </div>
            <div style={{ textAlign: 'center', ...mono, fontSize: 9, color: color.textGhost }}>
              links the design back to PRD · {meta.req}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Designer — design-task inbox. Only well-formed tasks the pipeline routed
 *  here; nothing raw, nothing half-specified. (Pipeline stage 5: Handoff.) */
export function DesignerView(): JSX.Element {
  const gaps = useFm((s) => s.engagement.gaps)
  const designTasks = gaps.filter((g) => g.view.canRouteToDesign)
  const newCount = designTasks.filter((g) => g.status === 'routed').length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: color.bgPanel }}>
      <div style={{ padding: '22px 28px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${color.border}` }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>Design tasks</div>
          <div style={{ fontSize: 12, color: color.textFaint, marginTop: 3 }}>
            Well-formed tasks sent to you from the pipeline — nothing raw, nothing half-specified.
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11.5,
            color: color.textMute,
            background: color.bgCard,
            border: `1px solid ${color.borderSoft}`,
            borderRadius: 8,
            padding: '8px 12px'
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color.mint }} />
          {newCount} new · syncs to Figma
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '20px 28px', display: 'flex', gap: 18 }}>
        {designTasks.map((g) => (
          <TaskCard key={g.id} g={g} />
        ))}

        <div style={{ width: 250, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: color.bgRaised, border: `1px solid ${color.border}`, borderRadius: 12, padding: 16 }}>
            <Label style={{ marginBottom: 12, fontSize: 9 }}>Watching · may route to you</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: color.textDim, lineHeight: 1.35 }}>Apple Pay markets assumption</div>
                <div style={{ ...mono, fontSize: 9.5, color: color.textFaint, marginTop: 3 }}>if confirmed → button variants</div>
              </div>
              <div style={{ height: 1, background: color.border }} />
              <div>
                <div style={{ fontSize: 12, color: color.textDim, lineHeight: 1.35 }}>Guest checkout decision</div>
                <div style={{ ...mono, fontSize: 9.5, color: color.textFaint, marginTop: 3 }}>blocked — flow may change</div>
              </div>
            </div>
          </div>
          <div
            style={{
              background: color.bgRaised,
              border: `1px solid ${color.border}`,
              borderRadius: 12,
              padding: 16,
              fontSize: 11.5,
              lineHeight: 1.55,
              color: color.textMute,
              fontFamily: font.ui
            }}
          >
            You only ever see tasks the pipeline has fully specified.{' '}
            <span style={{ color: color.mint }}>No guessing what&apos;s wanted.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
