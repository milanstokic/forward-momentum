import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { GapQueuePanel } from "./panels/gap-queue-panel.js";
import { PipelinePanel } from "./panels/pipeline-panel.js";
import { PrototypePanel } from "./panels/prototype-panel.js";
import { startStaticServer, type StaticServer } from "./prototype/server.js";

// Servers started for "open in browser" viewing. A self-contained single-file
// prototype needs no server after load, but a multi-file build does — so we keep
// them alive until the extension deactivates rather than disposing eagerly.
const browserServers: StaticServer[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the root of the first workspace folder, or undefined. */
function getRepoRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  return folders[0].uri.fsPath;
}

function requireRepoRoot(): string | undefined {
  const root = getRepoRoot();
  if (!root) {
    void vscode.window.showErrorMessage(
      "Forward Momentum: No workspace folder is open. Open an engagement repo first."
    );
  }
  return root;
}

// ---------------------------------------------------------------------------
// activate
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // Hello (bootstrap smoke test)
  context.subscriptions.push(
    vscode.commands.registerCommand("forwardMomentum.hello", () => {
      vscode.window.showInformationMessage(
        "Forward Momentum is active — let's build something traceable."
      );
    })
  );

  // Open Pipeline Panel
  context.subscriptions.push(
    vscode.commands.registerCommand("forwardMomentum.openPipeline", () => {
      const root = requireRepoRoot();
      if (!root) return;
      PipelinePanel.createOrShow(context.extensionUri, root);
    })
  );

  // Open Gap Queue Panel
  context.subscriptions.push(
    vscode.commands.registerCommand("forwardMomentum.openGapQueue", () => {
      const root = requireRepoRoot();
      if (!root) return;
      GapQueuePanel.createOrShow(context.extensionUri, root);
    })
  );

  // Open Prototype Panel (webview, beside the gap report)
  context.subscriptions.push(
    vscode.commands.registerCommand("forwardMomentum.openPrototype", async () => {
      const root = requireRepoRoot();
      if (!root) return;
      await PrototypePanel.createOrShow(root);
    })
  );

  // Open Prototype in the default browser (preferred over file://)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "forwardMomentum.openPrototypeInBrowser",
      async () => {
        const root = requireRepoRoot();
        if (!root) return;
        const prototypeDir = path.join(root, "prototype");
        if (!fs.existsSync(path.join(prototypeDir, "index.html"))) {
          void vscode.window.showInformationMessage(
            "Forward Momentum: No prototype found. Generate one first with /fm-prototype <gapId>."
          );
          return;
        }
        const server = await startStaticServer(prototypeDir);
        browserServers.push(server);
        const external = await vscode.env.asExternalUri(
          vscode.Uri.parse(server.url)
        );
        await vscode.env.openExternal(external);
      }
    )
  );
}

// ---------------------------------------------------------------------------
// deactivate
// ---------------------------------------------------------------------------

export function deactivate(): void {
  // Panel instances are disposed via their own onDidDispose handlers.
  // Tear down any browser-viewing servers still listening.
  for (const server of browserServers.splice(0)) {
    void server.dispose();
  }
}
