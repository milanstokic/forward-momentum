import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseGaps, parseReactions } from "../../src/model/guards.js";
import type { Gap } from "../../src/model/gap.js";

// ---------------------------------------------------------------------------
// Golden test for P5a — reaction → gap (the wedge).
//
// Models a /fm-gaps run on the sample WITH prototype/reactions.jsonl present.
//   baseline  = examples/sample-engagement/analysis/gaps.json  (sources only)
//   augmented = tests/fixtures/prototype/reaction-run/gaps.json (baseline + reactions folded in)
//
// Proves AC4 (a reaction is an input to the next run, tagged prototype@<screen>)
// and AC5 (a reaction produces a NEW gap absent from all text sources) — the
// latter by asserting the new gap is present in `augmented` but absent from
// `baseline`, so it is novelty, not a restatement.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const sampleDir = resolve(here, "../../examples/sample-engagement");
const baselinePath = resolve(sampleDir, "analysis/gaps.json");
const reactionsPath = resolve(sampleDir, "prototype/reactions.jsonl");
const augmentedPath = resolve(here, "../fixtures/prototype/reaction-run/gaps.json");

function loadGaps(path: string): Gap[] {
  const parsed = parseGaps(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.ok) {
    throw new Error(
      `${path} failed model validation:\n` +
        parsed.errors.map((e) => `  ${e.field}: ${e.message}`).join("\n")
    );
  }
  return parsed.data;
}

const baseline = loadGaps(baselinePath);
const augmented = loadGaps(augmentedPath);

function haystack(g: Gap): string {
  return [g.summary, ...g.evidence.map((e) => `${e.quote} ${e.locator} ${e.sourceFile}`)]
    .join(" ")
    .toLowerCase();
}

/** A gap "covers" a topic if its text contains ALL discriminating keywords. */
function covers(gaps: Gap[], keywords: string[]): Gap | undefined {
  return gaps.find((g) => {
    const hay = haystack(g);
    return keywords.every((k) => hay.includes(k.toLowerCase()));
  });
}

function hasProtoEvidence(g: Gap): boolean {
  return g.evidence.some((e) => e.locator.startsWith("prototype@"));
}

describe("input fixture — prototype/reactions.jsonl", () => {
  const parsed = parseReactions(readFileSync(reactionsPath, "utf8"));

  it("parses as a valid Reaction[]", () => {
    expect(parsed.ok).toBe(true);
  });

  it("includes reactions anchored to the confirmation screen", () => {
    if (!parsed.ok) throw new Error("reactions invalid");
    expect(parsed.data.length).toBeGreaterThanOrEqual(1);
    expect(parsed.data.some((r) => r.screen === "confirmation-screen")).toBe(true);
  });
});

describe("AC4 — a captured reaction is an input to the next gap-analysis run", () => {
  it("at least one augmented gap carries prototype@<screen> provenance", () => {
    const tagged = augmented.filter(hasProtoEvidence);
    expect(tagged.length).toBeGreaterThan(0);
    for (const g of tagged) {
      const anchor = g.evidence.find((e) => e.locator.startsWith("prototype@"))!;
      expect(anchor.locator).toMatch(/^prototype@[\w-]+$/);
    }
  });

  it("the reaction text is folded in verbatim as evidence", () => {
    const parsed = parseReactions(readFileSync(reactionsPath, "utf8"));
    if (!parsed.ok) throw new Error("reactions invalid");
    const allQuotes = augmented.flatMap((g) => g.evidence.map((e) => e.quote));
    for (const r of parsed.data) {
      expect(
        allQuotes.some((q) => q.includes(r.text)),
        `reaction ${r.id} was not folded into any gap's evidence`
      ).toBe(true);
    }
  });
});

describe("AC5 — a reaction produces a NEW gap absent from all text sources", () => {
  // The "no post-purchase order access for guests" gap from Appendix A.
  const KEYWORDS = ["guest", "track", "order"];

  it("is absent from the sources-only baseline", () => {
    expect(
      covers(baseline, KEYWORDS),
      "baseline already covers guest order-tracking — AC5 would be vacuous"
    ).toBeUndefined();
  });

  it("is present in the reactions-augmented run", () => {
    const newGap = covers(augmented, KEYWORDS);
    expect(newGap, "augmented run is missing the guest order-tracking gap").toBeDefined();
  });

  it("the new gap is anchored to the prototype (prototype@<screen>), proving the click found it", () => {
    const newGap = covers(augmented, KEYWORDS)!;
    expect(hasProtoEvidence(newGap)).toBe(true);
    const anchor = newGap.evidence.find((e) => e.locator.startsWith("prototype@"))!;
    expect(anchor.locator).toBe("prototype@confirmation-screen");
  });

  it("the augmented run has exactly one more gap than the baseline", () => {
    expect(augmented.length).toBe(baseline.length + 1);
  });
});

describe("sharpen — an existing gap gains a concrete locus, severity unchanged", () => {
  const baseConflict = baseline.find((g) => g.id === "conflict-001")!;
  const augConflict = augmented.find((g) => g.id === "conflict-001")!;

  it("conflict-001 exists in both runs", () => {
    expect(baseConflict).toBeDefined();
    expect(augConflict).toBeDefined();
  });

  it("gains a prototype@ evidence entry not present in the baseline", () => {
    expect(hasProtoEvidence(baseConflict)).toBe(false);
    expect(hasProtoEvidence(augConflict)).toBe(true);
    expect(augConflict.evidence.length).toBe(baseConflict.evidence.length + 1);
  });

  it("keeps all original source evidence (sharpen adds, does not replace)", () => {
    for (const e of baseConflict.evidence) {
      expect(
        augConflict.evidence.some(
          (a) => a.sourceFile === e.sourceFile && a.locator === e.locator
        )
      ).toBe(true);
    }
  });

  it("does not change severity by default", () => {
    expect(augConflict.severity).toBe(baseConflict.severity);
  });
});
