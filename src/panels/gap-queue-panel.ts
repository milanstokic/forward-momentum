/**
 * Gap Queue Panel — webview listing all gaps from analysis/gaps.json.
 *
 * Per-gap actions:
 *   Resolve  → sets gap.status = "resolved" and rewrites gaps.json
 *   Defer    → sets gap.status = "deferred" and rewrites gaps.json
 *   Waive    → opens the ResolutionFormPanel for structured acknowledgement
 *
 * Gate enforcement:
 *   - Gate status is derived from canExitResolution(gaps) on every update.
 *   - The "Advance" button is disabled while the gate is blocked.
 *   - Advancing calls passGate + advanceStage via the state machine and
 *     writes the result with writeFlowState + writeGateRecord (store.ts).
 *
 * Single source of truth = files on disk. The panel re-reads gaps.json on
 * every "requestState" message from the webview.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { canExitResolution } from "../flow/gates.js";
import { advanceStage, passGate } from "../flow/state-machine.js";
import { readFlowState, writeFlowState, writeGateRecord } from "../flow/store.js";
import type { Gap } from "../model/gap.js";
import { ResolutionFormPanel } from "./resolution-form.js";

// ---------------------------------------------------------------------------
// GapQueuePanel
// ---------------------------------------------------------------------------

export class GapQueuePanel {
  public static currentPanel: GapQueuePanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _repoRoot: string;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

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
      (msg: { type: string; gapId?: string }) => this._handleMessage(msg),
      null,
      this._disposables
    );
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  public static createOrShow(
    extensionUri: vscode.Uri,
    repoRoot: string
  ): GapQueuePanel {
    const column = vscode.ViewColumn.One;

    if (GapQueuePanel.currentPanel) {
      GapQueuePanel.currentPanel._panel.reveal(column);
      return GapQueuePanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "forwardMomentum.gapQueue",
      "Forward Momentum — Gap Queue",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    GapQueuePanel.currentPanel = new GapQueuePanel(panel, repoRoot, extensionUri);
    return GapQueuePanel.currentPanel;
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  private async _handleMessage(msg: { type: string; gapId?: string }): Promise<void> {
    switch (msg.type) {
      case "requestState":
        this._sendState();
        break;

      case "resolveGap":
        if (msg.gapId) {
          this._updateGapStatus(msg.gapId, "resolved");
        }
        break;

      case "deferGap":
        if (msg.gapId) {
          this._updateGapStatus(msg.gapId, "deferred");
        }
        break;

      case "openWaiveForm":
        if (msg.gapId) {
          await this._openWaiveForm(msg.gapId);
        }
        break;

      case "advanceStage":
        this._tryAdvance();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Gap status mutation
  // ---------------------------------------------------------------------------

  private _updateGapStatus(
    gapId: string,
    status: "resolved" | "deferred"
  ): void {
    const gaps = this._readGaps();
    const target = gaps.find((g) => g.id === gapId);
    if (!target) {
      this._post({ type: "error", text: `Gap "${gapId}" not found.` });
      return;
    }

    target.status = status;
    target.resolution = {
      by: "gap-queue-panel",
      reason: status === "deferred" ? "Deferred via gap queue." : "Resolved via gap queue.",
      at: new Date().toISOString(),
    };

    this._writeGaps(gaps);
    this._sendState();
  }

  // ---------------------------------------------------------------------------
  // Waive form
  // ---------------------------------------------------------------------------

  private async _openWaiveForm(gapId: string): Promise<void> {
    const gaps = this._readGaps();
    const gap = gaps.find((g) => g.id === gapId);
    if (!gap) {
      this._post({ type: "error", text: `Gap "${gapId}" not found.` });
      return;
    }

    // Open the resolution form panel; when it completes it posts back a waived
    // gap and writes the waiver record; we then reload state.
    ResolutionFormPanel.createOrShow(
      this._extensionUri,
      this._repoRoot,
      gap,
      () => {
        // On successful waiver, refresh this panel
        this._sendState();
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Advance past Resolution gate
  // ---------------------------------------------------------------------------

  private _tryAdvance(): void {
    const gaps = this._readGaps();
    const gateResult = canExitResolution(gaps);

    if (!gateResult.ok) {
      this._post({
        type: "error",
        text: `Cannot advance: ${gateResult.reason}`,
      });
      return;
    }

    const now = new Date().toISOString();
    let state;
    try {
      state = readFlowState(this._repoRoot, now);
    } catch (err) {
      this._post({ type: "error", text: `Could not read flow state: ${err instanceof Error ? err.message : err}` });
      return;
    }

    // Mark the Resolution gate passed
    const stateWithGate = passGate(state, "Resolution", now);

    // Advance to PRDDraft
    const advanced = advanceStage(stateWithGate, now);
    if (!advanced.ok) {
      this._post({ type: "error", text: `Transition failed: ${advanced.reason}` });
      return;
    }

    writeFlowState(this._repoRoot, advanced.state);
    writeGateRecord(this._repoRoot, {
      gate: "Resolution",
      waived: false,
      passedAt: now,
      passedBy: "gap-queue-panel",
    });

    vscode.window.showInformationMessage(
      "Resolution gate passed — advanced to PRD Draft stage."
    );

    this._sendState();
  }

  // ---------------------------------------------------------------------------
  // State broadcasting
  // ---------------------------------------------------------------------------

  private _sendState(): void {
    const gaps = this._readGaps();
    const gateResult = canExitResolution(gaps);

    this._post({
      type: "update",
      gaps,
      gateResult,
    });
  }

  // ---------------------------------------------------------------------------
  // File I/O helpers
  // ---------------------------------------------------------------------------

  private _gapsPath(): string {
    return path.join(this._repoRoot, "analysis", "gaps.json");
  }

  private _readGaps(): Gap[] {
    try {
      const p = this._gapsPath();
      if (!fs.existsSync(p)) return [];
      const raw = fs.readFileSync(p, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Gap[]) : [];
    } catch {
      return [];
    }
  }

  private _writeGaps(gaps: Gap[]): void {
    const dir = path.dirname(this._gapsPath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this._gapsPath(), JSON.stringify(gaps, null, 2), "utf-8");
  }

  // ---------------------------------------------------------------------------
  // Messaging helpers
  // ---------------------------------------------------------------------------

  private _post(msg: Record<string, unknown>): void {
    void this._panel.webview.postMessage(msg);
  }

  // ---------------------------------------------------------------------------
  // HTML builder
  // ---------------------------------------------------------------------------

  private _buildHtml(): string {
    const webview = this._panel.webview;
    const nonce = getNonce();

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "gap-queue.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "gap-queue.js")
    );

    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "gap-queue.html"
    );
    let html: string;
    try {
      html = fs.readFileSync(htmlPath.fsPath, "utf-8");
    } catch {
      html = "<body><p>Error: could not load gap-queue.html</p></body>";
    }

    return html
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{styleUri\}\}/g, styleUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
      .replace(/\{\{cspNonce\}\}/g, `'nonce-${nonce}'`);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public dispose(): void {
    GapQueuePanel.currentPanel = undefined;
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
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
