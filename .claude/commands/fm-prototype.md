---
description: Generate a throwaway, self-contained STATIC clickable prototype that forces a path through the targeted open BLOCKING gap(s), recording each forced choice in a manifest and as an in-UI provisional banner (Forward-Momentum Prototype Module — on-demand, not a pipeline stage).
argument-hint: <gapId> [gapId…]
---

Invoke the **fm-prototype** skill to break a specific deadlock with a clickable artifact.

**Target gap id(s):** $ARGUMENTS

Read `analysis/gaps.json`, `analysis/claims.json`, and `prd/**` (if present; otherwise work from
claims + gaps), then generate into `prototype/`:

- `prototype/index.html` — a **single self-contained static** prototype: inline CSS/JS, **no network
  calls, no backend, no env/secrets**, all data inline **synthetic** mock data. Each screen carries a
  stable semantic `data-screen="<screen-id>"`.
- `prototype/manifest.json` — a `PrototypeManifest` (conform to `src/model/prototype.ts`):
  `{ generatedAt, targetGapIds, choices: [{gapId, choice, rationale}], screens }`.

For each target that is **open AND blocking**, FORCE a path through it: pick the most defensible
option, build the prototype as if it were decided, record `{gapId, choice, rationale}` in the
manifest, AND show a provisional banner naming the gap id (e.g. *"Provisional: guest checkout ·
[conflict-001]"*). Every manifest choice must have a matching banner and vice versa. Targets that are
non-blocking or already resolved/waived are not force-recorded. If no target is open-and-blocking,
still generate a runnable prototype with `choices: []` and no banners.

This is an **on-demand** action to force a chosen conflict — not a routine "prototype everything"
step, and it does NOT introduce any deploy/CI/preview/hosting code.

See `.claude/skills/fm-prototype/SKILL.md` for the full procedure, output contract, and quality bar.
