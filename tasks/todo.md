# Forward-Momentum — Task Checklist

Companion to [`plan.md`](./plan.md) and [`../SPEC.md`](../SPEC.md). Check tasks off as completed.
`∥` marks tasks that can run in parallel (subagents).

## Phase 0 — Foundation
- [ ] **T1** Bootstrap the VSCode extension project (toolchain + activating extension) — M
- [ ] **T2** Shared domain model types (`Claim`, `Gap`, `Waiver`, `FlowState`, guards) — S
- [ ] **T3** ∥ Sample engagement corpus + planted-issue answer key — M
- [ ] **Checkpoint: Foundation** — builds clean, types compile, smoke test green, corpus committed

## Phase 1 — The learning core (Track A ∥ Track B)
- [ ] **T4** `extraction` skill + `/fm-extract` → `analysis/claims.json` with provenance — M
- [ ] **T5** `gap-analysis` skill + `/fm-gaps` → `gap-report.md` (golden test vs answer key) — M
- [ ] **T6** ∥ State machine (pure transitions + loopback) — S
- [ ] **T7** ∥ Gates + structured waivers + `store.ts` persistence — M
- [ ] **Checkpoint B: Is the core good enough?** — FAIL-FAST GATE, human review before any UI

## Phase 2 — Enforced loop in the UI
- [ ] **T8** Pipeline panel (runs `claude` CLI, reflects state) — M
- [ ] **T9** Gap queue + resolution gate + structured-waiver form — M
- [ ] **Checkpoint C: Enforced loop end-to-end** — minimum compelling story; human review

## Phase 3 — PRD + QA
- [ ] **T10** `prd-author` + `/fm-prd` → dual-view, traceable PRD — M
- [ ] **T11** `reviewer` + `/fm-review` + Review gate + PRD panel — M
- [ ] **Checkpoint D: PRD complete** — traceable, Review gate enforced

## Phase 4 — GitHub dispatch
- [ ] **T12** GitHub auth plumbing (SecretStorage, demo project, dry-run) — S
- [ ] **T13** `/fm-tasks` dispatch + tasks panel + Linear stub — M
- [ ] **Checkpoint E: Dispatch working**

## Phase 5 — CI backstop
- [ ] **T14** `prd-gate.yml` + unit-tested check script — S
- [ ] **Checkpoint F: Complete** — all SPEC success criteria met, packages clean, ready to ship

---
14 tasks · 6 checkpoints · stop-safe at Checkpoint C
