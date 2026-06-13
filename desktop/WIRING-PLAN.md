# Wiring the standalone UI into the Forward-Momentum core — Target B (standalone desktop)

## TL;DR

We keep the Electron app and make it a **real product**, not a mock. The **Electron main process
becomes the authoritative host** (the role the VS Code extension host plays in the other repo): it
reads/writes the real on-disk engagement files and runs the existing **VS Code-independent core**
(`src/model`, `src/flow`, `src/github`) to evaluate gates, advance the flow, and dispatch tasks.
The **renderer** (our React UI) talks to main over **IPC**; the Zustand mock store is replaced by
state pushed from main + intents sent to main.

Confirmed: `src/flow/*`, `src/model/*`, and `src/github/dispatch.ts` import zero `vscode`;
`auth.ts` uses only a *type-only* `SecretStorage` and is explicitly built to run "without any
vscode runtime present." So the whole core drops straight into an Electron main process.

No VS Code dependency. The deliverable is a double-click desktop app pointed at an engagement
folder on disk.

---

## Target architecture

```
┌─ Electron MAIN (Node — the host) ───────────────────────────────┐
│  engagement = a folder on disk (folder picker; default          │
│               examples/sample-engagement)                        │
│  reads/writes: analysis/{claims,gaps}.json, .flow/state.json,   │
│                decisions/*.md, prd/PRD.md, spec/SPEC.md,         │
│                tasks/dispatch.json                              │
│  runs core:    flow/gates · flow/state-machine · flow/store ·   │
│                github/dispatch · model/*  (all vscode-free)     │
│  fs.watch on the engagement → push fresh snapshot on change     │
│                                                                  │
│      └── ipcMain.handle(intent) / webContents.send(snapshot) ───┐│
└───────────────────────────────────────────────────────────────┼┘
                                                                  │
┌─ Electron PRELOAD (contextBridge) ──────────────────────────────┤
│  window.fm = { send(intent), onSnapshot(cb), openEngagement() } │
└───────────────────────────────────────────────────────────────┬┘
                                                                  │
┌─ RENDERER (our React app, unchanged screens) ───────────────────┴┐
│  Transport (ElectronTransport via window.fm | MockTransport)     │
│      ↕                                                           │
│  Zustand: UI-only state (persona, active stage, selection,       │
│           celebration latch) + cached host snapshot              │
└──────────────────────────────────────────────────────────────────┘
```

**Principle: main is the single source of truth.** The renderer stops *deriving* flow truth and
instead renders the snapshot main pushes and sends intents. Gate evaluation, stage advance,
sign-off, dispatch, and waivers all run in main via the existing core, which re-reads the files and
re-broadcasts.

---

## Decisions (recommended defaults — confirm or override)

1. **Repo layout / how the app gets the core.** Merge `main` into `worktree-standalone-ui` (brings
   in `src/`), then relocate the Electron app into **`desktop/`** in the main repo. `desktop/`'s
   main process imports the shared core from `../src/{model,flow,github}` directly (plain TS;
   electron-vite bundles it). The existing extension (`src/extension.ts`, `src/panels/*`, esbuild)
   stays untouched and dormant — costs nothing and keeps the door open to a VS Code shell later.
   *(Alternative: keep the app at the worktree root and vendor the core — rejected; duplicates code.)*

2. **Artifact generation.** Phase 1 assumes the engagement's artifacts already exist on disk
   (`examples/sample-engagement` has them) and wires **read + gate actions** only. Running the
   `fm-*` skills to *generate* artifacts (via `src/agents/cli-runner.ts`, which also runs from
   Electron main) is a later phase with "Run extraction / gap-analysis / draft PRD / review"
   buttons.

3. **GitHub auth in a desktop app.** `auth.ts` accepts an injected `SecretStorage`-shaped object.
   Provide a tiny Electron impl backed by `safeStorage` (encrypted token on disk) or a `GITHUB_TOKEN`
   env var; absent a token → dry-run, exactly as the dispatch skill specifies.

---

## Phased plan

### Phase 0 — Converge trees, prove the IPC bridge on real data
- Merge `main` into the branch; move the Electron app to `desktop/`; reconcile build scripts so
  `desktop/` has its own electron-vite build importing `../src` core.
- Add an **"Open engagement" folder picker** (default to `examples/sample-engagement`).
- Main: `readGaps(root)` + an `ipcMain.handle("requestSnapshot")` that returns the real
  `analysis/gaps.json`. Renderer renders it.
- **Smoke test:** launch app → open sample engagement → the PM board shows the *real* gaps. (Ship
  this first — it de-risks everything.)

### Phase 1 — IPC transport + intent/snapshot protocol
- `Transport` interface in the renderer: `send(intent)` + `onSnapshot(cb)`.
  - `ElectronTransport` → `window.fm` (preload over `ipcRenderer.invoke` / `webContents.send`).
  - `MockTransport` → current `checkoutV2` mock + existing store actions (keeps browser/Vite dev
    loop alive for fast design iteration).
- Replace direct store mutations (`resolveGap`, `advanceToPrd`, `signOffReview`, `dispatchTasks`,
  …) with `transport.send(...)`; store updates only when a `snapshot` arrives from main.
- Snapshot = `{ flowState, gaps, claims, prd?, review?, dispatch? }`, assembled by a main-side
  **adapter**. `fs.watch` the engagement dir → re-push on external edits.

### Phase 2 — Reconcile the model
- Drop the invented `routed` GapStatus; adopt real `open|resolved|deferred|waived`. "Send to
  Design" maps to **dispatch** (Handoff), not a status.
- `deriveView(gap, claims)` adapter for the display fields our screens use: `title` = summary,
  `category` from `kind` + the `isDesignGap` heuristic, `canRouteToDesign` = `isDesignGap(gap)`.
  Decide per orphan field — `owner`, `ageDays` (could derive from `resolution.at`), `scopeImpact`
  (no source): compute or drop the affordance. Role views degrade gracefully.
- Resolve/defer send `{reason}` → main writes `gap.resolution {by,reason,at}` + rewrites gaps.json.
- **Waivers:** add the structured waiver UI (reason + 3 acknowledgements: communicatedToClient /
  riskAccepted / revisitScheduled); main validates via `validateWaiver` before opening the gate.
- Replace our derived stepper with the real `FlowState` (`currentStage` + `PerGateStatus`); map
  `StageName` ↔ our stage keys.

### Phase 3 — Real artifacts (Markdown → view models, real dispatch)
- Main-side parsers: `prd/PRD.md` + `spec/SPEC.md` → our `PrdDoc` (citation brackets are strict;
  regex + join `claim-id`s against `claims.json` to recover quotes for click-to-reveal; the
  traceability meter becomes real). `decisions/prd-review.md` → our `ReviewReport`
  (`Verdict:` + findings table + axis results).
- Sign-off → main `passGate("Review")` + `advanceStage` + `writeGateRecord`.
- Handoff → `github/dispatch.dispatchDesignTasks(...)` (async, live/dry-run via the injected auth);
  read/write the real `tasks/dispatch.json`; delete our duplicate `isDesignGap` in favour of the
  core one.

### Phase 4 — Gate moments on real data
- Re-fire the Resolution celebration when a snapshot shows the Resolution gate newly `passed`
  (latch on transition, host-driven). Same for the Review dual-key open. Donut / quality-floor /
  EM inspector all read the snapshot.

### Phase 5 — Package & verify
- `electron-builder` → distributable `.app` / `.dmg` (signing/notarization optional for a demo).
- Verify against `examples/sample-engagement`: walk the full flow (resolve blockers → gate opens →
  advance → PRD → sign off review → dispatch) and confirm the real files change on disk.
- Adapter/parser unit tests (the core repo already has vitest).

---

## Risks & caveats (target B)

- **Two build systems coexist** — esbuild (dormant extension) + electron-vite (`desktop/`). Keep
  `desktop/` self-contained with its own scripts; don't entangle the root manifest.
- **Core imports from `../src`** must bundle cleanly in the Electron main (Node) build; mark
  `@octokit/rest` external (electron-vite `externalizeDepsPlugin`, already in our config).
- **GitHub token storage** in a desktop context (see Decision 3).
- **Orphan view fields** (owner/age/scope-impact) have no real data source — compute or drop.
- **Fonts:** Electron renderer can fetch Geist from Google Fonts at runtime (no webview CSP wall),
  but bundle the woff2 locally for offline/reliability.
- **Worktree is behind `main`** — merging may surface unrelated drift.

---

## Suggested first PR (smallest end-to-end slice)

Phase 0 + a vertical slice of Phase 1–2 on **one** screen: converge trees, move app to `desktop/`,
IPC bridge, `ElectronTransport` + keep `MockTransport`, and **GapQueue → PM board reading real
`gaps.json`** with resolve/defer/advance writing real files via the core and the Resolution gate
opening live. Proves the whole architecture on the highest-value screen; PRD/Review/Handoff
parsers follow as separate PRs.
