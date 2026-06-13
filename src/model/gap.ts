import type { Provenance } from "./claim.js";

export type GapKind = "gap" | "conflict";
export type GapSeverity = "blocking" | "non-blocking";
export type GapStatus = "open" | "resolved" | "deferred" | "waived";

export interface Gap {
  /** Unique stable identifier, e.g. "gap-007" */
  id: string;
  kind: GapKind;
  severity: GapSeverity;
  summary: string;
  /** IDs of related claims */
  relatedClaims: string[];
  evidence: Provenance[];
  status: GapStatus;
  /** Required for waived or deferred gaps */
  resolution?: {
    by: string;
    reason: string;
    /** ISO timestamp */
    at: string;
  };
}

// Returned by gate-evaluation functions (pure, no I/O)
export type GateResult =
  | { ok: true }
  | { ok: false; reason: string; blocking: Gap[] };
