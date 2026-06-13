import type { Claim, Provenance } from "./claim.js";
import type { Gap, GapKind, GapSeverity, GapStatus } from "./gap.js";
import type {
  ProvisionalChoice,
  PrototypeManifest,
  Reaction,
} from "./prototype.js";

// ---------------------------------------------------------------------------
// Typed error type for parse failures
// ---------------------------------------------------------------------------

export interface ParseError {
  field: string;
  message: string;
  value?: unknown;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: ParseError[] };

// ---------------------------------------------------------------------------
// Provenance guard
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseProvenance(raw: unknown, prefix: string): ParseResult<Provenance> {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      errors: [{ field: prefix, message: "must be an object", value: raw }],
    };
  }
  const obj = raw as Record<string, unknown>;
  const errors: ParseError[] = [];

  if (!isNonEmptyString(obj["sourceFile"])) {
    errors.push({
      field: `${prefix}.sourceFile`,
      message: "must be a non-empty string",
      value: obj["sourceFile"],
    });
  }
  if (!isNonEmptyString(obj["locator"])) {
    errors.push({
      field: `${prefix}.locator`,
      message: "must be a non-empty string",
      value: obj["locator"],
    });
  }
  if (!isNonEmptyString(obj["quote"])) {
    errors.push({
      field: `${prefix}.quote`,
      message: "must be a non-empty string",
      value: obj["quote"],
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      sourceFile: obj["sourceFile"] as string,
      locator: obj["locator"] as string,
      quote: obj["quote"] as string,
    },
  };
}

// ---------------------------------------------------------------------------
// Claim parser — parses a claims.json payload into Claim[]
// ---------------------------------------------------------------------------

function parseSingleClaim(raw: unknown, index: number): ParseResult<Claim> {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      errors: [
        { field: `claims[${index}]`, message: "must be an object", value: raw },
      ],
    };
  }
  const obj = raw as Record<string, unknown>;
  const errors: ParseError[] = [];

  if (!isNonEmptyString(obj["id"])) {
    errors.push({
      field: `claims[${index}].id`,
      message: "must be a non-empty string",
      value: obj["id"],
    });
  }
  if (!isNonEmptyString(obj["summary"])) {
    errors.push({
      field: `claims[${index}].summary`,
      message: "must be a non-empty string",
      value: obj["summary"],
    });
  }

  const provenanceRaw = obj["provenance"];
  if (!Array.isArray(provenanceRaw) || provenanceRaw.length === 0) {
    errors.push({
      field: `claims[${index}].provenance`,
      message: "must be a non-empty array",
      value: provenanceRaw,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const provenanceResults = (provenanceRaw as unknown[]).map((p, pi) =>
    parseProvenance(p, `claims[${index}].provenance[${pi}]`)
  );
  const provenanceErrors = provenanceResults
    .filter((r): r is { ok: false; errors: ParseError[] } => !r.ok)
    .flatMap((r) => r.errors);

  if (provenanceErrors.length > 0) return { ok: false, errors: provenanceErrors };

  return {
    ok: true,
    data: {
      id: obj["id"] as string,
      summary: obj["summary"] as string,
      provenance: provenanceResults
        .filter((r): r is { ok: true; data: Provenance } => r.ok)
        .map((r) => r.data),
    },
  };
}

/**
 * Parses a raw JSON payload (e.g. parsed contents of claims.json) into Claim[].
 * Returns typed errors on malformed input.
 */
export function parseClaims(raw: unknown): ParseResult<Claim[]> {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: "claims", message: "payload must be an array", value: raw }],
    };
  }

  const results = raw.map((item, i) => parseSingleClaim(item, i));
  const allErrors = results
    .filter((r): r is { ok: false; errors: ParseError[] } => !r.ok)
    .flatMap((r) => r.errors);

  if (allErrors.length > 0) return { ok: false, errors: allErrors };

  return {
    ok: true,
    data: results
      .filter((r): r is { ok: true; data: Claim } => r.ok)
      .map((r) => r.data),
  };
}

// ---------------------------------------------------------------------------
// Gap validator
// ---------------------------------------------------------------------------

const GAP_KINDS = new Set<GapKind>(["gap", "conflict"]);
const GAP_SEVERITIES = new Set<GapSeverity>(["blocking", "non-blocking"]);
const GAP_STATUSES = new Set<GapStatus>(["open", "resolved", "deferred", "waived"]);

function isGapKind(v: unknown): v is GapKind {
  return typeof v === "string" && GAP_KINDS.has(v as GapKind);
}
function isGapSeverity(v: unknown): v is GapSeverity {
  return typeof v === "string" && GAP_SEVERITIES.has(v as GapSeverity);
}
function isGapStatus(v: unknown): v is GapStatus {
  return typeof v === "string" && GAP_STATUSES.has(v as GapStatus);
}

function parseSingleGap(raw: unknown, index: number): ParseResult<Gap> {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      errors: [
        { field: `gaps[${index}]`, message: "must be an object", value: raw },
      ],
    };
  }
  const obj = raw as Record<string, unknown>;
  const errors: ParseError[] = [];

  if (!isNonEmptyString(obj["id"])) {
    errors.push({
      field: `gaps[${index}].id`,
      message: "must be a non-empty string",
      value: obj["id"],
    });
  }
  if (!isGapKind(obj["kind"])) {
    errors.push({
      field: `gaps[${index}].kind`,
      message: `must be one of: ${[...GAP_KINDS].join(", ")}`,
      value: obj["kind"],
    });
  }
  if (!isGapSeverity(obj["severity"])) {
    errors.push({
      field: `gaps[${index}].severity`,
      message: `must be one of: ${[...GAP_SEVERITIES].join(", ")}`,
      value: obj["severity"],
    });
  }
  if (!isNonEmptyString(obj["summary"])) {
    errors.push({
      field: `gaps[${index}].summary`,
      message: "must be a non-empty string",
      value: obj["summary"],
    });
  }
  if (!Array.isArray(obj["relatedClaims"])) {
    errors.push({
      field: `gaps[${index}].relatedClaims`,
      message: "must be an array",
      value: obj["relatedClaims"],
    });
  }
  if (!Array.isArray(obj["evidence"])) {
    errors.push({
      field: `gaps[${index}].evidence`,
      message: "must be an array",
      value: obj["evidence"],
    });
  }
  if (!isGapStatus(obj["status"])) {
    errors.push({
      field: `gaps[${index}].status`,
      message: `must be one of: ${[...GAP_STATUSES].join(", ")}`,
      value: obj["status"],
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const evidenceResults = (obj["evidence"] as unknown[]).map((e, ei) =>
    parseProvenance(e, `gaps[${index}].evidence[${ei}]`)
  );
  const evidenceErrors = evidenceResults
    .filter((r): r is { ok: false; errors: ParseError[] } => !r.ok)
    .flatMap((r) => r.errors);

  if (evidenceErrors.length > 0) return { ok: false, errors: evidenceErrors };

  const gap: Gap = {
    id: obj["id"] as string,
    kind: obj["kind"] as GapKind,
    severity: obj["severity"] as GapSeverity,
    summary: obj["summary"] as string,
    relatedClaims: obj["relatedClaims"] as string[],
    evidence: evidenceResults
      .filter((r): r is { ok: true; data: Provenance } => r.ok)
      .map((r) => r.data),
    status: obj["status"] as GapStatus,
  };

  // Optional resolution field
  if (obj["resolution"] !== undefined) {
    const res = obj["resolution"] as Record<string, unknown>;
    if (
      isNonEmptyString(res["by"]) &&
      isNonEmptyString(res["reason"]) &&
      isNonEmptyString(res["at"])
    ) {
      gap.resolution = {
        by: res["by"],
        reason: res["reason"],
        at: res["at"],
      };
    }
  }

  return { ok: true, data: gap };
}

/**
 * Validates an array of raw gap records (e.g. parsed from gap-report front-matter).
 * Returns typed errors on malformed input.
 */
export function parseGaps(raw: unknown): ParseResult<Gap[]> {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: "gaps", message: "payload must be an array", value: raw }],
    };
  }

  const results = raw.map((item, i) => parseSingleGap(item, i));
  const allErrors = results
    .filter((r): r is { ok: false; errors: ParseError[] } => !r.ok)
    .flatMap((r) => r.errors);

  if (allErrors.length > 0) return { ok: false, errors: allErrors };

  return {
    ok: true,
    data: results
      .filter((r): r is { ok: true; data: Gap } => r.ok)
      .map((r) => r.data),
  };
}

// ---------------------------------------------------------------------------
// Prototype module: manifest + reactions
// ---------------------------------------------------------------------------

function isIsoTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function parseProvisionalChoice(
  raw: unknown,
  prefix: string
): ParseResult<ProvisionalChoice> {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      errors: [{ field: prefix, message: "must be an object", value: raw }],
    };
  }
  const obj = raw as Record<string, unknown>;
  const errors: ParseError[] = [];

  for (const field of ["gapId", "choice", "rationale"] as const) {
    if (!isNonEmptyString(obj[field])) {
      errors.push({
        field: `${prefix}.${field}`,
        message: "must be a non-empty string",
        value: obj[field],
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      gapId: obj["gapId"] as string,
      choice: obj["choice"] as string,
      rationale: obj["rationale"] as string,
    },
  };
}

/**
 * Parses a raw JSON payload (parsed contents of prototype/manifest.json) into a
 * PrototypeManifest. Returns typed errors on malformed input.
 */
export function parseManifest(raw: unknown): ParseResult<PrototypeManifest> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: "manifest", message: "must be an object", value: raw }],
    };
  }
  const obj = raw as Record<string, unknown>;
  const errors: ParseError[] = [];

  if (!isIsoTimestamp(obj["generatedAt"])) {
    errors.push({
      field: "manifest.generatedAt",
      message: "must be an ISO8601 timestamp string",
      value: obj["generatedAt"],
    });
  }
  if (!isStringArray(obj["targetGapIds"])) {
    errors.push({
      field: "manifest.targetGapIds",
      message: "must be an array of strings",
      value: obj["targetGapIds"],
    });
  }
  if (!isStringArray(obj["screens"])) {
    errors.push({
      field: "manifest.screens",
      message: "must be an array of strings",
      value: obj["screens"],
    });
  }
  if (!Array.isArray(obj["choices"])) {
    errors.push({
      field: "manifest.choices",
      message: "must be an array",
      value: obj["choices"],
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const choiceResults = (obj["choices"] as unknown[]).map((c, ci) =>
    parseProvisionalChoice(c, `manifest.choices[${ci}]`)
  );
  const choiceErrors = choiceResults
    .filter((r): r is { ok: false; errors: ParseError[] } => !r.ok)
    .flatMap((r) => r.errors);

  if (choiceErrors.length > 0) return { ok: false, errors: choiceErrors };

  return {
    ok: true,
    data: {
      generatedAt: obj["generatedAt"] as string,
      targetGapIds: obj["targetGapIds"] as string[],
      choices: choiceResults
        .filter((r): r is { ok: true; data: ProvisionalChoice } => r.ok)
        .map((r) => r.data),
      screens: obj["screens"] as string[],
    },
  };
}

function parseSingleReaction(raw: unknown, prefix: string): ParseResult<Reaction> {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      errors: [{ field: prefix, message: "must be an object", value: raw }],
    };
  }
  const obj = raw as Record<string, unknown>;
  const errors: ParseError[] = [];

  for (const field of ["id", "author", "screen", "text"] as const) {
    if (!isNonEmptyString(obj[field])) {
      errors.push({
        field: `${prefix}.${field}`,
        message: "must be a non-empty string",
        value: obj[field],
      });
    }
  }
  if (!isIsoTimestamp(obj["ts"])) {
    errors.push({
      field: `${prefix}.ts`,
      message: "must be an ISO8601 timestamp string",
      value: obj["ts"],
    });
  }
  // element is optional, but when present must be a non-empty string
  if (obj["element"] !== undefined && !isNonEmptyString(obj["element"])) {
    errors.push({
      field: `${prefix}.element`,
      message: "when present must be a non-empty string",
      value: obj["element"],
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const reaction: Reaction = {
    id: obj["id"] as string,
    author: obj["author"] as string,
    screen: obj["screen"] as string,
    text: obj["text"] as string,
    ts: obj["ts"] as string,
  };
  if (obj["element"] !== undefined) {
    reaction.element = obj["element"] as string;
  }
  return { ok: true, data: reaction };
}

/**
 * Parses the contents of prototype/reactions.jsonl (one JSON Reaction per line)
 * into Reaction[]. Blank lines are ignored. Returns typed errors on any malformed
 * line — the field names a 1-based line number so a bad entry is locatable.
 */
export function parseReactions(jsonl: string): ParseResult<Reaction[]> {
  if (typeof jsonl !== "string") {
    return {
      ok: false,
      errors: [
        { field: "reactions", message: "payload must be a string", value: jsonl },
      ],
    };
  }

  const lines = jsonl.split("\n");
  const results: ParseResult<Reaction>[] = [];
  const parseErrors: ParseError[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return; // skip blank lines
    const lineNo = i + 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parseErrors.push({
        field: `reactions:line ${lineNo}`,
        message: "not valid JSON",
        value: trimmed,
      });
      return;
    }
    results.push(parseSingleReaction(parsed, `reactions:line ${lineNo}`));
  });

  const validationErrors = results
    .filter((r): r is { ok: false; errors: ParseError[] } => !r.ok)
    .flatMap((r) => r.errors);
  const allErrors = [...parseErrors, ...validationErrors];

  if (allErrors.length > 0) return { ok: false, errors: allErrors };

  return {
    ok: true,
    data: results
      .filter((r): r is { ok: true; data: Reaction } => r.ok)
      .map((r) => r.data),
  };
}
