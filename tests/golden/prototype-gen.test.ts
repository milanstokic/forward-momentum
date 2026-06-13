import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseManifest } from "../../src/model/guards.js";
import type { PrototypeManifest } from "../../src/model/prototype.js";

// ---------------------------------------------------------------------------
// Golden test for the fm-prototype skill (P2). Asserts the static, no-network,
// forced-choice properties (AC1, AC2) on the committed sample prototype, plus
// the AC6 non-goal guard and the zero-blocking-gaps edge case. The sample
// artifact under examples/sample-engagement/prototype/ is the oracle — it is
// what `/fm-prototype conflict-001 gap-002` is expected to produce.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const sampleProto = resolve(here, "../../examples/sample-engagement/prototype");
const noBlockFixture = resolve(here, "../fixtures/prototype/no-blocking");

function load(dir: string): { html: string; manifest: PrototypeManifest } {
  const html = readFileSync(resolve(dir, "index.html"), "utf8");
  const rawManifest: unknown = JSON.parse(
    readFileSync(resolve(dir, "manifest.json"), "utf8")
  );
  const parsed = parseManifest(rawManifest);
  if (!parsed.ok) {
    throw new Error(
      "manifest.json failed model validation:\n" +
        parsed.errors.map((e) => `  ${e.field}: ${e.message}`).join("\n")
    );
  }
  return { html, manifest: parsed.data };
}

// Tokens that would mean the prototype reaches the network or pulls an external
// resource — forbidden anywhere in the output (AC1, AC6).
const FORBIDDEN_NETWORK_TOKENS = [
  "http://",
  "https://",
  "ws://",
  "wss://",
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "navigator.sendBeacon",
  "<script src",
  "<link ",
  "@import",
  'src="//',
  "import(",
];

// Tokens that would mean deploy/CI/preview/backend code crept in (AC6 non-goal guard).
const FORBIDDEN_NONGOAL_TOKENS = [
  "localhost",
  "127.0.0.1",
  "process.env",
  "api/",
  "/deploy",
];

function bannerCount(html: string): number {
  return (html.match(/class="banner"/g) ?? []).length;
}

describe("sample prototype — AC1: self-contained & static (no network)", () => {
  const { html } = load(sampleProto);

  for (const token of FORBIDDEN_NETWORK_TOKENS) {
    it(`contains no network token: ${JSON.stringify(token)}`, () => {
      expect(
        html.includes(token),
        `index.html contains forbidden network token ${JSON.stringify(
          token
        )} — the prototype must be fully self-contained (AC1).`
      ).toBe(false);
    });
  }

  it("inlines its CSS and JS (has <style> and <script> blocks)", () => {
    expect(html).toMatch(/<style>/);
    expect(html).toMatch(/<script>/);
  });
});

describe("sample prototype — AC6: no deploy/CI/preview/backend code", () => {
  const { html } = load(sampleProto);
  for (const token of FORBIDDEN_NONGOAL_TOKENS) {
    it(`contains no non-goal token: ${JSON.stringify(token)}`, () => {
      expect(html.includes(token)).toBe(false);
    });
  }
});

describe("sample prototype — AC2: forced choices recorded AND bannered", () => {
  const { html, manifest } = load(sampleProto);

  it("targeted the expected blocking gaps", () => {
    expect(manifest.targetGapIds).toContain("conflict-001");
    expect(manifest.targetGapIds).toContain("gap-002");
  });

  it("records a non-empty choice for a targeted blocking gap (the forcing function)", () => {
    expect(manifest.choices.length).toBeGreaterThan(0);
    for (const c of manifest.choices) {
      expect(c.gapId.trim().length).toBeGreaterThan(0);
      expect(c.choice.trim().length).toBeGreaterThan(0);
      expect(c.rationale.trim().length).toBeGreaterThan(0);
    }
  });

  it("shows an in-UI provisional banner naming each forced gap id", () => {
    for (const c of manifest.choices) {
      expect(
        html.includes(`[${c.gapId}]`),
        `No provisional banner names forced gap ${c.gapId} — every manifest choice must be surfaced in-UI (AC2).`
      ).toBe(true);
    }
  });

  it("has exactly one banner per recorded choice (no orphan banners)", () => {
    expect(bannerCount(html)).toBe(manifest.choices.length);
  });
});

describe("sample prototype — screens are addressable and match the manifest", () => {
  const { html, manifest } = load(sampleProto);

  it("manifest.screens equals the data-screen ids rendered in the HTML", () => {
    const rendered = [...html.matchAll(/data-screen="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(rendered)).toEqual(new Set(manifest.screens));
  });

  it("includes the confirmation-screen (the post-order payoff used for reaction anchoring)", () => {
    expect(manifest.screens).toContain("confirmation-screen");
    expect(html).toMatch(/data-screen="confirmation-screen"/);
  });
});

describe("edge case — zero targeted blocking gaps still generates a runnable prototype", () => {
  const { html, manifest } = load(noBlockFixture);

  it("manifest has no forced choices", () => {
    expect(manifest.choices).toHaveLength(0);
  });

  it("renders no provisional banners", () => {
    expect(bannerCount(html)).toBe(0);
  });

  it("is still a runnable, navigable, network-free prototype", () => {
    expect(html).toMatch(/data-screen="/);
    expect(html).toMatch(/<script>/);
    for (const token of FORBIDDEN_NETWORK_TOKENS) {
      expect(html.includes(token)).toBe(false);
    }
  });
});
