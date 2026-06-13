import { color, fill, font } from '@/styles/theme'
import { useFm, useGate } from '@/state/store'
import type { GapRecord } from '@/model/types'
import { CategoryBadge, mono, shortSource } from '@/components/primitives'
import { Lock } from '@/components/Icon'

function LedgerRow({ g }: { g: GapRecord }): JSX.Element {
  const contested = g.severity === 'blocking' && g.status === 'open'
  const dotColor = contested ? color.orange : color.mint
  const srcColor = contested ? color.orangeSoft : '#7c9d8e'
  const p = g.evidence[0]
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 20px',
        borderBottom: `1px solid #1f1f1f`,
        alignItems: 'flex-start',
        background: g.status !== 'open' ? 'rgba(126,255,198,.03)' : 'transparent'
      }}
    >
      <CategoryBadge category={g.view.category} width={88} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: color.text, lineHeight: 1.35 }}>
          {g.view.title}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flex: 'none', marginTop: 3 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...mono, fontSize: 10, color: srcColor }}>
              {shortSource(p.sourceFile)} · {p.locator}
            </div>
            <div style={{ fontFamily: font.ui, fontSize: 11, color: color.textMute, marginTop: 2, lineHeight: 1.4 }}>
              “{p.quote}”
            </div>
          </div>
        </div>
      </div>
      {contested ? (
        <span
          style={{
            ...mono,
            fontSize: 8,
            letterSpacing: '.06em',
            color: color.orange,
            background: fill.orange13,
            padding: '4px 7px',
            borderRadius: 5,
            flex: 'none',
            marginTop: 1
          }}
        >
          CONTESTED
        </span>
      ) : (
        <span style={{ ...mono, fontSize: 8, letterSpacing: '.06em', color: color.mint, flex: 'none', marginTop: 3 }}>
          traced
        </span>
      )}
    </div>
  )
}

function MachineSpec(): JSX.Element {
  const gaps = useFm((s) => s.engagement.gaps)
  const slaGap = gaps.find((g) => g.id === 'gap-002')
  const slaResolved = slaGap ? slaGap.status !== 'open' : false

  return (
    <div
      style={{
        width: 418,
        flex: 'none',
        background: color.bgRaised,
        borderLeft: `1px solid ${color.border}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${color.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600 }}>Machine spec</span>
        <span style={{ ...mono, fontSize: 9, color: color.bgPanel, background: color.mint, padding: '3px 7px', borderRadius: 5, fontWeight: 600 }}>
          REQ-014
        </span>
        <span style={{ marginLeft: 'auto', ...mono, fontSize: 10, color: color.textGhost }}>for coding agent</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', ...mono, fontSize: 11.5, lineHeight: 1.6, color: '#cfcfca' }}>
        <div style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: color.text, marginBottom: 4 }}>
          Express refund
        </div>
        <div style={{ color: color.textFaint, fontSize: 10, marginBottom: 14 }}>↑ traces to prd-draft · §4.2 · transcript 31:20</div>

        <div style={{ fontSize: 9.5, letterSpacing: '.12em', color: color.textGhost, marginBottom: 8 }}>ACCEPTANCE CRITERIA</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, color: '#cfcfca' }}>
            <span style={{ color: color.mint }}>▸</span>
            <span>GIVEN a settled charge, WHEN refund issued, THEN funds return to original method.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, color: slaResolved ? '#cfcfca' : '#7a6a62' }}>
            <span style={{ color: slaResolved ? color.mint : color.orange }}>▸</span>
            {slaResolved ? (
              <span>
                SLA window <span style={{ background: fill.mint10, color: color.mint, padding: '1px 5px', borderRadius: 4 }}>24h</span> — resolved via gap-002.
              </span>
            ) : (
              <span style={{ color: '#e3b69d' }}>
                SLA window <span style={{ background: fill.orange13, color: color.orange, padding: '1px 5px', borderRadius: 4 }}>UNRESOLVED</span> — blocked by gap-002.
              </span>
            )}
          </div>
        </div>

        <div style={{ fontSize: 9.5, letterSpacing: '.12em', color: color.textGhost, marginBottom: 8 }}>DATA CONTRACT</div>
        <div style={{ background: '#121212', border: `1px solid ${color.border}`, borderRadius: 8, padding: 12, color: '#9fb8af', fontSize: 11, lineHeight: 1.7 }}>
          POST /refunds
          <br />
          <span style={{ color: color.textGhost }}>{'{'}</span>
          <br />
          &nbsp;&nbsp;<span style={{ color: '#e3b69d' }}>charge_id</span>: string,
          <br />
          &nbsp;&nbsp;<span style={{ color: '#e3b69d' }}>amount</span>: int,
          <br />
          &nbsp;&nbsp;<span style={{ color: '#e3b69d' }}>sla_hours</span>:{' '}
          {slaResolved ? (
            <span style={{ color: color.mint }}>24</span>
          ) : (
            <span style={{ color: color.orange }}>??? // gated</span>
          )}
          <br />
          <span style={{ color: color.textGhost }}>{'}'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '18px 0 9px' }}>
          <span style={{ fontSize: 9.5, letterSpacing: '.12em', color: color.textGhost }}>BREAKDOWN · TASKS FROM THIS PRD</span>
          <span style={{ flex: 1, height: 1, background: color.border }} />
          <span style={{ fontSize: 9, color: color.textGhost }}>synced ↻</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <TaskRow
            id="FM-231 · Refund endpoint"
            sub="feat/refunds"
            dot={slaResolved ? color.mint : color.orange}
            tag={slaResolved ? 'UNBLOCKED' : 'BLOCKED · GATE'}
            tagColor={slaResolved ? color.mint : color.orange}
          />
          <TaskRow id="FM-240 · Drawer empty state" sub="feat/drawer-empty · design linked" dot={color.mint} tag="IN REVIEW" tagColor={color.mint} />
          <TaskRow id="FM-233 · Decline error copy" sub="unassigned" dot="#55554f" tag="TODO" tagColor={color.textFaint} muted />
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: color.textFaint }}>
          <Lock size={12} color={color.textFaint} />
          Tasks sync from your tracker — blocked ones can&apos;t merge past the gate.
        </div>
      </div>
    </div>
  )
}

function TaskRow({
  id,
  sub,
  dot,
  tag,
  tagColor,
  muted
}: {
  id: string
  sub: string
  dot: string
  tag: string
  tagColor: string
  muted?: boolean
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 10px',
        borderRadius: 8,
        background: '#141212',
        border: `1px solid ${color.border}`
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flex: 'none' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, color: muted ? color.textDim : '#e4e4de' }}>{id}</div>
        <div style={{ fontSize: 9, color: color.textGhost, marginTop: 2 }}>{sub}</div>
      </div>
      <span
        style={{
          fontSize: 8,
          letterSpacing: '.05em',
          color: tagColor,
          background: muted ? 'transparent' : `${tagColor}1f`,
          border: muted ? `1px solid ${color.borderHard}` : 'none',
          padding: '3px 6px',
          borderRadius: 4,
          flex: 'none',
          ...mono
        }}
      >
        {tag}
      </span>
    </div>
  )
}

/** Developer — spec & provenance. The mono-forward audit surface; the quality
 *  floor pins to the bottom and blocks handoff to coding agents. */
export function DeveloperView(): JSX.Element {
  const gaps = useFm((s) => s.engagement.gaps)
  const gate = useGate()

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, fontFamily: font.mono }}>
      <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', minWidth: 0, background: color.bg }}>
        <div
          style={{
            height: 46,
            flex: 'none',
            borderBottom: `1px solid ${color.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px'
          }}
        >
          <span style={{ fontSize: 12.5, color: color.mint }}>●</span>
          <span style={{ fontSize: 12.5, color: '#e4e4de' }}>{useFm.getState().engagement.slug}.prd</span>
          <span style={{ fontSize: 11, color: '#5a5a54' }}>/ provenance</span>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: color.textFaint }}>
            <span style={{ color: color.mint }}>{gate.total - gate.openBlocking} traced</span> ·{' '}
            <span style={{ color: color.orange }}>{gate.openBlocking} contested</span>
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {gaps.map((g) => (
            <LedgerRow key={g.id} g={g} />
          ))}
        </div>
        <div
          style={{
            flex: 'none',
            background: color.bgPanel,
            borderTop: `1px solid ${gate.closed ? fill.orangeBorder : fill.mintBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            height: 56
          }}
        >
          <span style={{ color: gate.closed ? color.orange : color.mint, display: 'flex' }}>
            <Lock size={22} color={gate.closed ? color.orange : color.mint} strokeWidth={1.8} />
          </span>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.05em', color: gate.closed ? color.orange : color.mint }}>
              QUALITY FLOOR · GATE {gate.closed ? 'CLOSED' : 'OPEN'}
            </div>
            <div style={{ fontFamily: font.ui, fontSize: 11, color: color.textMute, marginTop: 1 }}>
              {gate.closed
                ? `${gate.openBlocking} contested requirements block handoff to coding agents.`
                : 'All requirements trace clean — handoff to coding agents unblocked.'}
            </div>
          </div>
        </div>
      </div>
      <MachineSpec />
    </div>
  )
}
