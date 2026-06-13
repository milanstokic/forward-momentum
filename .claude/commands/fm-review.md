---
description: QA-review the dual-view PRD for traceability, internal consistency, and unresolved-gap leakage; emit decisions/prd-review.md with a PASS/FAIL verdict (Forward-Momentum pipeline stage 4 — Review).
---

Invoke the **fm-reviewer** skill.

Read `prd/PRD.md`, `spec/SPEC.md`, `analysis/claims.json`, `analysis/gaps.json`, and the records in
`decisions/`, then perform a QA pass across three axes and write `decisions/prd-review.md`:

1. **Traceability** — every assertion ends with a provenance citation; every cited claim id / gap id
   / `decisions/` file actually exists (flag dangling citations and uncited assertions as blockers).
2. **Internal consistency** — no fact and its negation (e.g. a resolved conflict asserted both ways);
   the human view (`prd/`) and machine view (`spec/`) must agree; scope vs non-goals consistent.
3. **Unresolved-gap leakage** — no still-`open` **blocking** gap/conflict asserted as settled; any
   open **non-blocking** gap appears only as an explicit "Open Question," never as a decided
   requirement.

The first machine-readable line of `decisions/prd-review.md` MUST be `Verdict: PASS` or
`Verdict: FAIL`. FAIL if there is any blocker finding; otherwise PASS (warnings allowed).

This produces ONLY the reviewer-pass half of the hard-blocking Review gate. The gate also requires an
explicit **human sign-off** (recorded by the controller). Do not grant sign-off and do not advance the
flow. A FAIL keeps the gate closed until the PRD is fixed and re-reviewed (or the gate is waived via
the structured-waiver path).

See `.claude/skills/fm-reviewer/SKILL.md` for the full procedure, checks, output contract, and quality
bar.
