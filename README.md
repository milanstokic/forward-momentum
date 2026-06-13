# forward-momentum

A project built with [Claude Code](https://claude.com/claude-code) using the
[agent-skills](https://github.com/addyosmani/agent-skills) plugin — production-grade
engineering skills that drive the full development lifecycle from spec to ship.

## Working with this repo

The skills, slash commands, and agent personas from
[agent-skills](https://github.com/addyosmani/agent-skills) are vendored directly into
`.claude/` (skills, commands, agents) with checklists in `references/`, so everything works
in Claude Code with no plugin install. A SessionStart hook injects the skill-discovery
meta-skill at the start of each session.

### Slash commands

The lifecycle, in order:

| Command         | Phase   | What it does                          |
|-----------------|---------|---------------------------------------|
| `/spec`         | Define  | Write a spec before any code          |
| `/plan`         | Plan    | Break the spec into small, atomic tasks |
| `/build`        | Build   | Implement one slice at a time (`/build auto` runs the whole plan) |
| `/test`         | Verify  | Prove it works with tests             |
| `/review`       | Review  | Improve code health before merge      |
| `/code-simplify`| Review  | Clarity over cleverness               |
| `/ship`         | Ship    | Release to production                 |

Skills also activate automatically based on what you're doing (e.g. designing an API
triggers `api-and-interface-design`, building UI triggers `frontend-ui-engineering`).

### Updating the skills

The skills are a vendored copy. To pull in upstream changes, re-copy from a fresh clone of
`addyosmani/agent-skills` into `.claude/skills`, `.claude/commands`, `.claude/agents`, and
`references/`, then strip the `agent-skills:` plugin prefix from the command files.

## The product

Forward-Momentum is an **IDE for product development** — a gated pipeline from messy inputs to a
traceable PRD. The shipping product is a **standalone Electron desktop app** that drives
**Claude Code** as its agent runtime.

```bash
cd desktop
npm install
npm run dev        # launch the desktop app (connects to the `claude` CLI)
npm run dist       # package a distributable (.dmg / nsis / AppImage)
```

### Repository layout

| Path | What |
|------|------|
| `desktop/` | **The product** — Electron app (Domain Host + `AgentRunner` → Claude Code). See `desktop/WIRING-PLAN.md`. |
| `src/` | Shared, VS Code-independent **core** (`model/`, `flow/`, `github/`, `agents/cli-runner`) reused by the desktop main process. |
| `src/extension.ts`, `src/panels/*` | **Legacy** VS Code extension (v1) — retired scaffolding, superseded by `desktop/`. Kept for reference. |
| `examples/sample-engagement/` | Real fixture engagement the app opens by default. |

The pipeline + agent skills (`/fm-extract`, `/fm-gaps`, `/fm-prd`, `/fm-review`, `/fm-tasks`) live in
`.claude/`; the desktop app invokes them through the `claude` CLI.
