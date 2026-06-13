/**
 * Prototype Panel — renders the throwaway prototype inside a webview, beside the
 * gap report (ViewColumn.Two), plus an "Open in browser" affordance.
 *
 * Architecture:
 *  - The prototype is self-contained static HTML in the engagement repo under
 *    /prototype/. We serve it on a localhost port (server.ts) and embed it in an
 *    <iframe> via vscode.env.asExternalUri (the robust way to reach a local
 *    server from a webview, incl. remote/tunnel sessions). file:// is avoided.
 *  - The panel owns the server lifecycle: started on open, disposed on close.
 *  - Single source of truth = files on disk; reopening re-reads the manifest.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import { startStaticServer, type StaticServer } from "../prototype/server.js";
import { parseManifest } from "../model/guards.js";
import type { PrototypeManifest } from "../model/prototype.js";

export class PrototypePanel {
  public static currentPanel: PrototypePanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _server: StaticServer;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, server: StaticServer) {
    this._panel = panel;
    this._server = server;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Opens (or reveals) the prototype panel beside the gap report. Returns
   * undefined if no prototype has been generated yet.
   */
  public static async createOrShow(
    repoRoot: string
  ): Promise<PrototypePanel | undefined> {
    const prototypeDir = path.join(repoRoot, "prototype");
    const indexPath = path.join(prototypeDir, "index.html");

    if (!fs.existsSync(indexPath)) {
      void vscode.window.showInformationMessage(
        "Forward Momentum: No prototype found. Generate one first with /fm-prototype <gapId> to break a deadlock."
      );
      return undefined;
    }

    if (PrototypePanel.currentPanel) {
      PrototypePanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
      await PrototypePanel.currentPanel._render(repoRoot, prototypeDir);
      return PrototypePanel.currentPanel;
    }

    const server = await startStaticServer(prototypeDir);
    const panel = vscode.window.createWebviewPanel(
      "forwardMomentum.prototype",
      "Forward Momentum — Prototype",
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const instance = new PrototypePanel(panel, server);
    PrototypePanel.currentPanel = instance;
    await instance._render(repoRoot, prototypeDir);
    return instance;
  }

  /** Best-effort load of the manifest for the banner summary. */
  private _readManifest(prototypeDir: string): PrototypeManifest | undefined {
    try {
      const raw: unknown = JSON.parse(
        fs.readFileSync(path.join(prototypeDir, "manifest.json"), "utf-8")
      );
      const parsed = parseManifest(raw);
      return parsed.ok ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  private async _render(repoRoot: string, prototypeDir: string): Promise<void> {
    const manifest = this._readManifest(prototypeDir);
    // Reach the localhost server from inside the webview/remote.
    const external = await vscode.env.asExternalUri(vscode.Uri.parse(this._server.url));
    this._panel.webview.html = this._buildHtml(external, manifest);
  }

  private _buildHtml(
    frameUri: vscode.Uri,
    manifest: PrototypeManifest | undefined
  ): string {
    const nonce = getNonce();
    const frameOrigin = `${frameUri.scheme}://${frameUri.authority}`;
    const frameSrc = frameUri.toString();

    const banners = (manifest?.choices ?? [])
      .map(
        (c) =>
          `<span class="banner">${escapeHtml(c.choice)} · <strong>[${escapeHtml(
            c.gapId
          )}]</strong></span>`
      )
      .join("");
    const bannerBar = banners
      ? `<div class="banners"><span class="lbl">Provisional:</span>${banners}</div>`
      : `<div class="banners empty">No forced blocking-gap choices in this prototype.</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${frameOrigin}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<style>
  body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); display: flex; flex-direction: column; height: 100vh; }
  .bar { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 12px; }
  .bar .title { font-weight: 600; }
  .bar .scratch { color: var(--vscode-descriptionForeground); }
  .bar button { margin-left: auto; }
  .banners { padding: 6px 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .banners.empty { color: var(--vscode-descriptionForeground); }
  .banners .lbl { color: var(--vscode-descriptionForeground); }
  .banner { border: 1px solid var(--vscode-panel-border); border-radius: 999px; padding: 2px 9px; }
  iframe { flex: 1; width: 100%; border: 0; background: #fff; }
</style>
</head>
<body>
  <div class="bar">
    <span class="title">Prototype</span>
    <span class="scratch">throwaway · regenerate with /fm-prototype</span>
    <button id="reload">Reload</button>
  </div>
  ${bannerBar}
  <iframe id="frame" src="${frameSrc}" title="Prototype"></iframe>
  <script nonce="${nonce}">
    const f = document.getElementById('frame');
    document.getElementById('reload').addEventListener('click', () => {
      // eslint-disable-next-line no-self-assign
      f.src = f.src;
    });
  </script>
</body>
</html>`;
  }

  public dispose(): void {
    PrototypePanel.currentPanel = undefined;
    void this._server.dispose();
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
