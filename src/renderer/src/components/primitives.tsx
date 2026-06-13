import type { CSSProperties, ReactNode } from 'react'
import { color, fill, font, radius } from '@/styles/theme'
import { CATEGORY_STYLE } from '@/model/category'
import type { GapCategory, GapSeverity, Provenance } from '@/model/types'
import { FileIcon } from './Icon'

export const mono: CSSProperties = { fontFamily: font.mono }

/* ── Category badge ───────────────────────────────────────────────────── */
export function CategoryBadge({
  category,
  width
}: {
  category: GapCategory
  width?: number
}): JSX.Element {
  const c = CATEGORY_STYLE[category]
  return (
    <span
      style={{
        ...mono,
        fontSize: 9,
        letterSpacing: '.06em',
        color: c.textColor,
        border: `1px solid ${c.borderColor}`,
        padding: '3px 7px',
        borderRadius: radius.sm,
        flex: 'none',
        width,
        textAlign: width ? 'center' : undefined,
        whiteSpace: 'nowrap'
      }}
    >
      {c.label}
    </span>
  )
}

/* ── Severity pill ────────────────────────────────────────────────────── */
export function SeverityPill({ severity }: { severity: GapSeverity }): JSX.Element {
  const blocking = severity === 'blocking'
  return (
    <span
      style={{
        ...mono,
        fontSize: 9,
        letterSpacing: '.1em',
        color: blocking ? color.orange : color.mint,
        background: blocking ? fill.orange13 : fill.mint08,
        padding: '4px 8px',
        borderRadius: radius.sm,
        flex: 'none'
      }}
    >
      {blocking ? 'BLOCKING' : 'NON-BLOCK'}
    </span>
  )
}

/* ── Provenance chip — the "machine receipt" ──────────────────────────── */
export function ProvenanceChip({
  p,
  tone = 'mint',
  boxed = true
}: {
  p: Provenance
  tone?: 'mint' | 'orange' | 'mute'
  boxed?: boolean
}): JSX.Element {
  const iconColor = tone === 'orange' ? color.orange : tone === 'mute' ? color.greenLine : color.mint
  const label = `${shortSource(p.sourceFile)} · ${p.locator}`
  const inner = (
    <>
      <FileIcon size={11} color={iconColor} strokeWidth={2} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </>
  )
  if (!boxed) {
    return (
      <div
        style={{
          ...mono,
          fontSize: 10,
          color: color.textFaint,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        {inner}
      </div>
    )
  }
  return (
    <div
      style={{
        ...mono,
        fontSize: 10,
        color: color.textMute,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: color.bgInput,
        border: `1px solid ${tone === 'orange' ? fill.orangeBorder : color.borderSoft}`,
        borderRadius: 7,
        padding: '7px 9px'
      }}
    >
      {inner}
    </div>
  )
}

/** "sources/discovery-call.md" -> "discovery-call" */
export function shortSource(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.[^.]+$/, '')
}

/* ── Evidence quote card (used in inspector panes) ────────────────────── */
export function EvidenceCard({
  p,
  accent,
  attribution
}: {
  p: Provenance
  accent: string
  attribution?: string
}): JSX.Element {
  return (
    <div
      style={{
        border: `1px solid ${color.borderHard}`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: 9,
        padding: '11px 12px',
        background: color.bgPanel
      }}
    >
      <div
        style={{
          ...mono,
          fontSize: 10,
          color: accent,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 6
        }}
      >
        <FileIcon size={11} color={accent} />
        {shortSource(p.sourceFile)} · {p.locator}
        {attribution ? ` · ${attribution}` : ''}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#e4e4de' }}>“{p.quote}”</div>
    </div>
  )
}

/* ── Section label ────────────────────────────────────────────────────── */
export function Label({
  children,
  style
}: {
  children: ReactNode
  style?: CSSProperties
}): JSX.Element {
  return (
    <div
      style={{
        ...mono,
        fontSize: 10,
        letterSpacing: '.14em',
        color: color.textGhost,
        textTransform: 'uppercase',
        ...style
      }}
    >
      {children}
    </div>
  )
}

/* ── Buttons ──────────────────────────────────────────────────────────── */
type BtnVariant = 'primary' | 'ghost' | 'outline'

export function Button({
  children,
  variant = 'outline',
  onClick,
  grow,
  style
}: {
  children: ReactNode
  variant?: BtnVariant
  onClick?: () => void
  grow?: number
  style?: CSSProperties
}): JSX.Element {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '9px 13px',
    borderRadius: radius.md,
    fontSize: 12,
    fontWeight: 500,
    flex: grow !== undefined ? grow : undefined,
    textAlign: 'center'
  }
  const skins: Record<BtnVariant, CSSProperties> = {
    primary: { background: color.mint, color: color.bgPanel, fontWeight: 600, border: 'none' },
    ghost: {
      background: fill.mint06,
      color: color.mint,
      border: `1px solid ${fill.mintBorder}`
    },
    outline: { background: 'transparent', color: color.textDim, border: `1px solid ${color.borderHard}` }
  }
  return (
    <div data-clickable onClick={onClick} style={{ ...base, ...skins[variant], ...style }}>
      {children}
    </div>
  )
}

/* ── Resolution gate donut ────────────────────────────────────────────── */
export function GateDonut({
  size = 150,
  progress,
  closed
}: {
  size?: number
  progress: number // 0..1 resolved
  closed: boolean
}): JSX.Element {
  const r = size / 2 - 9
  const circ = 2 * Math.PI * r
  const dash = circ
  const offset = circ * (1 - progress)
  const accent = closed ? color.orange : color.mint
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.border} strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.7,.2,1), stroke .3s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <GateGlyph closed={closed} />
        <span
          style={{
            ...mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.08em',
            color: accent,
            marginTop: 7
          }}
        >
          {closed ? 'CLOSED' : 'OPEN'}
        </span>
      </div>
    </div>
  )
}

function GateGlyph({ closed }: { closed: boolean }): JSX.Element {
  const accent = closed ? color.orange : color.mint
  if (closed) {
    return (
      <span style={{ color: accent, display: 'flex', animation: 'fmpulse 2.6s ease-in-out infinite' }}>
        <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={1.5}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    )
  }
  // open padlock
  return (
    <span style={{ color: accent, display: 'flex', animation: 'fmgateopen .5s ease both' }}>
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={1.5}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 7.5-1.8" />
      </svg>
    </span>
  )
}
