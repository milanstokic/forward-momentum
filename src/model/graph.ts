import type { Claim } from "./claim.js";
import type { Gap } from "./gap.js";
import type { ParseError, ParseResult } from "./guards.js";

// ---------------------------------------------------------------------------
// graph.ts — referential-integrity validation over the engagement graph.
//
// Forward Momentum's artifacts form an *implicit* graph linked by string ids:
//
//     source ──provenance── Claim ◄──relatedClaims── Gap ──evidence──► source
//                             ▲                        │
//                             │                        └─ resolution / waiver
//     PRD.md / SPEC.md assertion ──[claim-id · sourceFile:locator]──┘
//
// `guards.ts` validates each artifact's *shape* in isolation. It does NOT
// check that the edges between artifacts resolve: a gap can point at a claim
// that was renamed, or the PRD can cite a deleted claim, and every per-file
// guard still passes. That silently breaks the product's core promise — that
// every assertion is traceable to a source.
//
// `validateGraph` closes that hole. It is pure (no I/O) and returns the same
// typed `ParseResult<…>` shape as the guards, so CI and tests consume it the
// same way.
// ---------------------------------------------------------------------------

/** A citation reference pulled from a PRD/SPEC document. */
export interface Citation {
  /** The referenced id, e.g. "claim-004", "gap-007", "conflict-001". */
  id: string;
  /** Where the citation appears, for error messages, e.g. "prd/PRD.md:L12". */
  at: string;
}

/** The full set of nodes + cross-document edges to validate together. */
export interface GraphInput {
  claims: Claim[];
  gaps: Gap[];
  /** Citation references extracted from PRD/SPEC (see {@link extractCitations}). */
  citations?: Citation[];
}

const ID_TOKEN = /(?:claim|gap|conflict)-\d+/gi;

/**
 * Pull every citation reference out of a markdown document, tagged with the
 * line it appears on. Mirrors the id grammar the PRD author emits
 * (`claim-NNN`, `gap-NNN`, `conflict-NNN`). `sourceLabel` is the document path
 * used in error loci, e.g. "prd/PRD.md".
 */
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

/**
 * Validate referential integrity across the engagement graph. Reports:
 *
 *  - duplicate claim ids        (ambiguous lookup target)
 *  - duplicate gap ids          (ambiguous lookup target)
 *  - dangling `relatedClaims`   (gap → non-existent claim)
 *  - missing `resolution`       (gap is waived/deferred but carries no record —
 *                                the model states this is required; the per-gap
 *                                guard does not enforce it)
 *  - dangling citation          (PRD/SPEC cites a claim/gap id that does not exist)
 *
 * Orphan nodes (a claim no edge points at) are intentionally NOT flagged: an
 * uncontested claim flowing straight into the PRD is legitimate, and flagging
 * it would produce false positives. This validator only reports broken edges.
 */
export function validateGraph(input: GraphInput): ParseResult<GraphInput> {
  const errors: ParseError[] = [];

  // --- Build id indexes, catching duplicates as we go ----------------------
  const claimIds = new Set<string>();
  input.claims.forEach((claim, i) => {
    if (claimIds.has(claim.id)) {
      errors.push({
        field: `claims[${i}].id`,
        message: `duplicate claim id "${claim.id}" — ids must be unique`,
        value: claim.id,
      });
    }
    claimIds.add(claim.id);
  });

  const gapIds = new Set<string>();
  input.gaps.forEach((gap, i) => {
    if (gapIds.has(gap.id)) {
      errors.push({
        field: `gaps[${i}].id`,
        message: `duplicate gap id "${gap.id}" — ids must be unique`,
        value: gap.id,
      });
    }
    gapIds.add(gap.id);
  });

  // --- Gap → claim edges + resolution invariant ----------------------------
  input.gaps.forEach((gap, i) => {
    gap.relatedClaims.forEach((claimId, j) => {
      if (!claimIds.has(claimId)) {
        errors.push({
          field: `gaps[${i}].relatedClaims[${j}]`,
          message: `gap "${gap.id}" references unknown claim "${claimId}"`,
          value: claimId,
        });
      }
    });

    if (
      (gap.status === "waived" || gap.status === "deferred") &&
      gap.resolution === undefined
    ) {
      errors.push({
        field: `gaps[${i}].resolution`,
        message: `gap "${gap.id}" has status "${gap.status}" but no resolution record (by/reason/at)`,
        value: gap.status,
      });
    }
  });

  // --- PRD/SPEC citation edges ---------------------------------------------
  const knownIds = new Set<string>([...claimIds, ...gapIds].map((id) => id.toLowerCase()));
  for (const citation of input.citations ?? []) {
    if (!knownIds.has(citation.id)) {
      errors.push({
        field: citation.at,
        message: `citation references unknown id "${citation.id}" — not found in claims.json or gaps.json`,
        value: citation.id,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: input };
}
