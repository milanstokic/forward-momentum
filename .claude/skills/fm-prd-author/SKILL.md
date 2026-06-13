---
name: fm-prd-author
description: Compose a dual-view PRD (human prd/ + machine spec/) from a Forward-Momentum engagement's resolved claims.json, with a provenance citation on EVERY assertion. Use as pipeline stage 3 (PRDDraft), after the Resolution gate has cleared, to turn agreed claims into a traceable product spec. Every assertion must carry a provenance link back to a claim id and/or source.
---

# fm-prd-author — resolved claims → dual-view, fully-traceable PRD

## Overview

This is stage 3 of the Forward-Momentum pipeline (`PRDDraft`). It reads `analysis/claims.json`
(the resolved claims) plus the gate/resolution records in `decisions/` (how the team settled each
blocking gap/conflict) and composes a **dual-view PRD**:

- `prd/PRD.md` — the **human view**: narrative, rationale, the story of the product. What we're
  building and why, written for a human reader (Product, Eng, Design, client).
- `spec/SPEC.md` — the **machine view**: testable acceptance criteria, non-goals, edge cases, and
  data/API contracts. Structured for Claude Code (and downstream tooling) to consume.

The thesis (per the platform brief): the platform doesn't *write* the PRD — it **records team
consensus**. The PRD is the *receipt*. So every line that asserts something about the product must be
traceable back to where that assertion came from: a claim, a source quote, or a recorded decision.

## When to Use

- After the Resolution gate has cleared (all blocking gaps resolved/deferred/waived) and you need to
  compose the PRD from the resolved claims.
- Re-run when claims or resolutions change (loopback on new input).
- Invoked by the `/fm-prd` command.

**When NOT to use:** to extract claims (`/fm-extract`), to find gaps (`/fm-gaps`), or to QA the PRD
after the fact (`/fm-review`). This stage *composes*; it does not re-litigate gaps.

## HARD REQUIREMENT — every assertion carries provenance (non-negotiable)

This is the single rule the skill exists to enforce. **No assertion may stand without a citation.**

An *assertion* is any line that states a fact, requirement, goal, constraint, acceptance criterion,
non-goal, edge case, or contract about the product. In practice: every bullet, every numbered AC,
every table row that makes a claim, and every contract field description.

### Citation format (define once, use everywhere)

A citation is a trailing bracketed token of the form:

```
[<claim-id>[, <claim-id>…] · <sourceFile>:<locator>]
```

Examples:

```
- Guest users complete checkout without creating an account first. [claim-004 · sources/kickoff-call.md:L19]
- Wallets are the primary, most-prominent payment option on mobile. [claim-007 · sources/product-notes.md:L24]
- The account-model conflict resolves to "account required, lightweight inline signup." [conflict-001 · decisions/2026-06-13-resolution-conflict-001.md]
```

Rules:

1. **Every assertion line ends with at least one citation bracket** `[ … ]`.
2. A citation MUST contain **at least one** of: a claim id (`claim-NNN`), a gap/conflict id
   (`gap-NNN` / `conflict-NNN`), OR a `sourceFile:locator` pair. Prefer **both** a claim id AND its
   `sourceFile:locator` — the claim id makes it machine-traceable, the source is the human receipt.
3. Citations that rest on a recorded decision (e.g. how a conflict was resolved) cite the decision
   file in `decisions/` and the originating gap/conflict id.
4. The `·` (middle dot) separates the id list from the source locator. Multiple claim ids are
   comma-separated *before* the dot.
5. **Never invent** a claim id, source path, locator, or quote. If you cannot cite an assertion from
   the resolved claims or a recorded decision, **do not write it** — leave the gap explicit instead
   (see "Honesty" below).

Non-assertion lines — section headings, prose connective tissue ("This section covers…"),
table header rows, and code-fence delimiters — do NOT require a citation. Keep narrative glue
minimal so the traceability check (which scans bullets/ACs) stays meaningful.

## Procedure

1. **Load inputs.** Read `analysis/claims.json` (resolved claims). Read `decisions/` for any
   resolution/gate records — these tell you how blocking gaps/conflicts were settled, which lets you
   assert a single direction where the raw sources disagreed.
2. **Group claims into themes.** Objective/metrics, account model, checkout flow, payment methods,
   error handling, post-order, loyalty, promos, cart behavior, design coverage. Each theme becomes a
   PRD section.
3. **Resolve contradictions via decisions, not guesswork.** Where two claims conflict (e.g.
   claim-004 guest checkout vs claim-009 account-required), DO NOT assert both. Find the recorded
   resolution in `decisions/` and assert the chosen direction, citing the decision + the conflict id.
   If no decision exists, the Resolution gate has not actually cleared — stop and say so.
4. **Compose the human view (`prd/PRD.md`).** Narrative + rationale. Every assertion bullet carries a
   citation. Sections: Objective, Background/Problem, Goals & Success Metrics, Users, Scope (what
   we're building), Out of Scope / Parked, Key Decisions (with the conflict resolution), Open
   Questions (the non-blocking gaps still pending).
5. **Compose the machine view (`spec/SPEC.md`).** Structured + testable. Sections: Acceptance
   Criteria (numbered, each independently testable, each cited), Non-Goals (each cited to the
   parked/deferred claim or decision), Edge Cases (each cited — e.g. declined payment), Data/API
   Contracts (the order/payment/account shapes implied by the claims, each field-line cited).
6. **Self-check against the Quality Bar.** Re-scan: does every bullet/AC/contract line end in a
   citation bracket? Fix any that don't — either cite it or delete it.

## Output Contract

### `prd/PRD.md` — human view

```markdown
# PRD: <engagement> (dual-view · human)

> Generated by /fm-prd from analysis/claims.json + decisions/. Every assertion is cited
> `[claim-id · sourceFile:locator]`. The machine view lives in spec/SPEC.md.

## Objective
- <assertion>. [claim-001 · sources/kickoff-call.md:L9]

## Goals & Success Metrics
- <assertion>. [claim-002 · sources/product-notes.md:L6]

## Scope
- <assertion>. [claim-005 · sources/kickoff-call.md:L23]

## Key Decisions
- <resolution of a conflict>. [conflict-001 · decisions/<file>.md]

## Out of Scope / Parked
- <assertion>. [claim-013 · sources/kickoff-call.md:L45]

## Open Questions (non-blocking gaps pending)
- <assertion>. [gap-004 · sources/kickoff-call.md:L49]
```

### `spec/SPEC.md` — machine view

```markdown
# SPEC: <engagement> (dual-view · machine)

> Testable acceptance criteria, non-goals, edge cases, contracts. Every line is cited.

## Acceptance Criteria
1. <testable AC>. [claim-004 · sources/kickoff-call.md:L19]

## Non-Goals
- <non-goal>. [claim-013 · sources/product-notes.md:L32]

## Edge Cases
- <edge case>. [claim-010 · sources/kickoff-call.md:L35]

## Data / API Contracts
### Order
- `order.accountId: string` — every order is tied to an account. [claim-009 · sources/product-notes.md:L15-L18]
```

## Quality Bar (self-check before finishing)

- [ ] BOTH views written: `prd/PRD.md` (human) and `spec/SPEC.md` (machine).
- [ ] **Every assertion line ends with a citation bracket** containing a claim/gap id and/or a
      `sourceFile:locator`. No uncited assertions. (This is what `tests/golden/prd-traceability.test.ts`
      enforces — an uncited assertion FAILS the build.)
- [ ] No invented ids, sources, locators, or quotes — every citation maps to a real claim in
      `claims.json` or a real file in `decisions/`.
- [ ] Contradictions are resolved to ONE direction via a recorded `decisions/` entry, cited — never
      asserted both ways.
- [ ] Non-blocking gaps that remain open are surfaced as "Open Questions" rather than silently
      asserted as settled.
- [ ] Narrative glue is minimal; headings/prose-connectors are not dressed up as assertions.
