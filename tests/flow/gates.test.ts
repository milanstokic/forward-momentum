import { describe, it, expect } from "vitest";
import {
  canExitExtraction,
  canExitGapAnalysis,
  canExitResolution,
  canExitReview,
  validateWaiver,
  waiverToGateResult,
} from "../../src/flow/gates";
import type { Gap } from "../../src/model/gap";
import type { Waiver } from "../../src/model/waiver";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGap(
  id: string,
  severity: Gap["severity"],
  status: Gap["status"]
): Gap {
  return {
    id,
    kind: "gap",
    severity,
    summary: `Test gap ${id}`,
    relatedClaims: [],
    evidence: [],
    status,
  };
}

function makeValidWaiver(gate: Waiver["gate"] = "Resolution"): Waiver {
  return {
    gate,
    by: "Product",
    reason: "We accept this risk because the client agreed in writing.",
    at: "2024-01-01T00:00:00.000Z",
    acknowledgements: {
      communicatedToClient: true,
      riskAccepted: true,
      revisitScheduled: true,
    },
  };
}

// ---------------------------------------------------------------------------
// canExitExtraction
// ---------------------------------------------------------------------------

describe("canExitExtraction", () => {
  it("passes when sources are acknowledged", () => {
    const result = canExitExtraction(true);
    expect(result.ok).toBe(true);
  });

  it("blocks when no sources have been acknowledged", () => {
    const result = canExitExtraction(false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBeTruthy();
      expect(result.blocking).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// canExitGapAnalysis
// ---------------------------------------------------------------------------

describe("canExitGapAnalysis", () => {
  it("passes when gap report has been produced", () => {
    const result = canExitGapAnalysis(true);
    expect(result.ok).toBe(true);
  });

  it("blocks when gap report has not been produced", () => {
    const result = canExitGapAnalysis(false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBeTruthy();
      expect(result.blocking).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// canExitResolution — the critical hard-blocking gate
// ---------------------------------------------------------------------------

describe("canExitResolution", () => {
  it("passes when gaps array is empty", () => {
    const result = canExitResolution([]);
    expect(result.ok).toBe(true);
  });

  it("passes when all blocking gaps are resolved", () => {
    const gaps = [
      makeGap("g1", "blocking", "resolved"),
      makeGap("g2", "blocking", "deferred"),
      makeGap("g3", "non-blocking", "open"),
    ];
    const result = canExitResolution(gaps);
    expect(result.ok).toBe(true);
  });

  it("passes when all blocking gaps are waived", () => {
    const gaps = [makeGap("g1", "blocking", "waived")];
    const result = canExitResolution(gaps);
    expect(result.ok).toBe(true);
  });

  it("blocks when one blocking gap is open", () => {
    const gaps = [makeGap("g1", "blocking", "open")];
    const result = canExitResolution(gaps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0].id).toBe("g1");
      expect(result.reason).toContain("1 blocking gap");
    }
  });

  it("blocks when multiple blocking gaps are open", () => {
    const gaps = [
      makeGap("g1", "blocking", "open"),
      makeGap("g2", "blocking", "open"),
      makeGap("g3", "blocking", "resolved"),
    ];
    const result = canExitResolution(gaps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocking).toHaveLength(2);
      expect(result.reason).toContain("2 blocking gap");
    }
  });

  it("does NOT block on non-blocking open gaps", () => {
    const gaps = [makeGap("g1", "non-blocking", "open")];
    const result = canExitResolution(gaps);
    expect(result.ok).toBe(true);
  });

  it("returns all blocking open gaps in the blocking array", () => {
    const gaps = [
      makeGap("g1", "blocking", "open"),
      makeGap("g2", "blocking", "resolved"),
      makeGap("g3", "blocking", "open"),
      makeGap("g4", "non-blocking", "open"),
    ];
    const result = canExitResolution(gaps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const ids = result.blocking.map((g) => g.id);
      expect(ids).toContain("g1");
      expect(ids).toContain("g3");
      expect(ids).not.toContain("g2");
      expect(ids).not.toContain("g4");
    }
  });
});

// ---------------------------------------------------------------------------
// canExitReview
// ---------------------------------------------------------------------------

describe("canExitReview", () => {
  it("passes when reviewer passed and human signed off", () => {
    const result = canExitReview(true, true);
    expect(result.ok).toBe(true);
  });

  it("blocks when reviewer has not passed", () => {
    const result = canExitReview(false, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("reviewer");
    }
  });

  it("blocks when human has not signed off", () => {
    const result = canExitReview(true, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("sign-off");
    }
  });

  it("blocks when both reviewer pass and human sign-off are missing", () => {
    const result = canExitReview(false, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("reviewer");
      expect(result.reason).toContain("sign-off");
    }
  });
});

// ---------------------------------------------------------------------------
// validateWaiver — full valid waiver
// ---------------------------------------------------------------------------

describe("validateWaiver — valid waiver", () => {
  it("accepts a fully valid Resolution waiver", () => {
    const waiver = makeValidWaiver("Resolution");
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(true);
  });

  it("accepts a fully valid Review waiver", () => {
    const waiver = makeValidWaiver("Review");
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateWaiver — empty reason
// ---------------------------------------------------------------------------

describe("validateWaiver — empty reason", () => {
  it("rejects a waiver with an empty reason string", () => {
    const waiver = { ...makeValidWaiver(), reason: "" };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons.some((r) => r.includes("reason"))).toBe(true);
    }
  });

  it("rejects a waiver with a whitespace-only reason", () => {
    const waiver = { ...makeValidWaiver(), reason: "   " };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateWaiver — one missing acknowledgement at a time
// ---------------------------------------------------------------------------

describe("validateWaiver — communicatedToClient false", () => {
  it("rejects when communicatedToClient is false", () => {
    const waiver: Waiver = {
      ...makeValidWaiver(),
      acknowledgements: {
        communicatedToClient: false,
        riskAccepted: true,
        revisitScheduled: true,
      },
    };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons.some((r) => r.includes("communicatedToClient"))).toBe(true);
    }
  });
});

describe("validateWaiver — riskAccepted false", () => {
  it("rejects when riskAccepted is false", () => {
    const waiver: Waiver = {
      ...makeValidWaiver(),
      acknowledgements: {
        communicatedToClient: true,
        riskAccepted: false,
        revisitScheduled: true,
      },
    };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons.some((r) => r.includes("riskAccepted"))).toBe(true);
    }
  });
});

describe("validateWaiver — revisitScheduled false", () => {
  it("rejects when revisitScheduled is false", () => {
    const waiver: Waiver = {
      ...makeValidWaiver(),
      acknowledgements: {
        communicatedToClient: true,
        riskAccepted: true,
        revisitScheduled: false,
      },
    };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons.some((r) => r.includes("revisitScheduled"))).toBe(true);
    }
  });
});

describe("validateWaiver — missing authority/timestamp", () => {
  it("rejects when 'by' is empty (no waiver authority recorded)", () => {
    const waiver: Waiver = { ...makeValidWaiver(), by: "" };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons.some((r) => r.includes("'by'"))).toBe(true);
    }
  });

  it("rejects when 'by' is whitespace only", () => {
    const waiver: Waiver = { ...makeValidWaiver(), by: "   " };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
  });

  it("rejects when 'at' is empty (no timestamp recorded)", () => {
    const waiver: Waiver = { ...makeValidWaiver(), at: "" };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons.some((r) => r.includes("'at'"))).toBe(true);
    }
  });
});

describe("validateWaiver — all acknowledgements false", () => {
  it("reports all three missing acknowledgements", () => {
    const waiver: Waiver = {
      ...makeValidWaiver(),
      acknowledgements: {
        communicatedToClient: false,
        riskAccepted: false,
        revisitScheduled: false,
      },
    };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons).toHaveLength(3);
    }
  });
});

describe("validateWaiver — reason missing + acks false", () => {
  it("reports all four failures when reason is empty and all acks are false", () => {
    const waiver: Waiver = {
      ...makeValidWaiver(),
      reason: "",
      acknowledgements: {
        communicatedToClient: false,
        riskAccepted: false,
        revisitScheduled: false,
      },
    };
    const result = validateWaiver(waiver);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasons).toHaveLength(4);
    }
  });
});

// ---------------------------------------------------------------------------
// waiverToGateResult
// ---------------------------------------------------------------------------

describe("waiverToGateResult", () => {
  it("returns ok:true for a valid waiver result", () => {
    const gateResult = waiverToGateResult({ valid: true });
    expect(gateResult.ok).toBe(true);
  });

  it("returns ok:false for an invalid waiver result", () => {
    const gateResult = waiverToGateResult({
      valid: false,
      reasons: ["reason must be non-empty"],
    });
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) {
      expect(gateResult.reason).toContain("Waiver invalid");
      expect(gateResult.blocking).toHaveLength(0);
    }
  });
});
