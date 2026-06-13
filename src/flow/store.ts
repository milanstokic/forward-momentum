/**
 * Persistence layer for the Forward-Momentum flow controller.
 *
 * This is the ONLY file in src/flow/ that performs I/O.
 *
 * Responsibilities:
 *  - Read/write `.flow/state.json` in a given engagement-repo root.
 *    Initialises to { currentStage: "Intake", gates: all "pending", updatedAt }
 *    when the file is absent.
 *  - Append a human-readable record to `decisions/` when a gate is passed or
 *    waived. Records are written as Markdown for human readability (provenance).
 *
 * Design constraints:
 *  - Timestamps are accepted as parameters — never called internally with
 *    Date.now() so that callers (and tests) control time.
 *  - No pure logic lives here; all gate/waiver validation happens in gates.ts.
 */

import * as fs from "fs";
import * as path from "path";

import type { FlowState, PerGateStatus } from "../model/flow-state.js";
import type { GateRecord, Waiver } from "../model/waiver.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const FLOW_DIR = ".flow";
const STATE_FILE = "state.json";
const DECISIONS_DIR = "decisions";

function flowStatePath(repoRoot: string): string {
  return path.join(repoRoot, FLOW_DIR, STATE_FILE);
}

function decisionsDir(repoRoot: string): string {
  return path.join(repoRoot, DECISIONS_DIR);
}

// ---------------------------------------------------------------------------
// Read state
// ---------------------------------------------------------------------------

/**
 * Read `.flow/state.json` from the engagement repo root.
 * If the file does not exist, initialises and writes a fresh state.
 *
 * @param repoRoot   Absolute path to the engagement repo root.
 * @param updatedAt  ISO timestamp to use when initialising fresh state.
 */
export function readFlowState(repoRoot: string, updatedAt: string): FlowState {
  const statePath = flowStatePath(repoRoot);

  if (!fs.existsSync(statePath)) {
    const initial = makeInitialState(updatedAt);
    writeFlowState(repoRoot, initial);
    return initial;
  }

  const raw = fs.readFileSync(statePath, "utf-8");
  return JSON.parse(raw) as FlowState;
}

// ---------------------------------------------------------------------------
// Write state
// ---------------------------------------------------------------------------

/**
 * Persist the flow state to `.flow/state.json`.
 * Creates `.flow/` if it does not exist.
 */
export function writeFlowState(repoRoot: string, state: FlowState): void {
  const flowDir = path.join(repoRoot, FLOW_DIR);
  fs.mkdirSync(flowDir, { recursive: true });
  fs.writeFileSync(
    flowStatePath(repoRoot),
    JSON.stringify(state, null, 2),
    "utf-8"
  );
}

// ---------------------------------------------------------------------------
// Decisions records
// ---------------------------------------------------------------------------

/**
 * Append a gate-passage record to `decisions/`.
 * The file is named `<passedAt ISO>-gate-<gate>.md` with colons replaced so
 * it is safe on all filesystems.
 *
 * @param repoRoot    Absolute path to the engagement repo root.
 * @param record      The GateRecord to persist.
 */
export function writeGateRecord(repoRoot: string, record: GateRecord): void {
  const dir = decisionsDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });

  const safeTimestamp = record.passedAt.replace(/[:.]/g, "-");
  const filename = `${safeTimestamp}-gate-${record.gate}.md`;
  const filepath = path.join(dir, filename);

  const content = formatGateRecord(record);
  fs.writeFileSync(filepath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInitialState(updatedAt: string): FlowState {
  const gates: PerGateStatus = {
    Extraction: "pending",
    GapAnalysis: "pending",
    Resolution: "pending",
    Review: "pending",
  };
  return { currentStage: "Intake", gates, updatedAt };
}

/**
 * Render a GateRecord as human-readable Markdown provenance.
 */
function formatGateRecord(record: GateRecord): string {
  const lines: string[] = [];

  lines.push(`# Gate Record: ${record.gate}`);
  lines.push("");
  lines.push(`| Field      | Value |`);
  lines.push(`|------------|-------|`);
  lines.push(`| Gate       | ${record.gate} |`);
  lines.push(`| Passed At  | ${record.passedAt} |`);
  lines.push(`| Passed By  | ${record.passedBy} |`);
  lines.push(`| Waived     | ${record.waived ? "Yes" : "No"} |`);
  lines.push("");

  if (record.waived && record.waiver) {
    lines.push("## Waiver Details");
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Gate  | ${record.waiver.gate} |`);
    lines.push(`| By    | ${record.waiver.by} |`);
    lines.push(`| At    | ${record.waiver.at} |`);
    lines.push("");
    lines.push("### Reason");
    lines.push("");
    lines.push(record.waiver.reason);
    lines.push("");
    lines.push("### Acknowledgements");
    lines.push("");
    lines.push(
      `- Communicated to client: ${record.waiver.acknowledgements.communicatedToClient ? "Yes" : "No"}`
    );
    lines.push(
      `- Risk accepted: ${record.waiver.acknowledgements.riskAccepted ? "Yes" : "No"}`
    );
    lines.push(
      `- Revisit scheduled: ${record.waiver.acknowledgements.revisitScheduled ? "Yes" : "No"}`
    );
    lines.push("");
  }

  return lines.join("\n");
}

// Re-export GateRecord type for consumers
export type { GateRecord, Waiver };
