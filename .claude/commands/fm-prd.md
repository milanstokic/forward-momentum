---
description: Compose a dual-view, fully-traceable PRD (human prd/PRD.md + machine spec/SPEC.md) from resolved claims (Forward-Momentum pipeline stage 3 — PRDDraft).
---

Invoke the **fm-prd-author** skill.

Read `analysis/claims.json` (the resolved claims) and the records in `decisions/` (how each blocking
gap/conflict was settled), then produce BOTH views of the PRD:

- `prd/PRD.md` — the **human view**: narrative + rationale (objective, problem, goals/metrics, scope,
  out-of-scope/parked, key decisions, open questions).
- `spec/SPEC.md` — the **machine view**: testable acceptance criteria, non-goals, edge cases, and
  data/API contracts.

HARD REQUIREMENT — **every assertion carries a provenance citation**. Each bullet, numbered AC,
contract field, and asserting table row MUST end with a trailing bracket of the form
`[<claim-id>[, …] · <sourceFile>:<locator>]` (e.g. `[claim-007 · sources/product-notes.md:L24]`).
A citation must contain at least a claim/gap/conflict id and/or a `sourceFile:locator`; prefer both.
Assertions that rest on a resolved conflict cite the `decisions/` file plus the conflict id. NEVER
invent an id, source path, locator, or quote — if you cannot cite it, do not assert it.

Resolve contradictions to ONE direction using the recorded `decisions/` entry (e.g. the guest-vs-
account-required conflict) — do not assert both sides. Surface still-open non-blocking gaps as "Open
Questions," not as settled facts.

See `.claude/skills/fm-prd-author/SKILL.md` for the full procedure, citation format, output contract,
and quality bar. The traceability golden test (`tests/golden/prd-traceability.test.ts`) fails the
build if any assertion is uncited.
