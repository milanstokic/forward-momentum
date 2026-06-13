# Implementation Plan: Forward-Momentum (Hackathon v1)

Source of truth: [`SPEC.md`](../SPEC.md). This plan turns the spec's sequencing into ordered,
verifiable tasks. Read it alongside the spec; don't duplicate spec content here.

## Overview

Build a VSCode extension over a git "engagement" repo that runs a Claude Code skill-pack pipeline
(extraction → gap-analysis → dual-view PRD → reviewer QA), **enforces a gated flow** with structured
waivers, dispatches design tasks to a GitHub Project, and backstops the PRD merge with CI. We build
the *learning-bearing* parts first (gap-analysis core + flow controller) so a failure teaches us
something early, then converge them in the UI, then add dispatch and the CI gate.

## Architecture Decisions (recap from SPEC)

- **Two repos:** this *platform* repo holds the extension + distributable `.claude/` skill-pack; it
  operates on *engagement* repos (the §4 layout). `examples/sample-engagement/` is our dogfood repo.
- **TypeScript only.** Extension + flow controller + glue in TS; agents are Claude Code skills
  (markdown) invoked via **`claude` CLI subprocess** (Agent SDK deferred).
- **Single source of truth = files on disk.** `.flow/state.json`, `analysis/gap-report.md`, etc.
  Panels re-read files on change rather than holding divergent in-memory state. This keeps the
  webview ↔ extension ↔ pipeline boundary simple and the whole thing testable without the UI.
- **Pure flow controller.** Gate/transition logic has no I/O; persistence is isolated in `store.ts`.
- **Riskiest-first.** Phase 1 = the two uncertain bets, with a hard review checkpoint before any UI.

## Dependency Graph

```
Phase 0  Foundation
  T1 extension bootstrap ─┐
  T2 domain model types ──┼──> everything below
  T3 sample corpus ───────┘

Phase 1  The learning core  (TWO PARALLEL TRACKS — independent subsystems)
  Track A (skill-pack):   T4 extraction ──> T5 gap-analysis (golden test)
  Track B (flow ctrl):    T6 state-machine ──> T7 gates + waivers + store
        └──────────────── CHECKPOINT B: is the core good enough? (fail-fast gate)

Phase 2  Enforced loop in UI  (convergence of both tracks)
  T8 pipeline panel (runs CLI) ──> T9 gap queue + resolution gate
        └──────────────── CHECKPOINT C: full enforced loop demoable

Phase 3  PRD + QA
  T10 prd-author ──> T11 reviewer + Review gate + PRD panel

Phase 4  GitHub dispatch
  T12 auth plumbing ──> T13 /fm-tasks dispatch + panel + Linear stub

Phase 5  CI backstop
  T14 prd-gate.yml + check script
```

Implementation order is bottom-up: foundations first, then the two risky cores in parallel, then
the UI that depends on both, then features that depend on a finished PRD.

## Parallelization

- **Phase 0:** T1/T2 by one agent (shared toolchain), T3 (corpus authoring) by a subagent in parallel.
- **Phase 1:** Track A (T4→T5) and Track B (T6→T7) are fully independent — run as two subagents
  concurrently. They share only the `model/` types from T2 (a defined contract), so no coordination
  needed mid-flight.
- **Phase 2+:** mostly sequential (each depends on the prior file-on-disk contract). Panel scaffolding
  within a task can be delegated, but the controller wiring stays on the main thread.

---

## Task List

### Phase 0: Foundation

#### Task 1: Bootstrap the VSCode extension project
**Description:** Stand up the TS toolchain and a minimal activating extension so F5 launches an
Extension Development Host with one registered command.
**Acceptance criteria:**
- [ ] `package.json` with VSCode engine, `contributes.commands` (one `forwardMomentum.hello`), esbuild + vitest + eslint scripts matching SPEC's Commands.
- [ ] `tsconfig.json` strict; `.vscode/launch.json` runs the dev host; `src/extension.ts` activates and registers the command.
- [ ] One trivial vitest test passes.
**Verification:**
- [ ] `npm install && npm run build && npm run typecheck && npm test` all green.
- [ ] Manual: F5 opens dev host; `forwardMomentum.hello` shows an info message.
**Dependencies:** None
**Files:** `package.json`, `tsconfig.json`, `esbuild.mjs`, `.vscode/launch.json`, `src/extension.ts`, `tests/smoke.test.ts`
**Scope:** M

#### Task 2: Shared domain model types
**Description:** Define the TS contracts every other component depends on.
**Acceptance criteria:**
- [ ] `Claim`, `Provenance`, `Gap` (kind/severity/status), `Waiver` (with structured `acknowledgements`), `FlowState`/`Stage`, `GateRecord` types per SPEC code-style section.
- [ ] Type guards / validators for parsing `claims.json` and `gap-report` front-matter.
**Verification:**
- [ ] `npm run typecheck` clean; unit tests for the guards (valid + malformed input).
**Dependencies:** T1
**Files:** `src/model/{claim,gap,waiver,flow-state}.ts`, `tests/model/guards.test.ts`
**Scope:** S

#### Task 3: Sample engagement corpus (with planted-issue answer key)
**Description:** Create `examples/sample-engagement/` mirroring the §4 layout, with synthetic
`sources/` (transcript + notes) containing **deliberately planted gaps and exactly one conflict**,
plus a documented answer key the golden test will assert against.
**Acceptance criteria:**
- [ ] Full layout: `sources/`, `analysis/`, `decisions/`, `prd/`, `spec/`, `tasks/`, `.flow/`, `.claude/` (placeholders where generated).
- [ ] `sources/` has a realistic transcript + notes; ≥4 planted gaps + 1 planted conflict.
- [ ] `examples/sample-engagement/ANSWER-KEY.md` lists every planted issue (for the T5 golden test).
**Verification:**
- [ ] Layout present; answer key enumerates each planted issue with where it hides.
**Dependencies:** None (can parallelize with T1/T2)
**Files:** `examples/sample-engagement/sources/*`, `examples/sample-engagement/ANSWER-KEY.md`, layout dirs
**Scope:** M

### Checkpoint: Foundation (after T1–T3)
- [ ] Builds clean, types compile, smoke test green.
- [ ] Sample corpus + answer key committed.
- [ ] Dev host launches.

---

### Phase 1 — Track A: Skill-pack pipeline (parallel with Track B)

#### Task 4: `extraction` skill + `/fm-extract`
**Description:** A Claude Code skill + command that reads `sources/` and emits
`analysis/claims.json` — each claim carrying ≥1 `Provenance` (source file + locator + verbatim quote).
**Acceptance criteria:**
- [ ] `.claude/skills/fm-extraction/` + `.claude/commands/fm-extract.md`.
- [ ] Running on the sample produces `analysis/claims.json` valid against the T2 `Claim` type.
- [ ] Every claim has ≥1 provenance entry with a real quote from a source file.
**Verification:**
- [ ] Run `/fm-extract` in the sample repo; validate JSON with a parsing test using T2 guards.
**Dependencies:** T2, T3
**Files:** `.claude/skills/fm-extraction/SKILL.md`, `.claude/commands/fm-extract.md`, `tests/fixtures/...`
**Scope:** M

#### Task 5: `gap-analysis` skill + `/fm-gaps` (the core bet)
**Description:** Skill + command that reads `claims.json` and emits `analysis/gap-report.md` with
structured gaps (kind/severity/status). This is the product's central value test.
**Acceptance criteria:**
- [ ] `.claude/skills/fm-gap-analysis/` + `.claude/commands/fm-gaps.md`.
- [ ] **Golden test:** report flags every planted gap AND the planted conflict from T3's answer key.
- [ ] Each gap carries severity (blocking/non-blocking) and links to related claims/sources.
**Verification:**
- [ ] Golden test (`tests/golden/gap-report.test.ts`) green against the sample answer key.
**Dependencies:** T4
**Files:** `.claude/skills/fm-gap-analysis/SKILL.md`, `.claude/commands/fm-gaps.md`, `tests/golden/gap-report.test.ts`
**Scope:** M

### Phase 1 — Track B: Flow controller (parallel with Track A)

#### Task 6: State machine
**Description:** Pure stage/transition logic: `Intake → Extraction → GapAnalysis → Resolution →
PRDDraft → Review → Handoff`, with loopback when new input arrives. No I/O.
**Acceptance criteria:**
- [ ] `flow/state-machine.ts` exposes valid transitions + a loopback rule for new sources.
- [ ] Illegal transitions rejected; new-input re-opens earlier stages.
**Verification:**
- [ ] Unit tests cover every transition + loopback; ≥90% coverage on this file.
**Dependencies:** T2
**Files:** `src/flow/state-machine.ts`, `tests/flow/state-machine.test.ts`
**Scope:** S

#### Task 7: Gates, structured waivers, and persistence
**Description:** Gate evaluation (incl. Resolution-blocking-on-open-gaps), structured-waiver
validation (reason + all required acknowledgements), and `store.ts` reading/writing
`.flow/state.json` + writing waiver/gate records to `decisions/`.
**Acceptance criteria:**
- [ ] `gates.ts`: Resolution blocks while any blocking gap is `open`; waiver valid only when reason set AND `communicatedToClient`+`riskAccepted`+`revisitScheduled` all true.
- [ ] `store.ts` round-trips `.flow/state.json` and appends a `decisions/` record on waiver.
**Verification:**
- [ ] Unit tests: gate pass/block, waiver valid/invalid (each missing ack), decisions record written; ≥90% coverage on gate logic.
**Dependencies:** T6
**Files:** `src/flow/gates.ts`, `src/flow/store.ts`, `tests/flow/{gates,store}.test.ts`
**Scope:** M

### Checkpoint B: Is the core good enough? (FAIL-FAST GATE — human review)
- [ ] Golden gap-report test green: the gap-analysis agent catches all planted issues.
- [ ] Flow controller ≥90% covered; gates + structured waivers behave per spec.
- [ ] **Decision point:** Does enforced-flow + gap-surfacing look like it beats a single-shot prompt?
      If the core is weak, this is where we learn it — before any UI investment. Review with human.

---

### Phase 2: Enforced loop in the UI (convergence)

#### Task 8: Pipeline panel (runs the CLI pipeline)
**Description:** Webview panel that reads `.flow/state.json` and renders the current stage; buttons
run each pipeline step by invoking `claude` as a subprocess (`/fm-extract`, `/fm-gaps`), then
re-reads the resulting files to update the view.
**Acceptance criteria:**
- [ ] Opening `examples/sample-engagement/` shows the panel at `Intake`.
- [ ] Running extraction/gap-analysis from the panel updates stage + shows claim/gap counts.
- [ ] CLI invocation is wrapped with timeout + error surfacing; failures show in the panel.
**Verification:**
- [ ] Manual in dev host: pipeline advances Intake→GapAnalysis; counts reflect generated files.
- [ ] Unit test for the CLI-invocation wrapper (mocked subprocess: success, error, timeout).
**Dependencies:** T1, T5, T7
**Files:** `src/panels/pipeline-panel.ts`, `src/agents/cli-runner.ts`, `media/pipeline.*`, `tests/agents/cli-runner.test.ts`
**Scope:** M

#### Task 9: Gap queue + resolution gate (the critical human gate)
**Description:** Panel listing gaps from `gap-report.md` with resolve/defer/waive actions; waive opens
a structured-acknowledgement form; advancing past Resolution is blocked until clear; gate
records/waivers write to `decisions/`.
**Acceptance criteria:**
- [ ] Cannot advance past Resolution while any blocking gap is `open`.
- [ ] Resolving/deferring all blockers unblocks; waiver with all acks advances AND writes a `decisions/` record; a waiver missing any ack is rejected in the UI.
**Verification:**
- [ ] Manual: walk the sample's blockers; confirm block → resolve/waive → advance; inspect `decisions/` record.
- [ ] Unit tests for the panel's gate-state derivation reuse T7 logic.
**Dependencies:** T7, T8
**Files:** `src/panels/gap-queue-panel.ts`, `src/panels/resolution-form.ts`, `media/gap-queue.*`
**Scope:** M

### Checkpoint C: Enforced loop end-to-end (human review)
- [ ] Demo on sample: ingest → claims → gap report → resolve/waive each blocker → Resolution gate opens.
- [ ] `decisions/` shows the receipts (gate records + structured waivers).
- [ ] **This is the minimum compelling story.** Safe to stop here if time runs out.

---

### Phase 3: PRD generation + reviewer QA

#### Task 10: `prd-author` skill + `/fm-prd` (dual view, traceable)
**Description:** Generate the dual-view PRD — `prd/` (human narrative) + `spec/` (machine: testable
AC, non-goals, edge cases, contracts) — from resolved claims, with a provenance link on every assertion.
**Acceptance criteria:**
- [ ] `/fm-prd` produces both views from the sample's resolved claims.
- [ ] Automated traceability check: no assertion lacks a provenance link.
**Verification:**
- [ ] Run on sample; `tests/golden/prd-traceability.test.ts` confirms every assertion is linked.
**Dependencies:** T5, T9
**Files:** `.claude/skills/fm-prd-author/SKILL.md`, `.claude/commands/fm-prd.md`, `tests/golden/prd-traceability.test.ts`
**Scope:** M

#### Task 11: `reviewer` skill + `/fm-review` + Review gate + PRD panel
**Description:** Reviewer QA pass over the PRD; wire the Review hard-gate (reviewer pass + human
sign-off) into the controller; render the PRD in a panel.
**Acceptance criteria:**
- [ ] `/fm-review` emits QA notes; Review gate requires reviewer pass + explicit human sign-off (waivable per spec).
- [ ] PRD view panel renders both views.
**Verification:**
- [ ] Manual: review gate blocks without sign-off, opens with it; PRD renders.
- [ ] Unit test for Review-gate logic.
**Dependencies:** T7, T10
**Files:** `.claude/skills/fm-reviewer/SKILL.md`, `.claude/commands/fm-review.md`, `src/panels/prd-panel.ts`, `tests/flow/review-gate.test.ts`
**Scope:** M

### Checkpoint D: PRD complete (human review)
- [ ] Dual-view PRD generated and fully traceable; Review gate enforced.

---

### Phase 4: GitHub Projects dispatch

#### Task 12: GitHub auth plumbing (zero-setup demo)
**Description:** Retrieve the pre-provisioned credential from VSCode SecretStorage (fallback env),
configure the Octokit client against the bundled demo-project config. No secret in source.
**Acceptance criteria:**
- [ ] Token read from SecretStorage/env; Octokit authenticates against the demo project.
- [ ] Missing credential fails gracefully with a clear message (and a dry-run mode for offline demo).
**Verification:**
- [ ] Unit test with mocked SecretStorage (present / absent → dry-run). No secret committed.
**Dependencies:** T1
**Files:** `src/github/auth.ts`, `src/github/client.ts`, `tests/github/auth.test.ts`
**Scope:** S

#### Task 13: `/fm-tasks` dispatch + panel + Linear stub
**Description:** Convert design gaps into GitHub Issues on the demo Project; write dispatch state to
`tasks/`; show dispatched tasks in a panel with a "Linear — coming soon" stub.
**Acceptance criteria:**
- [ ] `/fm-tasks` creates an Issue per design gap on the demo Project (or dry-run records intent).
- [ ] `tasks/` reflects dispatch state; panel lists tasks + shows the Linear stub.
**Verification:**
- [ ] Run on sample (or dry-run); confirm issues created / intent recorded; panel renders state + stub.
**Dependencies:** T5, T12
**Files:** `.claude/skills/fm-tasks/SKILL.md`, `.claude/commands/fm-tasks.md`, `src/github/dispatch.ts`, `src/panels/tasks-panel.ts`
**Scope:** M

### Checkpoint E: Dispatch working
- [ ] Design tasks land on the GitHub Project (or dry-run); dispatch state visible in UI.

---

### Phase 5: CI merge-gate backstop

#### Task 14: `prd-gate.yml` + check script
**Description:** GitHub Action that fails a PR touching `prd/` or `spec/` while
`analysis/gap-report.md` has open blocking gaps; passes once clear. Logic in a small node-runnable
TS script so it's unit-testable.
**Acceptance criteria:**
- [ ] Workflow triggers on PRs touching `prd/**` or `spec/**`.
- [ ] Check script reads the gap report and exits non-zero iff a blocking gap is `open`.
**Verification:**
- [ ] Unit tests on the script against fixtures (open blocker → fail; clean → pass).
- [ ] Manual: a PR with an open blocker is red; resolved is green.
**Dependencies:** T5
**Files:** `.github/workflows/prd-gate.yml`, `src/ci/check-blockers.ts`, `tests/ci/check-blockers.test.ts`
**Scope:** S

### Checkpoint F: Complete
- [ ] SPEC success criteria 1–7 all met.
- [ ] All tests + typecheck + lint green; extension packages (`npm run package`).
- [ ] Ready for review / ship.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gap-analysis doesn't catch planted issues (core bet fails) | High | Exercise it at **Checkpoint B** with a planted-answer-key golden test, before any UI. Failure is early + informative; tune prompts or rethink. |
| Full thin slice is too much for the time box | High | Phases ordered so each checkpoint is independently demoable; **Checkpoint C is the minimum compelling story** — can stop there. |
| Webview ↔ extension state divergence | Med | Single source of truth = files on disk; panels re-read on change; no in-memory authority. |
| `claude` CLI subprocess flaky/slow from the extension | Med | Wrap with timeout + error surfacing; keep skills runnable standalone so the pipeline is testable without the UI. |
| GitHub auth setup friction kills the demo | Med | Pre-provisioned App/PAT in SecretStorage + a dry-run mode so the demo works offline. |
| Identity model (who is "Product"/may waive) underspecified | Low | Single-user demo: identity = a config string recorded in waiver/gate records; real auth deferred. |

## Open Questions (non-blocking; can resolve during build)

1. How many planted gaps in the sample, and how "obvious" — calibrate so the golden test is meaningful but not trivial. (Resolve in T3.)
2. Live GitHub dispatch in the demo, or is dry-run acceptable? (Affects T13 demo prep.)
3. Reviewer "human sign-off" UX — a button in the PRD panel vs a committed sign-off file? (Resolve in T11.)

---
---

# Part II — Migration: VS Code extension → standalone Electron app on Claude Code

> v1 (Part I) shipped as a VS Code extension. Part II retargets the product as a **standalone
> Electron desktop app** that drives **Claude Code** (the `claude` CLI) as its agent runtime. The
> designed renderer already exists under `desktop/` (electron-vite + React + Zustand). Architecture
> rationale: [`desktop/WIRING-PLAN.md`](../desktop/WIRING-PLAN.md). **omnigent is shelved** — not in
> scope for the hackathon.

## What's reused vs new

- **Reused as-is (the moat):** the VS Code-independent core at `src/` — `model/`, `flow/` (gates,
  state-machine, store), `github/` (dispatch, client, auth), `agents/cli-runner.ts`, the `fm-*`
  skills, the golden tests, the CI gate. Only `src/extension.ts` + `src/panels/*` are VS Code-bound
  and become dead weight (retired, not deleted, at the end).
- **Reused, needs wiring:** the `desktop/` renderer — all screens are built but run on mock data with
  a local store that re-derives gate logic.
- **New:** Electron main as the **Domain Host** (file I/O + core), the **IPC bridge** (preload
  `window.fm`), a renderer **Transport** seam, **Markdown→view-model parsers** (PRD/SPEC/review), an
  **`AgentRunner`** wrapping `cli-runner` (Claude Code), and **packaging**.

## Architecture (target)

```
Renderer (React, desktop/) ──Transport(IPC)── Preload(window.fm) ── Electron MAIN
                                                                      ├─ Domain Host: src/flow + src/github + src/model
                                                                      │     over engagement files (single source of truth)
                                                                      └─ AgentRunner → cli-runner → `claude /fm-<stage>`
```

Single source of truth = the engagement files on disk. Renderer renders snapshots main pushes and
sends intents; main mutates files via the core and re-broadcasts. The `AgentRunner` only
generates/refreshes artifacts; the Domain Host owns all gate/flow truth (gates are domain logic).

## Dependency Graph (Part II)

```
Phase 6  Domain Host bridge (read-only, no Claude Code)
  T15 desktop imports core ──> T16 engagement loader + IPC snapshot ──> T17 Transport seam
        └──────────────── CHECKPOINT G: real gaps.json renders in the built app

Phase 7  Mutations + Resolution gate on real files
  T18 resolve/defer writes files ──> T19 structured waiver ──> T20 advance Resolution gate
        └──────────────── CHECKPOINT H: full enforced Resolution loop on real files

Phase 8  Model reconciliation
  T21 adopt core model + deriveView + real FlowState stepper   (unblocks clean PRD/Review wiring)

Phase 9  PRD + Review on real artifacts
  T22 PRD/SPEC markdown parser ──> T23 review parser + sign-off gate
        └──────────────── CHECKPOINT I: PRD + Review wired to real artifacts

Phase 10 Handoff dispatch
  T24 wire github/dispatch (live/dry-run)

Phase 11 Connect to Claude Code
  T25 AgentRunner (ClaudeCodeRunner) ──> T26 "Run stage" actions + run states
        └──────────────── CHECKPOINT J: open → run stages via Claude Code → gate → advance → dispatch

Phase 12 Package & retire extension
  T27 electron-builder package + fonts/secrets ──> T28 retire extension scaffolding
        └──────────────── CHECKPOINT K: shippable standalone app at v1 parity
```

Bottom-up and vertically sliced: each task is one complete path (UI ↔ IPC ↔ core ↔ files), provable
on `examples/sample-engagement`. No omnigent on any path.

---

## Task List (Part II)

### Phase 6: Domain Host bridge (read-only — no Claude Code)

#### Task 15: `desktop/` main imports the shared core
**Description:** Wire the electron-vite **main** build to import the root core from `../../src`
(`flow/gates`, `flow/store`, `model/*`, `github/dispatch`). Keep `@octokit/rest` external.
**Acceptance criteria:**
- [ ] `desktop/` builds a main bundle that imports `canExitResolution` + `readFlowState` from `../../src` with no bundling error.
- [ ] A startup smoke log proves the core runs in main (e.g. `canExitResolution([])` → ok:true).
**Verification:**
- [ ] `cd desktop && npm run build` green; launching logs the smoke result once.
**Dependencies:** Phase 0 (done)
**Files:** `desktop/electron.vite.config.ts`, `desktop/src/main/index.ts`, `desktop/tsconfig*.json`
**Scope:** S

#### Task 16: Engagement loader + IPC snapshot + "Open engagement"
**Description:** Main reads an engagement root (`analysis/{gaps,claims}.json` + `readFlowState`),
assembles a `Snapshot`, and serves it over IPC; a folder picker selects the root (default
`examples/sample-engagement`). Preload exposes `window.fm = { requestSnapshot, onSnapshot, openEngagement }`.
**Acceptance criteria:**
- [ ] `ipcMain.handle("requestSnapshot")` returns `{ flowState, gaps, claims, gate }` from the real files.
- [ ] Opening the sample engagement yields a snapshot containing its real gap ids + `currentStage`.
- [ ] Preload is `contextIsolation`-safe; renderer never touches `fs`.
**Verification:**
- [ ] Temp debug log / devtools shows the real `gap-00x` ids and stage from `examples/sample-engagement`.
**Dependencies:** T15
**Files:** `desktop/src/main/{index,engagement,ipc}.ts`, `desktop/src/preload/index.ts`
**Scope:** M

#### Task 17: Renderer Transport seam (Electron + Mock)
**Description:** Introduce a `Transport` interface (`send(intent)`, `onSnapshot(cb)`,
`openEngagement()`); `ElectronTransport` over `window.fm`, `MockTransport` over the existing
`checkoutV2` mock + store actions. Store consumes snapshots; pick transport by environment.
**Acceptance criteria:**
- [ ] Built desktop app (ElectronTransport): PM board renders titles derived from the real `gaps.json`.
- [ ] Plain `vite` browser dev (MockTransport): the checkoutV2 mock still renders unchanged.
**Verification:**
- [ ] Launch desktop → real gaps; `npm run dev:web` (browser) → mock. No `routed`/crash regressions yet.
**Dependencies:** T16
**Files:** `desktop/src/renderer/src/transport/*`, `desktop/src/renderer/src/state/store.ts`
**Scope:** M

### Checkpoint G: Real data renders (human review)
- [ ] The built Electron app, opened on `examples/sample-engagement`, shows its **real** gaps read by
      Electron main via the core. Read-only — no mutations yet. **Smallest end-to-end proof.**

---

### Phase 7: Mutations + Resolution gate on real files

#### Task 18: Resolve / defer write real `gaps.json`
**Description:** `resolveGap`/`deferGap` intents → main sets `gap.status` + `gap.resolution
{by,reason,at}` and rewrites `analysis/gaps.json` (mirroring `gap-queue-panel`), recomputes
`canExitResolution`, re-broadcasts the snapshot.
**Acceptance criteria:**
- [ ] Resolving a blocking gap writes status + resolution to the real `gaps.json`; snapshot + UI update.
- [ ] Gate count in the snapshot reflects the new open-blocker count.
**Verification:**
- [ ] `git diff examples/sample-engagement/analysis/gaps.json` shows the change; UI reflects it live.
**Dependencies:** T17
**Files:** `desktop/src/main/intents.ts`, `desktop/src/renderer/src/state/store.ts`
**Scope:** M

#### Task 19: Structured waiver path
**Description:** Waiver form UI (reason + `communicatedToClient`/`riskAccepted`/`revisitScheduled`) →
main `validateWaiver`; on valid → set gap `waived` + `waiveGate` + `writeGateRecord`; invalid →
surface the failing reasons.
**Acceptance criteria:**
- [ ] Waiving a blocker with all acks writes a `decisions/*.md` gate record and opens the gate.
- [ ] A waiver missing any ack is rejected with the specific reasons (no file written).
**Verification:**
- [ ] `decisions/` gains a record; gate flips; invalid attempt shows the validation reasons.
**Dependencies:** T18
**Files:** `desktop/src/renderer/src/.../WaiverForm.tsx`, `desktop/src/main/intents.ts`
**Scope:** M

#### Task 20: Advance the Resolution gate (real flow state)
**Description:** `advanceStage` intent → main `canExitResolution` → `passGate("Resolution")` +
`advanceStage` + `writeFlowState` + `writeGateRecord`; re-broadcast. Renderer stepper reads real
`FlowState`.
**Acceptance criteria:**
- [ ] With 0 open blockers, Advance moves `.flow/state.json` `currentStage` Resolution→PRDDraft + writes a gate record.
- [ ] With open blockers, Advance is rejected with the gate reason; the celebration fires only on the real close→open.
**Verification:**
- [ ] `state.json` + `decisions/` change; stepper reflects the new stage; blocked case shows the reason.
**Dependencies:** T18 (T19 optional path)
**Files:** `desktop/src/main/intents.ts`, `desktop/src/renderer/src/components/StageStepper.tsx`
**Scope:** M

### Checkpoint H: Enforced Resolution loop on real files (human review)
- [ ] On the sample: resolve/defer/waive blockers → Resolution gate opens → advance, all mutating the
      real `gaps.json` / `.flow/state.json` / `decisions/`. This is the v1 enforced loop, in Electron.

---

### Phase 8: Model reconciliation

#### Task 21: Adopt the core model in the renderer
**Description:** Replace the renderer's local model with the core `Gap`/`Claim`/`FlowState`; drop the
invented `routed` status (→ `open|resolved|deferred|waived`); add `deriveView(gap, claims)` for the
display fields (title=summary; category from kind+`isDesignGap`; `canRouteToDesign`=`isDesignGap`;
`ageDays` from `resolution.at`; drop `owner`/`scopeImpact` or mark unknown); map `StageName` ↔ stage
keys; delete the front-end gate re-derivation in favour of the snapshot's `gate`.
**Acceptance criteria:**
- [ ] Renderer types import the shared model; `npm run typecheck` clean; no `routed` references remain.
- [ ] All 5 role views + PRD/Review/Handoff render from real snapshots with no console errors; orphan fields degrade gracefully.
**Verification:**
- [ ] Typecheck green; click through every persona/stage on the sample with no runtime errors.
**Dependencies:** T17 (best after T18–T20 so behaviour is observable)
**Files:** `desktop/src/renderer/src/model/*`, `.../adapters/deriveView.ts`, all views
**Scope:** L

---

### Phase 9: PRD + Review on real artifacts

#### Task 22: PRD/SPEC markdown → `PrdDoc`
**Description:** Main parser: `prd/PRD.md` + `spec/SPEC.md` → our `PrdDoc`; parse the strict
`[claim-id · file:loc]` citations and join claim ids to `claims.json` for verbatim quotes. PRD screen
renders real content; traceability meter + click-to-reveal become real.
**Acceptance criteria:**
- [ ] Opening the sample's PRD shows its real sections; the meter shows actual cited/total; clicking a cited line reveals the real claim quote.
- [ ] An uncited assertion (if present) is flagged, matching the golden traceability check's intent.
**Verification:**
- [ ] Spot-check 2 assertions against `prd/PRD.md` + `analysis/claims.json`.
**Dependencies:** T21
**Files:** `desktop/src/main/parsers/prd.ts`, `desktop/src/renderer/src/views/PrdDraftScreen.tsx`
**Scope:** M

#### Task 23: Review markdown → `ReviewReport` + sign-off gate
**Description:** Main parser: `decisions/prd-review.md` → our `ReviewReport` (`Verdict`/findings/axes);
`reviewerPassed` = `Verdict: PASS`. Sign-off intent → `passGate("Review")` + `advanceStage` +
`writeGateRecord`.
**Acceptance criteria:**
- [ ] Review screen shows the real verdict/findings/axes; the reviewer-pass key reflects the parsed verdict.
- [ ] Signing off advances `.flow/state.json` Review→Handoff + writes a gate record; the dual-key gate opens only with both keys.
**Verification:**
- [ ] `state.json` + `decisions/` change on sign-off; UI dual-key gate behaves per the parsed verdict.
**Dependencies:** T22
**Files:** `desktop/src/main/parsers/review.ts`, `desktop/src/renderer/src/views/ReviewScreen.tsx`, `desktop/src/main/intents.ts`
**Scope:** M

### Checkpoint I: PRD + Review on real artifacts (human review)
- [ ] PRD + Review screens render the sample's real Markdown artifacts with working provenance and a
      real sign-off that advances the flow.

---

### Phase 10: Handoff dispatch

#### Task 24: Wire real GitHub dispatch
**Description:** Dispatch intent → main `resolveAuth` (Electron `safeStorage`/`GITHUB_TOKEN` injected
into the `SecretStorageLike` shape) → `createClient` → `dispatchDesignTasks(root, gaps, client)`;
read/write the real `tasks/dispatch.json`. Delete the renderer's duplicate `isDesignGap` (use core).
**Acceptance criteria:**
- [ ] Dry-run (no token) writes `tasks/dispatch.json` for the design gaps; idempotent re-run shows `skipped-already-dispatched`.
- [ ] With a token, live mode creates issues (or is stubbed); the Handoff UI reflects dispatched/skipped + mode.
**Verification:**
- [ ] `tasks/dispatch.json` matches the core's output; UI states match the file.
**Dependencies:** T21
**Files:** `desktop/src/main/intents.ts`, `desktop/src/renderer/src/views/HandoffScreen.tsx`
**Scope:** M

---

### Phase 11: Connect to Claude Code (the agent runtime)

#### Task 25: `AgentRunner` interface + `ClaudeCodeRunner`
**Description:** Define `AgentRunner` (`run(stage, engagementRoot)`, surfacing progress + result);
implement `ClaudeCodeRunner` wrapping `runCliCommand` (`claude /fm-<stage> --print` in the engagement
root). On success, main re-loads the affected artifacts and re-broadcasts the snapshot.
**Acceptance criteria:**
- [ ] `runStage("GapAnalysis")` on an engagement with sources runs Claude Code, regenerates `analysis/gaps.json`, and the UI refreshes with the new gaps.
- [ ] The runner path is unit-tested with an injected mock `spawnFn` (success / error / timeout) so CI needs no live `claude`.
**Verification:**
- [ ] With `claude` available: a stage run regenerates its artifact + refreshes the UI. Unit test green with mock spawn.
**Dependencies:** T16 (artifacts reload), benefits from T21
**Files:** `desktop/src/main/agent/{AgentRunner,ClaudeCodeRunner}.ts`, `desktop/src/main/intents.ts`, `tests/...`
**Scope:** M

#### Task 26: "Run stage" actions + run states in the pipeline tracker
**Description:** Add per-stage run actions (Extraction/GapAnalysis/PRDDraft/Review) to the stepper/
pipeline surface with idle→running→done/error states; surface `RunResult.stderr` on failure.
**Acceptance criteria:**
- [ ] Each runnable stage shows idle→running→done; a failing run shows the error text.
- [ ] Running a stage refreshes the relevant screen (e.g. GapAnalysis → gap queue repopulates).
**Verification:**
- [ ] Trigger each stage on the sample; observe states + artifact refresh.
**Dependencies:** T25
**Files:** `desktop/src/renderer/src/components/StageStepper.tsx`, `.../views/*`
**Scope:** M

### Checkpoint J: End-to-end on Claude Code (human review)
- [ ] Open an engagement → run stages via Claude Code → resolve/waive gates → advance → dispatch,
      all reading/writing real files. **The working application.**

---

### Phase 12: Package & retire the extension

#### Task 27: Package the desktop app
**Description:** `electron-builder` config → `.app`/`.dmg`; bundle Geist/Geist Mono locally (offline);
wire GitHub token via `safeStorage`/env; multi-engagement open/switch UX pass.
**Acceptance criteria:**
- [ ] A built artifact launches on a clean machine, opens an engagement, and runs the loop offline (fonts local; dispatch dry-run without a token).
**Verification:**
- [ ] Install the built app; smoke the Checkpoint-J flow.
**Dependencies:** T20, T23, T24, T26
**Files:** `desktop/electron-builder.yml`, `desktop/src/main/*`, bundled fonts
**Scope:** M

#### Task 28: Retire the VS Code extension scaffolding
**Description:** Mark `src/extension.ts` + `src/panels/*` as deprecated scaffolding (don't delete);
update `README.md`/`CLAUDE.md` to name the Electron app the product; ensure the root build + tests
stay green and `desktop/` is the documented entry point.
**Acceptance criteria:**
- [ ] Docs describe the standalone app + how to run it; the extension is clearly marked legacy.
- [ ] Root `npm run typecheck`/`test` and `desktop` build all green.
**Verification:**
- [ ] Fresh-clone read of the README leads a new dev to launch the desktop app.
**Dependencies:** T27
**Files:** `README.md`, `CLAUDE.md`, `desktop/README.md`
**Scope:** S

### Checkpoint K: Shippable standalone app at v1 parity
- [ ] The Electron app reproduces the v1 enforced loop end-to-end on real files, driven by Claude
      Code, packaged as a desktop artifact. Extension retired.

---

## Risks and Mitigations (Part II)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundling root `src/` core into the Electron main build breaks (ESM/paths/octokit) | High | Validate at **T15** in isolation before anything depends on it; keep `@octokit` external. |
| Renderer↔core model drift (the `routed`/`view` gaps) causes runtime crashes | Med | T21 is a dedicated reconciliation task with a typecheck + click-through gate; sequence it before PRD/Review wiring. |
| Markdown parsers brittle vs hand-edited PRD/review | Med | Citations follow a strict format; parse defensively + unit-test against the sample fixtures; fail soft (show raw) rather than crash. |
| `claude` CLI absent/slow/flaky from Electron | Med | `AgentRunner` behind an interface; inject mock `spawnFn` in tests; surface timeout/stderr; the whole loop works without Claude Code through T24. |
| Mutating the committed `examples/sample-engagement` during dev dirties git | Low | Treat it as a fixture; copy to a temp/working engagement for live testing, or revert after demos. |
| Two build systems (esbuild extension + electron-vite desktop) | Low | `desktop/` stays self-contained; the extension build is untouched until retirement. |

## Open Questions (Part II)

1. Multi-engagement UX — open one folder at a time, or a recent-engagements switcher? (Resolve in T16/T27.)
2. Agent runs — batch (`--print`, show running→done) for v1, or stream events into a transcript later? (Default batch; T25/T26.)
3. Should advancing a stage auto-run the next `fm-*` skill, or always require an explicit "Run"? (Default explicit; revisit at Checkpoint J.)
4. Worktree/branch consolidation — the omnigent docs + `open-knowledge-format` still live on other branches; fold in or leave? (Coordination, not code.)
