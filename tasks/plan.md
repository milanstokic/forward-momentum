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
