import { contextBridge, ipcRenderer } from 'electron'

import {
  FM_CHANNELS,
  type AgentRunResult,
  type Intent,
  type MutationResult,
  type Snapshot,
  type WireStageName
} from '../shared/contract'

// Safe, minimal surface. The renderer never touches the filesystem or ipcRenderer
// directly — it goes through these typed methods (the Domain Host owns all I/O).
const api = {
  platform: process.platform,

  /** Load/refresh the current (or default) engagement snapshot. */
  requestSnapshot: (): Promise<Snapshot | null> =>
    ipcRenderer.invoke(FM_CHANNELS.requestSnapshot),

  /** Prompt for an engagement folder; resolves to its snapshot, or null if cancelled. */
  openEngagement: (): Promise<Snapshot | null> =>
    ipcRenderer.invoke(FM_CHANNELS.openEngagement),

  /** Apply a mutation to the engagement files; resolves to the result + fresh snapshot. */
  mutate: (intent: Intent): Promise<MutationResult> =>
    ipcRenderer.invoke(FM_CHANNELS.mutate, intent),

  /** Run a pipeline stage's agent via Claude Code; resolves to the run result. */
  runStage: (stage: WireStageName): Promise<AgentRunResult> =>
    ipcRenderer.invoke(FM_CHANNELS.runStage, stage),

  /** Subscribe to host-pushed snapshots (e.g. after a mutation). Returns an unsubscribe fn. */
  onSnapshot: (cb: (snap: Snapshot) => void): (() => void) => {
    const listener = (_e: unknown, snap: Snapshot): void => cb(snap)
    ipcRenderer.on(FM_CHANNELS.snapshot, listener)
    return () => ipcRenderer.removeListener(FM_CHANNELS.snapshot, listener)
  }
}

try {
  contextBridge.exposeInMainWorld('fm', api)
} catch {
  // contextIsolation disabled — fall back to global
  // @ts-ignore
  window.fm = api
}

export type FmApi = typeof api
