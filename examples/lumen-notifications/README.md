# Fresh Engagement — Lumen Notification Center v1

A **pre-extraction** fixture: only `sources/` exist. Nothing has been extracted, no gaps surfaced,
no PRD drafted. The flow is parked at **Extraction** so the app shows the `▶ Run in Claude Code`
bar (→ `/fm-extract`) and the Intake screen's run controls on load.

Use it to demo the front of the pipeline end-to-end:

1. **Extraction** — run `/fm-extract` → writes `analysis/claims.json`.
2. **GapAnalysis** — run `/fm-gaps` → writes `analysis/gaps.json` + `gap-report.md`.
3. From there the engagement behaves like the others (Resolution gate, PRD draft, …).

**Lumen** is a (fictional) docs-collaboration SaaS. It has email notifications only; this engagement
is the Q3 build of an in-app notification center (bell + live feed). The sources carry a few natural
tensions — e.g. realtime called "non-negotiable" vs. flagged as the bulk of the effort, in-app vs.
email double-notification left unresolved, retention window and badge-count undecided — so
`/fm-gaps` has real material to surface.

> Everything here is synthetic. The `analysis/`, `prd/`, `spec/`, etc. dirs are empty (`.gitkeep`)
> until you run the pipeline.
