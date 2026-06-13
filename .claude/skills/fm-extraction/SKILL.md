---
name: fm-extraction
description: Extract atomic, provenance-backed claims from an engagement repo's sources/. Use when starting the Forward-Momentum pipeline on a fresh engagement (or after new sources land) to turn messy transcripts, notes, and references into a structured claims.json that downstream gap-analysis can reason over. Each emitted claim MUST carry at least one verbatim-quote provenance entry.
---

# fm-extraction — sources → claims with provenance

## Overview

This is stage 1 of the Forward-Momentum pipeline (`Extraction`). It reads every file under an
engagement repo's `sources/` directory and emits `analysis/claims.json`: a flat array of atomic
**claims**, each one a single assertion about the product, scope, requirement, or design — and each
one backed by **verbatim provenance** (the source file, a locator, and an exact quote). The claim
set is the substrate the gap-analysis stage (`/fm-gaps`) reasons over, so completeness and faithful
provenance matter more than prose quality.

The platform's thesis is *manufacturing recorded consensus from messy inputs*. A claim with no
verbatim receipt is worthless — it cannot be traced, contested, or waived. So the hard rule of this
skill: **no claim without provenance, and provenance quotes must appear verbatim in the source.**

## When to Use

- A new engagement's `sources/` has been populated and you're starting the pipeline.
- New source material landed (a follow-up call, revised notes) and claims must be re-extracted.
- Invoked by the `/fm-extract` command.

**When NOT to use:** to find gaps or contradictions — that's `/fm-gaps`. This stage only records what
the sources *say*, faithfully and atomically. It does not judge, fill in, or resolve.

## Inputs

- All files under `sources/` (transcripts, notes, research, design references). Treat each as
  authoritative text. Do **not** invent content not present in a source.

## Procedure

1. **Enumerate sources.** List every file under `sources/`. Read each one fully.
2. **Identify line/locator anchors.** For markdown/text, use a line range like `L40-L52`. For a
   transcript with timestamps, a timestamp like `00:14:30` is acceptable. The locator must let a
   reviewer find the quote.
3. **Extract atomic claims.** Walk each source and pull out every distinct assertion that bears on
   the product: goals, metrics/targets, scope decisions, requirements, constraints, payment/auth
   rules, design intentions, parked/deferred items, and explicit open questions. Split compound
   statements into separate claims (one assertion per claim). Capture *parked* and *open* items as
   claims too — "X is parked" is itself a claim, and gap-analysis depends on it.
4. **Attach provenance.** For each claim, attach ≥1 `Provenance`:
   - `sourceFile`: the path relative to the engagement repo root, e.g. `sources/kickoff-call.md`.
   - `locator`: line range or timestamp.
   - `quote`: a **verbatim** excerpt — copy it exactly, do not paraphrase or fix typos. If a claim is
     supported by two sources, attach two provenance entries.
5. **Stay faithful, stay neutral.** Record contradictory statements as separate claims (do not
   reconcile them — surfacing the conflict is the next stage's job). Do not add claims the sources
   don't support.
6. **Assign stable ids.** `claim-001`, `claim-002`, … zero-padded, in reading order.
7. **Write `analysis/claims.json`** as the array (see output contract). Create the `analysis/`
   directory if missing.
8. **Self-check before finishing** (see Quality Bar).

## Output Contract

Write `analysis/claims.json` — a JSON array of `Claim` matching the platform's TS model
(`src/model/claim.ts`):

```jsonc
[
  {
    "id": "claim-001",                       // stable, zero-padded, reading order
    "summary": "Short, neutral restatement of the single assertion.",
    "provenance": [                          // ≥1 entry, REQUIRED
      {
        "sourceFile": "sources/kickoff-call.md",
        "locator": "L13",                    // line range or timestamp
        "quote": "verbatim excerpt from the source — copied exactly"
      }
    ]
  }
]
```

Constraints enforced by the model guards (`parseClaims`):
- The payload is an array.
- Every claim has a non-empty `id`, non-empty `summary`, and a **non-empty** `provenance` array.
- Every provenance entry has non-empty `sourceFile`, `locator`, and `quote`.

## Quality Bar (self-check before finishing)

- [ ] Every claim has ≥1 provenance entry.
- [ ] Every `quote` appears **verbatim** in the cited `sourceFile` (grep it to be sure).
- [ ] Compound statements were split into atomic claims.
- [ ] Parked / deferred / open items were captured as claims (gap-analysis needs them).
- [ ] Contradictory statements are recorded separately, not silently reconciled.
- [ ] `analysis/claims.json` parses as valid JSON and is an array.
