---
name: fm-gap-analysis
description: Surface missing-information gaps AND cross-source contradictions from a Forward-Momentum engagement's claims.json, emitting a human-readable gap-report.md and a structured gaps.json. Use as pipeline stage 2 (GapAnalysis), after /fm-extract, to manufacture the reviewable artifact the Resolution gate forces a team to clear. This is the product's central value: catching the issues a human skim would miss, and assigning blocking vs non-blocking deliberately.
---

# fm-gap-analysis — claims → gap & conflict report

## Overview

This is stage 2 of the Forward-Momentum pipeline (`GapAnalysis`) and the product's central bet. It
reads `analysis/claims.json` (and MAY re-read the original `sources/` for fuller context) and emits
**two** artifacts:

- `analysis/gap-report.md` — a human-readable report a Product person reviews and resolves.
- `analysis/gaps.json` — a structured `Gap[]` (the platform's TS model) so tooling, the flow
  controller, the Resolution gate, and tests can parse it.

The thesis: the platform doesn't write the PRD, it *manufactures and records team consensus from
messy inputs*. The gap report is the forcing function — every blocking gap is a decision the team
must make (resolve, defer, or waive-with-reason) before the flow advances. So this stage must catch
the issues a human reading the sources would plausibly **miss**, and it must classify each one's
severity with a clear, defensible rationale.

## When to Use

- After `/fm-extract` has produced `analysis/claims.json` and you need the gap/conflict report.
- Re-run when claims change (new sources, re-extraction).
- Invoked by the `/fm-gaps` command.

**When NOT to use:** to extract claims (`/fm-extract`) or to resolve/waive gaps (that's the human
Resolution gate). This stage *finds and classifies*; it does not decide.

## What counts as an issue

Find BOTH of these. Do not stop at one kind.

1. **Gaps (kind: "gap")** — missing information that the work needs but no source pins down:
   - A requirement acknowledged but never specified (where does X get entered? validated? how does
     it affect the total?).
   - A behavior implied by a decision but left undefined (e.g. a flow changed to single-page, but
     in-session state behavior unstated).
   - A screen/state described in one source but **absent** from the designs or notes (cross-check
     claims against design references — a named pain point or "payoff" screen with no mock is a
     design gap).
   - An item explicitly **parked/deferred** whose unresolved interaction with shipping scope still
     blocks build (parked ≠ resolved).

2. **Conflicts (kind: "conflict")** — two (or more) claims/sources that **cannot both be true**:
   - Compare claims pairwise for direct contradiction (e.g. "guest checkout, no account needed" vs
     "every order must be tied to a signed-in account"). Cite **both** sides in the evidence.
   - A conflict is almost always blocking — both statements are load-bearing and the team must pick.

## Procedure

1. **Load claims.** Read `analysis/claims.json`. Optionally re-read `sources/` for context the
   atomic claims dropped.
2. **Build a coverage map.** Group claims by topic (auth/account, payment methods, error handling,
   confirmation/post-order, promos, cart behavior, design frames, …). This makes both missing
   topics and contradictions visible.
3. **Hunt gaps.** For each topic, ask: is this fully specified, or only *mentioned*? Cross-reference
   what the call/notes promise against what the design references actually contain — a described
   screen with no frame is a design gap. Treat parked items as gaps when their interaction with
   shipping scope is undefined.
4. **Hunt conflicts.** Compare claims across sources for direct contradiction. When found, record
   `kind: "conflict"` and cite **both** sides in `evidence`.
5. **Assign severity deliberately.** Mark **blocking** when the issue would make the build wrong,
   unsafe, or stuck if left open — payment correctness, auth/account model, a known-broken state
   with no design, and any direct conflict. Mark **non-blocking** when it's a real gap but the
   happy path can proceed and it can be settled later (nice-to-have screen, a parked-and-truly-later
   item, an acknowledged-but-deferrable requirement). State *why* in the rationale.
6. **Attach evidence.** Every gap/conflict carries `evidence: Provenance[]` with verbatim quotes
   (reuse the claims' provenance; for conflicts include one entry per conflicting side). Link
   `relatedClaims` to the claim ids involved.
7. **Assign ids & status.** `gap-001`, `gap-002`, … ; every new gap is `status: "open"`.
8. **Write both artifacts** (see Output Contract) and self-check (Quality Bar).

## Output Contract

### `analysis/gaps.json` — structured `Gap[]` (conform to `src/model/gap.ts`)

```jsonc
[
  {
    "id": "gap-001",
    "kind": "gap",                 // "gap" | "conflict"
    "severity": "blocking",        // "blocking" | "non-blocking"
    "summary": "One-line statement of what is missing or contradictory.",
    "relatedClaims": ["claim-004", "claim-011"],
    "evidence": [                  // Provenance[] — verbatim quotes; both sides for a conflict
      { "sourceFile": "sources/kickoff-call.md", "locator": "L31", "quote": "verbatim…" }
    ],
    "status": "open"               // always "open" on first emission
  }
]
```

Constraints enforced by the model guards (`parseGaps`): array payload; each gap has a non-empty
`id`, a valid `kind`, a valid `severity`, a non-empty `summary`, an array `relatedClaims`, an array
`evidence` (each entry a valid provenance), and a valid `status`.

### `analysis/gap-report.md` — human-readable

Suggested shape (one section per gap; keep ids identical to `gaps.json`):

```markdown
# Gap & Conflict Report — <engagement>

**Summary:** N issues — X gaps, Y conflicts. Blocking: Z.

## Blocking
### conflict-… / gap-…  (kind · category · severity)
- **Summary:** …
- **Why it matters / severity rationale:** …
- **Related claims:** claim-…, claim-…
- **Evidence:**
  - `sources/…` (L..): "verbatim quote"
  - (for a conflict, quote BOTH sides)

## Non-blocking
…
```

The report and `gaps.json` must describe the **same** set of issues with the **same** ids.

## Quality Bar (self-check before finishing)

- [ ] Both kinds present: missing-information **gaps** AND cross-source **conflicts** were hunted.
- [ ] Every direct contradiction is `kind: "conflict"` and cites **both** sides in `evidence`.
- [ ] Designs were cross-checked against described screens/states — missing frames flagged as gaps.
- [ ] Parked/deferred items were re-examined for unresolved interactions with shipping scope.
- [ ] Severity is deliberate, with a one-line rationale; payment/auth/known-broken/conflicts trend
      blocking.
- [ ] Every gap has ≥1 evidence entry with a verbatim quote and links `relatedClaims`.
- [ ] `gaps.json` parses as a valid `Gap[]`; ids match the report; all new gaps are `status: "open"`.
