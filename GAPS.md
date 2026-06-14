# Forward-Momentum — Known Gaps & Follow-ups

Status snapshot for **v0.2.0** (standalone desktop app on Claude Code). These are the
known gaps, limitations, and deferred items — not bugs that block the demo, but the
work between "demo-ready" and "production handoff." Priorities: **P1** blocks real-world
use beyond the bundled sample, **P2** important for a polished handoff, **P3** nice-to-have.

Local working doc — not committed/pushed.

---

## 1. Agent runtime / Claude Code

| # | Gap | Pri | Detail | Fix |
|---|-----|-----|--------|-----|
| 1.1 | `/fm-*` commands must resolve for the opened engagement | **P1** | Inside this repo the project `.claude/` provides them; an external engagement folder opened on its own won't have `/fm-extract` etc., so "Run in Claude Code" fails. | On open, install/copy the `fm-*` commands into the engagement's `.claude/`, or document installing them globally in `~/.claude/`. |
| 1.2 | Packaged-app `claude` PATH resolution | **P2** | `fixPath()` prepends common bin dirs (`~/.local/bin`, `/usr/local/bin`, `/opt/homebrew/bin`) so packaged launches usually find `claude`. A non-standard install location still ENOENTs. | Make the `claude` path configurable (setting/env), or resolve via `which` at startup and store it. |
| 1.3 | No live output streaming | **P2** | `runStage` runs `claude … --print` and returns on completion; the UI shows running → done/error but not the agent's live token stream. | Stream stdout over IPC (`webContents.send`) into a transcript surface. |
| 1.4 | Thin error surfacing on agent failure | **P3** | On non-zero exit the `AgentRunBar` shows stderr/exit code, but there's no actionable guidance (e.g. "claude not found", "command missing"). | Classify common failures and show remediation hints. |

## 2. GitHub / Handoff dispatch

| # | Gap | Pri | Detail | Fix |
|---|-----|-----|--------|-----|
| 2.1 | Live GitHub dispatch not wired (dry-run only) | **P1** | `desktop/src/main/dispatch.ts` writes a real `tasks/dispatch.json` but always as dry-run; a "live" request degrades to dry-run. No issues are actually created. | Add `@octokit/rest` to `desktop/`, wire the core `github/dispatch` live path, inject a token. |
| 2.2 | No GitHub auth / token storage | **P1** | `store.connectGitHub()` only flips `dispatchMode` to `'live'` (cosmetic). No real OAuth/token, no `safeStorage` secret. | Implement token via Electron `safeStorage` (or env), surface a connect flow. |

## 3. Packaging / distribution

| # | Gap | Pri | Detail | Fix |
|---|-----|-----|--------|-----|
| 3.1 | macOS arm64 only | **P1** | `npm run dist` builds the local platform/arch. The published `.dmg` is Apple-Silicon mac; Intel mac (`x64`), Windows (`nsis`), Linux (`AppImage`) are unbuilt. electron-builder can't cross-compile mac↔win. | Add a CI matrix (GitHub Actions on mac+win+linux) that builds all targets and uploads on tag push. |
| 3.2 | Unsigned / unnotarized builds | **P1** | `identity: null` — macOS Gatekeeper blocks first launch (right-click → Open). Windows would warn too. | Add an Apple Developer ID signing identity + notarization; a Windows code-signing cert. |
| 3.3 | No automated release pipeline | **P2** | Releases are manual (`npm run dist` + `gh release upload`, or `npm run release`). No `.github/workflows/release.yml`. | Add a release workflow triggered on `v*` tags. |
| 3.4 | Auto-update not configured | **P3** | No `electron-updater` / update feed; users re-download installers. | Wire `electron-updater` against the GitHub releases feed. |

## 4. UX / data fidelity

| # | Gap | Pri | Detail | Fix |
|---|-----|-----|--------|-----|
| 4.1 | No in-app "Add source" | **P2** | The Intake screen lists `sources/` but you add files to the folder on disk manually; no file picker/drag-drop import. | Add an `addSource` intent (copy picked files into `sources/`). |
| 4.2 | Single engagement at a time | **P3** | "Open engagement" swaps the current one; no recents list or multi-window. | Add a recents list / multi-window support. |
| 4.3 | Designer acceptance criteria are demo content | **P3** | `metaFor()` returns authored criteria for the sample gaps and a generic fallback otherwise — not real per-gap acceptance for arbitrary engagements. | Derive acceptance from the gap/PRD, or let designers edit it. |
| 4.4 | Mock-flavored copy in some views | **P3** | `DeveloperView` keys on `gap-002` (SLA/`REQ-014` framing); the Designer "watching" panel and some labels are hardcoded sample content — semantically off (not crashing) on other engagements. | Derive these from the live engagement or drop them. |
| 4.5 | Early-stage gates auto-pass on run | **P3** | Running `/fm-extract`/`/fm-gaps` auto-advances the flow through the waivable Extraction/GapAnalysis gates (`advanceFlowForStage`). Intentional, but the early gates are effectively non-enforcing. | Confirm this is the desired policy; expose if those gates should ever block. |

## 5. Testing

| # | Gap | Pri | Detail | Fix |
|---|-----|-----|--------|-----|
| 5.1 | Desktop has no formal test runner | **P2** | Verification is via `desktop/scripts/verify-*.mjs` (esbuild-bundled headless checks), not vitest. The root core *does* have vitest tests. | Add vitest to `desktop/` and port the verify scripts into proper tests; add a renderer component test or two. |
| 5.2 | No live `claude` integration test | **P3** | `ClaudeCodeRunner` is proven with a mock spawn; the real `claude` invocation path is exercised manually. | Add an opt-in (network/auth-gated) integration test that runs one real stage. |
| 5.3 | No CI | **P2** | No automated typecheck/build/test on push or PR. | Add a CI workflow. |

## 6. Docs / housekeeping

| # | Gap | Pri | Detail | Fix |
|---|-----|-----|--------|-----|
| 6.1 | `desktop/WIRING-PLAN.md` is stale | **P3** | Still references the omnigent runtime (shelved) as the agent backend; the shipped design uses Claude Code via `cli-runner`. | Update or annotate it to match the shipped architecture. |
| 6.2 | Inline demo video deferred | **P3** | README links to YouTube (GitHub can't embed an inline player from a URL); inline playback needs a GitHub-hosted asset. | Optional: upload the `.mov`/`.mp4` to a GitHub comment for a `user-attachments` URL and embed it. |
| 6.3 | Legacy VS Code extension retained | — | Intentional: marked legacy, not deleted. Listed for awareness, not action. | Delete once the desktop app is fully validated, if desired. |

---

## Top priorities for production handoff (P1)

1. **`/fm-*` commands available in any opened engagement** (1.1) — otherwise the agent only works inside this repo.
2. **Live GitHub dispatch + token storage** (2.1, 2.2) — Handoff is dry-run today.
3. **Multi-platform, signed builds via CI** (3.1, 3.2) — the only published artifact is an unsigned mac-arm64 `.dmg`.
