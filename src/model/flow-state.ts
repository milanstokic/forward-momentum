// Discriminated union for pipeline stages
export type Stage =
  | { name: "Intake" }
  | { name: "Extraction" }
  | { name: "GapAnalysis" }
  | { name: "Resolution" }
  | { name: "PRDDraft" }
  | { name: "Review" }
  | { name: "Handoff" };

export type StageName = Stage["name"];

export type GateStatus = "pending" | "passed" | "waived" | "blocked";

export interface PerGateStatus {
  Extraction: GateStatus;
  GapAnalysis: GateStatus;
  Resolution: GateStatus;
  Review: GateStatus;
}

// The full runtime state — persisted to .flow/state.json in the engagement repo
export interface FlowState {
  currentStage: StageName;
  gates: PerGateStatus;
  /** ISO timestamp of the last state change */
  updatedAt: string;
}
