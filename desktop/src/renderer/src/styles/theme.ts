/**
 * Forward-Momentum design tokens.
 * The palette carries the product's two souls semantically, not decoratively:
 *   orange = conflict · blocking · gate CLOSED
 *   mint   = resolved · provenance verified · gate OPEN
 * (see example-ui/ "The system" panel)
 */
export const color = {
  // surfaces — dark IDE shell
  bg: '#141414',
  bgRaised: '#181818',
  bgPanel: '#1C1C1C',
  bgRail: '#191919',
  bgCard: '#202020',
  bgCardRaised: '#232323',
  bgInput: '#1a1a1a',
  border: '#262626',
  borderSoft: '#2c2c2c',
  borderHard: '#2e2e2e',
  divider: '#242424',

  // text
  text: '#F2F1ED',
  textDim: '#b9b9b2',
  textMute: '#9a9a94',
  textFaint: '#77776f',
  textGhost: '#6a6a64',

  // semantic — the two souls
  orange: '#F67035', // conflict / blocking / gate CLOSED
  orangeSoft: '#F0a07a',
  mint: '#7EFFC6', // resolved / verified / gate OPEN
  green: '#295A4F', // structural secondary / deferred
  greenLine: '#3f6b5d',
  gray: '#999999'
} as const

/** translucent fills used across badges/banners */
export const fill = {
  orange12: 'rgba(246,112,53,.12)',
  orange13: 'rgba(246,112,53,.13)',
  orange07: 'rgba(246,112,53,.07)',
  orangeBorder: 'rgba(246,112,53,.3)',
  orangeBorderStrong: 'rgba(246,112,53,.4)',
  mint10: 'rgba(126,255,198,.1)',
  mint08: 'rgba(126,255,198,.08)',
  mint06: 'rgba(126,255,198,.06)',
  mintBorder: 'rgba(126,255,198,.3)'
} as const

export const font = {
  ui: "'Geist', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace"
} as const

export const radius = {
  sm: 5,
  md: 8,
  lg: 11,
  xl: 14
} as const
