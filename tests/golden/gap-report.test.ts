import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseGaps } from "../../src/model/guards.js";
import type { Gap } from "../../src/model/gap.js";

// ---------------------------------------------------------------------------
// Golden test: the gap-analysis output for the sample engagement must cover
// every planted issue in ANSWER-KEY.md (the oracle). This is the Checkpoint B
// fail-fast signal — if a planted issue is missed, this test FAILS loudly.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const sampleDir = resolve(here, "../../examples/sample-engagement");
const gapsPath = resolve(sampleDir, "analysis/gaps.json");
const answerKeyPath = resolve(sampleDir, "ANSWER-KEY.md");

// --- Oracle: parse the answer-key quick-reference table -------------------

interface AnswerKeyIssue {
  id: string;
  type: "gap" | "conflict";
  category: string; // "requirement" | "design"
  severity: "blocking" | "non-blocking";
  oneLine: string;
}

function parseAnswerKey(md: string): AnswerKeyIssue[] {
  const rows = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\|\s*(gap|conflict)-\d+\s*\|/.test(l));

  const issues = rows.map((row) => {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const [id, type, category, severity, oneLine] = cells;
    return {
      id,
      type: type as AnswerKeyIssue["type"],
      category,
      severity: severity as AnswerKeyIssue["severity"],
      oneLine,
    };
  });
  return issues;
}

// --- Keyword sets per planted issue, used to match robustly ---------------
// Each issue is matched if a produced gap's text contains enough of these
// discriminating keywords (category + topic), not by id. This survives the
// agent choosing different ids/wording, while still failing if a topic is
// genuinely missing.
const ISSUE_KEYWORDS: Record<string, string[]> = {
  "gap-01": ["saved", "card"],
  "gap-02": ["declined", "error"],
  "gap-03": ["confirmation"],
  "gap-04": ["promo"],
  "gap-05": ["cart", "session"],
  "conflict-01": ["guest", "account"],
};

function gapHaystack(g: Gap): string {
  return [
    g.summary,
    ...g.evidence.map((e) => e.quote),
    ...g.evidence.map((e) => e.sourceFile),
  ]
    .join(" ")
    .toLowerCase();
}

function coveringGap(gaps: Gap[], keywords: string[]): Gap | undefined {
  return gaps.find((g) => {
    const hay = gapHaystack(g);
    const hits = keywords.filter((k) => hay.includes(k.toLowerCase())).length;
    // require coverage of all discriminating keywords for the topic
    return hits === keywords.length;
  });
}

// --- Load + validate produced gaps ----------------------------------------

const rawGaps: unknown = JSON.parse(readFileSync(gapsPath, "utf8"));
const parsed = parseGaps(rawGaps);

describe("produced gaps.json", () => {
  it("is a valid Gap[] (parses via the model guards)", () => {
    if (!parsed.ok) {
      throw new Error(
        "gaps.json failed model validation:\n" +
          parsed.errors.map((e) => `  ${e.field}: ${e.message}`).join("\n")
      );
    }
    expect(parsed.ok).toBe(true);
  });

  it("every gap is status 'open' with at least one verbatim-quote evidence entry", () => {
    if (!parsed.ok) throw new Error("gaps.json invalid; see prior failure");
    for (const g of parsed.data) {
      expect(g.status).toBe("open");
      expect(g.evidence.length).toBeGreaterThanOrEqual(1);
      for (const e of g.evidence) {
        expect(e.quote.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("ANSWER-KEY oracle", () => {
  const md = readFileSync(answerKeyPath, "utf8");
  const oracle = parseAnswerKey(md);

  it("parses the planted-issue table (6 issues: 5 gaps + 1 conflict)", () => {
    expect(oracle.length).toBe(6);
    expect(oracle.filter((i) => i.type === "conflict")).toHaveLength(1);
    expect(oracle.filter((i) => i.type === "gap")).toHaveLength(5);
    expect(oracle.filter((i) => i.severity === "blocking")).toHaveLength(3);
    // every oracle id must have a keyword set defined for matching
    for (const issue of oracle) {
      expect(ISSUE_KEYWORDS[issue.id]).toBeDefined();
    }
  });
});

describe("coverage: every planted issue is surfaced by a produced gap", () => {
  if (!parsed.ok) {
    it("gaps.json must be valid before coverage can be asserted", () => {
      throw new Error("gaps.json invalid; see prior failure");
    });
  } else {
    const gaps = parsed.data;
    const md = readFileSync(answerKeyPath, "utf8");
    const oracle = parseAnswerKey(md);

    for (const issue of oracle) {
      it(`covers ${issue.id} (${issue.type} · ${issue.category} · ${issue.severity})`, () => {
        const keywords = ISSUE_KEYWORDS[issue.id];
        const match = coveringGap(gaps, keywords);
        expect(
          match,
          `No produced gap covers planted issue ${issue.id} — expected keywords [${keywords.join(
            ", "
          )}]. This means the gap-analysis MISSED a planted issue.`
        ).toBeDefined();

        // the conflict must be detected AS a conflict
        if (issue.type === "conflict") {
          expect(
            match!.kind,
            `planted ${issue.id} is a conflict but the covering gap was kind="${match!.kind}"`
          ).toBe("conflict");
        }

        // blocking planted issues must be marked blocking
        if (issue.severity === "blocking") {
          expect(
            match!.severity,
            `planted ${issue.id} is blocking but covering gap was severity="${match!.severity}"`
          ).toBe("blocking");
        }
      });
    }

    it("detects exactly one conflict and marks all 3 blocking issues blocking", () => {
      const conflicts = gaps.filter((g) => g.kind === "conflict");
      expect(conflicts).toHaveLength(1);

      const blockingOracle = oracle.filter((i) => i.severity === "blocking");
      for (const issue of blockingOracle) {
        const match = coveringGap(gaps, ISSUE_KEYWORDS[issue.id]);
        expect(match, `blocking issue ${issue.id} not covered`).toBeDefined();
        expect(match!.severity).toBe("blocking");
      }

      const blockingProduced = gaps.filter((g) => g.severity === "blocking");
      expect(blockingProduced.length).toBeGreaterThanOrEqual(blockingOracle.length);
    });
  }
});
