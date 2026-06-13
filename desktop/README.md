# Forward-Momentum — Desktop App

A standalone **Electron desktop app** for the Forward-Momentum pipeline: take messy product
inputs through a gated flow (Intake → Extraction → GapAnalysis → Resolution → PRDDraft → Review
→ Handoff) to a traceable PRD. Two hard gates (Resolution, dual-key Review) stop work from
advancing on a hunch; every claim, gap, and PRD assertion carries a provenance citation.

The app is **file-backed** (the engagement files on disk are the single source of truth) and uses
**Claude Code as its agent runtime** — it shells out to your local `claude` CLI to generate the
pipeline artifacts.

---

## Prerequisites

1. **Node.js 20 or 22** and npm.
2. **The Claude Code CLI** installed and authenticated:
   ```bash
   claude --version      # must print a version
   ```
   Install/auth instructions: <https://docs.claude.com/claude-code>. The app spawns this `claude`
   binary, so it must be on your `PATH` (the app also probes the usual locations —
   `~/.local/bin`, `/usr/local/bin`, `/opt/homebrew/bin` — so packaged launches work too).
3. **The `/fm-*` commands** must be available to Claude Code in the engagement you open. This repo
   ships them in `.claude/` (so the bundled sample engagement works out of the box). For your own
   engagements, the commands need to resolve from the engagement's `.claude/` or your global
   `~/.claude/` (see *Opening your own engagement* below).

---

## Install, run, package

```bash
cd desktop
npm install

npm run dev          # launch the app with hot reload (dev)
npm run build        # production build into out/
npm run dist         # package a distributable: .dmg (mac) / nsis (win) / AppImage (linux)
npm run dist:dir     # unpacked app (faster; for smoke-testing the package)

npm run typecheck    # tsc on renderer + main
```

`npm run dev` is the recommended way to run it day-to-day — it inherits your shell `PATH`, so the
`claude` connection works without any extra setup.

> Packaged builds are **unsigned** (`identity: null` in `electron-builder.yml`). On macOS, right-click
> → Open the first time, or set a signing identity to notarize for distribution.

---

## How it connects to your local Claude Code

The app never edits files or runs processes from the React UI. Everything goes through the Electron
main process, which is the **Domain Host**:

```
 React renderer (UI)
   │  window.fm.*  (contextBridge, no Node access in the UI)
   ▼
 IPC  ──────────────────────────────────────────────────────────────
   ▼
 Electron main = DOMAIN HOST
   ├─ reads/writes the engagement files and runs the core
   │     (flow/gates · flow/state-machine) for ALL gate + flow truth
   └─ AgentRunner ── "Run in Claude Code"
         ClaudeCodeRunner.runStage(stage)
           → spawn("claude", ["/fm-<stage>", "--print"], { cwd: <engagement> })
           → captures stdout/stderr; on exit, re-reads the engagement
           → pushes a fresh snapshot back to the UI
```

So when you click **Run in Claude Code** on a stage, the app launches your local `claude` as a
subprocess **in the open engagement's directory**, runs the stage's slash command headlessly
(`--print`), and then re-reads whatever the agent wrote. The stage → command map:

| Stage        | Command       | Writes                                   |
|--------------|---------------|------------------------------------------|
| Extraction   | `/fm-extract` | `analysis/claims.json`                   |
| GapAnalysis  | `/fm-gaps`    | `analysis/gaps.json`, `gap-report.md`    |
| PRDDraft     | `/fm-prd`     | `prd/PRD.md`, `spec/SPEC.md`             |
| Review       | `/fm-review`  | `decisions/prd-review.md`                |

The **gates and flow state are the app's own logic** (not the agent's): resolving/deferring/waiving
gaps, advancing stages, and recording gate decisions all run in the Domain Host and write the files
directly. The agent is only used to *generate* artifacts.

Wiring lives in `src/main/agent-runner.ts` (the `AgentRunner` seam + `ClaudeCodeRunner`), which wraps
the repo-root core `src/agents/cli-runner.ts`.

---

## Using the app

1. **Open an engagement.** On launch it opens the bundled sample (`examples/sample-engagement`). Use
   **Open engagement** to pick any engagement folder (see structure below).
2. **Intake (fresh engagements).** A folder with only `sources/` opens to the **Intake** screen: it
   lists your raw inputs and lets you **Run Extraction** (sources → claims) then **Run Gap Analysis**
   (claims → gaps) via Claude Code. Once gaps exist the flow lands at Resolution. (The bundled sample
   is already analyzed, so it opens straight to the gap board.)
4. **Resolve the gaps.** As **Product Manager**, Resolve / Defer / **Waive** each blocking gap. A
   blocking gap holds the Resolution gate `CLOSED` (orange); clear the last one and it flips `OPEN`
   (mint) with a celebration. Waiving requires a structured waiver (reason + three acknowledgements)
   and is recorded to `decisions/`.
5. **Advance** through PRD draft → Review → Handoff. The **Review gate** is dual-key: it needs the
   reviewer's `PASS` (from `decisions/prd-review.md`) **and** an explicit human sign-off.
6. **Run agents** at any runnable stage with **Run in Claude Code** (top bar) to (re)generate that
   stage's artifacts; the UI refreshes from the files the agent wrote.
7. **Handoff** dispatches design gaps (writes `tasks/dispatch.json`).

All mutations write real files; reopen the engagement and your progress persists.

### Roles (persona switcher)

| Role | View | Focus |
|------|------|-------|
| **Product Manager** | Consensus board | Resolve / defer / waive — drives the gate |
| **Project Manager** | Status & ownership | Who holds the gate, age of oldest blocker |
| **Engineering Manager** | Scope inspector | Blocking scope conflicts + head-to-head evidence |
| **Developer** | Provenance ledger + machine spec | Every requirement traces to a verbatim source |
| **Designer** | Design-task inbox | Routed design tasks; connect a Figma frame to the PRD |

---

## Opening your own engagement

An engagement is a folder the app reads and writes. Minimum structure:

```
<engagement>/
  .claude/                  so `claude` resolves the /fm-* commands here
  sources/                  raw inputs (call notes, docs) — fed to /fm-extract
  analysis/
    claims.json             /fm-extract output
    gaps.json               /fm-gaps output   ← the app requires this to recognize a folder
  .flow/state.json          pipeline position + gate status (app creates/updates)
  decisions/                gate records + resolution decisions (app writes)
  prd/PRD.md                /fm-prd output (human view)
  spec/SPEC.md              /fm-prd output (machine view)
  decisions/prd-review.md   /fm-review output
  tasks/dispatch.json       handoff dispatch state (app writes)
```

Only `analysis/gaps.json` is required for the app to accept a folder; the rest are produced by
running the stages (manually with `claude`, or via **Run in Claude Code**). If a folder has sources
but no analysis yet, open it and run **Extraction** then **GapAnalysis**.

---

## Architecture

```
desktop/src/
  main/                      ELECTRON MAIN = Domain Host
    index.ts                 window + IPC handlers + PATH fix + bundled-sample resolution
    domain-host.ts           loadEngagement(root) → Snapshot (runs the core)
    mutations.ts             resolve/defer/waive/advance/handToReview/signOffReview/dispatch
    prd-parser.ts            prd/PRD.md + spec/SPEC.md → PrdDoc (citations, quotes, traceability)
    review-parser.ts         decisions/prd-review.md → ReviewReport
    dispatch.ts              design-gap dispatch → tasks/dispatch.json
    agent-runner.ts          AgentRunner seam + ClaudeCodeRunner (spawns `claude`)
  preload/index.ts           window.fm bridge (requestSnapshot/openEngagement/mutate/runStage)
  shared/contract.ts         the IPC wire contract (Snapshot / Intent / AgentRunResult)
  renderer/src/
    transport/               Transport seam: ElectronTransport (IPC) + MockTransport (browser dev)
    state/store.ts           Zustand; hydrates from snapshots; actions send intents
    views/, components/      role views + UI

../src/                      shared, VS Code-independent core (model/flow/github/agents)
../examples/sample-engagement   the bundled fixture engagement
```

The renderer talks only through the `Transport` seam: `ElectronTransport` (real IPC) in the app, or
`MockTransport` (the bundled `checkoutV2` fixture) when the renderer is run in a plain browser for
design iteration — so the UI is developable without Electron or Claude Code.

Headless checks (no GUI) live in `scripts/verify-*.mjs` and exercise the Domain Host read/write
paths, the markdown parsers, and the `ClaudeCodeRunner` (with a mock spawn) against the sample
engagement:

```bash
node scripts/verify-load.mjs        # read path
node scripts/verify-mutations.mjs   # resolve/waive/advance write real files; gate enforced
node scripts/verify-artifacts.mjs   # PRD/Review parsing + full flow to Handoff
node scripts/verify-agent.mjs       # ClaudeCodeRunner command mapping + exit handling (mock spawn)
node scripts/verify-intake.mjs      # sources-only engagement loads at Intake; early-flow advance

# The fixture-based checks normalize their temp copy, so they pass even if a live
# run has mutated examples/sample-engagement. To reset the sample itself:
#   git checkout -- examples/sample-engagement
```

---

## Current limitations / follow-ups

- **Live GitHub dispatch** is not yet wired — Handoff currently records a dry-run to
  `tasks/dispatch.json`. Live issue creation needs `@octokit` added here plus a token
  (via `safeStorage`/env).
- **Packaged-app `claude` resolution** relies on the binary being in a standard location (the app
  augments `PATH`). If your `claude` lives elsewhere, run via `npm run dev` or adjust `fixPath()` in
  `src/main/index.ts`.
- The Designer view's per-task acceptance criteria are authored demo content for the sample gaps and
  derived generically for other engagements.

## Design system

Charcoal `#1C1C1C` dark IDE shell · Geist + Geist Mono (vendored locally — no CDN). The palette is
semantic: **orange** = conflict / blocking / gate CLOSED · **mint** = resolved / verified / gate OPEN.
