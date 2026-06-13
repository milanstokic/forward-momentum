/**
 * Prototype Panel — renders the throwaway prototype inside a webview, beside the
 * gap report (ViewColumn.Two), with an "Open in browser" affordance and a
 * reaction-capture drawer.
 *
 * Architecture:
 *  - The prototype is self-contained static HTML in the engagement repo under
 *    /prototype/. We serve it on a localhost port (server.ts) and embed it in an
 *    <iframe> via vscode.env.asExternalUri (robust localhost-in-webview path;
 *    file:// avoided), opened beside the gap report.
 *  - The iframe is a separate (localhost) origin, so the webview cannot observe
 *    clicks inside it. Reactions therefore anchor to a screen chosen from a
 *    dropdown (manifest.screens) + an optional free-text element, and are
 *    appended to /prototype/reactions.jsonl via reactions-store.
 *  - Single source of truth = files on disk; the panel owns the server lifecycle.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import { startStaticServer, type StaticServer } from "../prototype/server.js";
import {
  appendReaction,
  readReactions,
} from "../prototype/reactions-store.js";
import { parseManifest } from "../model/guards.js";
import type { PrototypeManifest, Reaction } from "../model/prototype.js";

interface AddReactionMessage {
  type: "addReaction";
  screen: string;
  element?: string;
  text: string;
}
interface RequestReactionsMessage {
  type: "requestReactions";
}
type InboundMessage = AddReactionMessage | RequestReactionsMessage;

export class PrototypePanel {
  public static currentPanel: PrototypePanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _server: StaticServer;
  private readonly _prototypeDir: string;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    server: StaticServer,
    prototypeDir: string
  ) {
    this._panel = panel;
    this._server = server;
    this._prototypeDir = prototypeDir;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg: InboundMessage) => void this._handleMessage(msg),
      null,
      this._disposables
    );
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
      await PrototypePanel.currentPanel._render();
      return PrototypePanel.currentPanel;
    }

    const server = await startStaticServer(prototypeDir);
    const panel = vscode.window.createWebviewPanel(
      "forwardMomentum.prototype",
      "Forward Momentum — Prototype",
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const instance = new PrototypePanel(panel, server, prototypeDir);
    PrototypePanel.currentPanel = instance;
    await instance._render();
    return instance;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  private async _handleMessage(msg: InboundMessage): Promise<void> {
    switch (msg.type) {
      case "addReaction":
        try {
          appendReaction(this._prototypeDir, {
            author: currentAuthor(),
            screen: msg.screen,
            element: msg.element,
            text: msg.text,
          });
        } catch (err) {
          void vscode.window.showErrorMessage(
            `Forward Momentum: could not save reaction — ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        this._sendReactions();
        break;
      case "requestReactions":
        this._sendReactions();
        break;
    }
  }

  private _sendReactions(): void {
    let reactions: Reaction[] = [];
    try {
      reactions = readReactions(this._prototypeDir);
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Forward Momentum: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    void this._panel.webview.postMessage({ type: "reactions", items: reactions });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private _readManifest(): PrototypeManifest | undefined {
    try {
      const raw: unknown = JSON.parse(
        fs.readFileSync(path.join(this._prototypeDir, "manifest.json"), "utf-8")
      );
      const parsed = parseManifest(raw);
      return parsed.ok ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  private async _render(): Promise<void> {
    const manifest = this._readManifest();
    const external = await vscode.env.asExternalUri(
      vscode.Uri.parse(this._server.url)
    );
    this._panel.webview.html = this._buildHtml(external, manifest);
    this._sendReactions();
  }

  private _buildHtml(
    frameUri: vscode.Uri,
    manifest: PrototypeManifest | undefined
  ): string {
    const nonce = getNonce();
    const frameOrigin = `${frameUri.scheme}://${frameUri.authority}`;
    const frameSrc = frameUri.toString();
    const screens = manifest?.screens ?? [];

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

    const screenOptions = screens
      .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
      .join("");
    const screenField = screens.length
      ? `<select id="screen">${screenOptions}</select>`
      : `<input id="screen" placeholder="screen id" />`;

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
  iframe { flex: 1; width: 100%; border: 0; background: #fff; min-height: 240px; }
  .drawer { border-top: 1px solid var(--vscode-panel-border); display: flex; flex-direction: column; max-height: 42vh; }
  .drawer h3 { margin: 0; padding: 8px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--vscode-descriptionForeground); }
  .form { display: flex; gap: 6px; padding: 0 12px 8px; flex-wrap: wrap; align-items: flex-start; }
  .form select, .form input, .form textarea { font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; padding: 5px 7px; }
  .form textarea { flex: 1; min-width: 180px; min-height: 38px; resize: vertical; }
  .form .anchor { font-size: 11px; color: var(--vscode-descriptionForeground); width: 100%; }
  button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 4px; padding: 6px 12px; cursor: pointer; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .list { overflow: auto; padding: 0 12px 12px; }
  .reaction { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; font-size: 13px; }
  .reaction .meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px; }
  .reaction .tag { font-family: var(--vscode-editor-font-family, monospace); }
  .empty-list { color: var(--vscode-descriptionForeground); font-size: 12px; padding: 4px 0 10px; }
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
  <div class="drawer">
    <h3>Reactions</h3>
    <div class="form">
      ${screenField}
      <input id="element" placeholder="element (optional)" />
      <textarea id="text" placeholder="What does clicking this surface? (e.g. 'as a guest, how do they find this order again?')"></textarea>
      <button id="add">Add reaction</button>
      <div class="anchor" id="anchor-preview"></div>
    </div>
    <div class="list" id="list"><div class="empty-list">No reactions yet.</div></div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const $ = (id) => document.getElementById(id);
    const frame = $('frame');

    $('reload').addEventListener('click', () => { frame.src = frame.src; });

    function updateAnchor() {
      const screen = $('screen').value || '<screen>';
      $('anchor-preview').textContent = 'Will anchor to: prototype@' + screen;
    }
    $('screen').addEventListener('change', updateAnchor);
    $('screen').addEventListener('input', updateAnchor);
    updateAnchor();

    $('add').addEventListener('click', () => {
      const screen = $('screen').value.trim();
      const element = $('element').value.trim();
      const text = $('text').value.trim();
      if (!screen || !text) return;
      vscode.postMessage({ type: 'addReaction', screen, element: element || undefined, text });
      $('text').value = '';
      $('element').value = '';
    });

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function render(items) {
      const list = $('list');
      if (!items.length) { list.innerHTML = '<div class="empty-list">No reactions yet.</div>'; return; }
      list.innerHTML = items.map((r) => {
        const anchor = 'prototype@' + r.screen + (r.element ? (' · ' + escapeHtml(r.element)) : '');
        return '<div class="reaction">' + escapeHtml(r.text) +
          '<div class="meta"><span class="tag">' + escapeHtml(anchor) + '</span> — ' +
          escapeHtml(r.author) + ' · ' + escapeHtml(r.ts) + '</div></div>';
      }).join('');
    }

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg && msg.type === 'reactions') render(msg.items || []);
    });

    vscode.postMessage({ type: 'requestReactions' });
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

/** Reaction author — a single-user-demo config string (defaults to "product"). */
function currentAuthor(): string {
  const configured = vscode.workspace
    .getConfiguration("forwardMomentum")
    .get<string>("author");
  return configured && configured.trim().length > 0 ? configured.trim() : "product";
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
