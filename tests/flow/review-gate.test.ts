import { describe, it, expect } from "vitest";
import { evaluateReviewGate } from "../../src/flow/gates";
import type { Waiver } from "../../src/model/waiver";

// ---------------------------------------------------------------------------
// Unit tests for the composite Review-gate evaluator (T11).
//
// The Review gate is HARD-BLOCKING. It opens only when EITHER:
//   (a) reviewer passed AND human signed off, OR
//   (b) a VALID Review-scoped structured waiver is supplied.
// ---------------------------------------------------------------------------

function validReviewWaiver(): Waiver {
  return {
    gate: "Review",
    by: "Product",
    reason: "Client agreed in writing to ship with the open review note tracked as follow-up.",
    at: "2026-06-13T00:00:00.000Z",
    acknowledgements: {
      communicatedToClient: true,
      riskAccepted: true,
      revisitScheduled: true,
    },
  };
}

describe("evaluateReviewGate — normal path", () => {
  it("passes when reviewer passed AND human signed off", () => {
    const result = evaluateReviewGate({ reviewerPassed: true, humanSignedOff: true });
    expect(result.ok).toBe(true);
  });

  it("blocks without a reviewer pass", () => {
    const result = evaluateReviewGate({ reviewerPassed: false, humanSignedOff: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("reviewer");
    }
  });

  it("blocks without a human sign-off", () => {
    const result = evaluateReviewGate({ reviewerPassed: true, humanSignedOff: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("sign-off");
    }
  });

  it("blocks when both reviewer pass and sign-off are missing", () => {
    const result = evaluateReviewGate({ reviewerPassed: false, humanSignedOff: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("reviewer");
      expect(result.reason).toContain("sign-off");
    }
  });
});

describe("evaluateReviewGate — waiver path", () => {
  it("opens with a valid Review-scoped waiver even when reviewer/sign-off are missing", () => {
    const result = evaluateReviewGate({
      reviewerPassed: false,
      humanSignedOff: false,
      waiver: validReviewWaiver(),
    });
    expect(result.ok).toBe(true);
  });

  it("stays closed when the waiver has an empty reason", () => {
    const waiver = { ...validReviewWaiver(), reason: "" };
    const result = evaluateReviewGate({
      reviewerPassed: false,
      humanSignedOff: false,
      waiver,
    });
    expect(result.ok).toBe(false);
  });

  it("stays closed when an acknowledgement is missing", () => {
    const waiver: Waiver = {
      ...validReviewWaiver(),
      acknowledgements: {
        communicatedToClient: true,
        riskAccepted: false,
        revisitScheduled: true,
      },
    };
    const result = evaluateReviewGate({
      reviewerPassed: false,
      humanSignedOff: false,
      waiver,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a waiver scoped to a different gate (Resolution)", () => {
    const waiver: Waiver = { ...validReviewWaiver(), gate: "Resolution" };
    const result = evaluateReviewGate({
      reviewerPassed: false,
      humanSignedOff: false,
      waiver,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Resolution");
    }
  });

  it("a valid waiver opens the gate regardless of the normal-path inputs", () => {
    // Even with reviewer passed but no sign-off, a valid waiver opens it.
    const result = evaluateReviewGate({
      reviewerPassed: true,
      humanSignedOff: false,
      waiver: validReviewWaiver(),
    });
    expect(result.ok).toBe(true);
  });
});
