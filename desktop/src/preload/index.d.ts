import type { FmApi } from './index'

declare global {
  interface Window {
    fm: FmApi
  }
}

export {}
