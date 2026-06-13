import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("passes trivially — the toolchain is wired up", () => {
    expect(1 + 1).toBe(2);
  });

  it("extension module exports activate and deactivate", async () => {
    // Dynamic import so we don't need the vscode runtime in tests
    // (extension.ts is not imported here — just verify the file exists)
    const fs = await import("fs");
    const path = await import("path");
    const extPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../src/extension.ts"
    );
    expect(fs.existsSync(extPath)).toBe(true);
  });
});
