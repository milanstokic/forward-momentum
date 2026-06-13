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
14 tasks · 6 checkpoints · stop-safe at Checkpoint C
