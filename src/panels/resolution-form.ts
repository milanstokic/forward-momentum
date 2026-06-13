/**
 * Resolution Form Panel — structured waiver acknowledgement form.
 *
 * Opened by the Gap Queue panel when the user clicks "Waive" on a gap.
 * Collects:
 *   - reason (free text, required)
 *   - acknowledgements.communicatedToClient (boolean, required true)
 *   - acknowledgements.riskAccepted (boolean, required true)
 *   - acknowledgements.revisitScheduled (boolean, required true)
 *
 * On submit:
 *   1. Validates via validateWaiver from gates.ts (server-side authoritative check).
 *   2. If invalid, posts validation errors back to the webview.
 *   3. If valid:
 *      - Marks the gap as "waived" in analysis/gaps.json.
 *      - Writes a waiver record to decisions/ via store.ts.
 *      - Calls the onComplete callback so the Gap Queue panel refreshes.
 *      - Closes itself.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { validateWaiver } from "../flow/gates.js";
import { writeGateRecord, readFlowState, writeFlowState } from "../flow/store.js";
import { waiveGate } from "../flow/state-machine.js";
import type { Gap } from "../model/gap.js";
import type { Waiver } from "../model/waiver.js";

// ---------------------------------------------------------------------------
// ResolutionFormPanel
// ---------------------------------------------------------------------------

interface SubmitMessage {
  type: "submitWaiver";
  reason: string;
  acknowledgements: {
    communicatedToClient: boolean;
    riskAccepted: boolean;
    revisitScheduled: boolean;
  };
}

type IncomingMessage =
  | { type: "ready" }
  | SubmitMessage
  | { type: "cancel" };

export class ResolutionFormPanel {
  public static currentPanel: ResolutionFormPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _repoRoot: string;
  private readonly _extensionUri: vscode.Uri;
  private readonly _gap: Gap;
  private readonly _onComplete: () => void;
  private _disposables: vscode.Disposable[] = [];
  private _disposed = false;

  private constructor(
    panel: vscode.WebviewPanel,
    repoRoot: string,
    extensionUri: vscode.Uri,
    gap: Gap,
    onComplete: () => void
  ) {
    this._panel = panel;
    this._repoRoot = repoRoot;
    this._extensionUri = extensionUri;
    this._gap = gap;
    this._onComplete = onComplete;

    this._panel.webview.html = this._buildHtml();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (msg: IncomingMessage) => this._handleMessage(msg),
      null,
      this._disposables
    );
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  public static createOrShow(
    extensionUri: vscode.Uri,
    repoRoot: string,
    gap: Gap,
    onComplete: () => void
  ): ResolutionFormPanel {
    const column = vscode.ViewColumn.Two;

    if (ResolutionFormPanel.currentPanel) {
      ResolutionFormPanel.currentPanel._panel.dispose();
    }

    const panel = vscode.window.createWebviewPanel(
      "forwardMomentum.resolutionForm",
      `Waive Gap — ${gap.id}`,
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    ResolutionFormPanel.currentPanel = new ResolutionFormPanel(
      panel,
      repoRoot,
      extensionUri,
      gap,
      onComplete
    );
    return ResolutionFormPanel.currentPanel;
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  private _handleMessage(msg: IncomingMessage): void {
    switch (msg.type) {
      case "ready":
        // Send gap context to the webview
        this._post({
          type: "init",
          gap: { id: this._gap.id, summary: this._gap.summary },
        });
        break;

      case "submitWaiver":
        this._handleSubmit(msg);
        break;

      case "cancel":
        this.dispose();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Waiver submission
  // ---------------------------------------------------------------------------

  private _handleSubmit(msg: SubmitMessage): void {
    const now = new Date().toISOString();

    const waiver: Waiver = {
      gate: "Resolution",
      by: "resolution-form-panel",
      reason: msg.reason,
      at: now,
      acknowledgements: {
        communicatedToClient: msg.acknowledgements.communicatedToClient,
        riskAccepted: msg.acknowledgements.riskAccepted,
        revisitScheduled: msg.acknowledgements.revisitScheduled,
      },
    };

    // Authoritative server-side validation
    const validation = validateWaiver(waiver);
    if (!validation.valid) {
      this._post({
        type: "validationErrors",
        errors: validation.reasons,
      });
      return;
    }

    // Mark the gap as waived in gaps.json
    const gapUpdateOk = this._markGapWaived(now, msg.reason);
    if (!gapUpdateOk) return;

    // Write the waiver record to decisions/ via store.ts
    writeGateRecord(this._repoRoot, {
      gate: "Resolution",
      waived: true,
      waiver,
      passedAt: now,
      passedBy: "resolution-form-panel",
    });

    // Update gate status in .flow/state.json to "waived" (if still at Resolution)
    try {
      const state = readFlowState(this._repoRoot, now);
      if (state.currentStage === "Resolution" || state.gates.Resolution === "pending" || state.gates.Resolution === "blocked") {
        const updated = waiveGate(state, "Resolution", now);
        writeFlowState(this._repoRoot, updated);
      }
    } catch {
      // Non-fatal: state update failure shouldn't block the waiver receipt
    }

    this._post({
      type: "success",
      text: `Gap ${this._gap.id} waived. Waiver written to decisions/.`,
    });

    // Notify the gap queue panel to refresh
    this._onComplete();

    // Close after a short delay so the user sees the success message
    setTimeout(() => this.dispose(), 1500);
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

  private _markGapWaived(at: string, reason: string): boolean {
    const gaps = this._readGaps();
    const target = gaps.find((g) => g.id === this._gap.id);
    if (!target) {
      this._post({
        type: "error",
        text: `Gap "${this._gap.id}" not found in gaps.json.`,
      });
      return false;
    }

    target.status = "waived";
    target.resolution = {
      by: "resolution-form-panel",
      reason,
      at,
    };

    try {
      const dir = path.dirname(this._gapsPath());
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        this._gapsPath(),
        JSON.stringify(gaps, null, 2),
        "utf-8"
      );
      return true;
    } catch (err) {
      this._post({
        type: "error",
        text: `Failed to write gaps.json: ${err instanceof Error ? err.message : err}`,
      });
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Messaging helper
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
      vscode.Uri.joinPath(this._extensionUri, "media", "resolution-form.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "resolution-form.js")
    );

    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "resolution-form.html"
    );
    let html: string;
    try {
      html = fs.readFileSync(htmlPath.fsPath, "utf-8");
    } catch {
      html = "<body><p>Error: could not load resolution-form.html</p></body>";
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
    // Idempotent: createOrShow disposes the old panel, which synchronously
    // fires onDidDispose -> dispose() again. Guard against re-entering so we
    // never call _panel.dispose() on an already-disposed webview.
    if (this._disposed) return;
    this._disposed = true;
    ResolutionFormPanel.currentPanel = undefined;
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
