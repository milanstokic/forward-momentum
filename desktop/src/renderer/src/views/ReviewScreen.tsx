import { color, fill, font, radius } from '@/styles/theme'
import { useFm } from '@/state/store'
import { checkoutV2Review } from '@/data/checkoutV2Review'
import { AXIS_LABEL, type AxisResult, type Finding } from '@/model/review'
import { Label, mono } from '@/components/primitives'
import { Check, Lock, Shield, Pen, Warning } from '@/components/Icon'

/* ── the dual-key Review gate (left rail) ──────────────────────────────── */

function KeyRow({
  glyph,
  title,
  satisfied,
  detail,
  action
}: {
  glyph: JSX.Element
  title: string
  satisfied: boolean
  detail: string
  action?: JSX.Element
}): JSX.Element {
  return (
    <div
      style={{
        background: color.bgInput,
        border: `1px solid ${satisfied ? color.greenLine : color.borderSoft}`,
        borderRadius: radius.lg,
        padding: '13px 14px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: satisfied ? fill.mint10 : color.bgCard,
            color: satisfied ? color.mint : color.textMute
          }}
        >
          {glyph}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
          <div style={{ ...mono, fontSize: 9.5, color: satisfied ? color.mint : color.textFaint, marginTop: 2 }}>
            {detail}
          </div>
        </div>
        {satisfied && <Check size={15} color={color.mint} strokeWidth={2.6} />}
      </div>
      {action && <div style={{ marginTop: 11 }}>{action}</div>}
    </div>
  )
}

function GateSeal({ open }: { open: boolean }): JSX.Element {
  const accent = open ? color.mint : color.orange
  return (
    <div style={{ position: 'relative', width: 132, height: 132, margin: '2px auto 4px' }}>
      {open &&
        [0, 0.5].map((d, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              inset: 14,
              borderRadius: '50%',
              border: `2px solid ${color.mint}`,
              animation: `fmring 2.4s ${d}s ease-out infinite`
            }}
          />
        ))}
      <svg
        width={132}
        height={132}
        viewBox="0 0 132 132"
        style={{
          position: 'absolute',
          inset: 0,
          animation: open ? 'fmsealspin .6s cubic-bezier(.2,.8,.2,1) both, fmglow 2.6s ease-in-out infinite' : 'none'
        }}
      >
        <path
          d="M66 14 108 38v48L66 110 24 86V38L66 14Z"
          fill={open ? 'rgba(126,255,198,.07)' : 'rgba(246,112,53,.05)'}
          stroke={accent}
          strokeWidth={2}
        />
        {open ? (
          <>
            <rect x="54" y="64" width="24" height="19" rx="3" fill={color.mint} />
            <path d="M58 64v-7a8 8 0 0 1 15-3.5" fill="none" stroke={color.mint} strokeWidth={3} strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="54" y="64" width="24" height="19" rx="3" fill={accent} />
            <path d="M58 64v-6a8 8 0 0 1 16 0v6" fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" />
          </>
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -2,
          textAlign: 'center',
          ...mono,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.08em',
          color: accent
        }}
      >
        {open ? 'OPEN' : 'CLOSED'}
      </div>
    </div>
  )
}

function ReviewGateRail({ reviewerPass }: { reviewerPass: boolean }): JSX.Element {
  const signedOff = useFm((s) => s.reviewSignedOff)
  const signOff = useFm((s) => s.signOffReview)
  const goToHandoff = useFm((s) => s.setActiveStage)
  const open = reviewerPass && signedOff

  return (
    <div
      style={{
        width: 300,
        flex: 'none',
        background: color.bgRaised,
        borderRight: `1px solid ${color.border}`,
        padding: 22,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Label style={{ color: color.textMute }}>Review gate</Label>
        <span
          style={{
            ...mono,
            fontSize: 8.5,
            letterSpacing: '.08em',
            color: color.orange,
            background: fill.orange13,
            padding: '2px 6px',
            borderRadius: 4
          }}
        >
          HARD-BLOCKING
        </span>
      </div>

      <GateSeal open={open} />

      <div style={{ textAlign: 'center', fontSize: 12, lineHeight: 1.5, color: color.textMute, margin: '10px 0 18px' }}>
        Two keys required — a reviewer pass <b style={{ color: color.text }}>and</b> your sign-off.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <KeyRow
          glyph={<Shield size={16} />}
          title="Reviewer pass"
          satisfied={reviewerPass}
          detail={reviewerPass ? 'fm-reviewer · Verdict PASS' : 'Verdict FAIL — fix the PRD'}
        />
        <KeyRow
          glyph={<Pen size={16} />}
          title="Human sign-off"
          satisfied={signedOff}
          detail={signedOff ? 'signed · Milan (Product)' : 'awaiting your sign-off'}
          action={
            !signedOff ? (
              <div
                data-clickable={reviewerPass || undefined}
                onClick={reviewerPass ? signOff : undefined}
                style={{
                  textAlign: 'center',
                  padding: '9px',
                  borderRadius: radius.md,
                  fontSize: 12,
                  fontWeight: 600,
                  background: reviewerPass ? color.mint : color.bgCard,
                  color: reviewerPass ? color.bgPanel : color.textFaint,
                  cursor: reviewerPass ? 'pointer' : 'not-allowed',
                  border: reviewerPass ? 'none' : `1px solid ${color.borderHard}`
                }}
              >
                Sign off &amp; open gate
              </div>
            ) : undefined
          }
        />
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: 14,
          borderRadius: 10,
          background: open ? fill.mint06 : color.bg,
          border: `1px solid ${open ? fill.mintBorder : color.border}`,
          fontSize: 11.5,
          lineHeight: 1.5,
          color: open ? color.mint : color.textMute
        }}
      >
        {open ? (
          <span className="fm-fadein">
            <b>Gate open.</b> The reviewed PRD can hand off to build — Handoff is unlocked.
            <div
              data-clickable
              onClick={() => goToHandoff('handoff')}
              style={{
                marginTop: 11,
                textAlign: 'center',
                padding: '9px',
                borderRadius: radius.md,
                background: color.mint,
                color: color.bgPanel,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Go to Handoff →
            </div>
          </span>
        ) : (
          <>
            Reviewer pass is necessary but <b style={{ color: color.textDim }}>not sufficient</b>. The gate stays
            closed until a human signs off.
          </>
        )}
      </div>
    </div>
  )
}

/* ── reviewer report (main) ────────────────────────────────────────────── */

function VerdictBanner({ pass, reviewer, at }: { pass: boolean; reviewer: string; at: string }): JSX.Element {
  const accent = pass ? color.mint : color.orange
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 18px',
        borderRadius: radius.lg,
        background: pass ? fill.mint06 : fill.orange07,
        border: `1px solid ${pass ? color.greenLine : fill.orangeBorder}`,
        marginBottom: 20
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: pass ? fill.mint10 : fill.orange13,
          color: accent
        }}
      >
        {pass ? <Check size={22} color={accent} strokeWidth={2.6} /> : <Warning size={22} color={accent} />}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ ...mono, fontSize: 15, fontWeight: 600, letterSpacing: '.04em', color: accent }}>
          Verdict: {pass ? 'PASS' : 'FAIL'}
        </div>
        <div style={{ ...mono, fontSize: 10.5, color: color.textFaint, marginTop: 2 }}>
          {reviewer} · reviewed {at.replace('T', ' ').replace('Z', ' UTC')}
        </div>
      </div>
    </div>
  )
}

function AxisRow({ a }: { a: AxisResult }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid ${color.divider}` }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          flex: 'none',
          marginTop: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: a.pass ? fill.mint10 : fill.orange13,
          color: a.pass ? color.mint : color.orange
        }}
      >
        {a.pass ? <Check size={12} color={color.mint} strokeWidth={3} /> : <Warning size={12} color={color.orange} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{AXIS_LABEL[a.axis]}</span>
          <span style={{ ...mono, fontSize: 9.5, color: a.pass ? color.mint : color.orange }}>
            {a.pass ? 'PASS' : 'FAIL'}
          </span>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: color.textMute, marginTop: 3 }}>{a.note}</div>
      </div>
    </div>
  )
}

function FindingsTable({ findings }: { findings: Finding[] }): JSX.Element {
  if (findings.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: color.mint, padding: '10px 0' }}>
        No findings — PRD passes all three axes.
      </div>
    )
  }
  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.lg, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '90px 150px 1fr',
          gap: 0,
          padding: '9px 14px',
          ...mono,
          fontSize: 9.5,
          letterSpacing: '.1em',
          color: color.textGhost,
          background: color.bgInput,
          borderBottom: `1px solid ${color.border}`
        }}
      >
        <span>SEVERITY</span>
        <span>LOCATION</span>
        <span>FINDING</span>
      </div>
      {findings.map((f, i) => {
        const blocker = f.severity === 'blocker'
        const tone = blocker ? color.orange : '#d8b48a'
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 150px 1fr',
              gap: 0,
              padding: '12px 14px',
              alignItems: 'start',
              borderBottom: i < findings.length - 1 ? `1px solid ${color.divider}` : 'none'
            }}
          >
            <span>
              <span
                style={{
                  ...mono,
                  fontSize: 8.5,
                  letterSpacing: '.06em',
                  color: tone,
                  background: blocker ? fill.orange13 : 'rgba(216,180,138,.12)',
                  border: `1px solid ${blocker ? fill.orangeBorder : '#4a4136'}`,
                  padding: '3px 6px',
                  borderRadius: 4
                }}
              >
                {f.severity.toUpperCase()}
              </span>
            </span>
            <span style={{ ...mono, fontSize: 10.5, color: color.textMute, paddingRight: 10, wordBreak: 'break-word' }}>
              {f.location}
            </span>
            <span style={{ fontSize: 12, lineHeight: 1.5, color: color.textDim }}>{f.finding}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Review — pipeline stage 4. The reviewer's QA pass plus the dual-key,
 *  hard-blocking Review gate (reviewer PASS + human sign-off). */
export function ReviewScreen(): JSX.Element {
  const report = useFm((s) => s.review) ?? checkoutV2Review
  const slug = useFm((s) => s.engagement.slug)
  const reviewerPass = report.verdict === 'PASS'
  const warnings = report.findings.filter((f) => f.severity === 'warning').length
  const blockers = report.findings.filter((f) => f.severity === 'blocker').length

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ReviewGateRail reviewerPass={reviewerPass} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: color.bg }}>
        {/* header */}
        <div
          style={{
            height: 64,
            flex: 'none',
            borderBottom: `1px solid ${color.divider}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 12
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>PRD review</div>
            <div style={{ ...mono, fontSize: 10.5, color: color.textFaint, marginTop: 2 }}>
              decisions/prd-review.md · {slug}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, ...mono, fontSize: 11 }}>
            <span style={{ color: blockers ? color.orange : color.textFaint }}>
              <b style={{ color: blockers ? color.orange : color.textMute }}>{blockers}</b> blockers
            </span>
            <span style={{ color: color.textFaint }}>
              <b style={{ color: '#d8b48a' }}>{warnings}</b> warnings
            </span>
            <span style={{ color: color.textFaint }}>
              3 / 3 axes <span style={{ color: color.mint }}>pass</span>
            </span>
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          <div style={{ maxWidth: 760 }}>
            <VerdictBanner pass={reviewerPass} reviewer={report.reviewer} at={report.reviewedAt} />

            <Label style={{ fontSize: 9.5, marginBottom: 8, color: color.textMute }}>Summary</Label>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: color.textDim, margin: '0 0 22px' }}>{report.summary}</p>

            <Label style={{ fontSize: 9.5, marginBottom: 4, color: color.textMute }}>Axis results</Label>
            <div style={{ marginBottom: 22 }}>
              {report.axes.map((a) => (
                <AxisRow key={a.axis} a={a} />
              ))}
            </div>

            <Label style={{ fontSize: 9.5, marginBottom: 10, color: color.textMute }}>
              Findings · {report.findings.length}
            </Label>
            <FindingsTable findings={report.findings} />
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            flex: 'none',
            height: 38,
            borderTop: `1px solid ${color.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 24px',
            ...mono,
            fontSize: 10.5,
            color: color.textGhost
          }}
        >
          <Lock size={11} color={color.textGhost} />
          The reviewer grants only the pass half of the gate — a human sign-off is still required to advance.
        </div>
      </div>
    </div>
  )
}
