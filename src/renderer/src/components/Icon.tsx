import type { CSSProperties, ReactNode } from 'react'

interface IconProps {
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}

function Svg({
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  children
}: IconProps & { children: ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none', ...style }}
    >
      {children}
    </svg>
  )
}

export const Check = (p: IconProps): JSX.Element => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 3}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
)

export const Lock = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
)

export const FileIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 4h11l5 5v11H4z" />
    <path d="M14 4v6h6" />
  </Svg>
)

export const Chevron = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <polyline points="9 6 15 12 9 18" />
  </Svg>
)

export const Send = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </Svg>
)

export const Link = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="6" cy="18" r="2.2" />
    <path d="M6 8v8" />
    <path d="M18 8a6 6 0 0 1-6 6H6" />
    <circle cx="18" cy="6" r="2.2" />
  </Svg>
)

export const Warning = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <path d="M12 17h.01" />
  </Svg>
)

export const Bars = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 20v-6M6 20V10M18 20V4" />
  </Svg>
)

/* persona glyphs */
export const Flag = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h12l-2.5 4L17 12H5" />
  </Svg>
)
export const Chart = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1" />
    <rect x="10" y="4" width="5" height="10" rx="1" />
    <rect x="17" y="4" width="4" height="13" rx="1" />
  </Svg>
)
export const Shield = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
    <path d="M9.5 12l2 2 3.5-3.5" />
  </Svg>
)
export const Code = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <polyline points="8 7 3 12 8 17" />
    <polyline points="16 7 21 12 16 17" />
  </Svg>
)
export const Pen = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M14 4l6 6-10 10H4v-6L14 4Z" />
    <path d="M12.5 6.5l5 5" />
  </Svg>
)

/** Filled hexagonal gate node — the product's core motif. */
export const GateHex = ({
  size = 34,
  color = 'currentColor',
  style
}: IconProps): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.4}
    style={{ display: 'block', ...style }}
  >
    <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" />
    <rect x="9" y="11" width="6" height="4.5" rx="1" fill={color} stroke="none" />
    <path d="M10 11v-1.2a2 2 0 0 1 4 0V11" strokeWidth={1.6} />
  </svg>
)

export const GitHub = ({ size = 14, color = 'currentColor', style }: IconProps): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block', flex: 'none', ...style }}>
    <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.2 11.16.6.1.82-.25.82-.56v-2c-3.34.72-4.04-1.6-4.04-1.6-.55-1.36-1.33-1.72-1.33-1.72-1.08-.73.08-.72.08-.72 1.2.08 1.83 1.21 1.83 1.21 1.07 1.8 2.8 1.28 3.49.98.1-.76.42-1.28.76-1.57-2.67-.3-5.47-1.3-5.47-5.78 0-1.28.47-2.32 1.24-3.14-.13-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.2.96-.26 1.98-.39 3-.4 1.02 0 2.04.14 3 .4 2.28-1.52 3.29-1.2 3.29-1.2.66 1.64.25 2.86.12 3.16.77.82 1.24 1.86 1.24 3.14 0 4.49-2.81 5.47-5.49 5.76.43.36.81 1.08.81 2.18v3.23c0 .31.21.67.82.56C20.57 21.88 24 17.48 24 12.29 24 5.78 18.63.5 12 .5Z" />
  </svg>
)

export const Sparkle = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </Svg>
)

export const Figma = ({ size = 13, style }: IconProps): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', ...style }}>
    <path d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 1 0 0 8Z" />
    <path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4Z" opacity=".7" />
    <path d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4Z" opacity=".5" />
    <path d="M12 0h4a4 4 0 1 1 0 8h-4V0Z" opacity=".7" />
    <circle cx="16" cy="12" r="4" opacity=".5" />
  </svg>
)
