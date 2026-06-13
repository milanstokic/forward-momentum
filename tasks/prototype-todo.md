# Extension A — Prototype Module — Task Checklist

Companion to [`prototype-plan.md`](./prototype-plan.md). Extends the v1 plan in [`plan.md`](./plan.md);
does not replace it. `∥` marks tasks that can run in parallel (subagents).

> **Prereqs from v1:** skill track (P1/P2/P5a) needs only `gaps.json` + `fm-gap-analysis` (✅ exist).
> UI track (P3/P4/P5b/P6) needs the flow store (T7) and gap-queue panel (T8/T9) — verify before
> starting, or use a temporary command-palette entry point.

## Phase A — Contract
- [x] **P1** Prototype data contracts + guards (`model/prototype.ts`: `ProvisionalChoice`, `PrototypeManifest`, `Reaction`, `protoAnchor`; `parseManifest`/`parseReactions`) — S ✅ 20 tests, typecheck/lint/build clean

## Phase B — Generation (skill track, core bet)
- [x] **P2** `fm-prototype` skill + `/fm-prototype <gapIds>` → static `index.html` + `manifest.json` + provisional banners (AC1, AC2, AC6) — M ✅ 29 golden tests; sample forces conflict-001 + gap-002
- [ ] **Checkpoint A: Is the forcing function real?** — FAIL-FAST, human review before viewing UI

## Phase C — Viewing (UI track)
- [x] **P3** ∥ Local viewing — localhost static server + open-in-browser + webview beside gap report (AC3) — M ✅ 14 server tests; panel+browser commands wired (webview needs F5 dev-host to eyeball)
- [x] **P4** Reaction capture — webview UI → `reactions.jsonl` (`prototype@<screen>` anchor) — M ✅ 9 store tests; drawer with screen-anchored comment form + reactions list
- [ ] **Checkpoint B: View + react end-to-end** — AC3 + reaction-capture half of AC4

## Phase D — The wedge (reaction → gap)
- [x] **P5a** ∥ Extend `fm-gap-analysis` to ingest `reactions.jsonl` (sharpen / new / confirm-provisional; stale-anchor) (AC4, AC5) — M ✅ 12 golden tests; AC5 proven by present-with / absent-without comparison
- [x] **P5b** Round-trip wiring — re-run analysis from panel; new gaps show `prototype@<screen>` provenance — S ✅ gap-queue "⟳ Re-run" button (reuses cli-runner) + prototype badges + stale-anchor flag

## Phase E — Flow integration
- [x] **P6** On-demand action (target gap IDs from gap queue) + soft "prototype reviewed" marker (non-blocking) + AC6 repo grep guard — M ✅ select-and-prototype + soft marker (gate-orthogonal, tested) + 20-test AC6 guard
- [x] **Checkpoint C: Acceptance** — AC1–AC6 green; edge cases covered; tests + typecheck + lint clean ✅ 271 tests pass

---
7 tasks · 3 checkpoints · skill track standalone-testable · the wedge is AC5 (new gap from a click)

**MODULE COMPLETE** — all 7 tasks done. AC1–AC6 covered (AC3/UI eyeballed via F5).
271 tests pass; typecheck/lint/build clean. Committed on branch `feat/prototype-module`.
