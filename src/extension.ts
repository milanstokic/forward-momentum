import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "forwardMomentum.hello",
    () => {
      vscode.window.showInformationMessage(
        "Forward Momentum is active — let's build something traceable."
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // No cleanup needed for the bootstrap command
}
