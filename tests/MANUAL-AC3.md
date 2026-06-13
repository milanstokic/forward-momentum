# Manual verification — AC3 (prototype viewing)

> AC3 is the one acceptance criterion that can't be checked headlessly: the webview render
> and the live commands only run inside the VS Code **Extension Development Host**. The
> server/data path beneath them *is* covered automatically by `tests/prototype/server.test.ts`
> (loopback serving, content-types, traversal guard, port release). This checklist covers the
> GUI half a reviewer should tick off before merge.

## AC3 — "A repo-holder with the extension can view the current prototype via both open-in-browser and webview, with no deploy and no credentials."

### Setup
- [ ] Open the **platform repo** (this repo) in VS Code.
- [ ] Press **F5** → an Extension Development Host window launches.
- [ ] In the dev host, open the folder `examples/sample-engagement/` as the workspace.
- [ ] (If no prototype is present) run **Forward Momentum: Open Prototype in Browser** and confirm it prompts to generate one — or use the committed sample under `examples/sample-engagement/prototype/`.

### Open in browser
- [ ] Run **Forward Momentum: Open Prototype in Browser** (Command Palette).
- [ ] The default browser opens to a `http://127.0.0.1:<port>/` URL (localhost, **not** `file://`).
- [ ] The prototype loads with **no login / no credentials prompt**.
- [ ] Two provisional banners are visible: `guest checkout … [conflict-001]` and `inline declined-payment error … [gap-002]`.
- [ ] Click through cart → checkout → payment → confirmation. Toggle "Simulate a declined card" and confirm the inline error state appears.

### Webview (beside the gap report)
- [ ] Run **Forward Momentum: Open Prototype (webview)**.
- [ ] The prototype renders inside a VS Code webview panel in the second column (beside the gap report).
- [ ] The provisional-banner summary shows at the top of the panel.
- [ ] No deploy step was required and no credentials were entered at any point.

### Reaction round-trip (P4 + P5b)
- [ ] In the webview's **Reactions** drawer, pick a screen (e.g. `confirmation-screen`), type a comment, and click **Add reaction**.
- [ ] Confirm a new line appears in `examples/sample-engagement/prototype/reactions.jsonl`.
- [ ] Open the **Gap Queue** and click **⟳ Re-run gap analysis (with reactions)**.
- [ ] A reaction-derived gap appears tagged with a `prototype@confirmation-screen` badge (and a `stale-anchor` badge if the anchored screen is absent from the regenerated prototype).

### Non-goal sanity (AC6, by eye)
- [ ] At no point did viewing require a deploy, an external/ephemeral URL, a hosting service, or any auth.
