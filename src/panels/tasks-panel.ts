/**
 * Tasks Panel — webview listing dispatched design tasks.
 *
 * Architecture (same pattern as pipeline-panel.ts):
 *  - Single source of truth = tasks/dispatch.json on disk.
 *  - Panel reads the file on open and on "requestState" messages.
 *  - Exposes createOrShow(extensionUri, repoRoot) — orchestrator calls this
 *    when registering the forwardMomentum.openTasksPanel command.
 *  - NOT registered in extension.ts / package.json — the orchestrator wires it.
 *
 * UI sections:
 *  1. Dispatched tasks table (populated from dispatch.json)
 *  2. "Linear — coming soon" stub (visible always, clearly labelled)
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { DISPATCH_STATE_FILE } from "../github/dispatch.js";
import type { DispatchState } from "../github/dispatch.js";

// ---------------------------------------------------------------------------
// TasksPanel
// ---------------------------------------------------------------------------

export class TasksPanel {
  public static currentPanel: TasksPanel | undefined;

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
      (msg: { type: string }) => this._handleMessage(msg),
      null,
      this._disposables
    );

    // Send initial state after the webview is ready
    void this._sendState();
  }

  // ---------------------------------------------------------------------------
  // Factory — called by the orchestrator's command registration
  // ---------------------------------------------------------------------------

  /**
   * Create or reveal the Tasks panel.
   *
   * Orchestrator usage:
   *   TasksPanel.createOrShow(context.extensionUri, repoRoot);
   *
   * @param extensionUri  From the extension's activation context.
   * @param repoRoot      Absolute path to the engagement repo.
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    repoRoot: string
  ): TasksPanel {
    const column = vscode.ViewColumn.One;

    if (TasksPanel.currentPanel) {
      TasksPanel.currentPanel._panel.reveal(column);
      return TasksPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "forwardMomentum.tasks",
      "Forward Momentum — Design Tasks",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    TasksPanel.currentPanel = new TasksPanel(panel, repoRoot, extensionUri);
    return TasksPanel.currentPanel;
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  private async _handleMessage(msg: { type: string }): Promise<void> {
    switch (msg.type) {
      case "requestState":
        await this._sendState();
        break;
      // Future: "runDispatch" → trigger /fm-tasks CLI command
    }
  }

  // ---------------------------------------------------------------------------
  // State broadcasting
  // ---------------------------------------------------------------------------

  private async _sendState(): Promise<void> {
    const dispatchState = this._readDispatchState();
    this._post({
      type: "update",
      state: dispatchState,
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _readDispatchState(): DispatchState | null {
    try {
      const filePath = path.join(this._repoRoot, DISPATCH_STATE_FILE);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as DispatchState;
    } catch {
      return null;
    }
  }

  private _post(msg: Record<string, unknown>): void {
    void this._panel.webview.postMessage(msg);
  }

  // ---------------------------------------------------------------------------
  // HTML builder
  // ---------------------------------------------------------------------------

  private _buildHtml(): string {
    const nonce = getNonce();
    const webview = this._panel.webview;

    // CSP: only allow scripts with the nonce + inline styles
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Forward Momentum — Design Tasks</title>
  <style>
    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px 24px;
      margin: 0;
    }
    h1 { font-size: 1.3em; margin-bottom: 4px; }
    h2 { font-size: 1em; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid var(--vscode-panel-border, #444); padding-bottom: 4px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75em;
      font-weight: 600;
      margin-left: 6px;
    }
    .badge-blocking { background: #c53030; color: #fff; }
    .badge-nonblocking { background: #744210; color: #fff; }
    .badge-dryrun { background: #2b4c7e; color: #fff; }
    .badge-live { background: #276749; color: #fff; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      font-size: 0.9em;
    }
    th { font-weight: 600; opacity: 0.8; }
    tr:hover td { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05)); }
    .summary-cell { max-width: 400px; }
    .coming-soon-box {
      border: 1px dashed var(--vscode-panel-border, #555);
      border-radius: 6px;
      padding: 12px 16px;
      opacity: 0.7;
      margin-top: 8px;
    }
    .coming-soon-box p { margin: 4px 0; }
    .empty-state { opacity: 0.6; font-style: italic; margin: 12px 0; }
    a { color: var(--vscode-textLink-foreground, #3794ff); }
    .spinner { display: none; }
    .spinner.active { display: inline; }
  </style>
</head>
<body>
  <h1>Design Tasks</h1>
  <p id="subtitle" style="opacity:0.7; margin-top:0">Dispatched via /fm-tasks to GitHub Projects</p>

  <h2>GitHub Project Tasks</h2>
  <div id="tasks-container">
    <p class="empty-state">Loading…</p>
  </div>

  <h2>Linear — <em>coming soon</em></h2>
  <div class="coming-soon-box">
    <p><strong>Linear integration is not yet available.</strong></p>
    <p>In a future release, design tasks will also be dispatched to a configured Linear project,
       enabling design and product teams to track work in their preferred tool.</p>
    <p style="margin-top:8px; font-size:0.85em; opacity:0.7">
      See SPEC.md §Tech Stack — "Linear — coming soon" stub.
    </p>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function renderTasks(state) {
      const container = document.getElementById('tasks-container');
      if (!state || Object.keys(state).length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks dispatched yet. Run <code>/fm-tasks</code> in the engagement repo to dispatch design gaps to GitHub.</p>';
        return;
      }

      const entries = Object.values(state);
      // Filter to dispatched (not skipped-already-dispatched for duplicate display)
      const dispatched = entries.filter(e => e.status === 'dispatched' || e.status === 'skipped-already-dispatched');
      if (dispatched.length === 0) {
        container.innerHTML = '<p class="empty-state">No design gaps found to dispatch.</p>';
        return;
      }

      let html = '<table>';
      html += '<thead><tr><th>Gap ID</th><th>Summary</th><th>Mode</th><th>Issue</th><th>Dispatched At</th></tr></thead>';
      html += '<tbody>';
      for (const entry of dispatched) {
        const modeBadge = entry.mode === 'live'
          ? '<span class="badge badge-live">live</span>'
          : '<span class="badge badge-dryrun">dry-run</span>';
        const issueCell = entry.issueUrl && entry.issueUrl !== 'dry-run'
          ? (entry.issueNumber
            ? '<a href="' + escHtml(entry.issueUrl) + '" target="_blank">#' + entry.issueNumber + '</a>'
            : '<span style="opacity:0.5">—</span>')
          : (entry.mode === 'dry-run' ? '<em style="opacity:0.5">would create</em>' : '<span style="opacity:0.5">—</span>');
        const dispAt = entry.dispatchedAt ? new Date(entry.dispatchedAt).toLocaleString() : '—';
        const summary = (entry.summary || '').slice(0, 100) + ((entry.summary || '').length > 100 ? '…' : '');
        html += '<tr>';
        html += '<td><code>' + escHtml(entry.gapId) + '</code></td>';
        html += '<td class="summary-cell">' + escHtml(summary) + '</td>';
        html += '<td>' + modeBadge + '</td>';
        html += '<td>' + issueCell + '</td>';
        html += '<td style="font-size:0.8em;opacity:0.7">' + escHtml(dispAt) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function escHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'update') {
        renderTasks(msg.state);
      }
    });

    // Request initial state
    vscode.postMessage({ type: 'requestState' });
  </script>
</body>
</html>`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public dispose(): void {
    TasksPanel.currentPanel = undefined;
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
