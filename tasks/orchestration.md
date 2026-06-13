# Orchestration Plan — Sub-agents, Waves & Gates

How the [plan.md](./plan.md) tasks get executed: parallel subagent **waves**, an automated **gate**
between waves (must be green to advance), and **human-review gates** at Checkpoints B and C.
Model policy: **Sonnet** for mechanical/well-specified work; **Opus** for judgment-heavy IP
(gap-analysis prompt, planted-gap corpus, PRD author).

## Shared-file rule (conflict avoidance)
Only **one agent per wave** may edit `src/extension.ts` (the command/panel registration point).
When two parallel agents would both need to register something, the second writes its contribution
as a standalone module and the **orchestrator** wires `extension.ts` after the wave. Agents touching
disjoint paths run freely in parallel; agents that would collide get `isolation: worktree`.

## Wave 0 — Foundation  (2 agents ∥)
| Agent | Tasks | Model | Paths (disjoint) |
|---|---|---|---|
| A | T1 bootstrap + T2 model types | **Sonnet** | `package.json`, `tsconfig`, `esbuild.mjs`, `.vscode/`, `src/extension.ts`, `src/model/`, `tests/` |
| B | T3 sample corpus + answer key | **Opus** | `examples/sample-engagement/**` |
**GATE — Foundation:** `npm install && npm run build && npm run typecheck && npm test` all green;
sample layout + `ANSWER-KEY.md` present. Orchestrator runs the gate. → proceed automatically.

## Wave 1 — The learning core  (2 agents ∥, independent subsystems)
| Agent | Tasks | Model | Paths (disjoint) |
|---|---|---|---|
| A (Track A) | T4 extraction + T5 gap-analysis | **Opus** (core IP) | `.claude/skills/fm-*`, `.claude/commands/fm-*`, `tests/golden/`, `tests/fixtures/` |
| B (Track B) | T6 state-machine + T7 gates/waivers/store | **Sonnet** | `src/flow/`, `tests/flow/` |
**GATE B — FAIL-FAST, HUMAN REVIEW:** golden gap-report test green (all planted issues caught);
flow controller ≥90% covered; gates + structured waivers behave. Orchestrator runs tests, reports
results + a core-quality read. **STOP for human sign-off** before any UI.

## Wave 2 — Enforced UI + floats  (3 agents ∥)
T12 (auth, dep T1✓) and T14 (CI, dep T5✓) float forward to fill parallel capacity.
| Agent | Tasks | Model | Paths |
|---|---|---|---|
| A | T8 pipeline panel → T9 gap queue + resolution gate | **Sonnet** | `src/panels/`, `src/agents/`, `media/`, **owns `extension.ts` this wave** |
| B | T12 GitHub auth plumbing (+ dry-run) | **Sonnet** | `src/github/auth.ts`, `client.ts`, `tests/github/` |
| C | T14 CI check script + `prd-gate.yml` | **Sonnet** | `src/ci/`, `.github/workflows/`, `tests/ci/` |
**GATE C — HUMAN REVIEW:** enforced loop demoable on the sample (ingest → gaps → resolve/waive →
gate opens, receipts in `decisions/`); T12 + T14 unit tests green. **Minimum compelling story —
stop-safe.** Orchestrator demos + reports. **STOP for human sign-off.**

## Wave 3 — PRD + QA + dispatch  (2 agents ∥, worktree-isolated on `extension.ts`)
Both register panels → run isolated, orchestrator merges `extension.ts` wiring.
| Agent | Tasks | Model | Paths |
|---|---|---|---|
| A | T10 prd-author (Opus) → T11 reviewer + Review gate + PRD panel (drop to Sonnet for panel) | **Opus→Sonnet** | `.claude/skills/fm-prd-author`, `fm-reviewer`, `src/panels/prd-panel.ts`, `tests/golden/`, `tests/flow/` |
| B | T13 `/fm-tasks` dispatch + tasks panel + Linear stub | **Sonnet** | `.claude/skills/fm-tasks`, `src/github/dispatch.ts`, `src/panels/tasks-panel.ts` |
**GATE D+E:** PRD traceability test green + Review gate enforced; dispatch creates issues (or
dry-run) + tasks panel renders. Orchestrator wires `extension.ts`, runs full suite.

## Wave 4 — Integration & ship
Orchestrator (main thread): wire any remaining registration, run full `build + typecheck + lint +
test + package`, verify SPEC success criteria 1–7.
**GATE F — Complete:** all criteria met, `npm run package` clean. → review/ship.

## Gate discipline
- Every wave ends with the orchestrator running the wave's automated checks **before** the next wave starts. Red gate ⇒ fix (re-task the agent) ⇒ re-run; never advance on red.
- Human gates (B, C) additionally pause for explicit sign-off.
- Subagents get self-contained prompts pointing at `SPEC.md` + their `plan.md` task; they read those directly (own context), return a short structured report of what they built + how they verified.
