---
name: fm-prototype
description: Generate a throwaway, self-contained, static clickable prototype for a Forward-Momentum engagement — from PRD + claims + gaps — that FORCES a path through targeted open BLOCKING gaps so the team can react to a concrete artifact. Use on demand from Gap analysis / Resolution to break a specific deadlock, not as a routine pipeline stage. Each forced choice is recorded in a manifest AND surfaced in-UI as a provisional banner. The prototype is scratch: regenerated on demand, never hand-edited, discarded after it has surfaced disagreement.
---

# fm-prototype — claims + gaps → throwaway clickable prototype

## Overview

This is the **Prototype Module** (Extension A). It generates a **self-contained static** clickable
prototype so teammates can *react to a concrete artifact* instead of prose. The prototype's job is
to **surface disagreement faster than prose**, then be discarded — it is **not** a handoff asset.

The core move: to be clickable, the prototype MUST choose a path through any targeted open
**BLOCKING** gap/conflict. Each forced choice is (1) recorded in a manifest and (2) shown in-UI as a
non-blocking **provisional banner**. The prototype is a *forcing function for a chosen conflict* — it
takes target gap id(s) as input and forces **those**, not "everything."

Downstream, teammates leave screen-anchored reactions (`fm-prototype` does not capture them — the
extension does) and `fm-gap-analysis` folds those reactions back in as new/sharpened gaps. The wedge
is a **new gap that no text source contained** — a requirement that only became visible once someone
could click.

## When to Use

- On demand from **Gap analysis / Resolution** to break a **specific deadlock** — invoked via the
  `/fm-prototype <gapId> [gapId…]` command with the target gap id(s).
- Re-run any time to regenerate from current state; prior output is disposable.

**When NOT to use:** as a mandatory pipeline stage, or to "prototype everything" (that just adds
throwaway-UI noise). It does not resolve gaps, capture reactions, or produce a handoff deliverable.

## Inputs

- `prd/**` — the human/machine PRD **if present** (may be empty early; then work from claims + gaps).
- `analysis/claims.json` — provenance-backed claims (the substance to mock).
- `analysis/gaps.json` — the structured `Gap[]`; this is where the targeted blocking gaps live.
- **Command argument:** one or more target gap ids (e.g. `conflict-001 gap-002`).

## Conflict-forcing behavior (the core)

1. **Resolve targets.** For each target gap id, look it up in `gaps.json`. Force a path **only** for
   targets that are open **AND** blocking (`severity: "blocking"`, `status: "open"`). Ignore (do not
   force) targets that are non-blocking or already resolved/waived — but you may still render screens
   that touch them.
2. **Choose a path.** For each forced gap, pick the most defensible path through the
   gap/conflict and build the prototype as if that path were the decision. Ground the choice in the
   evidence (e.g. a quote/locator from the gap's `evidence`).
3. **Record it** in `prototype/manifest.json` as `{ gapId, choice, rationale }` — the rationale is
   the receipt (cite the source moment, e.g. `"kickoff call L19"`).
4. **Surface it in-UI** as a provisional banner that names the gap id, e.g.
   *"Provisional: guest checkout (no account required) · [conflict-001]"*. Every manifest choice MUST
   have a matching visible banner; every banner MUST correspond to a manifest choice.
5. **Interacting choices:** when several forced gaps interact, record all of them; let the UI reflect
   the combined path. Do not silently drop one.

Edge case — **zero targeted blocking gaps** (none given, or all targets non-blocking/resolved): still
generate a runnable prototype, with `choices: []` and **no** provisional banners.

## Output target (HARD CONSTRAINTS)

Write to `prototype/` (scratch — treated as disposable, never hand-edited):

- **`prototype/index.html`** — a **single self-contained** file: inline `<style>` and `<script>`,
  **no network calls of any kind**. Forbidden anywhere in the output: `http://`, `https://`,
  `fetch(`, `XMLHttpRequest`, WebSocket, `import` from a URL, `<script src=…>` / `<link href=…>` to
  any external resource, remote fonts/images. If you need an image, use an inline SVG or a CSS
  shape — never a remote URL. (A static multi-file build is permitted only if a single file is truly
  impractical; even then **no backend, no API routes, no env/secrets, no network**.)
- **All data is inline, SYNTHETIC mock data.** Invent plausible fake content (menu items, prices,
  a fake order number). **Never** embed real client data, and do not copy source `quote` text into
  shippable mock fields.
- **Screens are addressable.** Render each screen as an element carrying a stable, semantic
  `data-screen="<screen-id>"` (e.g. `cart`, `checkout`, `payment`, `confirmation-screen`). Prefer
  semantic ids that survive regeneration, so reactions anchor stably. Navigation between screens is
  client-side only (show/hide or hash — never a server round-trip).

### `prototype/manifest.json` (conform to `src/model/prototype.ts` → `PrototypeManifest`)

```jsonc
{
  "generatedAt": "2026-06-13T10:00:00Z",   // ISO8601
  "targetGapIds": ["conflict-001", "gap-002"],
  "choices": [                              // one per FORCED blocking gap (may be [])
    { "gapId": "conflict-001", "choice": "guest checkout (no account required)", "rationale": "kickoff call L19 — guest checkout a must-have" }
  ],
  "screens": ["cart", "checkout", "payment", "confirmation-screen"]  // every data-screen rendered
}
```

`manifest.screens` MUST list exactly the `data-screen` ids present in `index.html`. `manifest.choices`
MUST match the provisional banners shown in the UI, by gap id.

## Non-goals (this is what "throwaway" means)

- **No** deploy / CI / PR-preview / ephemeral-URL / hosting code — none, anywhere.
- **No** backend, API routes, env vars, or secrets.
- **No** durable versioning; `prototype/` history is disposable.
- **No** external/stakeholder sharing or auth — viewing is local, repo-holders only.

## Quality Bar (self-check before finishing)

- [ ] `index.html` opens and runs with **no** network/backend (grep your own output for the
      forbidden tokens above — zero hits).
- [ ] Every targeted open **blocking** gap has a manifest `choice` **and** a matching visible banner
      naming its gap id; non-blocking/resolved targets were not force-recorded.
- [ ] Zero targeted blocking gaps → `choices: []`, no banners, still runnable.
- [ ] `manifest.json` parses as a valid `PrototypeManifest`; `screens[]` equals the `data-screen`
      ids in the HTML.
- [ ] Mock data is synthetic; no real client data; no source quotes pasted into mock content.
- [ ] The prototype is clickable enough to provoke a reaction (the whole point) — at least the
      forced path is navigable end to end.
