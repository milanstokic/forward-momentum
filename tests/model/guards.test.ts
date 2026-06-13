import { describe, it, expect } from "vitest";
import { parseClaims, parseGaps } from "../../src/model/guards.js";

// ---------------------------------------------------------------------------
// parseClaims
// ---------------------------------------------------------------------------

describe("parseClaims", () => {
  const validClaim = {
    id: "claim-001",
    summary: "The system must support SSO via SAML 2.0",
    provenance: [
      {
        sourceFile: "sources/kickoff-call.md",
        locator: "L40-L52",
        quote: "We need SSO via SAML 2.0 for enterprise customers.",
      },
    ],
  };

  it("accepts a valid claims array", () => {
    const result = parseClaims([validClaim]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("claim-001");
      expect(result.data[0].provenance).toHaveLength(1);
    }
  });

  it("accepts multiple valid claims", () => {
    const claim2 = {
      ...validClaim,
      id: "claim-002",
      summary: "The system must export data as CSV",
    };
    const result = parseClaims([validClaim, claim2]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
  });

  it("rejects non-array input", () => {
    const result = parseClaims({ id: "claim-001" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("claims");
    }
  });

  it("rejects a claim with missing id", () => {
    const bad = { ...validClaim, id: "" };
    const result = parseClaims([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("id"))).toBe(true);
    }
  });

  it("rejects a claim with missing summary", () => {
    const bad = { ...validClaim, summary: "  " };
    const result = parseClaims([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("summary"))).toBe(true);
    }
  });

  it("rejects a claim with empty provenance array", () => {
    const bad = { ...validClaim, provenance: [] };
    const result = parseClaims([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("provenance"))).toBe(true);
    }
  });

  it("rejects a claim with malformed provenance entry (missing quote)", () => {
    const bad = {
      ...validClaim,
      provenance: [{ sourceFile: "sources/foo.md", locator: "L1", quote: "" }],
    };
    const result = parseClaims([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("quote"))).toBe(true);
    }
  });

  it("rejects a claim with missing provenance field entirely", () => {
    const bad: Record<string, unknown> = {
      id: validClaim.id,
      summary: validClaim.summary,
      // provenance intentionally omitted
    };
    const result = parseClaims([bad]);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseGaps
// ---------------------------------------------------------------------------

describe("parseGaps", () => {
  const validGap = {
    id: "gap-001",
    kind: "gap",
    severity: "blocking",
    summary: "No SLA defined for the notification system",
    relatedClaims: ["claim-003"],
    evidence: [
      {
        sourceFile: "sources/kickoff-call.md",
        locator: "L80-L85",
        quote: "We'll need an SLA — but nobody put a number on it.",
      },
    ],
    status: "open",
  };

  it("accepts a valid gaps array", () => {
    const result = parseGaps([validGap]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].id).toBe("gap-001");
      expect(result.data[0].kind).toBe("gap");
      expect(result.data[0].severity).toBe("blocking");
      expect(result.data[0].status).toBe("open");
    }
  });

  it("accepts a conflict kind", () => {
    const conflict = { ...validGap, id: "gap-002", kind: "conflict" };
    const result = parseGaps([conflict]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[0].kind).toBe("conflict");
  });

  it("accepts all valid status values", () => {
    const statuses = ["open", "resolved", "deferred", "waived"] as const;
    for (const status of statuses) {
      const result = parseGaps([{ ...validGap, status }]);
      expect(result.ok).toBe(true);
    }
  });

  it("accepts an optional resolution field", () => {
    const withResolution = {
      ...validGap,
      status: "resolved",
      resolution: {
        by: "Product",
        reason: "SLA agreed at 99.9% uptime",
        at: "2026-06-13T10:00:00Z",
      },
    };
    const result = parseGaps([withResolution]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].resolution?.reason).toBe("SLA agreed at 99.9% uptime");
    }
  });

  it("rejects a malformed resolution rather than silently dropping it", () => {
    // A resolved gap whose resolution has empty fields would otherwise parse
    // with resolution: undefined and slip through the Resolution gate with no
    // recorded receipt — a provenance hole. It must error instead.
    const badResolution = {
      ...validGap,
      status: "resolved",
      resolution: { by: "", reason: "", at: "" },
    };
    const result = parseGaps([badResolution]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("resolution"))).toBe(true);
    }
  });

  it("rejects non-array input", () => {
    const result = parseGaps(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe("gaps");
  });

  it("rejects an invalid kind", () => {
    const bad = { ...validGap, kind: "unknown" };
    const result = parseGaps([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("kind"))).toBe(true);
    }
  });

  it("rejects an invalid severity", () => {
    const bad = { ...validGap, severity: "critical" };
    const result = parseGaps([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("severity"))).toBe(true);
    }
  });

  it("rejects an invalid status", () => {
    const bad = { ...validGap, status: "closed" };
    const result = parseGaps([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("status"))).toBe(true);
    }
  });

  it("rejects a gap with missing id", () => {
    const bad = { ...validGap, id: "" };
    const result = parseGaps([bad]);
    expect(result.ok).toBe(false);
  });

  it("rejects a gap with malformed evidence entry", () => {
    const bad = {
      ...validGap,
      evidence: [{ sourceFile: "", locator: "L1", quote: "something" }],
    };
    const result = parseGaps([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("sourceFile"))).toBe(true);
    }
  });

  it("rejects a gap with non-array relatedClaims", () => {
    const bad = { ...validGap, relatedClaims: "claim-001" };
    const result = parseGaps([bad]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("relatedClaims"))).toBe(true);
    }
  });
});
