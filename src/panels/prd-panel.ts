/**
 * PRD Panel — webview that renders BOTH views of the dual-view PRD side by side:
 *   - prd/PRD.md   (human narrative / rationale)
 *   - spec/SPEC.md (machine: testable AC, non-goals, edge cases, contracts)
 *
 * It also surfaces the Review-gate state and exposes a human sign-off action:
 *   - The reviewer-pass half is derived from decisions/prd-review.md
 *     (`Verdict: PASS`).
 *   - The human sign-off half is recorded by this panel via the Review gate
 *     evaluator + store.ts when the user clicks "Sign off".
 *
 * Architecture (matches pipeline-panel.ts / gap-queue-panel.ts):
 *  - Single source of truth = files on disk. The panel re-reads the PRD views,
 *    the review verdict, and .flow/state.json on every "requestState".
 *  - Gate evaluation is delegated to flow/gates.ts (evaluateReviewGate) — no
 *    gate logic is duplicated here.
 *  - State persistence + gate records are delegated to flow/store.ts.
 *  - HTML is built inline (no media assets required) so the orchestrator can
 *    wire it without shipping new media files.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { evaluateReviewGate } from "../flow/gates.js";
import { passGate, advanceStage } from "../flow/state-machine.js";
import { readFlowState, writeFlowState, writeGateRecord } from "../flow/store.js";
import type { FlowState } from "../model/flow-state.js";

// ---------------------------------------------------------------------------
// PrdPanel
// ---------------------------------------------------------------------------

export class PrdPanel {
  public static currentPanel: PrdPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _repoRoot: string;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /** Tracks whether the human has signed off in this session. Persisted to the
   *  flow state once the gate opens, so re-reads survive panel reloads. */
  private _humanSignedOff = false;

  private constructor(
    panel: vscode.WebviewPanel,
    repoRoot: string,
    extensionUri: vscode.Uri
  ) {
    this._panel = panel;
    this._repoRoot = repoRoot;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._buildHtml();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (msg: { type: string }) => this._handleMessage(msg),
      null,
      this._disposables
    );
  }

  // ---------------------------------------------------------------------------
  // Factory — matches the createOrShow signature used by the other panels
  // ---------------------------------------------------------------------------

  public static createOrShow(extensionUri: vscode.Uri, repoRoot: string): PrdPanel {
    const column = vscode.ViewColumn.One;

    if (PrdPanel.currentPanel) {
      PrdPanel.currentPanel._panel.reveal(column);
      return PrdPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "forwardMomentum.prd",
      "Forward Momentum — PRD",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    PrdPanel.currentPanel = new PrdPanel(panel, repoRoot, extensionUri);
    return PrdPanel.currentPanel;
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  private async _handleMessage(msg: { type: string }): Promise<void> {
    switch (msg.type) {
      case "requestState":
        this._sendState();
        break;

      case "signOff":
        await this._signOff();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Human sign-off → Review gate
  // ---------------------------------------------------------------------------

  private async _signOff(): Promise<void> {
    this._humanSignedOff = true;

    const reviewerPassed = this._reviewerPassed();
    const gate = evaluateReviewGate({
      reviewerPassed,
      humanSignedOff: this._humanSignedOff,
    });

    if (!gate.ok) {
      // Sign-off recorded in-session, but the gate is still closed (e.g. the
      // reviewer has not passed yet). Surface why and re-render.
      this._post({
        type: "error",
        text: `Sign-off recorded, but Review gate is still closed: ${gate.reason}`,
      });
      this._sendState();
      return;
    }

    // Both halves satisfied — mark the gate passed, advance, write the record.
    const now = new Date().toISOString();
    let state: FlowState;
    try {
      state = readFlowState(this._repoRoot, now);
    } catch {
      this._sendState();
      return;
    }

    const withGate = passGate(state, "Review", now);
    const advanced = advanceStage(withGate, now);
    const nextState = advanced.ok ? advanced.state : withGate;
    writeFlowState(this._repoRoot, nextState);

    writeGateRecord(this._repoRoot, {
      gate: "Review",
      waived: false,
      passedAt: now,
      passedBy: "prd-panel (human sign-off)",
    });

    this._sendState();
  }

  // ---------------------------------------------------------------------------
  // Reviewer-pass derivation (from decisions/prd-review.md)
  // ---------------------------------------------------------------------------

  /**
   * The reviewer pass is true when decisions/prd-review.md exists and its
   * machine-readable verdict line reads "Verdict: PASS".
   */
  private _reviewerPassed(): boolean {
    const reviewPath = path.join(this._repoRoot, "decisions", "prd-review.md");
    try {
      if (!fs.existsSync(reviewPath)) return false;
      const raw = fs.readFileSync(reviewPath, "utf-8");
      return /^\s*Verdict:\s*PASS\s*$/im.test(raw);
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // State broadcasting
  // ---------------------------------------------------------------------------

  private _sendState(): void {
    const prdHuman = this._readFile("prd/PRD.md");
    const specMachine = this._readFile("spec/SPEC.md");
    const reviewerPassed = this._reviewerPassed();

    // Sign-off is true if recorded this session OR the Review gate is already
    // passed/waived in the persisted flow state.
    let humanSignedOff = this._humanSignedOff;
    let reviewGateStatus = "pending";
    try {
      const state = readFlowState(this._repoRoot, new Date().toISOString());
      reviewGateStatus = state.gates.Review;
      if (state.gates.Review === "passed" || state.gates.Review === "waived") {
        humanSignedOff = true;
      }
    } catch {
      // No flow state — leave defaults.
    }

    const gate = evaluateReviewGate({ reviewerPassed, humanSignedOff });

    this._post({
      type: "update",
      prdHuman,
      specMachine,
      reviewerPassed,
      humanSignedOff,
      reviewGateStatus,
      gateOpen: gate.ok,
      gateReason: gate.ok ? "" : gate.reason,
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _readFile(relPath: string): string {
    try {
      const full = path.join(this._repoRoot, relPath);
      if (!fs.existsSync(full)) {
        return `_(not generated yet: ${relPath} — run /fm-prd)_`;
      }
      return fs.readFileSync(full, "utf-8");
    } catch (err) {
      return `_(error reading ${relPath}: ${err instanceof Error ? err.message : String(err)})_`;
    }
  }

  private _post(msg: Record<string, unknown>): void {
    void this._panel.webview.postMessage(msg);
  }

  // ---------------------------------------------------------------------------
  // HTML builder (inline; no media assets required)
  // ---------------------------------------------------------------------------

  private _buildHtml(): string {
    const nonce = getNonce();
    const cspSource = this._panel.webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Forward Momentum — PRD</title>
  <style nonce="${nonce}">
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
           padding: 0 1rem 2rem; }
    h1 { font-size: 1.2rem; }
    .gate-bar { position: sticky; top: 0; background: var(--vscode-editor-background);
                padding: 0.5rem 0; border-bottom: 1px solid var(--vscode-panel-border);
                display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .badge { padding: 0.1rem 0.5rem; border-radius: 0.6rem; font-size: 0.8rem; }
    .ok { background: var(--vscode-testing-iconPassed, #2d2); color: #000; }
    .pending { background: var(--vscode-testing-iconQueued, #ca0); color: #000; }
    .closed { background: var(--vscode-testing-iconFailed, #d22); color: #fff; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
             border: none; padding: 0.4rem 0.8rem; cursor: pointer; border-radius: 3px; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .views { display: flex; gap: 1rem; align-items: flex-start; }
    .view { flex: 1; min-width: 0; }
    .view h2 { font-size: 1rem; border-bottom: 1px solid var(--vscode-panel-border);
               padding-bottom: 0.25rem; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: var(--vscode-editor-font-family);
          font-size: 0.85rem; background: var(--vscode-textCodeBlock-background); padding: 0.75rem;
          border-radius: 4px; }
    .err { color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <h1>Dual-view PRD</h1>
  <div class="gate-bar">
    <span>Reviewer pass: <span id="reviewerBadge" class="badge pending">…</span></span>
    <span>Human sign-off: <span id="signoffBadge" class="badge pending">…</span></span>
    <span>Review gate: <span id="gateBadge" class="badge pending">…</span></span>
    <button id="signOffBtn">Sign off</button>
    <span id="gateReason" class="err"></span>
  </div>
  <div class="views">
    <section class="view">
      <h2>Human view — prd/PRD.md</h2>
      <pre id="prdHuman">Loading…</pre>
    </section>
    <section class="view">
      <h2>Machine view — spec/SPEC.md</h2>
      <pre id="specMachine">Loading…</pre>
    </section>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function setBadge(el, ok, okText, badText, pendingText) {
      el.className = "badge " + (ok === true ? "ok" : ok === false ? "closed" : "pending");
      el.textContent = ok === true ? okText : ok === false ? badText : pendingText;
    }
    window.addEventListener("message", (event) => {
      const m = event.data;
      if (m.type === "update") {
        document.getElementById("prdHuman").textContent = m.prdHuman;
        document.getElementById("specMachine").textContent = m.specMachine;
        setBadge(document.getElementById("reviewerBadge"), m.reviewerPassed, "PASS", "not passed", "…");
        setBadge(document.getElementById("signoffBadge"), m.humanSignedOff, "signed off", "pending", "…");
        setBadge(document.getElementById("gateBadge"), m.gateOpen, "OPEN", "BLOCKED", "…");
        document.getElementById("gateReason").textContent = m.gateOpen ? "" : (m.gateReason || "");
        document.getElementById("signOffBtn").disabled = m.humanSignedOff === true;
      } else if (m.type === "error") {
        document.getElementById("gateReason").textContent = m.text;
      }
    });
    document.getElementById("signOffBtn").addEventListener("click", () => {
      vscode.postMessage({ type: "signOff" });
    });
    vscode.postMessage({ type: "requestState" });
  </script>
</body>
</html>`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public dispose(): void {
    PrdPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// Nonce helper
// ---------------------------------------------------------------------------

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
