/**
 * check-blockers.ts — CI merge-gate script for Forward Momentum.
 *
 * Blocks a merge when EITHER:
 *   1. any gap has severity === "blocking" AND status === "open", or
 *   2. the engagement graph fails referential integrity (dangling edges,
 *      duplicate ids, or a waived/deferred gap with no resolution record).
 *
 * Run with no build step:
 *   node --experimental-strip-types src/ci/check-blockers.ts [path/to/gaps.json]
 *
 * Default path: analysis/gaps.json (relative to cwd). claims.json (sibling) and
 * prd/PRD.md + spec/SPEC.md (engagement root) are loaded when present.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Inline types (mirrors src/model/gap.ts — import type only so types erase
// and the script remains zero-build runnable)
// ---------------------------------------------------------------------------

type GapSeverity = "blocking" | "non-blocking";
type GapStatus = "open" | "resolved" | "deferred" | "waived";

interface GapLike {
  id: string;
  severity: GapSeverity;
  status: GapStatus;
  summary: string;
  /** Edges to claim ids — needed by the graph-integrity check. */
  relatedClaims: string[];
  /** Present iff the gap was resolved/deferred/waived with a record. */
  resolution?: { by?: unknown; reason?: unknown; at?: unknown };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Validation helpers (inline — no runtime imports from src/model)
// ---------------------------------------------------------------------------

function isGapSeverity(v: unknown): v is GapSeverity {
  return v === "blocking" || v === "non-blocking";
}

function isGapStatus(v: unknown): v is GapStatus {
  return (
    v === "open" || v === "resolved" || v === "deferred" || v === "waived"
  );
}

function validateGap(
  item: unknown,
  index: number
): { ok: true; gap: GapLike } | { ok: false; error: string } {
  if (typeof item !== "object" || item === null) {
    return { ok: false, error: `Item at index ${index} is not an object` };
  }
  const obj = item as Record<string, unknown>;

  if (typeof obj["id"] !== "string" || !obj["id"]) {
    return {
      ok: false,
      error: `Item at index ${index} is missing a non-empty string 'id'`,
    };
  }
  if (!isGapSeverity(obj["severity"])) {
    return {
      ok: false,
      error: `Gap '${obj["id"]}': 'severity' must be "blocking" or "non-blocking", got ${JSON.stringify(obj["severity"])}`,
    };
  }
  if (!isGapStatus(obj["status"])) {
    return {
      ok: false,
      error: `Gap '${obj["id"]}': 'status' must be "open"|"resolved"|"deferred"|"waived", got ${JSON.stringify(obj["status"])}`,
    };
  }
  if (typeof obj["summary"] !== "string") {
    return {
      ok: false,
      error: `Gap '${obj["id"]}': 'summary' must be a string`,
    };
  }

  const relatedRaw = obj["relatedClaims"];
  const relatedClaims = Array.isArray(relatedRaw)
    ? relatedRaw.filter((c): c is string => typeof c === "string")
    : [];

  const gap: GapLike = {
    id: obj["id"] as string,
    severity: obj["severity"] as GapSeverity,
    status: obj["status"] as GapStatus,
    summary: obj["summary"] as string,
    relatedClaims,
  };
  if (typeof obj["resolution"] === "object" && obj["resolution"] !== null) {
    gap.resolution = obj["resolution"] as GapLike["resolution"];
  }

  return { ok: true, gap };
}

// ---------------------------------------------------------------------------
// Core decision function — pure, no I/O, fully unit-testable
// ---------------------------------------------------------------------------

export interface BlockerResult {
  blocked: boolean;
  offenders: GapLike[];
  /** Total gaps examined */
  total: number;
}

/**
 * Determines whether the given gaps array contains any open blocking gaps.
 * Pure function — no I/O.
 */
export function hasOpenBlockers(gaps: GapLike[]): BlockerResult {
  const offenders = gaps.filter(
    (g) => g.severity === "blocking" && g.status === "open"
  );
  return {
    blocked: offenders.length > 0,
    offenders,
    total: gaps.length,
  };
}

// ---------------------------------------------------------------------------
// File parsing — reads, parses, and validates a gaps.json file
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; gaps: GapLike[] }
  | { ok: false; error: string };

export function parseGapsFile(filePath: string): ParseResult {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Cannot read file '${filePath}': ${msg}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `'${filePath}' is not valid JSON: ${msg}`,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: `'${filePath}' must contain a JSON array at the top level, got ${typeof parsed}`,
    };
  }

  const gaps: GapLike[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const result = validateGap(parsed[i], i);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    gaps.push(result.gap);
  }

  return { ok: true, gaps };
}

// ---------------------------------------------------------------------------
// Graph referential-integrity check
//
// Inline, zero-build mirror of `validateGraph` in src/model/graph.ts (which is
// the canonical, fully-tested implementation). It is duplicated here on purpose
// so this script stays runnable via `node --experimental-strip-types` with no
// runtime import from src/model — the same reason the gap types are inlined
// above. Keep the two in sync.
// ---------------------------------------------------------------------------

interface ClaimLike {
  id: string;
}

export type ClaimsParseResult =
  | { ok: true; claims: ClaimLike[] }
  | { ok: false; error: string };

export function parseClaimsFile(filePath: string): ClaimsParseResult {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Cannot read file '${filePath}': ${msg}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `'${filePath}' is not valid JSON: ${msg}` };
  }
  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: `'${filePath}' must contain a JSON array at the top level, got ${typeof parsed}`,
    };
  }
  const claims: ClaimLike[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const obj = parsed[i] as Record<string, unknown> | null;
    if (typeof obj !== "object" || obj === null || typeof obj["id"] !== "string" || !obj["id"]) {
      return { ok: false, error: `Claim at index ${i} is missing a non-empty string 'id'` };
    }
    claims.push({ id: obj["id"] });
  }
  return { ok: true, claims };
}

export interface Citation {
  id: string;
  at: string;
}

const ID_TOKEN = /(?:claim|gap|conflict)-\d+/gi;

/** Pull citation ids (with line loci) out of a PRD/SPEC markdown document. */
export function extractCitations(text: string, sourceLabel: string): Citation[] {
  const citations: Citation[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].match(ID_TOKEN);
    if (!matches) continue;
    for (const id of matches) {
      citations.push({ id: id.toLowerCase(), at: `${sourceLabel}:L${i + 1}` });
    }
  }
  return citations;
}

export interface IntegrityResult {
  ok: boolean;
  violations: string[];
}

/**
 * Referential-integrity check over the engagement graph. `claims` is null when
 * claims.json is absent (CI may run before extraction); claim-edge and citation
 * checks are then skipped, but duplicate-gap-id and resolution-record checks
 * (which need only the gaps) still run.
 */
export function checkGraphIntegrity(opts: {
  gaps: GapLike[];
  claims: ClaimLike[] | null;
  citations?: Citation[];
}): IntegrityResult {
  const { gaps, claims, citations } = opts;
  const violations: string[] = [];

  const claimIds = claims ? new Set(claims.map((c) => c.id)) : null;
  if (claims) {
    const seen = new Set<string>();
    for (const c of claims) {
      if (seen.has(c.id)) violations.push(`duplicate claim id "${c.id}" — ids must be unique`);
      seen.add(c.id);
    }
  }

  const gapIds = new Set<string>();
  for (const g of gaps) {
    if (gapIds.has(g.id)) violations.push(`duplicate gap id "${g.id}" — ids must be unique`);
    gapIds.add(g.id);
  }

  for (const g of gaps) {
    if (claimIds) {
      for (const claimId of g.relatedClaims) {
        if (!claimIds.has(claimId)) {
          violations.push(`gap "${g.id}" references unknown claim "${claimId}"`);
        }
      }
    }
    if ((g.status === "waived" || g.status === "deferred") && g.resolution === undefined) {
      violations.push(
        `gap "${g.id}" has status "${g.status}" but no resolution record (by/reason/at)`
      );
    }
  }

  if (claimIds && citations) {
    const known = new Set<string>([...claimIds, ...gapIds].map((id) => id.toLowerCase()));
    for (const c of citations) {
      if (!known.has(c.id)) {
        violations.push(`${c.at}: citation references unknown id "${c.id}"`);
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// CLI entry point — runs only when invoked directly
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const gapsPath = resolve(process.cwd(), args[0] ?? "analysis/gaps.json");

  console.log(`Checking gaps file: ${gapsPath}`);

  const parseResult = parseGapsFile(gapsPath);
  if (!parseResult.ok) {
    console.error(`\nERROR: ${parseResult.error}`);
    process.exit(1);
  }

  const { gaps } = parseResult;

  // --- Graph integrity: load sibling claims.json + PRD/SPEC if present -------
  const analysisDir = dirname(gapsPath);
  const engagementRoot = dirname(analysisDir);
  const claimsPath = join(analysisDir, "claims.json");

  let claims: ClaimLike[] | null = null;
  if (existsSync(claimsPath)) {
    const claimsResult = parseClaimsFile(claimsPath);
    if (!claimsResult.ok) {
      console.error(`\nERROR: ${claimsResult.error}`);
      process.exit(1);
    }
    claims = claimsResult.claims;
  } else {
    console.log(`(no claims.json at ${claimsPath} — skipping claim-edge checks)`);
  }

  const citations: Citation[] = [];
  for (const rel of ["prd/PRD.md", "spec/SPEC.md"]) {
    const p = join(engagementRoot, rel);
    if (existsSync(p)) {
      citations.push(...extractCitations(readFileSync(p, "utf-8"), rel));
    }
  }

  const integrity = checkGraphIntegrity({ gaps, claims, citations });

  // --- Open-blocker gate -----------------------------------------------------
  const { blocked, offenders, total } = hasOpenBlockers(gaps);

  if (blocked) {
    console.error(
      `\nBLOCKED — ${offenders.length} open blocking gap(s) found (${total} total):\n`
    );
    for (const g of offenders) {
      console.error(`  [${g.id}] ${g.summary}`);
    }
    console.error(
      "\nResolve, defer, or waive all blocking gaps before merging.\n"
    );
  }

  if (!integrity.ok) {
    console.error(
      `\nGRAPH INTEGRITY FAILED — ${integrity.violations.length} broken edge(s):\n`
    );
    for (const v of integrity.violations) {
      console.error(`  - ${v}`);
    }
    console.error("\nFix the dangling references before merging.\n");
  }

  if (blocked || !integrity.ok) {
    process.exit(1);
  }

  console.log(
    `\nALL CLEAR — no open blocking gaps and graph integrity holds (${total} gap(s) checked).\n`
  );
  process.exit(0);
}

// Detect direct invocation: works for both `node --experimental-strip-types`
// and compiled JS output via dist/.
// ESM import.meta.url would need --input-type=module; using argv check instead.
const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]).endsWith("check-blockers.ts") ||
    resolve(process.argv[1]).endsWith("check-blockers.js")
  : false;

if (isDirectRun) {
  main();
}
