# Forward-Momentum — Desktop UI

An Electron desktop app for the Forward-Momentum pipeline: the surface where a team
**reviews the surfaced gaps and clears the Resolution gate** before a PRD can advance.

> Built on the `example-ui/` design prototypes. Role-switching spine; the same gaps,
> the same gate, the same provenance — re-prioritized per role.

## Run it

```bash
npm install
npm run dev        # launches the Electron window with hot reload
npm run build      # production build into out/
```

## The core mechanic — the Resolution gate

A **blocking** gap holds the gate `CLOSED` (orange) while it is still `open`. Resolve (or
defer/route) the last blocking gap and the gate flips `OPEN` (mint), the donut completes,
and the Resolution stage unlocks. This is live everywhere: the donut, the pipeline stepper,
the Developer "quality floor", and the EM scope inspector all read the same store.

Try it: as **Product Manager**, click **Resolve** on both blocking cards → watch the gate open.

## The pipeline (clickable stepper, top bar)

The full 7-stage flow is navigable end-to-end. Stages unlock as you progress:

1. **Intake / Extraction** — done (sources → claims).
2. **Gap analysis** — the 5 role views below (the gap/conflict review surface).
3. **Resolution** — the gate. Clear every blocking gap → it flips OPEN (celebration).
4. **PRD draft** (`fm-prd`) — dual-view PRD (`prd/PRD.md` + `spec/SPEC.md`); every
   assertion ends in a citation and reveals its source/decision on click; a
   traceability meter mirrors the golden test.
5. **Review** (`fm-reviewer`) — the dual-key, hard-blocking Review gate: an
   automated reviewer PASS (traceability / consistency / leakage) **plus** an
   explicit human sign-off. Both required to advance.
6. **Handoff** (`fm-tasks`) — dispatch the design gaps to GitHub Issues
   (live / dry-run, idempotent); conflicts and pure requirement gaps are excluded
   by the documented heuristic. Completes the pipeline.

Each gate is the product's forcing function: nothing advances on a hunch.

## Roles (persona switcher, top bar)

| Role | View | Focus |
|------|------|-------|
| **Product Manager** | Consensus board | Two lanes (Blocking / Non-blocking); resolve drives the gate |
| **Project Manager** | Status & ownership | Who holds the gate, age of oldest blocker, gate-health strip |
| **Engineering Manager** | Scope inspector | Only blocking scope conflicts; head-to-head evidence + "your call" |
| **Developer** | Provenance ledger + machine spec | Every requirement traces to a verbatim source; quality floor blocks handoff |
| **Designer** | Design-task inbox | Well-formed routed tasks; connect a Figma frame back to the PRD |

## Architecture

```
src/
  main/index.ts          Electron main process (window, hiddenInset titlebar)
  preload/index.ts       contextBridge surface (minimal; ready for fs access)
  renderer/src/
    model/types.ts       Core contracts — faithful to the real FM pipeline
                         (Claim, Gap, Provenance). Swap mock → real with no refactor.
    data/checkoutV2.ts   Mock engagement, shaped exactly like analysis/{claims,gaps}.json
    state/store.ts       Zustand store; derives gate state + stage states on every mutation
    components/          Shell, StageStepper, PersonaSwitcher, GateSidebar, GapCard, primitives
    views/               One component per role
```

### Wiring to a real engagement

`model/types.ts` mirrors the `fm-extraction` / `fm-gap-analysis` skill output contracts.
To load a real engagement, replace `data/checkoutV2.ts` with a loader that reads
`analysis/claims.json` + `analysis/gaps.json` (via a new preload IPC channel) and joins
each `Gap` with a `GapView` decoration. The views need no changes.

## Design system

Charcoal `#1C1C1C` dark IDE shell · Geist + Geist Mono. The palette is semantic, not
decorative: **orange** = conflict / blocking / gate CLOSED · **mint** = resolved /
provenance verified / gate OPEN.
