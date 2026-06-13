import * as vscode from "vscode";
import { GapQueuePanel } from "./panels/gap-queue-panel.js";
import { PipelinePanel } from "./panels/pipeline-panel.js";

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
}

// ---------------------------------------------------------------------------
// deactivate
// ---------------------------------------------------------------------------

export function deactivate(): void {
  // Panel instances are disposed via their own onDidDispose handlers
}
