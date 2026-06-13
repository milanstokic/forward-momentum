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
- [ ] **T21** Adopt core model (drop `routed`) + `deriveView(gap,claims)` + real `FlowState` stepper — L

## Phase 9 — PRD + Review on real artifacts
- [ ] **T22** PRD/SPEC markdown → `PrdDoc` (real citations/quotes/traceability) — M
- [ ] **T23** Review markdown → `ReviewReport` + sign-off gate (`passGate("Review")`) — M
- [ ] **Checkpoint I** — PRD + Review render real artifacts; sign-off advances the flow

## Phase 10 — Handoff dispatch
- [ ] **T24** Wire `dispatchDesignTasks` (live/dry-run via injected auth); real `tasks/dispatch.json` — M

## Phase 11 — Connect to Claude Code
- [ ] **T25** `AgentRunner` + `ClaudeCodeRunner` (wraps `cli-runner`; mock-spawn unit test) — M
- [ ] **T26** ∥ "Run stage" actions + idle/running/done/error states in the tracker — M
- [ ] **Checkpoint J** — open → run stages via Claude Code → gate → advance → dispatch *(the working app)*

## Phase 12 — Package & retire extension
- [ ] **T27** `electron-builder` package + local fonts + secrets/multi-engagement UX — M
- [ ] **T28** Retire extension scaffolding (don't delete); docs point at the desktop app — S
- [ ] **Checkpoint K** — shippable standalone app at v1 parity; extension retired

---
Part II: 14 tasks · 6 checkpoints · stop-safe at Checkpoint H (enforced loop) and Checkpoint J (working app)
