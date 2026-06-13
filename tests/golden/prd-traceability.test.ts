import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseClaims } from "../../src/model/guards.js";

// ---------------------------------------------------------------------------
// Golden test: the generated dual-view PRD must be FULLY traceable.
//
// Every ASSERTION line in prd/PRD.md and spec/SPEC.md must carry a provenance
// citation of the form:
//     [<claim/gap/conflict-id>[, …] · <sourceFile>:<locator>]
//   or a decision-file citation:
//     [<id> · decisions/<file>.md]
//
// An assertion is any markdown bullet ("- " / "* ") or numbered list item
// ("1. ") that makes a claim about the product. Headings, prose, table-header
// rows, blockquotes, and code fences are NOT assertions.
//
// If ANY assertion line lacks a citation token, this test FAILS loudly — that
// is the whole point: an uncited assertion is an untraceable assertion.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const sampleDir = resolve(here, "../../examples/sample-engagement");
const prdPath = resolve(sampleDir, "prd/PRD.md");
const specPath = resolve(sampleDir, "spec/SPEC.md");
const claimsPath = resolve(sampleDir, "analysis/claims.json");

// A citation token: a bracketed group containing at least one id token
// (claim-NN / gap-NN / conflict-NN) and/or a sourceFile:locator or a
// decisions/ file reference.
const ID_TOKEN = /(?:claim|gap|conflict)-\d+/i;
const SOURCE_TOKEN = /sources\/[^\s\]]+:[^\s\]]+/i;
const DECISION_TOKEN = /decisions\/[^\s\]]+/i;

/** Extract the trailing bracket group(s) from a line, if any. */
function bracketGroups(line: string): string[] {
  const groups: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    groups.push(m[1]);
  }
  return groups;
}

/** A bracket group is a valid citation if it carries an id and/or a source/decision locator. */
function isCitation(group: string): boolean {
  return (
    ID_TOKEN.test(group) ||
    SOURCE_TOKEN.test(group) ||
    DECISION_TOKEN.test(group)
  );
}

function lineHasCitation(line: string): boolean {
  return bracketGroups(line).some(isCitation);
}

/**
 * Decide whether a line is an ASSERTION that must carry a citation.
 * Assertion = a bullet or numbered list item with substantive text.
 */
function isAssertionLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  // bullets ("- x" / "* x") and numbered items ("1. x")
  const isBullet = /^[-*]\s+\S/.test(t);
  const isNumbered = /^\d+\.\s+\S/.test(t);
  if (!isBullet && !isNumbered) return false;
  // A markdown table row is handled separately; skip table delimiters.
  if (/^\|?\s*-+\s*\|/.test(t)) return false;
  return true;
}

/** Pull all citation tokens (ids) referenced across a document. */
function citedIds(text: string): string[] {
  const ids: string[] = [];
  const re = /(?:claim|gap|conflict)-\d+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ids.push(m[0]);
  }
  return ids;
}

function assertionLines(text: string): { lineNo: number; text: string }[] {
  return text
    .split("\n")
    .map((text, i) => ({ lineNo: i + 1, text }))
    .filter((l) => isAssertionLine(l.text));
}

// --- Load documents --------------------------------------------------------

const prdText = readFileSync(prdPath, "utf8");
const specText = readFileSync(specPath, "utf8");

describe("dual-view PRD exists with both views", () => {
  it("prd/PRD.md (human) is non-trivial", () => {
    expect(prdText.length).toBeGreaterThan(200);
    expect(prdText).toMatch(/^#\s/m);
  });
  it("spec/SPEC.md (machine) has the four machine sections", () => {
    expect(specText).toMatch(/##\s*Acceptance Criteria/i);
    expect(specText).toMatch(/##\s*Non-Goals/i);
    expect(specText).toMatch(/##\s*Edge Cases/i);
    expect(specText).toMatch(/##\s*Data\s*\/\s*API Contracts/i);
  });
});

describe("traceability: every assertion in prd/PRD.md is cited", () => {
  const lines = assertionLines(prdText);

  it("has at least a handful of assertion lines", () => {
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  for (const l of lines) {
    it(`prd/PRD.md:L${l.lineNo} carries a provenance citation`, () => {
      expect(
        lineHasCitation(l.text),
        `Uncited assertion at prd/PRD.md:L${l.lineNo}:\n  ${l.text.trim()}\n` +
          `Every assertion must end with a citation like [claim-007 · sources/product-notes.md:L24].`
      ).toBe(true);
    });
  }
});

describe("traceability: every assertion in spec/SPEC.md is cited", () => {
  const lines = assertionLines(specText);

  it("has at least a handful of assertion lines", () => {
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  for (const l of lines) {
    it(`spec/SPEC.md:L${l.lineNo} carries a provenance citation`, () => {
      expect(
        lineHasCitation(l.text),
        `Uncited assertion at spec/SPEC.md:L${l.lineNo}:\n  ${l.text.trim()}\n` +
          `Every assertion must end with a citation like [claim-006 · sources/product-notes.md:L12].`
      ).toBe(true);
    });
  }
});

describe("no dangling claim citations (every cited claim-id exists)", () => {
  const rawClaims: unknown = JSON.parse(readFileSync(claimsPath, "utf8"));
  const parsed = parseClaims(rawClaims);

  it("claims.json is valid", () => {
    expect(parsed.ok).toBe(true);
  });

  it("every claim-id cited in the PRD/SPEC exists in claims.json", () => {
    if (!parsed.ok) throw new Error("claims.json invalid; see prior failure");
    const validClaimIds = new Set(parsed.data.map((c) => c.id));
    const cited = [...citedIds(prdText), ...citedIds(specText)].filter((id) =>
      /^claim-/i.test(id)
    );
    expect(cited.length).toBeGreaterThan(0);
    const dangling = cited.filter((id) => !validClaimIds.has(id));
    expect(
      dangling,
      `These claim-ids are cited in the PRD/SPEC but do not exist in claims.json: ${[
        ...new Set(dangling),
      ].join(", ")}`
    ).toHaveLength(0);
  });
});
