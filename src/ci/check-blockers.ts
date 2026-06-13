/**
 * check-blockers.ts — CI merge-gate script for Forward Momentum.
 *
 * Reads a gaps.json file and exits non-zero if any gap has
 * severity === "blocking" AND status === "open".
 *
 * Run with no build step:
 *   node --experimental-strip-types src/ci/check-blockers.ts [path/to/gaps.json]
 *
 * Default path: analysis/gaps.json (relative to cwd)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  return {
    ok: true,
    gap: {
      id: obj["id"] as string,
      severity: obj["severity"] as GapSeverity,
      status: obj["status"] as GapStatus,
      summary: obj["summary"] as string,
    },
  };
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
    process.exit(1);
  }

  console.log(
    `\nALL CLEAR — no open blocking gaps (${total} gap(s) checked).\n`
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
