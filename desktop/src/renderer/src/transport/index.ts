import { electronTransport } from './electronTransport'
import { mockTransport } from './mockTransport'
import type { Transport } from './types'

/**
 * Pick the backend at module load: the Electron IPC bridge when `window.fm` is
 * present (the packaged/dev desktop app), otherwise the in-browser mock.
 */
function pickTransport(): Transport {
  const hasBridge =
    typeof window !== 'undefined' &&
    typeof (window as { fm?: { requestSnapshot?: unknown } }).fm?.requestSnapshot === 'function'
  return hasBridge ? electronTransport : mockTransport
}

export const transport: Transport = pickTransport()
export type { Transport } from './types'
