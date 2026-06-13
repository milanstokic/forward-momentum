# Forward-Momentum — Task Checklist

Companion to [`plan.md`](./plan.md) and [`../SPEC.md`](../SPEC.md). Check tasks off as completed.
`∥` marks tasks that can run in parallel (subagents).

## Phase 0 — Foundation
- [x] **T1** Bootstrap the VSCode extension project (toolchain + activating extension) — M
- [x] **T2** Shared domain model types (`Claim`, `Gap`, `Waiver`, `FlowState`, guards) — S
- [x] **T3** ∥ Sample engagement corpus + planted-issue answer key — M
- [x] **Checkpoint: Foundation** — builds clean, types compile, smoke test green, corpus committed ✓

## Phase 1 — The learning core (Track A ∥ Track B)
- [x] **T4** `extraction` skill + `/fm-extract` → `analysis/claims.json` with provenance — M
- [x] **T5** `gap-analysis` skill + `/fm-gaps` → `gap-report.md` (golden test vs answer key) — M
- [x] **T6** ∥ State machine (pure transitions + loopback) — S
- [x] **T7** ∥ Gates + structured waivers + `store.ts` persistence — M
- [x] **Checkpoint B: Is the core good enough?** — GREEN (115 tests, golden 10/10, controller 100%) — awaiting human sign-off

## Phase 2 — Enforced loop in the UI
- [x] **T8** Pipeline panel (runs `claude` CLI, reflects state) — M
- [x] **T9** Gap queue + resolution gate + structured-waiver form — M
- [x] **Checkpoint C: Enforced loop end-to-end** — GREEN (162 tests); awaiting human sign-off + F5 demo

## Phase 3 — PRD + QA
- [x] **T10** `prd-author` + `/fm-prd` → dual-view, traceable PRD — M
- [x] **T11** `reviewer` + `/fm-review` + Review gate + PRD panel — M
- [x] **Checkpoint D: PRD complete** — GREEN (traceability 57 tests, review-gate enforced)

## Phase 4 — GitHub dispatch
- [x] **T12** GitHub auth plumbing (SecretStorage, demo project, dry-run) — S *(floated into Wave 2)*
- [x] **T13** `/fm-tasks` dispatch + tasks panel + Linear stub — M
- [x] **Checkpoint E: Dispatch working** — GREEN (dry-run dispatches 2 design gaps; 27 tests)

## Phase 5 — CI backstop
- [x] **T14** `prd-gate.yml` + unit-tested check script — S *(floated into Wave 2)*
- [x] **Checkpoint F: Complete** — 255 tests green; vsce packages clean (48 KB); SC2/3/5/6/7 verified programmatically; SC1/SC4 logic unit-tested, pending F5 visual confirm

---
Part I: 14 tasks · 6 checkpoints · stop-safe at Checkpoint C — **all shipped (VS Code extension v1)**

---

# Part II — Standalone Electron app on Claude Code

Migration from VS Code extension → standalone Electron desktop app driving Claude Code. Renderer
already built under `desktop/`; reuses the `src/` core. omnigent shelved. Plan: [`plan.md`](./plan.md)
Part II · architecture: [`../desktop/WIRING-PLAN.md`](../desktop/WIRING-PLAN.md). Each task is a
vertical slice provable on `examples/sample-engagement`. **Stop-safe at Checkpoint H** (the enforced
loop on real files) and again at **Checkpoint J** (the working app on Claude Code).

## Phase 6 — Domain Host bridge (read-only, no Claude Code)
- [x] **T15** `desktop/` main imports the shared `src/` core via `@core` alias; build bundles it (`.js`→`.ts` resolved) — S
- [x] **T16** Engagement loader (`domain-host.loadEngagement`) + IPC (`requestSnapshot`/`openEngagement`) + folder picker — M
- [x] **T17** Renderer Transport seam (ElectronTransport + MockTransport) + `deriveView` adapter + store `hydrate` — M
- [x] **Checkpoint G** — typecheck+build clean; `loadEngagement` on real sample-engagement → 18 claims, 6 gaps, gate CLOSED (3 blockers: conflict-001, gap-001, gap-002). Verified headless via `scripts/verify-load.mjs`; awaiting `npm run dev` visual confirm

## Phase 7 — Mutations + Resolution gate on real files
- [x] **T18** Resolve/defer write real `gaps.json` (+ `resolution{by,reason,at}`) via `mutate` IPC → `domain-host.mutations` — M
- [x] **T19** Structured waiver path: `WaiverModal` (3 acks + reason) → `validateWaiver` → gap waived + `waiveGate` + gate record — M
- [x] **T20** Advance Resolution gate (`canExitResolution` → `passGate`+`advanceStage`+`writeFlowState`+`writeGateRecord`) — M
- [x] **Checkpoint H** — enforced loop verified headless via `scripts/verify-mutations.mjs` (12/12: advance REJECTED while 3 blockers open; resolve+waive write real files; gate opens; advance → state.json PRDDraft). Awaiting `npm run dev` visual confirm *(stop-safe)*

## Phase 8 — Model reconciliation
- [x] **T21** Dropped `routed` GapStatus (→ client-side `routedIds` dispatch marker); `deriveView` adapter (Phase 6); flow flags (advanced/handedToReview/reviewSignedOff) + `currentStage` derived authoritatively from real `FlowState` via `flowFlags(snap.flow)` — L

## Phase 9 — PRD + Review on real artifacts
- [x] **T22** `prd-parser.ts`: PRD.md + SPEC.md → `WirePrdDoc` (citations parsed, claim quotes joined from claims.json, decisions flagged, contracts/gated fields, traceability) — M
- [x] **T23** `review-parser.ts`: prd-review.md → `WireReviewReport`; `handToReview` + `signOffReview` intents (`canExitReview` → `passGate("Review")` + advance + record) — M
- [x] **Checkpoint I** — verified headless via `scripts/verify-artifacts.mjs` (25/25): real PRD/SPEC/review parsed; full flow resolve→advance→hand-to-review→sign-off reaches Handoff; sign-off rejected before Review. Awaiting `npm run dev` visual confirm

## Phase 10 — Handoff dispatch
- [x] **T24** Host `dispatch.ts` (dependency-free; mirrors core heuristic) → dry-run writes real `tasks/dispatch.json`; snapshot carries dispatch; `dispatchTasks` intent. Verified: gap-002/gap-003 dispatched. *(live GitHub = follow-up: needs @octokit + token)* — M

## Phase 11 — Connect to Claude Code
- [x] **T25** `AgentRunner` + `ClaudeCodeRunner` (wraps core `cli-runner`; spawns `claude /fm-<stage> --print`). Verified headless via `scripts/verify-agent.mjs` (17/17 mock-spawn: command mapping, exit codes, spawn-error, no-command) — M
- [x] **T26** `AgentRunBar` "Run in Claude Code" control + `agentRun` idle/running/done/error state + `runStage` IPC/transport; re-reads snapshot after the agent writes — M
- [x] **Checkpoint J** — *the working app*: open → run stages via Claude Code → gate → advance → dispatch. `claude` v2.1.177 on PATH (live spawn viable in `npm run dev`). Awaiting visual demo *(stop-safe)*

## Phase 12 — Package & retire extension
- [x] **T27** `electron-builder.yml` (+ `dist`/`dist:dir` scripts) → packages a 234MB `.app` with the sample engagement bundled (extraResources) + resolved via `process.resourcesPath`; local **vendored fonts** (geist woff2, CDN dropped, CSP tightened to `'self'`); `fixPath()` so packaged launches find `claude`. Multi-engagement = "Open engagement" picker. *(safeStorage secrets defer with live GitHub)* — M
- [x] **T28** Retired the VS Code extension: root README + CLAUDE.md document the layout and point at `desktop/`; extension `package.json` description marked `[LEGACY … superseded by desktop/]`. Not deleted. — S
- [x] **Checkpoint K** — `npm run dist:dir` produces a runnable unsigned `.app`; handoff README written; extension retired. *(live GitHub dispatch + packaged-PATH edge = documented follow-ups)*

### Post-handoff fixes
- [x] Designer view crashed on real engagements (`ACCEPTANCE[g.id]` undefined for non-mock gap ids) → `metaFor(gap)` fallback derives acceptance from the real gap.
- [x] Reset the sample engagement fixture to its pristine starting state (a live demo had advanced it to Handoff).
- [x] Rewrote `desktop/README.md` as real handoff docs (prerequisites, the Claude Code connection, opening your own engagement, architecture, limitations).
- [x] **Intake handled** (was unimplemented): `Snapshot.sources` (reads `sources/`); `isEngagementRoot` accepts sources-only folders so you can start fresh; `IntakeScreen` lists sources + runs Extraction → Gap Analysis via Claude Code; host `advanceFlowForStage` walks the flow Intake → Extraction → Resolution after early-stage runs; fresh engagements route to Intake. Verified via `scripts/verify-intake.mjs` (11/11).
- [x] Hardened `verify-mutations`/`verify-artifacts`/`verify-intake` with a `normalize()` step so the suite is deterministic even when a live demo has mutated the working-tree fixture.
- [x] **GitHub dispatch left as a documented gap** (per request): dry-run only; live issue creation needs `@octokit` + token. Documented in `desktop/README.md` *Current limitations*.

---
Part II: 14 tasks · 6 checkpoints · stop-safe at Checkpoint H (enforced loop) and Checkpoint J (working app)
