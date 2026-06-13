# Wiring plan — standalone Electron app on the omnigent runtime

Reconciled with ADR 0001 (standalone-electron-on-omnigent) + the architecture/open-questions docs
on `worktree-explore+electron-omnigent-architecture`. Supersedes the earlier "Target B" framing —
same Electron-desktop destination, now with the agent backend pointed at omnigent behind a seam.

## TL;DR

The product is a **standalone Electron desktop app**; the VS Code extension is throwaway
scaffolding. Our **renderer already exists** (this repo, `desktop/`) — don't rebuild it. The wiring
splits into **two backend layers behind the Electron main process**, and only one touches omnigent:

1. **Domain Host (ours, file-backed — the spine).** Electron main reads/writes the real engagement
   files and runs the VS Code-independent core (`src/model` + `src/flow` + `src/github`) to evaluate
   gates, record resolutions/waivers/gate-records, advance the flow, and dispatch design tasks.
   **No omnigent.** This is everything the UI needs to read and mutate *consensus state*.
2. **Agent Runtime (behind an `AgentRunner` seam — the omnigent part).** *Generating* artifacts
   (running the `fm-*` skills for Extraction / GapAnalysis / PRDDraft / Review) goes through a small
   `AgentRunner` interface. Interim impl = today's `cli-runner.ts` (spawns `claude`); target impl =
   an **omnigent session client** (Electron main local-spawns an omnigent server; renderer consumes
   REST + SSE). Our hard gates map onto omnigent policy **`ASK` elicitations** — but **gap/flow
   state stays domain-owned** (the policy gates the *agent action*, not our gap math).

Key consequence: **Phases 1–4 below need no omnigent at all** — they wire the file-backed Domain
Host and close the renderer's model-reconciliation gaps. omnigent enters only at the "Agent runs"
phase. That keeps the smallest proof shippable now and isolates the alpha dependency.

Confirmed earlier: `src/flow/*`, `src/model/*`, `src/github/dispatch.ts` import zero `vscode`;
`auth.ts` is type-only. The core drops straight into Electron main.

---

## Target architecture

```
┌─ Electron app (single install) ─────────────────────────────────────────┐
│  RENDERER (React, already built in desktop/) — our domain UI             │
│   pipeline tracker · gap queue · dual-view PRD · review · task board     │
│   + (later) reuse ap-web bits: approval/elicitation cards, Monaco,       │
│     terminal/chat transcript — for the live agent-run surfaces           │
│        ▲  Transport: ElectronTransport (IPC)  |  MockTransport (browser) │
│        │                                                                 │
│  MAIN process                                                            │
│   ├─ DOMAIN HOST (file-backed, ours) ── reads/writes engagement files:   │
│   │     analysis/{claims,gaps}.json · .flow/state.json · decisions/*.md  │
│   │     prd/PRD.md · spec/SPEC.md · tasks/dispatch.json                  │
│   │   runs core: flow/gates · flow/state-machine · flow/store ·          │
│   │              github/dispatch · model/*   (NO omnigent)               │
│   │                                                                      │
│   └─ AgentRunner (seam) ── run(stage, root)→events · resolveGate(...)    │
│         • interim: cli-runner (spawn `claude`)                           │
│         • target:  omnigent client ──REST+SSE──► local omnigent server   │
│            POST /v1/sessions · GET /stream ·                             │
│            POST …/elicitations/{id}/resolve   (= our gate)               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Single source of truth = the engagement files on disk** (the existing panels already enforce
this). The renderer renders a snapshot main pushes and sends intents; main mutates files via the
core and re-broadcasts. The AgentRunner only *produces/refreshes* artifacts; the Domain Host owns
all gate/flow truth.

---

## Decisions (reconciled)

1. **Repo layout — DONE.** App relocated to `desktop/`; `main` merged in (0 conflicts). Root owns
   the shared core/extension + `examples/sample-engagement`; `desktop/` owns the Electron app.
2. **Two-layer backend, `AgentRunner` seam.** Build the Domain Host first (no omnigent). Introduce
   `AgentRunner` when we wire generation; its first impl may even be a stub/`cli-runner` so the
   omnigent swap is localized and the app works before omnigent is integrated.
3. **omnigent: local-spawn for v1**, server base URL configurable so remote/team mode is a config
   flip later (open-Q #1). Pin a known-good omnigent commit; contract-test the `/v1` surface.
4. **Gates stay domain logic.** Resolution/Review gap+flow state is ours; omnigent `ASK` only gates
   the PRDDraft/Review *agent runs*. Keep the CI merge-gate (`prd-gate.yml`) regardless.
5. **ap-web reuse = components, not shape.** Vendor/borrow approval-cards, Monaco viewers,
   terminal/chat for agent-run surfaces; never adopt the chat-console product shape.
6. **GitHub auth** in Electron via `safeStorage`/env token (inject into `auth.ts`'s `SecretStorage`
   shape); no token → dry-run dispatch.

---

## Phased plan

### Phase 0 — Converge trees ✅ DONE
Relocated app to `desktop/`, merged `main` (0 conflicts), desktop build verified. Real data now
present at `examples/sample-engagement/`.

### Phase 1 — Domain Host bridge on real data (NO omnigent)
- Electron main: `loadEngagement(root)` reading `analysis/gaps.json` + `analysis/claims.json` +
  `.flow/state.json`; **"Open engagement" folder picker** (default `examples/sample-engagement`).
- IPC: `ipcMain.handle("requestSnapshot")`; preload `window.fm = { send, onSnapshot, openEngagement }`.
- Renderer `Transport` interface: `ElectronTransport` (IPC) + keep `MockTransport` (checkoutV2) for
  browser/Vite design iteration.
- **Smoke test:** launch → open sample engagement → PM board shows the *real* gaps. Ship first.

### Phase 2 — Reconcile the model (close the renderer↔core gaps)
- Drop invented `routed` GapStatus → real `open|resolved|deferred|waived`. "Send to Design" = a
  *dispatch* concern (Handoff), not a status.
- `deriveView(gap, claims)` adapter for our display fields (title=summary; category from kind +
  `isDesignGap`; `canRouteToDesign`=`isDesignGap`). Decide per orphan field — `owner`/`scopeImpact`
  have no source (drop/derive), `ageDays` can come from `resolution.at`. Views degrade gracefully.
- Resolve/defer send `{reason}` → main writes `gap.resolution{by,reason,at}` + rewrites gaps.json.
- **Structured waiver** UI (reason + communicatedToClient/riskAccepted/revisitScheduled); main
  validates via `validateWaiver` before opening a hard gate. (Reuse the existing resolution-form
  logic.)
- Replace our derived stepper with real `FlowState` (`currentStage` + `PerGateStatus`); map
  `StageName` ↔ our stage keys.

### Phase 3 — Real artifacts (Markdown → view models; real dispatch)
- Main parsers: `prd/PRD.md` + `spec/SPEC.md` → our `PrdDoc` (strict `[claim-id · file:loc]`
  citations; join claim ids against `claims.json` for verbatim quotes → real click-to-reveal +
  traceability meter). `decisions/prd-review.md` → our `ReviewReport`.
- Review sign-off → main `passGate("Review")` + `advanceStage` + `writeGateRecord`.
- Handoff → `github/dispatch.dispatchDesignTasks(...)` (async, live/dry-run via injected auth);
  read/write real `tasks/dispatch.json`; delete the duplicate `isDesignGap` in favour of the core.

### Phase 4 — Gate moments on real data
- Re-fire the Resolution celebration / Review dual-key open when a snapshot shows the gate newly
  passed (host-driven latch). Donut / quality-floor / EM inspector read the snapshot.

### Phase 5 — Agent runs via `AgentRunner` (omnigent enters here)
- Define `AgentRunner`: `run(stage, engagementRoot) → AsyncIterable<AgentEvent>`,
  `resolveGate(elicitationId, verdict)`. First impl can wrap `cli-runner` (claude) to prove the UI
  end-to-end with no new dependency.
- "Run this stage" actions in the pipeline tracker (Extraction / GapAnalysis / PRDDraft / Review)
  stream live agent events into a transcript surface (reuse ap-web ApprovalCard/Monaco/terminal).
- Swap impl → **omnigent client**: Electron main local-spawns an omnigent server (lifecycle, port,
  health-check, graceful shutdown — open-Q #1/#6); renderer drives `POST /v1/sessions`,
  `GET /stream`, and resolves gate `ASK` elicitations via `…/elicitations/{id}/resolve`.
- Steal the **cross-vendor review** idea for the Review stage (reviewer ≠ author vendor).

### Phase 6 — Package & verify
- `electron-builder` → `.app`/`.dmg`. **Must manage the omnigent Python server child** (bundle via
  uv/PyInstaller/sidecar — open-Q #1). Signing/notarization optional for a demo.
- Walk the sample engagement end-to-end; confirm real files change on disk. Add adapter/parser unit
  tests (vitest already configured) + an omnigent `/v1` contract test.

---

## Risks & open questions (from the ADR/brainstorm)

- **omnigent is alpha** → API churn. Isolate behind `AgentRunner`; pin a commit; contract-test `/v1`.
- **Electron managing a Python server** — packaging, ports, lifecycle. Local-spawn v1; URL
  configurable for remote/team mode.
- **Worktree consolidation** — three branches touch this (`standalone-ui` [here], the explore/docs
  branch, `open-knowledge-format`). The docs (ADR/architecture) still live only on the explore
  branch; decide whether to bring them into this tree.
- **Orphan view fields** (owner/scope-impact) have no real data source — compute or drop.
- **Two build systems** coexist (esbuild = dormant extension; electron-vite = `desktop/`). Keep
  `desktop/` self-contained.
- **Hackathon scope** (open-Q #8): the demo slice may stay on the extension; this worktree is the
  forward design. Smallest proof = Phase 1 (one stage + one gate on real data), omnigent optional.

## Suggested first PR
Phase 1 + the Phase-2 model reconciliation for **one** screen: the IPC bridge, `ElectronTransport`
(+ keep `MockTransport`), and the **gap queue / PM board reading real `gaps.json`** with
resolve/defer/advance writing real files via `src/flow` and the Resolution gate opening live.
Proves the Domain Host architecture end-to-end with zero omnigent dependency.
