/**
 * Forward-Momentum brand mark — the double chevron: an orange (#F67035)
 * trailing chevron (the contested input) resolving into a mint (#7EFFC6)
 * leading chevron (the verified output). Inlined from
 * `brand/icon/source/forward-momentum-mark.svg` so it ships with no asset
 * pipeline and stays crisp at any size. Per the brand handoff: do not recolor,
 * rotate, or add effects — size it with CSS only.
 */
export function BrandMark({ size = 24 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      strokeWidth={11}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Forward-Momentum"
      role="img"
      style={{ flex: 'none', display: 'block' }}
    >
      <path d="M27 25 L51 50 L27 75" stroke="#F67035" />
      <path d="M49 25 L73 50 L49 75" stroke="#7EFFC6" />
    </svg>
  )
}
