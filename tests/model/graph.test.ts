import { describe, it, expect } from "vitest";
import { validateGraph, extractCitations } from "../../src/model/graph.js";
import type { Claim } from "../../src/model/claim.js";
import type { Gap } from "../../src/model/gap.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const prov = {
  sourceFile: "sources/kickoff-call.md",
  locator: "L40-L52",
  quote: "We need SSO via SAML 2.0 for enterprise customers.",
};

function claim(id: string): Claim {
  return { id, summary: `summary for ${id}`, provenance: [prov] };
}

function gap(overrides: Partial<Gap> & { id: string }): Gap {
  return {
    kind: "gap",
    severity: "blocking",
    summary: `summary for ${overrides.id}`,
    relatedClaims: [],
    evidence: [prov],
    status: "open",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateGraph — happy path
// ---------------------------------------------------------------------------

describe("validateGraph — sound graph", () => {
  it("accepts a graph with resolving edges", () => {
    const result = validateGraph({
      claims: [claim("claim-001"), claim("claim-002")],
      gaps: [gap({ id: "gap-001", relatedClaims: ["claim-001", "claim-002"] })],
      citations: [
        { id: "claim-001", at: "prd/PRD.md:L9" },
        { id: "gap-001", at: "prd/PRD.md:L20" },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts an empty graph", () => {
    expect(validateGraph({ claims: [], gaps: [] }).ok).toBe(true);
  });

  it("does NOT flag orphan claims (uncontested claims are legitimate)", () => {
    const result = validateGraph({
      claims: [claim("claim-001"), claim("claim-002")],
      gaps: [],
    });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dangling edges
// ---------------------------------------------------------------------------

describe("validateGraph — dangling relatedClaims", () => {
  it("flags a gap pointing at a non-existent claim", () => {
    const result = validateGraph({
      claims: [claim("claim-001")],
      gaps: [gap({ id: "gap-001", relatedClaims: ["claim-001", "claim-999"] })],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("gaps[0].relatedClaims[1]");
      expect(result.errors[0].value).toBe("claim-999");
    }
  });
});

describe("validateGraph — dangling citations", () => {
  it("flags a PRD citation to a claim id that does not exist", () => {
    const result = validateGraph({
      claims: [claim("claim-001")],
      gaps: [],
      citations: [{ id: "claim-007", at: "prd/PRD.md:L12" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("prd/PRD.md:L12");
      expect(result.errors[0].value).toBe("claim-007");
    }
  });

  it("accepts a citation to a conflict-id that exists as a gap", () => {
    const result = validateGraph({
      claims: [],
      gaps: [gap({ id: "conflict-001", kind: "conflict" })],
      citations: [{ id: "conflict-001", at: "prd/PRD.md:L30" }],
    });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Duplicate ids
// ---------------------------------------------------------------------------

describe("validateGraph — duplicate ids", () => {
  it("flags duplicate claim ids", () => {
    const result = validateGraph({
      claims: [claim("claim-001"), claim("claim-001")],
      gaps: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe("claims[1].id");
      expect(result.errors[0].value).toBe("claim-001");
    }
  });

  it("flags duplicate gap ids", () => {
    const result = validateGraph({
      claims: [],
      gaps: [gap({ id: "gap-001" }), gap({ id: "gap-001" })],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe("gaps[1].id");
  });
});

// ---------------------------------------------------------------------------
// Resolution invariant (model-stated, guard-unenforced)
// ---------------------------------------------------------------------------

describe("validateGraph — resolution invariant", () => {
  it("flags a waived gap with no resolution record", () => {
    const result = validateGraph({
      claims: [],
      gaps: [gap({ id: "gap-001", status: "waived" })],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe("gaps[0].resolution");
  });

  it("flags a deferred gap with no resolution record", () => {
    const result = validateGraph({
      claims: [],
      gaps: [gap({ id: "gap-001", status: "deferred" })],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a waived gap that carries a resolution record", () => {
    const result = validateGraph({
      claims: [],
      gaps: [
        gap({
          id: "gap-001",
          status: "waived",
          resolution: { by: "PM", reason: "client deferred", at: "2026-06-13T00:00:00Z" },
        }),
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("does not require resolution for open or resolved gaps", () => {
    const result = validateGraph({
      claims: [],
      gaps: [gap({ id: "gap-001", status: "open" }), gap({ id: "gap-002", status: "resolved" })],
    });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multiple violations reported together
// ---------------------------------------------------------------------------

describe("validateGraph — reports all violations at once", () => {
  it("accumulates errors instead of failing on the first", () => {
    const result = validateGraph({
      claims: [claim("claim-001"), claim("claim-001")],
      gaps: [gap({ id: "gap-001", relatedClaims: ["claim-404"], status: "waived" })],
      citations: [{ id: "gap-999", at: "spec/SPEC.md:L4" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain("claims[1].id"); // duplicate
      expect(fields).toContain("gaps[0].relatedClaims[0]"); // dangling
      expect(fields).toContain("gaps[0].resolution"); // missing resolution
      expect(fields).toContain("spec/SPEC.md:L4"); // dangling citation
    }
  });
});

// ---------------------------------------------------------------------------
// extractCitations
// ---------------------------------------------------------------------------

describe("extractCitations", () => {
  it("pulls claim/gap/conflict ids with their line numbers", () => {
    const doc = [
      "# PRD",
      "- Guests can check out. [claim-004 · sources/kickoff-call.md:L19]",
      "- Resolved per decision. [conflict-001 · decisions/x.md]",
      "plain prose with no citation",
      "- Two on one line. [claim-005, gap-002 · sources/n.md:L1]",
    ].join("\n");
    const cites = extractCitations(doc, "prd/PRD.md");
    expect(cites).toEqual([
      { id: "claim-004", at: "prd/PRD.md:L2" },
      { id: "conflict-001", at: "prd/PRD.md:L3" },
      { id: "claim-005", at: "prd/PRD.md:L5" },
      { id: "gap-002", at: "prd/PRD.md:L5" },
    ]);
  });

  it("returns nothing for a document with no citations", () => {
    expect(extractCitations("# Title\njust prose\n", "prd/PRD.md")).toEqual([]);
  });

  it("feeds straight into validateGraph", () => {
    const doc = "- A. [claim-001 · sources/a.md:L1]\n- B. [claim-999 · sources/b.md:L2]";
    const result = validateGraph({
      claims: [claim("claim-001")],
      gaps: [],
      citations: extractCitations(doc, "prd/PRD.md"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].value).toBe("claim-999");
    }
  });
});
