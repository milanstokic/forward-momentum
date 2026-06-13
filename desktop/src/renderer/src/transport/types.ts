import type { AgentRunResult, Intent, MutationResult, Snapshot, WireStageName } from '@shared/contract'

/**
 * The renderer talks to the backend only through a Transport. In Electron it is
 * ElectronTransport (IPC to the Domain Host); in a plain browser (vite dev) it is
 * MockTransport (the bundled checkoutV2 fixture), so the UI is iterable without
 * launching Electron.
 */
export interface Transport {
  /** True for the real Electron/IPC backend; false for the in-browser mock. */
  readonly isLive: boolean
  /** Load (or refresh) the current/default engagement. */
  loadSnapshot(): Promise<Snapshot | null>
  /** Prompt for an engagement folder; resolves to its snapshot or null if cancelled. */
  openEngagement(): Promise<Snapshot | null>
  /** Apply a mutation; resolves to the result + the post-mutation snapshot. */
  mutate(intent: Intent): Promise<MutationResult>
  /** Run a pipeline stage's agent (Claude Code); resolves to the run result. */
  runStage(stage: WireStageName): Promise<AgentRunResult>
  /** Subscribe to host-pushed snapshots. Returns an unsubscribe fn. */
  onSnapshot(cb: (snap: Snapshot) => void): () => void
}
