import { color, fill } from '@/styles/theme'
import { useFm, useGate } from '@/state/store'
import type { GapRecord, PipelineStage } from '@/model/types'
import { CategoryBadge, mono } from '@/components/primitives'
import { Check, Lock } from '@/components/Icon'

function StatCard({ value, label, tone }: { value: string; label: string; tone: string }): JSX.Element {
  return (
    <div
      style={{
        background: color.bgCard,
        border: `1px solid ${color.borderSoft}`,
        borderRadius: 10,
        padding: '10px 16px',
        textAlign: 'center'
      }}
    >
      <div style={{ ...mono, fontSize: 20, fontWeight: 600, color: tone }}>{value}</div>
      <div style={{ fontSize: 10, color: color.textFaint, marginTop: 1 }}>{label}</div>
    </div>
  )
}

function GateHealthStrip({ stages }: { stages: PipelineStage[] }): JSX.Element {
  return (
    <div style={{ padding: '16px 24px 14px' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {stages.map((st) => {
          const locked = st.status === 'locked'
          const done = st.status === 'done'
          const current = st.status === 'current'
          const cellBg = locked ? fill.orange07 : current ? 'rgba(242,241,237,.04)' : color.bgInput
          const cellBorder = locked ? fill.orangeBorder : color.border
          const stepColor = locked ? color.orange : done ? color.mint : current ? color.text : color.textFaint
          return (
            <div
              key={st.key}
              style={{
                flex: 1,
                minWidth: 0,
                background: cellBg,
                border: `1px solid ${cellBorder}`,
                borderRadius: 8,
                padding: '11px 12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18, marginBottom: 7 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: stepColor,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  {st.name}
                </span>
                {locked && <Lock size={11} color={color.orange} strokeWidth={2.2} />}
                {done && <Check size={11} color={color.mint} strokeWidth={3} />}
              </div>
              <div
                style={{
                  ...mono,
                  fontSize: 9.5,
                  color: locked ? color.orangeSoft : color.textFaint,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {st.note}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ownerColors(role: string): { bg: string; fg: string } {
  if (role === 'Eng') return { bg: 'rgba(246,112,53,.15)', fg: color.orangeSoft }
  if (role === 'Design') return { bg: 'rgba(126,255,198,.14)', fg: color.mint }
  return { bg: 'rgba(159,184,175,.14)', fg: '#9fb8af' }
}

function Row({ g }: { g: GapRecord }): JSX.Element {
  const resolveGap = useFm((s) => s.resolveGap)
  const open = g.status === 'open'
  const oc = ownerColors(g.view.owner?.role ?? '')
  const ageColor = (g.view.ageDays ?? 0) >= 2 ? color.orangeSoft : color.textMute
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2.4fr 1.3fr .9fr .7fr 1.5fr 1fr',
        gap: 0,
        padding: '15px 16px',
        alignItems: 'center',
        borderBottom: `1px solid #232323`,
        opacity: open ? 1 : 0.6
      }}
    >
      <div style={{ paddingRight: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: color.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CategoryBadge category={g.view.category} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.view.title}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: oc.bg,
            color: oc.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9.5,
            fontWeight: 600,
            flex: 'none',
            ...mono
          }}
        >
          {g.view.owner?.initials}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: color.textDim, whiteSpace: 'nowrap' }}>{g.view.owner?.name}</div>
          <div style={{ fontSize: 9.5, color: color.textGhost }}>{g.view.owner?.role}</div>
        </div>
      </div>
      <div>
        {g.severity === 'blocking' ? (
          <span
            style={{
              ...mono,
              fontSize: 8.5,
              letterSpacing: '.06em',
              color: color.orange,
              background: fill.orange13,
              padding: '4px 7px',
              borderRadius: 5
            }}
          >
            BLOCKING
          </span>
        ) : (
          <span style={{ ...mono, fontSize: 8.5, letterSpacing: '.06em', color: '#7c9d8e' }}>non-block</span>
        )}
      </div>
      <div style={{ ...mono, fontSize: 11.5, color: ageColor }}>{g.view.ageDays}d</div>
      <div
        style={{
          fontSize: 11.5,
          color: color.textMute,
          paddingRight: 10,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {open ? g.view.waitingOn : `— ${g.status}`}
      </div>
      <div style={{ textAlign: 'right' }}>
        {open ? (
          <span
            data-clickable
            onClick={() => resolveGap(g.id)}
            style={{
              fontSize: 10.5,
              color: color.bgPanel,
              background: color.mint,
              padding: '6px 12px',
              borderRadius: 6,
              fontWeight: 600
            }}
          >
            Nudge
          </span>
        ) : (
          <span style={{ ...mono, fontSize: 10, color: color.mint }}>✓ done</span>
        )}
      </div>
    </div>
  )
}

/** Project Manager — status & ownership. Who holds the gate, and for how long. */
export function ProjectManagerView(): JSX.Element {
  const gaps = useFm((s) => s.engagement.gaps)
  const stages = useFm((s) => s.engagement.stages)
  const gate = useGate()
  const oldest = Math.max(0, ...gaps.filter((g) => g.status === 'open').map((g) => g.view.ageDays ?? 0))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: color.bgPanel }}>
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>Gate health &amp; ownership</div>
          <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>
            Who holds the Resolution gate, and how long it&apos;s been waiting.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <StatCard value={String(gate.openBlocking)} label="blocking open" tone={gate.openBlocking ? color.orange : color.mint} />
          <StatCard value={`${oldest}d`} label="oldest blocker" tone={color.text} />
          <StatCard value={`${gate.resolved}/${gate.total}`} label="resolved" tone={color.mint} />
        </div>
      </div>

      <GateHealthStrip stages={stages} />

      <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 22px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr 1.3fr .9fr .7fr 1.5fr 1fr',
            gap: 0,
            padding: '10px 16px',
            ...mono,
            fontSize: 9.5,
            letterSpacing: '.1em',
            color: color.textGhost,
            borderBottom: `1px solid ${color.border}`
          }}
        >
          <span>ITEM</span>
          <span>OWNER</span>
          <span>SEVERITY</span>
          <span>AGE</span>
          <span>WAITING ON</span>
          <span style={{ textAlign: 'right' }}>ACT</span>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: color.bgInput,
            border: `1px solid ${color.border}`,
            borderTop: 'none',
            borderRadius: '0 0 11px 11px'
          }}
        >
          {gaps.map((g) => (
            <Row key={g.id} g={g} />
          ))}
        </div>
      </div>
    </div>
  )
}
