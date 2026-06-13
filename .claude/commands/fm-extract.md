---
description: Extract provenance-backed claims from an engagement repo's sources/ into analysis/claims.json (Forward-Momentum pipeline stage 1).
---

Invoke the **fm-extraction** skill.

Read every file under `sources/` in the current engagement repo and produce
`analysis/claims.json` — a flat array of atomic `Claim` objects where **every claim carries at least
one `Provenance` entry** (sourceFile + locator + a verbatim quote that appears exactly in the
source).

Procedure (see `.claude/skills/fm-extraction/SKILL.md` for the full contract):
1. Enumerate and read all of `sources/`.
2. Extract atomic claims — one assertion each; capture parked/open items too; record contradictory
   statements separately without reconciling them.
3. Attach verbatim provenance to every claim (grep the source to confirm the quote matches exactly).
4. Assign stable ids `claim-001`, `claim-002`, … in reading order.
5. Write `analysis/claims.json` (create `analysis/` if needed) and self-check against the Quality Bar.

Do not invent content the sources don't support. Do not judge or resolve conflicts — that is
`/fm-gaps`.
