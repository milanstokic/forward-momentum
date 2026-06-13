import { color, fill } from '@/styles/theme'
import type { GapCategory } from './types'

interface CategoryStyle {
  label: string
  textColor: string
  borderColor: string
}

/** Badge styling per gap category — ported from the prototype's `C` map. */
export const CATEGORY_STYLE: Record<GapCategory, CategoryStyle> = {
  conflict: { label: 'CONFLICT', textColor: color.orangeSoft, borderColor: fill.orangeBorderStrong },
  missing: { label: 'MISSING', textColor: '#d8b48a', borderColor: '#4a4136' },
  assumption: { label: 'ASSUMPTION', textColor: '#9fb8af', borderColor: '#34453f' },
  'under-spec': { label: 'UNDER-SPEC', textColor: color.textMute, borderColor: '#33333a' },
  'design-gap': { label: 'DESIGN-GAP', textColor: color.mint, borderColor: color.greenLine }
}
