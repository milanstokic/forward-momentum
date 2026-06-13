import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// AC6 non-goal guard — the Prototype Module must NOT introduce deploy / CI /
// PR-preview / ephemeral-URL / hosting code. We scan the files the module owns
// for implementation-specific markers of those non-goals.
//
// Deliberately specific tokens (hosting providers, CI workflow markers, remote
// schemes) — NOT the generic words "deploy"/"CI", which legitimately appear in
// the skill's own non-goals prose forbidding them.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

const MODULE_FILES = [
  "src/model/prototype.ts",
  "src/prototype/server.ts",
  "src/prototype/reactions-store.ts",
  "src/prototype/review-marker.ts",
  "src/panels/prototype-panel.ts",
  ".claude/skills/fm-prototype/SKILL.md",
  ".claude/commands/fm-prototype.md",
  "examples/sample-engagement/prototype/index.html",
  "examples/sample-engagement/prototype/manifest.json",
];

const FORBIDDEN = [
  "vercel",
  "netlify",
  "ngrok",
  "cloudflare",
  "gh-pages",
  "surge.sh",
  "heroku",
  "fly.io",
  "render.com",
  "firebase deploy",
  "s3://",
  "actions/checkout",
  "pull_request:",
  "workflow_dispatch",
  ".github/workflows",
];

describe("AC6 — no deploy/CI/PR-preview/hosting code introduced by the module", () => {
  for (const rel of MODULE_FILES) {
    const abs = resolve(root, rel);
    it(`exists: ${rel}`, () => {
      expect(existsSync(abs), `expected module file ${rel} to exist`).toBe(true);
    });

    it(`is free of deploy/CI/hosting markers: ${rel}`, () => {
      const text = readFileSync(abs, "utf-8").toLowerCase();
      for (const token of FORBIDDEN) {
        expect(
          text.includes(token.toLowerCase()),
          `${rel} contains forbidden deploy/CI/hosting marker ${JSON.stringify(
            token
          )} — the Prototype Module must not introduce deploy/CI/PR-preview code (AC6).`
        ).toBe(false);
      }
    });
  }

  it("adds no hosting/deploy dependency to package.json", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf-8")
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = Object.keys({
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    });
    const deployish = deps.filter((d) =>
      /vercel|netlify|ngrok|surge|gh-pages|serve-handler|localtunnel|firebase|heroku/i.test(d)
    );
    expect(deployish, `unexpected hosting/deploy deps: ${deployish.join(", ")}`).toEqual([]);
  });

  it("introduces no prototype-related GitHub workflow", () => {
    const wfDir = resolve(root, ".github/workflows");
    if (!existsSync(wfDir)) return; // none at all is fine
    // The only permitted workflow is v1's PRD merge-gate; nothing prototype-y.
    const protoWorkflows = readdirSync(wfDir).filter((f) =>
      /prototype|preview|deploy/i.test(f)
    );
    expect(
      protoWorkflows,
      `prototype module must not add a deploy/preview workflow: ${protoWorkflows.join(", ")}`
    ).toEqual([]);
  });
});
