import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { readFlowState, writeFlowState, writeGateRecord } from "../../src/flow/store";
import type { FlowState } from "../../src/model/flow-state";
import type { GateRecord, Waiver } from "../../src/model/waiver";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TS = "2024-01-01T00:00:00.000Z";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fm-store-test-"));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function defaultState(): FlowState {
  return {
    currentStage: "Intake",
    gates: {
      Extraction: "pending",
      GapAnalysis: "pending",
      Resolution: "pending",
      Review: "pending",
    },
    updatedAt: TS,
  };
}

function makeValidWaiver(gate: Waiver["gate"] = "Resolution"): Waiver {
  return {
    gate,
    by: "Product",
    reason: "We accept this risk because the client agreed in writing.",
    at: TS,
    acknowledgements: {
      communicatedToClient: true,
      riskAccepted: true,
      revisitScheduled: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
});

afterEach(() => {
  removeTempDir(tmpDir);
});

// ---------------------------------------------------------------------------
// readFlowState — initialisation
// ---------------------------------------------------------------------------

describe("readFlowState — initialisation", () => {
  it("creates .flow/state.json with initial state when file is absent", () => {
    const state = readFlowState(tmpDir, TS);

    expect(state.currentStage).toBe("Intake");
    expect(state.gates.Extraction).toBe("pending");
    expect(state.gates.GapAnalysis).toBe("pending");
    expect(state.gates.Resolution).toBe("pending");
    expect(state.gates.Review).toBe("pending");
    expect(state.updatedAt).toBe(TS);

    // File must exist after initialisation
    const statePath = path.join(tmpDir, ".flow", "state.json");
    expect(fs.existsSync(statePath)).toBe(true);
  });

  it("creates .flow/ directory if absent", () => {
    readFlowState(tmpDir, TS);
    expect(fs.existsSync(path.join(tmpDir, ".flow"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// writeFlowState / readFlowState — round-trip
// ---------------------------------------------------------------------------

describe("writeFlowState / readFlowState — round-trip", () => {
  it("persists and retrieves a modified state", () => {
    const modified: FlowState = {
      currentStage: "Resolution",
      gates: {
        Extraction: "passed",
        GapAnalysis: "waived",
        Resolution: "pending",
        Review: "pending",
      },
      updatedAt: "2024-06-01T12:00:00.000Z",
    };

    writeFlowState(tmpDir, modified);
    const retrieved = readFlowState(tmpDir, TS); // TS is used for init only — file already exists

    expect(retrieved.currentStage).toBe("Resolution");
    expect(retrieved.gates.Extraction).toBe("passed");
    expect(retrieved.gates.GapAnalysis).toBe("waived");
    expect(retrieved.gates.Resolution).toBe("pending");
    expect(retrieved.updatedAt).toBe("2024-06-01T12:00:00.000Z");
  });

  it("overwrites the state on second write", () => {
    const state1 = defaultState();
    writeFlowState(tmpDir, state1);

    const state2: FlowState = {
      ...state1,
      currentStage: "PRDDraft",
      updatedAt: "2024-06-02T00:00:00.000Z",
    };
    writeFlowState(tmpDir, state2);

    const retrieved = readFlowState(tmpDir, TS);
    expect(retrieved.currentStage).toBe("PRDDraft");
  });

  it("does not overwrite when file already exists on readFlowState", () => {
    // Write a custom state first
    const state: FlowState = {
      currentStage: "GapAnalysis",
      gates: {
        Extraction: "passed",
        GapAnalysis: "pending",
        Resolution: "pending",
        Review: "pending",
      },
      updatedAt: "2024-03-01T00:00:00.000Z",
    };
    writeFlowState(tmpDir, state);

    // readFlowState with a different updatedAt should return the stored state
    const retrieved = readFlowState(tmpDir, "1970-01-01T00:00:00.000Z");
    expect(retrieved.currentStage).toBe("GapAnalysis");
    expect(retrieved.updatedAt).toBe("2024-03-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// writeGateRecord — decisions/ record
// ---------------------------------------------------------------------------

describe("writeGateRecord — passed gate (no waiver)", () => {
  it("writes a markdown file to decisions/", () => {
    const record: GateRecord = {
      gate: "Extraction",
      waived: false,
      passedAt: TS,
      passedBy: "Product",
    };
    writeGateRecord(tmpDir, record);

    const decisionsDir = path.join(tmpDir, "decisions");
    expect(fs.existsSync(decisionsDir)).toBe(true);

    const files = fs.readdirSync(decisionsDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/gate-Extraction/);
  });

  it("file contains the gate name and passed-by in human-readable form", () => {
    const record: GateRecord = {
      gate: "GapAnalysis",
      waived: false,
      passedAt: TS,
      passedBy: "SomeReviewer",
    };
    writeGateRecord(tmpDir, record);

    const files = fs.readdirSync(path.join(tmpDir, "decisions"));
    const content = fs.readFileSync(path.join(tmpDir, "decisions", files[0]), "utf-8");
    expect(content).toContain("GapAnalysis");
    expect(content).toContain("SomeReviewer");
    expect(content).toContain(TS);
  });

  it("file extension is .md", () => {
    const record: GateRecord = {
      gate: "Resolution",
      waived: false,
      passedAt: TS,
      passedBy: "Product",
    };
    writeGateRecord(tmpDir, record);

    const files = fs.readdirSync(path.join(tmpDir, "decisions"));
    expect(files[0]).toMatch(/\.md$/);
  });
});

describe("writeGateRecord — waived gate (with waiver)", () => {
  it("includes waiver details in the markdown file", () => {
    const waiver = makeValidWaiver("Resolution");
    const record: GateRecord = {
      gate: "Resolution",
      waived: true,
      waiver,
      passedAt: TS,
      passedBy: "Product",
    };
    writeGateRecord(tmpDir, record);

    const files = fs.readdirSync(path.join(tmpDir, "decisions"));
    const content = fs.readFileSync(path.join(tmpDir, "decisions", files[0]), "utf-8");

    expect(content).toContain("Waiver Details");
    expect(content).toContain(waiver.reason);
    expect(content).toContain("Communicated to client");
    expect(content).toContain("Risk accepted");
    expect(content).toContain("Revisit scheduled");
    expect(content).toContain("Yes");
  });

  it("indicates Waived: Yes in the table", () => {
    const waiver = makeValidWaiver("Review");
    const record: GateRecord = {
      gate: "Review",
      waived: true,
      waiver,
      passedAt: TS,
      passedBy: "Product",
    };
    writeGateRecord(tmpDir, record);

    const files = fs.readdirSync(path.join(tmpDir, "decisions"));
    const content = fs.readFileSync(path.join(tmpDir, "decisions", files[0]), "utf-8");
    expect(content).toContain("Yes");
  });
});

describe("writeGateRecord — multiple records", () => {
  it("writes separate files for multiple gate passages", () => {
    const ts1 = "2024-01-01T10:00:00.000Z";
    const ts2 = "2024-01-01T11:00:00.000Z";

    writeGateRecord(tmpDir, {
      gate: "Extraction",
      waived: false,
      passedAt: ts1,
      passedBy: "Product",
    });

    writeGateRecord(tmpDir, {
      gate: "GapAnalysis",
      waived: false,
      passedAt: ts2,
      passedBy: "Product",
    });

    const files = fs.readdirSync(path.join(tmpDir, "decisions"));
    expect(files).toHaveLength(2);
  });
});

describe("writeGateRecord — creates decisions/ directory", () => {
  it("creates the decisions directory if it does not exist", () => {
    const decisionsDir = path.join(tmpDir, "decisions");
    expect(fs.existsSync(decisionsDir)).toBe(false);

    writeGateRecord(tmpDir, {
      gate: "Extraction",
      waived: false,
      passedAt: TS,
      passedBy: "Product",
    });

    expect(fs.existsSync(decisionsDir)).toBe(true);
  });
});
