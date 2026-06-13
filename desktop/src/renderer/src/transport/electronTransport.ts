import type { Transport } from './types'

/** Real backend: every call delegates to the preload `window.fm` IPC bridge. */
export const electronTransport: Transport = {
  isLive: true,
  loadSnapshot: () => window.fm.requestSnapshot(),
  openEngagement: () => window.fm.openEngagement(),
  mutate: (intent) => window.fm.mutate(intent),
  onSnapshot: (cb) => window.fm.onSnapshot(cb)
}
