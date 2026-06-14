# Forward-Momentum

> An **IDE for product development** — a gated pipeline that turns messy inputs (call notes, docs)
> into a traceable PRD, with **Claude Code** as its agent runtime. Two hard gates stop work from
> advancing on a hunch; every claim, gap, and PRD assertion carries a provenance citation.

<div align="center">

[![Watch the Forward-Momentum demo](https://img.youtube.com/vi/-rdvOT8Fmdg/maxresdefault.jpg)](https://youtu.be/-rdvOT8Fmdg)

▶ **[Watch the demo](https://youtu.be/-rdvOT8Fmdg)**

</div>

## Quick start

```bash
cd desktop
npm install
npm run dev        # launch the desktop app (connects to your local `claude` CLI)
```

Prebuilt installer: **[Download the latest release](https://github.com/milanstokic/forward-momentum/releases/latest)**
(macOS Apple Silicon `.dmg`; unsigned — right-click → Open on first launch).

Requires the [Claude Code CLI](https://docs.claude.com/claude-code) installed and authenticated.
Full setup and usage: [`desktop/README.md`](./desktop/README.md).

## What it is

The product is a **standalone Electron desktop app** that runs a 7-stage pipeline:

```
Intake → Extraction → GapAnalysis → Resolution → PRDDraft → Review → Handoff
                                     ▲ hard gate              ▲ hard gate (dual-key)
```

- **File-backed.** The engagement files on disk are the single source of truth. The app reads/writes
  them and runs the core to evaluate gates, record resolutions/waivers, and advance the flow.
- **Resolution gate.** A blocking gap holds the gate `CLOSED` until it's resolved, deferred, or
  cleared via a structured waiver (reason + three acknowledgements).
- **Review gate.** Dual-key: an automated reviewer `PASS` (traceability / consistency / leakage)
  **plus** an explicit human sign-off.
- **Role-switching surface.** Product Manager, Project Manager, Engineering Manager, Developer,
  Designer — same gaps, same gate, re-prioritized per role.
- **Provenance everywhere.** Every PRD/SPEC assertion cites `[claim-id · sourceFile:locator]` and
  reveals its verbatim source or recorded decision on click.

## How it connects to Claude Code

When you click **Run in Claude Code** on a stage, the app spawns your local `claude` CLI as a
subprocess in the engagement directory and runs that stage's slash command headlessly:

```
React UI → window.fm (preload) → IPC → Electron main / ClaudeCodeRunner
        → spawn("claude", ["/fm-<stage>", "--print"], { cwd: <engagement> })
        → re-reads what the agent wrote → refreshes the UI
```

Stages map to `/fm-extract` · `/fm-gaps` · `/fm-prd` · `/fm-review`. The gates and flow state are the
app's own logic; the agent is used only to *generate* artifacts. Details in
[`desktop/README.md`](./desktop/README.md).

## Repository layout

| Path | What |
|------|------|
| `desktop/` | **The product** — Electron app (Domain Host + `AgentRunner` → Claude Code). See [`desktop/WIRING-PLAN.md`](./desktop/WIRING-PLAN.md). |
| `src/` | Shared, VS Code-independent **core** (`model/`, `flow/`, `github/`, `agents/cli-runner`) reused by the desktop main process. |
| `src/extension.ts`, `src/panels/*` | **Legacy** VS Code extension (v1) — retired scaffolding, superseded by `desktop/`. Kept for reference. |
| `examples/sample-engagement/` | Real fixture engagement the app opens by default. |
| `.claude/` | The pipeline's agent skills + slash commands (`/fm-extract`, `/fm-gaps`, `/fm-prd`, `/fm-review`, `/fm-tasks`). |

## Building & releasing

```bash
cd desktop
npm run dist       # build the installer into desktop/release/  (.dmg on macOS)
npm run release    # build + upload to the GitHub release for the current version
```

> macOS arm64 only on an Apple-Silicon machine; Windows (`nsis`) and Linux (`AppImage`) targets
> must be built on those platforms (e.g. via CI). Builds are unsigned.

---

## Built with Claude Code + agent-skills

This repo was built with [Claude Code](https://claude.com/claude-code) using the
[agent-skills](https://github.com/addyosmani/agent-skills) skills, commands, and agent personas,
vendored into `.claude/` (checklists in `references/`) so everything works with no plugin install.
The development lifecycle, in order:

| Command | Phase | What it does |
|---|---|---|
| `/spec` | Define | Write a spec before any code |
| `/plan` | Plan | Break the spec into small, atomic tasks |
| `/build` | Build | Implement one slice at a time (`/build auto` runs the whole plan) |
| `/test` | Verify | Prove it works with tests |
| `/review` | Review | Improve code health before merge |
| `/ship` | Ship | Release to production |

To update the vendored skills, re-copy from a fresh clone of `addyosmani/agent-skills` into
`.claude/skills`, `.claude/commands`, `.claude/agents`, and `references/`, then strip the
`agent-skills:` plugin prefix from the command files.
