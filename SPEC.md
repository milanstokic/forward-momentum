# Spec: Forward-Momentum (Hackathon v1)

> Derived from the v0.3 Product Brief. This spec narrows that vision to a **buildable,
> time-boxed hackathon slice** that exercises the riskiest bet first. The brief remains the
> north star; this is the contract for what we build *now*.

## Objective

**An IDE for product development.** A VSCode extension over a git "engagement" repo, driven by
a Claude Code agent pipeline that ingests messy inputs, surfaces conflicts/gaps as a reviewable
artifact, **enforces a gated workflow** to resolve them, composes a traceable dual-view PRD, and
dispatches **design tasks** to GitHub Projects.

**Thesis:** The platform doesn't write PRDs — it *manufactures and records team consensus from
messy inputs*. Each gate is a forced, recorded point of agreement. The PRD is the receipt.

**Users:** an embedded Design + Product + Engineering team. Engineering lives in the IDE; Product
drives the flow through friendly panels; Design is Figma-native and task-driven (receives generated
tasks, returns work as referenced sources).

**Hackathon demo target (decided): the full thin slice.** End-to-end:
`ingest → claims → gap report → human resolution gate → dual-view PRD → reviewer QA → handoff`,
**plus** design-task dispatch to GitHub Projects **and** a git/CI merge-gate backstop. Failure is
acceptable, but it must be *informative* — we exercise the gap-analysis core on real-ish inputs early.

**Success looks like:** a reviewer can replay one sample engagement in the extension, watch the
pipeline produce a gap report, resolve/waive each blocking gap through the UI, generate a PRD whose
every assertion traces back to a source, see design tasks appear on a GitHub Project, and confirm
the PRD PR is *blocked from merge* while a blocking gap is still open.

## Tech Stack

| Layer | Choice |
|---|---|
| UI | VSCode extension (webview panels), **not** a fork |
| Language | **TypeScript only** (extension + glue + flow controller) |
| Agent engine | Claude Code skill-pack (markdown skills/commands/subagents) invoked from the extension via **`claude` CLI subprocess** (v1). Claude Agent SDK for TS deferred to a later phase. |
| Substrate | git; one repo per engagement |
| Task dispatch | **GitHub Projects** (Issues + Project board) on a **dedicated demo project**, via Octokit; auth pre-provisioned so non-eng users do zero setup (see GitHub auth below). "Linear — coming soon" stub in UI |
| CI backstop | GitHub Actions (PRD merge gate) |
| Tests | Vitest (unit/logic) + fixture/golden tests on the sample engagement |
| Bundler | esbuild |

## Commands

```
# Platform repo (this repo)
Install:      npm install
Build:        npm run build          # esbuild bundle of the extension
Watch:        npm run watch          # rebuild on change for Extension Development Host
Test:         npm test               # vitest
Test (watch): npm test -- --watch
Coverage:     npm test -- --coverage
Lint:         npm run lint           # eslint
Lint (fix):   npm run lint -- --fix
Typecheck:    npm run typecheck      # tsc --noEmit
Package:      npm run package        # vsce package -> .vsix

# Run the extension: open this repo in VSCode, press F5 (Extension Development Host),
# then open examples/sample-engagement/ as the workspace.

# Claude Code pipeline commands (the skill-pack, runnable standalone in an engagement repo)
/fm-extract   # sources -> claims with provenance
/fm-gaps      # claims -> gap & conflict report
/fm-prd       # resolved claims -> dual-view PRD
/fm-review    # reviewer QA pass over the PRD
/fm-tasks     # design gaps -> GitHub Project tasks
```

## Project Structure

**Two repos.** This repo is the *platform*; it operates on *engagement* repos.

```
# Platform repo (forward-momentum) ─ what we build
src/
  extension.ts            Extension entry point, command registration
  flow/                   FLOW CONTROLLER — the core IP (build first)
    state-machine.ts      Stages, transitions, gate evaluation (pure, heavily tested)
    gates.ts              Gate definitions + waiver rules
    store.ts              Read/write .flow/state.json in the engagement repo
  agents/                 Claude Agent SDK orchestration (invoke skill-pack, parse outputs)
  panels/                 Webview panels (pipeline, gap queue, resolution, PRD view)
  github/                 GitHub Projects dispatch (Octokit) + "coming soon" stubs
  model/                  Shared TS types: Claim, Gap, GateRecord, Waiver, FlowState
tests/                    Vitest unit tests (flow controller first)
.claude/                  The distributable skill-pack (skills, agents, commands, CLAUDE.md)
examples/
  sample-engagement/      A full engagement repo for dogfooding/demo (see below)
.github/workflows/
  prd-gate.yml            CI backstop: blocks PRD PR merge while blocking gaps are open

# Engagement repo layout (what the extension operates on; examples/sample-engagement mirrors it)
/sources/                 Inputs: transcripts, notes, research, Figma *references*   <-- PUT INPUT FILES HERE
/analysis/                Generated: claims.json (with provenance), gap-report.md     [extends §4 — approved]
/decisions/               ADR-style decision log + gate records + waivers (the receipts)
/prd/                     Human view (rationale/narrative)
/spec/                    Machine view (testable AC, non-goals, edge cases, contracts) for Claude Code
/tasks/                   Generated design tasks + dispatch state
/.flow/state.json         Flow state machine: current stage + per-gate status            [extends §4 — approved]
/.claude/                 Engagement-local skill-pack copy + CLAUDE.md
```

> **Where to put your input files:** `examples/sample-engagement/sources/` — synthetic first, swap in
> a real (redacted) engagement when ready. Same layout works for any future engagement repo.

## Code Style

TypeScript, strict mode. Discriminated unions for domain states; pure functions in the flow
controller (no I/O — that lives in `store.ts`). Named exports, no default exports.

```typescript
// model/gap.ts
export type GapKind = "gap" | "conflict";
export type GapSeverity = "blocking" | "non-blocking";
export type GapStatus = "open" | "resolved" | "deferred" | "waived";

export interface Provenance {
  sourceFile: string;       // e.g. "sources/kickoff-call.md"
  locator: string;          // line range "L40-L52" or timestamp "00:14:30"
  quote: string;            // verbatim excerpt — the receipt
}

export interface Gap {
  id: string;               // "gap-007"
  kind: GapKind;
  severity: GapSeverity;
  summary: string;
  relatedClaims: string[];  // claim ids
  evidence: Provenance[];
  status: GapStatus;
  resolution?: { by: string; reason: string; at: string };  // required for waived/deferred
}

// flow/gates.ts — gate evaluation is pure and total
export function canExitResolution(gaps: Gap[]): GateResult {
  const openBlockers = gaps.filter(g => g.severity === "blocking" && g.status === "open");
  return openBlockers.length === 0
    ? { ok: true }
    : { ok: false, reason: `${openBlockers.length} blocking gap(s) open`, blocking: openBlockers };
}
```

## The Enforced Flow (state machine)

Stages with entry/exit gates; loopbacks allowed; new input re-opens earlier stages. Every gate is
**waivable with a recorded reason** (the waiver is provenance, written to `/decisions/`).

```
Intake → Extraction → GapAnalysis → Resolution → PRDDraft → Review → Handoff
                                        ▲ critical human gate
```

**Gate strictness (decided):**

| Gate (stage exit) | Strictness | Who may waive |
|---|---|---|
| Extraction (sources acknowledged) | waivable-by-default | Product |
| GapAnalysis (gap report produced) | waivable-by-default | Product |
| **Resolution** (all *blocking* gaps resolved/deferred) | **hard-blocking** | Product, structured waiver required |
| **Review** (reviewer agent pass + human sign-off) | **hard-blocking** | Product, structured waiver required |

**Structured waiver** — waiving a hard-blocking gate requires more than free text. The waiver record
(written to `/decisions/`) captures a reason **plus standard acknowledgement checks**, e.g.:

```typescript
// model/waiver.ts
export interface Waiver {
  gate: "Resolution" | "Review";
  by: string;               // role/identity of the waiver authority (Product)
  reason: string;           // required free text
  at: string;               // ISO timestamp
  acknowledgements: {
    communicatedToClient: boolean;   // client has been told about the unresolved gap
    riskAccepted: boolean;           // team explicitly accepts the downstream risk
    revisitScheduled: boolean;       // a follow-up/loopback is planned
  };
}
```
A waiver is only valid when `reason` is non-empty and all required acknowledgements are `true`;
otherwise the gate stays closed. The checklist is itself provenance — the receipt that consensus
(or accepted dissent) was real.

Enforcement is twofold: **UI** (primary — panels won't advance) and **git/CI backstop** (a PRD PR
cannot merge while `/analysis/gap-report.md` has open blocking gaps).

## GitHub auth (demo — zero-setup for non-eng users)

Design tasks dispatch to a **dedicated demo GitHub Project**. Non-engineering users must not have to
configure anything. Approach, least-friction first:

- **Preferred:** a **GitHub App** installed on the demo org, scoped to *only* the demo repo/project
  (issues + projects read/write). The extension ships pointing at the demo project; the app's
  short-lived installation token is minted server-side / at demo setup. Users click, it works.
- **Fallback:** a **fine-grained PAT** scoped to the demo project only, injected at demo time via
  VSCode **SecretStorage** (or an env var read on activation) — **never committed to source**.

The extension reads the destination project config from bundled defaults; the credential is the only
thing provisioned out-of-band, once, by us. **No secret ever lands in the repo or the `.vsix`.**

## Testing Strategy

- **Framework:** Vitest. Tests in `tests/`, mirroring `src/`.
- **Priority 1 — flow controller:** pure-function unit tests for every stage transition and gate
  (including waiver paths and loopback-on-new-input). This is the IP; aim for high coverage here.
- **Priority 2 — agent outputs:** fixture/golden tests against `examples/sample-engagement/` — the
  synthetic corpus contains *deliberately planted* gaps and one conflict; a golden `gap-report.md`
  asserts the gap-analysis agent still catches them. This is the "is the core good enough?" check.
- **Priority 3 — integration smoke:** one test that runs the full pipeline on the sample and asserts
  a PRD is produced with ≥1 traceable provenance link per assertion.
- **Coverage expectation:** flow controller ≥ 90%; overall best-effort given hackathon time.
- Tests are proof — a feature isn't done until verified (per CLAUDE.md).

## Boundaries

- **Always:** run `npm test` + `npm run typecheck` before commits; keep gate logic pure and tested;
  write provenance (source + locator + quote) for every claim and gap; record a reason for every
  waiver; small atomic commits off `main`.
- **Ask first:** adding dependencies; changing the engagement-repo directory convention; changing
  gate strictness or the required waiver acknowledgements; broadening GitHub token/app scope beyond
  the demo project; changing CI gate behavior.
- **Never:** commit secrets, GitHub tokens, or the demo App's private key (credential lives in
  SecretStorage/env, never source or `.vsix`); deep-parse Figma (reference-only in v1); add real-time
  multiplayer / cross-engagement graph / a VSCode fork (all deferred); delete a failing test or a
  recorded waiver to make a gate pass.

## Success Criteria (specific, testable)

1. Opening `examples/sample-engagement/` in the Extension Dev Host shows the pipeline panel at stage `Intake`.
2. Running the pipeline produces `/analysis/claims.json` where every claim has ≥1 `Provenance` entry.
3. `/analysis/gap-report.md` flags the planted gaps **and** the one planted conflict (golden test passes).
4. The Resolution gate **blocks** advancing while any blocking gap is `open`; resolving/deferring all of them unblocks it; a waiver advances it **and** writes a record to `/decisions/`.
5. `/fm-prd` produces a dual-view PRD (`/prd` human + `/spec` machine) with no assertion lacking a provenance link.
6. `/fm-tasks` creates GitHub Issues on a GitHub Project for each design gap; dispatch state is reflected in `/tasks/` and the panel. UI shows "Linear — coming soon."
7. `prd-gate.yml` fails a PR touching `/prd` or `/spec` while a blocking gap is open, and passes once resolved.

## Resolved Decisions (all v0.3 `❓` closed)

1. **Gate strictness** — Resolution + Review hard-block; Product is sole waiver authority; waivers
   require structured acknowledgements (communicated-to-client, risk-accepted, revisit-scheduled).
2. **`/analysis` + `/.flow`** — approved as extensions to the §4 convention.
3. **Agent invocation** — `claude` CLI subprocess for v1; Agent SDK deferred to a later phase.
4. **GitHub Project** — dedicated demo project; auth via pre-provisioned GitHub App (fallback: scoped
   fine-grained PAT in SecretStorage). Zero setup for non-eng users; no secret in source.
5. **Build order** — riskiest-first, confirmed (see Sequencing).
6. **Build process** — use Claude Code **subagents** for parallelizable build work to preserve the
   main context and speed development.

## Sequencing (preview — full plan in the Plan phase)

Per brief §5, point the build at the *learning*, not the plumbing. Delegate parallelizable pieces to
subagents (e.g. panel scaffolding, sample-corpus authoring) while the main thread holds the flow
controller and integration:
1. **Flow controller** (state machine + gates + structured waivers) — pure, tested. The real new IP.
2. **Agent pipeline on the sample** — extraction + gap-analysis; prove the core surfaces planted gaps.
3. **Resolution panel** — the critical human gate, end-to-end with the controller.
4. **PRD generation + reviewer QA** — dual view, traceability.
5. **GitHub Projects dispatch** + UI stub for Linear.
6. **CI merge-gate backstop.**
```
