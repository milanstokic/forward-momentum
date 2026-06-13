---
description: Dispatch design gaps from analysis/gaps.json to GitHub Projects as Issues, writing tasks/dispatch.json (Forward-Momentum pipeline stage 5 — Handoff / design dispatch).
---

Invoke the **fm-tasks** skill.

Read `analysis/gaps.json` in the current engagement repo and dispatch each **design gap** as a
GitHub Issue on the configured demo project, writing dispatch state to `tasks/dispatch.json`.

Procedure (see `.claude/skills/fm-tasks/SKILL.md` for the full contract):

1. Read and parse `analysis/gaps.json`. If the file does not exist, abort with a clear message
   ("Run /fm-gaps first to produce analysis/gaps.json").
2. Classify each gap as a design task using the documented heuristic:
   - `kind === "gap"` AND (`summary` matches design keywords OR `evidence` cites a
     `design-references` source file).
3. Check `tasks/dispatch.json` for already-dispatched gap ids — skip those (idempotent).
4. Resolve GitHub auth (SecretStorage → env vars → dry-run). No credential is not an error.
5. For each design gap, create a GitHub Issue (live) or record the intended operation (dry-run).
   Issue title: `[Design] <summary>`. Body: severity, summary, evidence, related claims.
6. Write `tasks/dispatch.json` with the full dispatch state.
7. Report: log which gaps were dispatched, which were skipped, and summarise the dispatch state.

Do not dispatch conflicts (`kind === "conflict"`) — those are product/architecture disputes.
Do not dispatch in dry-run mode as a failure — dry-run is the valid offline/demo path.
Do not commit secrets or tokens.
