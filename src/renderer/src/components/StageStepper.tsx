import { Fragment } from 'react'
import { color, fill } from '@/styles/theme'
import type { PipelineStage, StageStatus } from '@/model/types'
import { mono } from './primitives'
import { Check, Lock } from './Icon'

const stepColor: Record<StageStatus, string> = {
  done: color.textDim,
  current: color.text,
  locked: color.orangeSoft,
  todo: color.textFaint
}

function StageDot({ stage, index }: { stage: PipelineStage; index: number }): JSX.Element {
  const size = 15
  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none' as const
  }
  switch (stage.status) {
    case 'done':
      return (
        <span style={{ ...base, background: 'rgba(126,255,198,.15)', color: color.mint }}>
          <Check size={9} color={color.mint} strokeWidth={3.4} />
        </span>
      )
    case 'current':
      return (
        <span style={{ ...base, background: color.text, color: color.bgPanel, fontSize: 8.5, fontWeight: 700, ...mono }}>
          {index + 1}
        </span>
      )
    case 'locked':
      return (
        <span style={{ ...base, background: fill.orange13, color: color.orange }}>
          <Lock size={8} color={color.orange} strokeWidth={2.6} />
        </span>
      )
    default:
      return <span style={{ ...base, border: `1.5px solid #34342f` }} />
  }
}

/** The shared horizontal pipeline shown in the top bar. Stages that have a
 *  screen and are reachable become clickable to navigate the work surface. */
export function StageStepper({
  stages,
  activeKey,
  navigableKeys,
  onSelect
}: {
  stages: PipelineStage[]
  activeKey?: string
  navigableKeys?: Set<string>
  onSelect?: (key: string) => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {stages.map((st, i) => {
        const navigable = !!navigableKeys?.has(st.key) && !!onSelect
        const active = st.key === activeKey
        return (
          <Fragment key={st.key}>
            <div
              data-clickable={navigable || undefined}
              onClick={navigable ? () => onSelect?.(st.key) : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 7px',
                margin: '0 -1px',
                borderRadius: 7,
                background: active ? 'rgba(126,255,198,.08)' : 'transparent',
                boxShadow: active ? `inset 0 0 0 1px ${color.greenLine}` : 'none',
                cursor: navigable ? 'pointer' : 'default'
              }}
            >
              <StageDot stage={st} index={i} />
              <span style={{ fontSize: 10.5, color: active ? color.mint : stepColor[st.status], whiteSpace: 'nowrap' }}>
                {st.name}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span style={{ width: 18, height: 1.5, background: color.borderSoft, margin: '0 8px' }} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
