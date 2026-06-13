import { useState } from 'react'
import { color, fill, font, radius } from '@/styles/theme'
import { useFm } from '@/state/store'
import { checkoutV2Prd } from '@/data/checkoutV2Prd'
import {
  citationToken,
  traceability,
  type Assertion,
  type ContractGroup,
  type PrdCitation,
  type PrdSection
} from '@/model/prd'
import { Label, mono, shortSource } from '@/components/primitives'
import { Check, FileIcon } from '@/components/Icon'

type DualMode = 'both' | 'human' | 'machine'

/* ── citation token (the bracket at the end of every assertion) ────────── */
function CitationTokens({ citations, pending }: { citations: PrdCitation[]; pending?: boolean }): JSX.Element {
  const tone = pending ? '#d8b48a' : color.mint
  return (
    <>
      {citations.map((c, i) => (
        <span key={i} style={{ ...mono, fontSize: 10, color: tone, whiteSpace: 'nowrap' }}>
          [{citationToken(c)}
          {c.isDecision || c.decisionId ? <span style={{ color: color.greenLine }}> ✶</span> : null}]
        </span>
      ))}
    </>
  )
}

/* ── inline evidence reveal ────────────────────────────────────────────── */
function EvidenceReveal({ citations }: { citations: PrdCitation[] }): JSX.Element {
  return (
    <div className="fm-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 7, margin: '9px 0 4px' }}>
      {citations.map((c, i) => {
        const decision = c.isDecision || !!c.decisionId
        const accent = decision ? color.greenLine : color.mint
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${color.borderHard}`,
              borderLeft: `2px solid ${accent}`,
              borderRadius: 9,
              padding: '10px 12px',
              background: color.bgPanel
            }}
          >
            <div
              style={{
                ...mono,
                fontSize: 9.5,
                letterSpacing: '.1em',
                color: accent,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 6
              }}
            >
              {decision ? '✶ RECORDED DECISION' : '↳ SOURCE'}
              <span style={{ color: color.textGhost, letterSpacing: 0 }}>
                {shortSource(c.sourceFile)} · {c.locator}
              </span>
              {c.claimIds.length > 0 && (
                <span style={{ color: color.textGhost, letterSpacing: 0 }}>· {c.claimIds.join(', ')}</span>
              )}
            </div>
            <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.5, color: '#e4e4de' }}>“{c.quote}”</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── one assertion row (click to reveal its receipt) ───────────────────── */
function AssertionRow({
  a,
  index,
  numbered,
  selected,
  onSelect
}: {
  a: Assertion
  index: number
  numbered?: boolean
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  const marker = numbered ? `${index + 1}.` : a.pending ? '◇' : '▸'
  const markerColor = a.pending ? '#d8b48a' : color.mint
  return (
    <div
      style={{
        borderRadius: radius.md,
        padding: '8px 10px',
        marginLeft: -10,
        marginRight: -10,
        background: selected ? fill.mint06 : 'transparent',
        borderLeft: `2px solid ${selected ? color.mint : 'transparent'}`
      }}
    >
      <div data-clickable onClick={onSelect} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
        <span style={{ ...mono, color: markerColor, flex: 'none', fontSize: numbered ? 11 : 12 }}>{marker}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, lineHeight: 1.55, color: a.pending ? color.textMute : '#dededa' }}>
            {a.text}{' '}
          </span>
          {a.pending && (
            <span
              style={{
                ...mono,
                fontSize: 8.5,
                letterSpacing: '.08em',
                color: '#d8b48a',
                border: `1px solid #4a4136`,
                padding: '1px 5px',
                borderRadius: 4,
                margin: '0 4px',
                whiteSpace: 'nowrap'
              }}
            >
              PENDING
            </span>
          )}{' '}
          <CitationTokens citations={a.citations} pending={a.pending} />
        </div>
      </div>
      {selected && <EvidenceReveal citations={a.citations} />}
    </div>
  )
}

/* ── a PRD section ─────────────────────────────────────────────────────── */
function Section({
  section,
  selectedId,
  onSelect
}: {
  section: PrdSection
  selectedId: string | null
  onSelect: (id: string) => void
}): JSX.Element {
  return (
    <div style={{ marginBottom: 22 }}>
      <Label style={{ fontSize: 9.5, marginBottom: section.intro ? 6 : 10, color: color.textMute }}>{section.title}</Label>
      {section.intro && (
        <p style={{ fontSize: 11.5, lineHeight: 1.5, color: color.textFaint, margin: '0 0 10px' }}>{section.intro}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {section.assertions.map((a, i) => (
          <AssertionRow
            key={a.id}
            a={a}
            index={i}
            numbered={section.numbered}
            selected={selectedId === a.id}
            onSelect={() => onSelect(a.id)}
          />
        ))}
      </div>
    </div>
  )
}

/* ── data / api contracts ──────────────────────────────────────────────── */
function Contracts({
  groups,
  selectedId,
  onSelect
}: {
  groups: ContractGroup[]
  selectedId: string | null
  onSelect: (id: string) => void
}): JSX.Element {
  return (
    <div style={{ marginBottom: 22 }}>
      <Label style={{ fontSize: 9.5, marginBottom: 10, color: color.textMute }}>Data / API Contracts</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map((g) => (
          <div key={g.name} style={{ background: '#121212', border: `1px solid ${color.border}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ ...mono, fontSize: 11, color: '#9fb8af', marginBottom: 8 }}>
              {g.name}
              {g.endpoint && <span style={{ color: color.textGhost }}> · {g.endpoint}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {g.fields.map((f) => {
                const selected = selectedId === f.id
                return (
                  <div
                    key={f.id}
                    style={{
                      borderRadius: 7,
                      padding: '7px 9px',
                      marginLeft: -9,
                      marginRight: -9,
                      background: selected ? fill.mint06 : 'transparent',
                      borderLeft: `2px solid ${selected ? color.mint : 'transparent'}`
                    }}
                  >
                    <div data-clickable onClick={() => onSelect(f.id)} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <code style={{ ...mono, fontSize: 11.5, color: '#e3b69d' }}>{f.field}</code>
                      <span style={{ fontSize: 11.5, color: color.textMute }}>— {f.note}</span>{' '}
                      <CitationTokens citations={f.citations} />
                    </div>
                    {selected && <EvidenceReveal citations={f.citations} />}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── a document pane (one of the dual views) ───────────────────────────── */
function Pane({
  dot,
  filename,
  caption,
  children
}: {
  dot: string
  filename: string
  caption: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          height: 40,
          flex: 'none',
          borderBottom: `1px solid ${color.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 22px'
        }}
      >
        <span style={{ color: dot, fontSize: 11 }}>●</span>
        <span style={{ ...mono, fontSize: 12, color: '#e4e4de' }}>{filename}</span>
        <span style={{ ...mono, fontSize: 10.5, color: color.textGhost }}>{caption}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>{children}</div>
    </div>
  )
}

/** PRD draft — pipeline stage 3. Dual-view, every assertion traceable.
 *  Click any assertion to reveal the verbatim source or recorded decision. */
export function PrdDraftScreen(): JSX.Element {
  const doc = useFm((s) => s.prd) ?? checkoutV2Prd
  const slug = useFm((s) => s.engagement.slug)
  const handedToReview = useFm((s) => s.handedToReview)
  const handToReview = useFm((s) => s.handToReview)
  const [mode, setMode] = useState<DualMode>('both')
  const [selectedId, setSelectedId] = useState<string | null>('h-dec-1')

  const select = (id: string): void => setSelectedId((cur) => (cur === id ? null : id))
  const trace = traceability(doc)
  const fullyTraceable = trace.cited === trace.total

  const showHuman = mode !== 'machine'
  const showMachine = mode !== 'human'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: color.bg }}>
      {/* stage toolbar (replaces the persona switcher on this stage) */}
      <div
        style={{
          height: 64,
          flex: 'none',
          background: color.bgPanel,
          borderBottom: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 22px',
          gap: 16
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>PRD draft</div>
          <div style={{ ...mono, fontSize: 10.5, color: color.textFaint, marginTop: 2 }}>
            composed from {trace.total} resolved assertions · {slug}.prd
          </div>
        </div>

        {/* dual-view toggle */}
        <div style={{ display: 'flex', gap: 4, background: color.bgInput, border: `1px solid ${color.borderSoft}`, borderRadius: 9, padding: 3 }}>
          {(['both', 'human', 'machine'] as DualMode[]).map((m) => (
            <div
              key={m}
              data-clickable
              onClick={() => setMode(m)}
              style={{
                ...mono,
                fontSize: 10.5,
                padding: '5px 11px',
                borderRadius: 6,
                color: mode === m ? color.bgPanel : color.textMute,
                background: mode === m ? color.mint : 'transparent',
                fontWeight: mode === m ? 600 : 400,
                textTransform: 'capitalize'
              }}
            >
              {m}
            </div>
          ))}
        </div>

        {/* traceability meter — the thesis, made visible */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '8px 13px',
            borderRadius: 9,
            background: fill.mint06,
            border: `1px solid ${fullyTraceable ? color.greenLine : color.borderHard}`
          }}
        >
          {fullyTraceable && <Check size={14} color={color.mint} strokeWidth={2.6} />}
          <span style={{ ...mono, fontSize: 11, color: color.mint }}>
            {trace.cited}/{trace.total} cited · {fullyTraceable ? '100% traceable' : 'UNCITED LINES'}
          </span>
        </div>

        {/* advance to Review */}
        {handedToReview ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: 9,
              border: `1px solid ${color.greenLine}`,
              color: color.mint,
              fontSize: 12.5
            }}
          >
            <Check size={14} color={color.mint} strokeWidth={2.6} />
            Handed to Review
          </div>
        ) : (
          <div
            data-clickable
            onClick={handToReview}
            style={{
              padding: '10px 16px',
              borderRadius: 9,
              background: color.mint,
              color: color.bgPanel,
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            Send to Review →
          </div>
        )}
      </div>

      {/* dual panes */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {showHuman && (
          <Pane dot={color.mint} filename="prd/PRD.md" caption="human view · narrative">
            <div style={{ maxWidth: 640 }}>
              {doc.human.map((s) => (
                <Section key={s.title} section={s} selectedId={selectedId} onSelect={select} />
              ))}
            </div>
          </Pane>
        )}
        {showHuman && showMachine && <div style={{ width: 1, background: color.border, flex: 'none' }} />}
        {showMachine && (
          <Pane dot="#9fb8af" filename="spec/SPEC.md" caption="machine view · testable">
            <div style={{ maxWidth: 640 }}>
              {doc.spec.map((s) => (
                <Section key={s.title} section={s} selectedId={selectedId} onSelect={select} />
              ))}
              <Contracts groups={doc.contracts} selectedId={selectedId} onSelect={select} />
            </div>
          </Pane>
        )}
      </div>

      {/* footer note */}
      <div
        style={{
          flex: 'none',
          height: 38,
          borderTop: `1px solid ${color.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 22px',
          ...mono,
          fontSize: 10.5,
          color: color.textGhost
        }}
      >
        <FileIcon size={11} color={color.greenLine} />
        Every assertion ends in a citation — an uncited line fails the traceability gate. Click a line to see its receipt.
      </div>
    </div>
  )
}
