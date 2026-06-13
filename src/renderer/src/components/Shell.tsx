import type { ReactNode } from 'react'
import { color, font } from '@/styles/theme'
import { useFm } from '@/state/store'
import { StageStepper } from './StageStepper'
import { PersonaSwitcher } from './PersonaSwitcher'

/** Window chrome + shared context bar. The macOS traffic lights are inset
 *  (titleBarStyle: hiddenInset), so we pad the left for them. */
export function Shell({ children }: { children: ReactNode }): JSX.Element {
  const engagement = useFm((s) => s.engagement)

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: color.bg,
        color: color.text
      }}
    >
      {/* draggable titlebar */}
      <div
        style={{
          height: 54,
          flex: 'none',
          background: '#171717',
          borderBottom: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px 0 88px',
          gap: 16,
          // @ts-expect-error vendor prop for Electron window drag
          WebkitAppRegion: 'drag'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: color.mint,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color.bgPanel,
              fontWeight: 700,
              fontSize: 13
            }}
          >
            F
          </span>
          <span style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.01em' }}>
            Forward-Momentum
          </span>
        </div>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: '#5a5a54' }}>/</span>
        <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.textMute }}>
          {engagement.slug} <span style={{ color: '#5a5a54' }}>·</span>{' '}
          <span style={{ color: color.mint }}>{engagement.branch}</span>
        </span>

        <div style={{ margin: '0 auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <StageStepper stages={engagement.stages} />
        </div>

        <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#2a2a2a', flex: 'none' }} />
      </div>

      <PersonaSwitcher />

      {/* view canvas */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{children}</div>
    </div>
  )
}
