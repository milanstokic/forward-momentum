---
description: Surface gaps and conflicts from analysis/claims.json into a human gap-report.md and a structured gaps.json (Forward-Momentum pipeline stage 2 — the core value test).
---

Invoke the **fm-gap-analysis** skill.

Read `analysis/claims.json` (you MAY also re-read `sources/` for context) and produce BOTH:
- `analysis/gap-report.md` — human-readable report for the Product reviewer.
- `analysis/gaps.json` — a structured `Gap[]` (conform to `src/model/gap.ts`) for tooling and the
  Resolution gate.

You MUST find both kinds of issue:
1. **Gaps** (`kind: "gap"`) — missing/undefined requirements, behaviors implied but unspecified, and
   described screens/states **absent** from the designs or notes. Re-examine parked/deferred items
   for unresolved interaction with shipping scope (parked ≠ resolved).
2. **Conflicts** (`kind: "conflict"`) — claims across sources that cannot both be true. Cite **both**
   sides in the evidence.

For each issue: assign `severity` deliberately — **blocking** for payment/auth correctness, a
known-broken state with no design, and any direct conflict; **non-blocking** for real-but-deferrable
gaps — with a one-line rationale. Attach `evidence` (verbatim-quote provenance), link
`relatedClaims`, and set `status: "open"`. Keep ids identical between the report and `gaps.json`.

See `.claude/skills/fm-gap-analysis/SKILL.md` for the full procedure, output contract, and quality
bar.
