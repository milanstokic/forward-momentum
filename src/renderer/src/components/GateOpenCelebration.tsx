import type { CSSProperties } from 'react'
import { color, fill, font } from '@/styles/theme'
import { useFm } from '@/state/store'
import { Check } from './Icon'
import { mono } from './primitives'

/** Hexagonal seal with an open padlock + check — the gate motif, unlocked. */
function GateSeal(): JSX.Element {
  return (
    <div style={{ position: 'relative', width: 132, height: 132, margin: '0 auto' }}>
      {/* rippling rings */}
      {[0, 0.45, 0.9].map((delay, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${color.mint}`,
            animation: `fmring 2.4s ${delay}s ease-out infinite`
          }}
        />
      ))}
      {/* hex + lock */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fmsealspin .6s cubic-bezier(.2,.8,.2,1) both'
        }}
      >
        <svg
          width={132}
          height={132}
          viewBox="0 0 132 132"
          style={{ animation: 'fmglow 2.6s ease-in-out infinite' }}
        >
          <path
            d="M66 14 108 38v48L66 110 24 86V38L66 14Z"
            fill="rgba(126,255,198,.07)"
            stroke={color.mint}
            strokeWidth={2}
          />
          {/* open padlock: shackle swung open to the right */}
          <rect x="54" y="62" width="24" height="19" rx="3" fill={color.mint} />
          <path
            d="M58 62v-7a8 8 0 0 1 15-3.5"
            fill="none"
            stroke={color.mint}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </svg>
      </div>
      {/* check badge */}
      <span
        style={{
          position: 'absolute',
          right: 16,
          bottom: 18,
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: color.mint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 0 4px ${color.bgRaised}`,
          animation: 'fmcardpop .5s .35s both'
        }}
      >
        <Check size={16} color={color.bgPanel} strokeWidth={3.4} />
      </span>
    </div>
  )
}

/** A scatter of mint/orange confetti shards behind the card. */
function Confetti(): JSX.Element {
  const shards = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + (i % 2 ? 0.3 : 0)
    const dist = 180 + (i % 5) * 34
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 40 // bias upward
    const rot = (i % 2 ? 1 : -1) * (180 + (i % 4) * 90)
    const c = i % 3 === 0 ? color.orange : color.mint
    const style = {
      position: 'absolute',
      left: '50%',
      top: '46%',
      width: i % 2 ? 7 : 5,
      height: i % 2 ? 7 : 10,
      background: c,
      borderRadius: 1,
      '--dx': `${dx}px`,
      '--dy': `${dy}px`,
      '--rot': `${rot}deg`,
      animation: `fmshard 1.5s ${0.05 * (i % 6)}s cubic-bezier(.15,.6,.4,1) forwards`
    } as CSSProperties
    return <span key={i} style={style} />
  })
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>{shards}</div>
}

export function GateOpenCelebration(): JSX.Element | null {
  const justOpened = useFm((s) => s.justOpened)
  const gaps = useFm((s) => s.engagement.gaps)
  const gate = useFm((s) => s.gate)
  const advanceToPrd = useFm((s) => s.advanceToPrd)
  const dismiss = useFm((s) => s.dismissCelebration)

  if (!justOpened) return null

  const clearedBlockers = gaps.filter((g) => g.severity === 'blocking' && g.status !== 'open')

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(15,15,15,.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fmbackdrop .28s ease both'
      }}
    >
      <Confetti />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 460,
          maxWidth: '90vw',
          background: color.bgRaised,
          border: `1px solid ${fill.mintBorder}`,
          borderRadius: 18,
          padding: '30px 30px 24px',
          boxShadow: `0 30px 80px -20px rgba(0,0,0,.6), 0 0 0 1px rgba(126,255,198,.08), 0 0 60px -20px rgba(126,255,198,.4)`,
          animation: 'fmcardpop .42s cubic-bezier(.2,.8,.2,1) both'
        }}
      >
        <div
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: '.18em',
            color: color.mint,
            textAlign: 'center',
            marginBottom: 18
          }}
        >
          RESOLUTION GATE · OPEN
        </div>

        <GateSeal />

        <h2
          style={{
            fontFamily: font.ui,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-.02em',
            textAlign: 'center',
            margin: '20px 0 8px'
          }}
        >
          Resolution gate cleared
        </h2>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: color.textMute,
            textAlign: 'center',
            margin: '0 auto 18px',
            maxWidth: 360
          }}
        >
          Every blocking conflict is resolved. Consensus is recorded with provenance — the PRD
          can now be drafted from the agreed claims.
        </p>

        <div
          style={{
            ...mono,
            fontSize: 10.5,
            color: color.textFaint,
            textAlign: 'center',
            marginBottom: 16
          }}
        >
          {gate.resolved} / {gate.total} gaps resolved · <span style={{ color: color.mint }}>0 blocking</span>
        </div>

        {/* receipts for the blockers we just cleared */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {clearedBlockers.map((g, i) => (
            <div
              key={g.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 9,
                background: fill.mint06,
                border: `1px solid ${color.greenLine}`,
                animation: `fmrowin .3s ${0.12 + i * 0.08}s both`
              }}
            >
              <Check size={13} color={color.mint} strokeWidth={2.6} />
              <span
                style={{
                  fontSize: 12.5,
                  color: color.textDim,
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {g.view.title}
              </span>
              <span style={{ ...mono, fontSize: 9.5, color: color.textFaint, flex: 'none' }}>{g.id}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 9 }}>
          <div
            data-clickable
            onClick={advanceToPrd}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px',
              borderRadius: 10,
              background: color.mint,
              color: color.bgPanel,
              fontSize: 13,
              fontWeight: 600
            }}
          >
            Advance to PRD draft →
          </div>
          <div
            data-clickable
            onClick={dismiss}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: `1px solid ${color.borderHard}`,
              color: color.textDim,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            Stay here
          </div>
        </div>
      </div>
    </div>
  )
}
