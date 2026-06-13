---
name: fm-reviewer
description: QA-review a Forward-Momentum dual-view PRD (prd/ + spec/) for traceability, internal consistency, and unresolved-gap leakage, emitting review notes to decisions/prd-review.md with a clear PASS/FAIL verdict. Use as pipeline stage 4 (Review), after /fm-prd, to produce the reviewer-pass half of the hard-blocking Review gate (the other half is human sign-off).
---

# fm-reviewer — QA pass over the dual-view PRD

## Overview

This is stage 4 of the Forward-Momentum pipeline (`Review`). It reads the generated PRD
(`prd/PRD.md` + `spec/SPEC.md`), the resolved `analysis/claims.json`, the `analysis/gaps.json`, and
the `decisions/` records, then performs an adversarial QA pass and writes review notes to
`decisions/prd-review.md`.

The Review gate is **hard-blocking** and requires BOTH:
1. a **reviewer pass** (this skill emits `Verdict: PASS`), AND
2. an explicit **human sign-off**.

This skill produces (1). It does NOT grant sign-off and it does NOT advance the flow — a human (the
Product authority) does that through the panel/controller. A `Verdict: FAIL` keeps the gate closed
until the PRD is fixed and re-reviewed (or the gate is waived via the structured-waiver path).

## When to Use

- After `/fm-prd` has produced both PRD views and you need the reviewer QA pass.
- Re-run after PRD edits.
- Invoked by the `/fm-review` command.

**When NOT to use:** to author the PRD (`/fm-prd`) or to sign off as the human authority (that is a
human action recorded by the controller). This stage *checks*; it does not author or approve.

## What to check (the three axes)

### 1. Traceability
- Every assertion line in `prd/PRD.md` and `spec/SPEC.md` ends with a provenance citation bracket
  `[<claim/gap/conflict-id>[, …] · <sourceFile>:<locator>]`.
- Every cited claim id actually exists in `analysis/claims.json`; every cited `decisions/` file
  actually exists. Flag any **dangling** citation (id or file that does not exist).
- Flag any assertion with **no** citation at all (this duplicates the golden test, but the reviewer
  should catch it in human-readable form too).

### 2. Internal consistency
- The PRD must not assert a fact and its negation. The classic trap: a resolved conflict asserted
  both ways (e.g. "guest checkout, no account" AND "every order requires an account"). The PRD must
  pick the direction recorded in `decisions/` and assert only that.
- The human view (`prd/`) and machine view (`spec/`) must agree — an AC in `spec/` must not
  contradict the narrative in `prd/`.
- Success metrics, scope, and non-goals must be mutually consistent (a non-goal must not also appear
  as an in-scope requirement).

### 3. Unresolved-gap leakage
- A **blocking** gap/conflict that is still `open` in `analysis/gaps.json` must NOT be silently
  asserted in the PRD as if it were settled. If a blocking issue lacks a resolution in `decisions/`,
  the PRD should not have shipped — flag it.
- **Non-blocking** open gaps are allowed in the PRD ONLY as explicit "Open Questions," never as
  settled requirements. Flag any non-blocking open gap that has leaked into an AC or scope bullet as
  though decided.

## Procedure

1. Read `prd/PRD.md`, `spec/SPEC.md`, `analysis/claims.json`, `analysis/gaps.json`, and the files in
   `decisions/`.
2. Run the three checks above. Collect findings, each as a row with: severity (`blocker` /
   `warning`), axis, location (file + the offending line), and a one-line description.
3. Decide the verdict: **FAIL if there is any `blocker` finding** (uncited/dangling assertion,
   internal contradiction, or a leaked open blocking gap). Otherwise **PASS** (warnings allowed).
4. Write `decisions/prd-review.md` per the Output Contract. The file's first machine-readable line
   MUST be `Verdict: PASS` or `Verdict: FAIL` so tooling/the controller can read it.

## Output Contract — `decisions/prd-review.md`

```markdown
# PRD Review — <engagement>

Verdict: PASS        <!-- or: Verdict: FAIL -->
Reviewed-at: <ISO timestamp>
Reviewer: fm-reviewer

## Summary
<one paragraph: what was reviewed and the headline result>

## Findings
| Severity | Axis | Location | Finding |
|----------|------|----------|---------|
| blocker  | traceability | spec/SPEC.md:L42 | AC has no provenance citation |
| warning  | consistency  | prd/PRD.md:L18   | promo-code scope is vague |

(If no findings: state "No findings — PRD passes all three axes.")

## Axis results
- **Traceability:** PASS/FAIL — <note>
- **Internal consistency:** PASS/FAIL — <note>
- **Unresolved-gap leakage:** PASS/FAIL — <note>

## Sign-off
Reviewer pass is necessary but NOT sufficient. The Review gate also requires an explicit human
sign-off, recorded by the controller. This file grants only the reviewer-pass half.
```

## Quality Bar (self-check before finishing)

- [ ] All three axes were checked (traceability, consistency, leakage).
- [ ] Every cited id/file was verified to exist (dangling citations flagged as blockers).
- [ ] The verdict is FAIL iff there is ≥1 blocker finding; the `Verdict:` line is machine-readable.
- [ ] `decisions/prd-review.md` written; it does NOT claim to grant human sign-off.
