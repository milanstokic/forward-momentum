import type { ComponentType } from 'react'
import { color, fill, font } from '@/styles/theme'
import { PERSONA_LABEL, type Persona } from '@/model/types'
import { useFm } from '@/state/store'
import { Flag, Chart, Shield, Code, Pen } from './Icon'

const GLYPH: Record<Persona, ComponentType<{ size?: number }>> = {
  pm: Flag,
  pgm: Chart,
  em: Shield,
  dev: Code,
  design: Pen
}

const ORDER: Persona[] = ['pm', 'pgm', 'em', 'dev', 'design']

/** Persona tagline shown on the right of the switcher row. */
const TAGLINE: Record<Persona, string> = {
  pm: 'Make the call — resolve the blocking conflicts',
  pgm: 'Track ownership & how long the gate has waited',
  em: 'Scope conflicts that block estimates',
  dev: 'Spec & provenance for the coding agent',
  design: 'Well-formed design tasks from the pipeline'
}

export function PersonaSwitcher(): JSX.Element {
  const persona = useFm((s) => s.persona)
  const setPersona = useFm((s) => s.setPersona)

  return (
    <div
      style={{
        height: 68,
        flex: 'none',
        background: color.bgPanel,
        borderBottom: `1px solid ${color.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16
      }}
    >
      <span
        style={{
          fontFamily: font.mono,
          fontSize: 9.5,
          letterSpacing: '.16em',
          color: color.textGhost,
          flex: 'none'
        }}
      >
        VIEWING&nbsp;AS
      </span>
      <div style={{ display: 'flex', gap: 7 }}>
        {ORDER.map((p) => {
          const active = p === persona
          const Glyph = GLYPH[p]
          return (
            <div
              key={p}
              data-clickable
              onClick={() => setPersona(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 13px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                color: active ? color.bgPanel : color.textMute,
                background: active ? color.mint : 'transparent',
                border: `1px solid ${active ? color.mint : color.borderSoft}`
              }}
            >
              <Glyph size={15} />
              {PERSONA_LABEL[p]}
            </div>
          )
        })}
      </div>
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          fontSize: 12,
          color: color.textMute
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color.orange }} />
        {TAGLINE[persona]}
      </div>
    </div>
  )
}
