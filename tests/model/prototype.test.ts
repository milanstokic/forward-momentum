import { describe, it, expect } from "vitest";
import { parseManifest, parseReactions } from "../../src/model/guards.js";
import { protoAnchor } from "../../src/model/prototype.js";

// ---------------------------------------------------------------------------
// protoAnchor
// ---------------------------------------------------------------------------

describe("protoAnchor", () => {
  it("builds a prototype@<screen> provenance anchor", () => {
    expect(protoAnchor("confirmation-screen")).toBe(
      "prototype@confirmation-screen"
    );
  });
});

// ---------------------------------------------------------------------------
// parseManifest
// ---------------------------------------------------------------------------

describe("parseManifest", () => {
  const validManifest = {
    generatedAt: "2026-06-13T10:00:00Z",
    targetGapIds: ["gap-001"],
    choices: [
      { gapId: "gap-001", choice: "guest checkout", rationale: "call @06:30" },
    ],
    screens: ["landing", "confirmation-screen"],
  };

  it("accepts a valid manifest", () => {
    const result = parseManifest(validManifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.choices).toHaveLength(1);
      expect(result.data.choices[0].choice).toBe("guest checkout");
      expect(result.data.screens).toContain("confirmation-screen");
    }
  });

  it("accepts a manifest with no forced choices (zero blocking gaps targeted)", () => {
    const result = parseManifest({
      ...validManifest,
      targetGapIds: [],
      choices: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.choices).toHaveLength(0);
  });

  it("accepts interacting choices (multiple forced gaps)", () => {
    const result = parseManifest({
      ...validManifest,
      targetGapIds: ["gap-001", "gap-002"],
      choices: [
        { gapId: "gap-001", choice: "guest checkout", rationale: "call @06:30" },
        { gapId: "gap-002", choice: "email receipt only", rationale: "infer" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.choices).toHaveLength(2);
  });

  it("rejects an array payload", () => {
    const result = parseManifest([validManifest]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe("manifest");
  });

  it("rejects a missing/invalid generatedAt", () => {
    const result = parseManifest({ ...validManifest, generatedAt: "not-a-date" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("generatedAt"))).toBe(true);
    }
  });

  it("rejects non-array targetGapIds", () => {
    const result = parseManifest({ ...validManifest, targetGapIds: "gap-001" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("targetGapIds"))).toBe(true);
    }
  });

  it("rejects non-array screens", () => {
    const result = parseManifest({ ...validManifest, screens: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("screens"))).toBe(true);
    }
  });

  it("rejects a choice missing rationale", () => {
    const result = parseManifest({
      ...validManifest,
      choices: [{ gapId: "gap-001", choice: "guest checkout", rationale: "" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("rationale"))).toBe(true);
    }
  });

  it("rejects a screens array containing a non-string", () => {
    const result = parseManifest({ ...validManifest, screens: ["landing", 7] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("screens"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// parseReactions (JSONL)
// ---------------------------------------------------------------------------

describe("parseReactions", () => {
  const reactionLine = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      id: "react-001",
      author: "product",
      screen: "confirmation-screen",
      text: "where do they make the account Legal wants?",
      ts: "2026-06-13T11:30:00Z",
      ...overrides,
    });

  it("parses a single reaction line", () => {
    const result = parseReactions(reactionLine());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].screen).toBe("confirmation-screen");
      expect(result.data[0].element).toBeUndefined();
    }
  });

  it("parses multiple JSONL lines and ignores blank lines", () => {
    const jsonl = [
      reactionLine({ id: "react-001" }),
      "",
      reactionLine({ id: "react-002", screen: "landing" }),
      "   ",
    ].join("\n");
    const result = parseReactions(jsonl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[1].id).toBe("react-002");
    }
  });

  it("accepts an empty file (no reactions yet)", () => {
    const result = parseReactions("");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(0);
  });

  it("accepts an optional element anchor", () => {
    const result = parseReactions(reactionLine({ element: "#place-order-btn" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[0].element).toBe("#place-order-btn");
  });

  it("round-trips a Reaction through stringify -> parse", () => {
    const original = reactionLine({ element: "#cta" });
    const result = parseReactions(original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.data[0])).toBe(
        JSON.stringify(JSON.parse(original))
      );
    }
  });

  it("reports the line number on a malformed JSON line", () => {
    const jsonl = [reactionLine(), "{ not json"].join("\n");
    const result = parseReactions(jsonl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("line 2"))).toBe(true);
    }
  });

  it("rejects a reaction missing a screen anchor", () => {
    const result = parseReactions(reactionLine({ screen: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("screen"))).toBe(true);
    }
  });

  it("rejects a reaction with a non-ISO ts", () => {
    const result = parseReactions(reactionLine({ ts: "yesterday" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("ts"))).toBe(true);
    }
  });

  it("rejects an empty-string element when the key is present", () => {
    const result = parseReactions(reactionLine({ element: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field.includes("element"))).toBe(true);
    }
  });

  it("rejects a non-string payload", () => {
    const result = parseReactions(42 as unknown as string);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe("reactions");
  });
});
