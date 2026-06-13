---
name: fm-tasks
description: Dispatch design gaps from an engagement repo's analysis/gaps.json to a GitHub Project as Issues, writing dispatch state to tasks/dispatch.json. Use as pipeline stage 5 (Handoff) after the PRD is reviewed and the Resolution gate has cleared. Only dispatches gaps classified as design tasks (kind=gap + design-related keywords or design-reference evidence). Safe to re-run — idempotent via dispatch.json.
---

# fm-tasks — design gaps → GitHub Project tasks

## Overview

This is the dispatch stage of the Forward-Momentum pipeline. It reads `analysis/gaps.json` (the
structured gap array), classifies each gap as a design task or not, creates a GitHub Issue for
every design gap on the configured demo project, and writes the dispatch state to
`tasks/dispatch.json`. The Tasks panel reads this file to show dispatched tasks and the
"Linear — coming soon" stub.

## When to Use

- After the PRD Review gate has cleared and it's time to hand design tasks to the design team.
- To run offline / without a GitHub credential (dry-run mode — no issues created, but dispatch
  state is still recorded as "dry-run").
- Invoked by the `/fm-tasks` command.

**When NOT to use:** before the Resolution gate has cleared — there should be no open blocking
gaps when dispatching tasks. The skill will run anyway but it is best practice to clear blockers
first.

## Design-Gap Identification (documented heuristic)

A gap is dispatched as a design task when ALL of the following hold:

1. `gap.kind === "gap"` — conflicts are product/architecture disputes, not Figma tasks
2. At least one of:
   - `gap.summary` matches `/design|frame|mock|screen|ui\b|ux\b|figma|wireframe|layout|visual/i`
   - Any `gap.evidence[].sourceFile` matches `/design-references/i`

This heuristic reliably catches gaps about missing Figma frames or design artifacts while excluding
pure requirement/behaviour gaps (saved-card behaviour, promo codes, cart persistence) that are
engineering or product decisions rather than Figma design tasks.

## Inputs

- `analysis/gaps.json` — structured `Gap[]` (produced by `/fm-gaps`)
- `tasks/dispatch.json` — existing dispatch state (for idempotency; skipped if absent)
- `src/github/dispatch.ts` — the TypeScript dispatch implementation

## Procedure

1. **Read `analysis/gaps.json`** from the engagement repo root. Validate it is a JSON array.
2. **Classify design gaps** using the heuristic above. Log which gaps are included and which are excluded with a reason.
3. **Check `tasks/dispatch.json`** for already-dispatched gap ids — skip those.
4. **Resolve GitHub auth** (via `resolveAuth()` from `src/github/auth.ts`):
   - If a credential is found → live mode, create real GitHub Issues.
   - If no credential → dry-run mode, record intended operations.
5. **For each design gap:**
   - Create an Issue titled `[Design] <summary (truncated at 120 chars)>`
   - Body: severity, full summary, evidence (source + locator + quote), related claims
   - Labels: `design`, `forward-momentum`
   - Add the issue to the GitHub Project (v2 GraphQL mutation) — live mode only
6. **Write `tasks/dispatch.json`** mapping `gapId → DispatchEntry` (see contract below).
7. **Report**: log which gaps were dispatched, which were skipped (already done), and the final dispatch state.

## Output Contract

`tasks/dispatch.json` — a JSON object keyed by gap id:

```jsonc
{
  "gap-002": {
    "gapId": "gap-002",
    "summary": "A declined / failed-payment error state …",
    "mode": "dry-run",          // "live" | "dry-run"
    "issueNumber": 42,           // only when mode === "live" and creation succeeded
    "issueUrl": "dry-run",       // GitHub issue URL (live) or "dry-run"
    "dispatchedAt": "2026-06-13T10:00:00.000Z",
    "status": "dispatched"       // "dispatched" | "skipped-already-dispatched"
  }
}
```

## Quality Bar (self-check before finishing)

- [ ] `analysis/gaps.json` was read and parsed without error.
- [ ] Design gaps were classified with the documented heuristic; exclusions logged.
- [ ] Already-dispatched gap ids were not double-created.
- [ ] `tasks/dispatch.json` was written and is valid JSON.
- [ ] Dry-run mode works with no GitHub token (no secret committed, no error thrown).
- [ ] Issue titles are under 120 chars after the `[Design]` prefix; bodies include evidence.
