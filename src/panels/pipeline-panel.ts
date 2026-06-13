/**
 * Pipeline Panel — webview that shows the current pipeline stage, gate statuses,
 * claim/gap counts, and buttons to run /fm-extract and /fm-gaps.
 *
 * Architecture:
 *  - Single source of truth = files on disk. The panel reads .flow/state.json,
 *    analysis/claims.json, and analysis/gaps.json; re-reads when it receives a
 *    "requestState" message from the webview or when it is first opened.
 *  - CLI operations are delegated to cli-runner.ts.
 *  - Gate marking and state persistence are delegated to store.ts.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { runCliCommand, type RunCliOptions } from "../agents/cli-runner.js";
import { canExitExtraction, canExitGapAnalysis } from "../flow/gates.js";
import { passGate, advanceStage } from "../flow/state-machine.js";
import { readFlowState, writeFlowState, writeGateRecord } from "../flow/store.js";
import type { FlowState } from "../model/flow-state.js";

// ---------------------------------------------------------------------------
// PipelinePanel
// ---------------------------------------------------------------------------

export class PipelinePanel {
  public static currentPanel: PipelinePanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _repoRoot: string;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /** Injectable runner — allows tests to swap in a mock. */
  private readonly _runCliOptions: Partial<RunCliOptions>;

  private constructor(
    panel: vscode.WebviewPanel,
    repoRoot: string,
    extensionUri: vscode.Uri,
    runCliOptions: Partial<RunCliOptions> = {}
  ) {
    this._panel = panel;
    this._repoRoot = repoRoot;
    this._extensionUri = extensionUri;
    this._runCliOptions = runCliOptions;

    this._panel.webview.html = this._buildHtml();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (msg: { type: string }) => this._handleMessage(msg),
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
    runCliOptions: Partial<RunCliOptions> = {}
  ): PipelinePanel {
    const column = vscode.ViewColumn.One;

    if (PipelinePanel.currentPanel) {
      PipelinePanel.currentPanel._panel.reveal(column);
      return PipelinePanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "forwardMomentum.pipeline",
      "Forward Momentum — Pipeline",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    PipelinePanel.currentPanel = new PipelinePanel(
      panel,
      repoRoot,
      extensionUri,
      runCliOptions
    );
    return PipelinePanel.currentPanel;
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  private async _handleMessage(msg: { type: string }): Promise<void> {
    switch (msg.type) {
      case "requestState":
        await this._sendState();
        break;

      case "runExtract":
        await this._runStep("/fm-extract", "Extraction");
        break;

      case "runGaps":
        await this._runStep("/fm-gaps", "GapAnalysis");
        break;

      case "openGapQueue":
        await vscode.commands.executeCommand("forwardMomentum.openGapQueue");
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline step execution
  // ---------------------------------------------------------------------------

  private async _runStep(
    command: "/fm-extract" | "/fm-gaps",
    gate: "Extraction" | "GapAnalysis"
  ): Promise<void> {
    this._post({ type: "running", command });
    this._postLog(`Starting ${command}…`);

    try {
      const result = await runCliCommand(command, {
        cwd: this._repoRoot,
        ...this._runCliOptions,
      });

      if (result.stdout) this._postLog(result.stdout);
      if (result.stderr) this._postLog(`[stderr] ${result.stderr}`);

      if (!result.ok) {
        this._post({
          type: "error",
          text: `${command} exited with code ${result.exitCode}. See log for details.`,
        });
        this._postLog(`${command} failed (exit ${result.exitCode}).`);
      } else {
        this._postLog(`${command} completed successfully.`);
        // Mark the gate as passed and advance if eligible
        await this._markGatePassed(gate, command);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: "error", text: `${command} error: ${msg}` });
      this._postLog(`Error: ${msg}`);
    }

    this._post({ type: "done", command });
    await this._sendState();
  }

  // ---------------------------------------------------------------------------
  // Gate passage
  // ---------------------------------------------------------------------------

  private async _markGatePassed(
    gate: "Extraction" | "GapAnalysis",
    _command: string
  ): Promise<void> {
    const now = new Date().toISOString();
    let state: FlowState;
    try {
      state = readFlowState(this._repoRoot, now);
    } catch {
      return; // Can't read state — skip marking
    }

    // Evaluate the gate condition
    let gateOk = false;
    if (gate === "Extraction") {
      const claimsExist = fs.existsSync(
        path.join(this._repoRoot, "analysis", "claims.json")
      );
      gateOk = canExitExtraction(claimsExist).ok;
    } else if (gate === "GapAnalysis") {
      const gapsExist = fs.existsSync(
        path.join(this._repoRoot, "analysis", "gaps.json")
      );
      gateOk = canExitGapAnalysis(gapsExist).ok;
    }

    if (!gateOk) return;

    // Mark gate passed in state
    const stateWithGate = passGate(state, gate, now);

    // Try to advance the stage
    const advanced = advanceStage(stateWithGate, now);
    const nextState = advanced.ok ? advanced.state : stateWithGate;

    writeFlowState(this._repoRoot, nextState);

    // Write a gate record to decisions/
    writeGateRecord(this._repoRoot, {
      gate,
      waived: false,
      passedAt: now,
      passedBy: "pipeline-panel",
    });
  }

  // ---------------------------------------------------------------------------
  // State broadcasting
  // ---------------------------------------------------------------------------

  private async _sendState(): Promise<void> {
    const now = new Date().toISOString();
    let state: FlowState;
    try {
      state = readFlowState(this._repoRoot, now);
    } catch (err) {
      this._postLog(`Warning: could not read flow state — ${err instanceof Error ? err.message : err}`);
      return;
    }

    const claimCount = this._readJsonArrayLength("analysis/claims.json");
    const gapCount = this._readJsonArrayLength("analysis/gaps.json");

    this._post({
      type: "update",
      state: { ...state, claimCount, gapCount },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _readJsonArrayLength(relPath: string): number {
    try {
      const fullPath = path.join(this._repoRoot, relPath);
      if (!fs.existsSync(fullPath)) return 0;
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }

  private _post(msg: Record<string, unknown>): void {
    void this._panel.webview.postMessage(msg);
  }

  private _postLog(text: string): void {
    this._post({ type: "log", text });
  }

  // ---------------------------------------------------------------------------
  // HTML builder
  // ---------------------------------------------------------------------------

  private _buildHtml(): string {
    const webview = this._panel.webview;
    const nonce = getNonce();

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "pipeline.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "pipeline.js")
    );

    // Read the HTML template and substitute tokens
    const htmlPath = vscode.Uri.joinPath(this._extensionUri, "media", "pipeline.html");
    let html: string;
    try {
      html = fs.readFileSync(htmlPath.fsPath, "utf-8");
    } catch {
      html = "<body><p>Error: could not load pipeline.html</p></body>";
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
    PipelinePanel.currentPanel = undefined;
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
