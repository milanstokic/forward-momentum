# forward-momentum

## What this is

An IDE for product development: a gated pipeline that turns messy inputs into a traceable PRD
(Intake → Extraction → GapAnalysis → Resolution → PRDDraft → Review → Handoff), with two hard
gates (Resolution, dual-key Review) and provenance on every claim/gap/assertion.

**The product is the standalone Electron desktop app in `desktop/`** — a file-backed Domain Host
(Electron main runs the core over the engagement files) plus an `AgentRunner` that drives
**Claude Code** (`claude /fm-<stage>`) to generate artifacts. Run it with `cd desktop && npm run dev`;
package it with `npm run dist`.

## Repository layout

- `desktop/` — **the product.** electron-vite + React + Zustand. Main = Domain Host
  (`src/main/domain-host`, `mutations`, `prd-parser`, `review-parser`, `dispatch`, `agent-runner`);
  renderer talks to it over a `Transport` seam (IPC live / mock for browser dev). See
  `desktop/WIRING-PLAN.md` and the `desktop/scripts/verify-*.mjs` headless checks.
- `src/` — the VS Code-independent **shared core**: `model/`, `flow/` (gates, state-machine, store),
  `github/` (dispatch), `agents/cli-runner` (spawns `claude`). Reused by the desktop main process.
- `src/extension.ts` + `src/panels/*` — the **legacy VS Code extension** (v1). Retired scaffolding,
  superseded by the desktop app; kept for reference, not deleted. Don't build new features here.
- `examples/sample-engagement/` — real fixture engagement (claims/gaps/PRD/SPEC/review/dispatch).

## How we work here

This repo vendors the `agent-skills` skills, commands, and agent personas into `.claude/`
(checklists in `references/`). Follow the spec → plan → build → test → review → ship
lifecycle. Don't skip the spec for anything non-trivial; let the relevant skills drive the process.

## Conventions

- Branch off `main` for new work; keep commits small and atomic.
- Tests are proof — a feature isn't done until it's verified.
- Update this file as the project's stack and conventions get decided.
