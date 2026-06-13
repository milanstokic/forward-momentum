import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writePrototypeReviewMarker,
  hasPrototypeReviewMarker,
} from "../../src/prototype/review-marker.js";
import { canExitResolution } from "../../src/flow/gates.js";
import type { Gap } from "../../src/model/gap.js";

function gap(id: string, severity: Gap["severity"], status: Gap["status"]): Gap {
  return {
    id,
    kind: "gap",
    severity,
    summary: `${id} summary`,
    relatedClaims: [],
    evidence: [{ sourceFile: "sources/x.md", locator: "L1", quote: "q" }],
    status,
  };
}

describe("writePrototypeReviewMarker", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fm-review-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a non-blocking marker into decisions/", () => {
    const p = writePrototypeReviewMarker(dir, {
      reviewedBy: "product",
      at: "2026-06-13T12:00:00Z",
    });
    expect(existsSync(p)).toBe(true);
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("Non-blocking");
    expect(content).toContain("product");
    expect(hasPrototypeReviewMarker(dir)).toBe(true);
  });

  it("reports no marker before one is written", () => {
    expect(hasPrototypeReviewMarker(dir)).toBe(false);
  });
});

describe("the soft marker does NOT gate Resolution (non-blocking by construction)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fm-review-gate-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("an open blocking gap blocks Resolution whether or not a marker exists", () => {
    const gaps = [gap("conflict-001", "blocking", "open")];
    expect(canExitResolution(gaps).ok).toBe(false);

    writePrototypeReviewMarker(dir, { reviewedBy: "product", at: "2026-06-13T12:00:00Z" });
    // Marker is irrelevant to the gate — still blocked by the open blocker.
    expect(canExitResolution(gaps).ok).toBe(false);
  });

  it("resolved blockers clear Resolution without any marker present", () => {
    const gaps = [gap("conflict-001", "blocking", "resolved")];
    expect(hasPrototypeReviewMarker(dir)).toBe(false);
    expect(canExitResolution(gaps).ok).toBe(true);
  });

  it("a marker neither helps nor hinders a cleared gate (orthogonal signal)", () => {
    const gaps = [gap("conflict-001", "blocking", "resolved")];
    const before = canExitResolution(gaps).ok;
    writePrototypeReviewMarker(dir, { reviewedBy: "product", at: "2026-06-13T12:00:00Z" });
    const after = canExitResolution(gaps).ok;
    expect(after).toBe(before);
    expect(after).toBe(true);
  });
});
