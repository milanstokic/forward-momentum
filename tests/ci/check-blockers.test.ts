import { describe, it, expect } from "vitest";
import { hasOpenBlockers, parseGapsFile } from "../../src/ci/check-blockers";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A gaps array that contains an open blocking gap — should trigger a block. */
const GAPS_WITH_OPEN_BLOCKER = [
  {
    id: "conflict-001",
    kind: "conflict",
    severity: "blocking" as const,
    summary:
      "Account model contradiction: guest checkout vs. required sign-in.",
    relatedClaims: ["claim-004", "claim-009"],
    evidence: [],
    status: "open" as const,
  },
  {
    id: "gap-001",
    kind: "gap",
    severity: "blocking" as const,
    summary: "Saved-card behavior is explicitly parked and never resolved.",
    relatedClaims: ["claim-008"],
    evidence: [],
    status: "open" as const,
  },
  {
    id: "gap-003",
    kind: "gap",
    severity: "non-blocking" as const,
    summary: "Order-confirmation screen design not provided.",
    relatedClaims: ["claim-011"],
    evidence: [],
    status: "open" as const,
  },
];

/**
 * A clean gaps array: all blocking gaps are resolved/deferred/waived,
 * some non-blocking gaps remain open — should NOT trigger a block.
 */
const GAPS_CLEAN = [
  {
    id: "conflict-001",
    kind: "conflict",
    severity: "blocking" as const,
    summary: "Account model contradiction — now resolved.",
    relatedClaims: ["claim-004", "claim-009"],
    evidence: [],
    status: "resolved" as const,
    resolution: {
      by: "Product",
      reason: "Decision: guest checkout ships; account linking is optional.",
      at: "2026-06-13T10:00:00Z",
    },
  },
  {
    id: "gap-001",
    kind: "gap",
    severity: "blocking" as const,
    summary: "Saved-card behavior — deferred to v1.1.",
    relatedClaims: ["claim-008"],
    evidence: [],
    status: "deferred" as const,
    resolution: {
      by: "Product",
      reason: "Deferred to post-launch; saved cards not in v1 scope.",
      at: "2026-06-13T10:00:00Z",
    },
  },
  {
    id: "gap-002",
    kind: "gap",
    severity: "blocking" as const,
    summary: "Failed-payment error state design missing — waived.",
    relatedClaims: ["claim-010"],
    evidence: [],
    status: "waived" as const,
    resolution: {
      by: "Product",
      reason: "Temporary text fallback accepted; design will follow in sprint 2.",
      at: "2026-06-13T10:00:00Z",
    },
  },
  {
    id: "gap-003",
    kind: "gap",
    severity: "non-blocking" as const,
    summary: "Order-confirmation screen design not provided.",
    relatedClaims: ["claim-011"],
    evidence: [],
    status: "open" as const,
  },
  {
    id: "gap-004",
    kind: "gap",
    severity: "non-blocking" as const,
    summary: "Promo / discount code handling not specified.",
    relatedClaims: ["claim-012"],
    evidence: [],
    status: "open" as const,
  },
];

// ---------------------------------------------------------------------------
// hasOpenBlockers — pure function tests
// ---------------------------------------------------------------------------

describe("hasOpenBlockers", () => {
  it("returns blocked=true when there are open blocking gaps", () => {
    const result = hasOpenBlockers(GAPS_WITH_OPEN_BLOCKER);
    expect(result.blocked).toBe(true);
  });

  it("includes only the open blocking gaps in offenders", () => {
    const result = hasOpenBlockers(GAPS_WITH_OPEN_BLOCKER);
    // conflict-001 and gap-001 are blocking+open; gap-003 is non-blocking+open
    expect(result.offenders).toHaveLength(2);
    expect(result.offenders.map((g) => g.id).sort()).toEqual([
      "conflict-001",
      "gap-001",
    ]);
  });

  it("reports the correct total", () => {
    const result = hasOpenBlockers(GAPS_WITH_OPEN_BLOCKER);
    expect(result.total).toBe(3);
  });

  it("returns blocked=false when all blockers are resolved/deferred/waived", () => {
    const result = hasOpenBlockers(GAPS_CLEAN);
    expect(result.blocked).toBe(false);
  });

  it("returns no offenders for a clean set", () => {
    const result = hasOpenBlockers(GAPS_CLEAN);
    expect(result.offenders).toHaveLength(0);
  });

  it("reports the correct total for a clean set", () => {
    const result = hasOpenBlockers(GAPS_CLEAN);
    expect(result.total).toBe(5);
  });

  it("returns blocked=false for an empty array", () => {
    const result = hasOpenBlockers([]);
    expect(result.blocked).toBe(false);
    expect(result.total).toBe(0);
  });

  it("does NOT block on an open non-blocking gap alone", () => {
    const nonBlockingOnly = [
      {
        id: "gap-003",
        severity: "non-blocking" as const,
        status: "open" as const,
        summary: "Some non-blocking gap",
      },
    ];
    const result = hasOpenBlockers(nonBlockingOnly);
    expect(result.blocked).toBe(false);
    expect(result.offenders).toHaveLength(0);
  });

  it("does NOT block on a blocking gap that is resolved", () => {
    const resolvedBlocker = [
      {
        id: "gap-001",
        severity: "blocking" as const,
        status: "resolved" as const,
        summary: "Resolved blocker",
      },
    ];
    const result = hasOpenBlockers(resolvedBlocker);
    expect(result.blocked).toBe(false);
  });

  it("does NOT block on a blocking gap that is deferred", () => {
    const deferredBlocker = [
      {
        id: "gap-001",
        severity: "blocking" as const,
        status: "deferred" as const,
        summary: "Deferred blocker",
      },
    ];
    const result = hasOpenBlockers(deferredBlocker);
    expect(result.blocked).toBe(false);
  });

  it("does NOT block on a blocking gap that is waived", () => {
    const waivedBlocker = [
      {
        id: "gap-001",
        severity: "blocking" as const,
        status: "waived" as const,
        summary: "Waived blocker",
      },
    ];
    const result = hasOpenBlockers(waivedBlocker);
    expect(result.blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseGapsFile — file I/O + validation tests
// ---------------------------------------------------------------------------

describe("parseGapsFile", () => {
  /** Write a temp JSON file and return its path. */
  function writeTempJson(content: unknown): string {
    const dir = join(tmpdir(), `fm-ci-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "gaps.json");
    writeFileSync(path, JSON.stringify(content), "utf-8");
    return path;
  }

  it("parses a valid gaps file with open blockers", () => {
    const path = writeTempJson(GAPS_WITH_OPEN_BLOCKER);
    const result = parseGapsFile(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gaps).toHaveLength(3);
    }
  });

  it("parses a valid clean gaps file", () => {
    const path = writeTempJson(GAPS_CLEAN);
    const result = parseGapsFile(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gaps).toHaveLength(5);
    }
  });

  it("parses an empty array successfully", () => {
    const path = writeTempJson([]);
    const result = parseGapsFile(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gaps).toHaveLength(0);
    }
  });

  it("fails when the file does not exist", () => {
    const result = parseGapsFile("/nonexistent/path/gaps.json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Cannot read file/);
    }
  });

  it("fails when the file is not valid JSON", () => {
    const dir = join(tmpdir(), `fm-ci-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "gaps.json");
    writeFileSync(path, "{ not json }", "utf-8");
    const result = parseGapsFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not valid JSON/);
    }
  });

  it("fails when the file contains a JSON object instead of an array", () => {
    const path = writeTempJson({ id: "gap-001" });
    const result = parseGapsFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/must contain a JSON array/);
    }
  });

  it("fails when a gap item has an invalid severity", () => {
    const bad = [{ ...GAPS_WITH_OPEN_BLOCKER[0], severity: "critical" }];
    const path = writeTempJson(bad);
    const result = parseGapsFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/severity/);
    }
  });

  it("fails when a gap item has an invalid status", () => {
    const bad = [{ ...GAPS_WITH_OPEN_BLOCKER[0], status: "closed" }];
    const path = writeTempJson(bad);
    const result = parseGapsFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/status/);
    }
  });

  it("fails when a gap item is missing an id", () => {
    const bad = [{ ...GAPS_WITH_OPEN_BLOCKER[0], id: "" }];
    const path = writeTempJson(bad);
    const result = parseGapsFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/id/);
    }
  });

  it("fails when a gap item is not an object", () => {
    const bad = ["not-an-object"];
    const path = writeTempJson(bad);
    const result = parseGapsFile(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not an object/);
    }
  });

  it("round-trips: parsed gaps from open-blocker fixture trigger hasOpenBlockers", () => {
    const path = writeTempJson(GAPS_WITH_OPEN_BLOCKER);
    const parseResult = parseGapsFile(path);
    expect(parseResult.ok).toBe(true);
    if (parseResult.ok) {
      const { blocked } = hasOpenBlockers(parseResult.gaps);
      expect(blocked).toBe(true);
    }
  });

  it("round-trips: parsed gaps from clean fixture do not trigger hasOpenBlockers", () => {
    const path = writeTempJson(GAPS_CLEAN);
    const parseResult = parseGapsFile(path);
    expect(parseResult.ok).toBe(true);
    if (parseResult.ok) {
      const { blocked } = hasOpenBlockers(parseResult.gaps);
      expect(blocked).toBe(false);
    }
  });
});
