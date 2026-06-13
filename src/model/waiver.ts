// Structured waiver — required for hard-blocking gates (Resolution, Review).
// A waiver is only valid when reason is non-empty AND all acknowledgements are true.
export interface Waiver {
  gate: "Resolution" | "Review";
  /** Role/identity of the waiver authority */
  by: string;
  /** Required free-text justification */
  reason: string;
  /** ISO timestamp */
  at: string;
  acknowledgements: {
    /** Client has been told about the unresolved gap */
    communicatedToClient: boolean;
    /** Team explicitly accepts the downstream risk */
    riskAccepted: boolean;
    /** A follow-up/loopback is planned */
    revisitScheduled: boolean;
  };
}

// Persisted to decisions/ when a gate is passed (with or without a waiver)
export interface GateRecord {
  gate: "Extraction" | "GapAnalysis" | "Resolution" | "Review";
  /** Whether this gate was waived */
  waived: boolean;
  waiver?: Waiver;
  /** ISO timestamp of the gate passage */
  passedAt: string;
  /** Role/identity who passed the gate */
  passedBy: string;
}
