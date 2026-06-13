import { describe, it, expect } from "vitest";
import {
  STAGE_ORDER,
  LOOPBACK_TARGET,
  stageIndex,
  initialFlowState,
  advanceStage,
  retreatStage,
  transitionTo,
  loopbackOnNewInput,
  passGate,
  waiveGate,
  validNextStages,
  validPrevStages,
} from "../../src/flow/state-machine";
import type { FlowState, StageName } from "../../src/model/flow-state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TS = "2024-01-01T00:00:00.000Z";
const TS2 = "2024-01-02T00:00:00.000Z";

function makeState(currentStage: StageName, overrides: Partial<FlowState["gates"]> = {}): FlowState {
  return {
    currentStage,
    gates: {
      Extraction: "pending",
      GapAnalysis: "pending",
      Resolution: "pending",
      Review: "pending",
      ...overrides,
    },
    updatedAt: TS,
  };
}

function makePassedState(currentStage: StageName): FlowState {
  // Build a state where all gates up to and including the current stage's exit gate are "passed"
  const idx = stageIndex(currentStage);
  const gateMap: Record<string, StageName> = {
    Extraction: "Extraction",
    GapAnalysis: "GapAnalysis",
    Resolution: "Resolution",
    Review: "Review",
  };
  const overrides: Partial<FlowState["gates"]> = {};
  for (const [gate, stageName] of Object.entries(gateMap) as Array<[keyof FlowState["gates"], StageName]>) {
    if (stageIndex(stageName) <= idx) {
      overrides[gate] = "passed";
    }
  }
  return makeState(currentStage, overrides);
}

// ---------------------------------------------------------------------------
// stageIndex
// ---------------------------------------------------------------------------

describe("stageIndex", () => {
  it("returns 0 for Intake", () => {
    expect(stageIndex("Intake")).toBe(0);
  });

  it("returns correct indices for all stages", () => {
    STAGE_ORDER.forEach((name, i) => {
      expect(stageIndex(name)).toBe(i);
    });
  });
});

// ---------------------------------------------------------------------------
// initialFlowState
// ---------------------------------------------------------------------------

describe("initialFlowState", () => {
  it("starts at Intake with all gates pending", () => {
    const state = initialFlowState(TS);
    expect(state.currentStage).toBe("Intake");
    expect(state.gates.Extraction).toBe("pending");
    expect(state.gates.GapAnalysis).toBe("pending");
    expect(state.gates.Resolution).toBe("pending");
    expect(state.gates.Review).toBe("pending");
    expect(state.updatedAt).toBe(TS);
  });
});

// ---------------------------------------------------------------------------
// advanceStage — every valid forward transition
// ---------------------------------------------------------------------------

describe("advanceStage", () => {
  it("advances Intake → Extraction (no gate guards Intake exit)", () => {
    const state = makeState("Intake");
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.currentStage).toBe("Extraction");
      expect(result.state.updatedAt).toBe(TS2);
    }
  });

  it("advances Extraction → GapAnalysis when Extraction gate is passed", () => {
    const state = makeState("Extraction", { Extraction: "passed" });
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("GapAnalysis");
  });

  it("advances Extraction → GapAnalysis when Extraction gate is waived", () => {
    const state = makeState("Extraction", { Extraction: "waived" });
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("GapAnalysis");
  });

  it("blocks Extraction → GapAnalysis when Extraction gate is pending", () => {
    const state = makeState("Extraction");
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Extraction");
  });

  it("advances GapAnalysis → Resolution when GapAnalysis gate is passed", () => {
    const state = makeState("GapAnalysis", { GapAnalysis: "passed" });
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Resolution");
  });

  it("blocks GapAnalysis → Resolution when GapAnalysis gate is pending", () => {
    const state = makeState("GapAnalysis");
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(false);
  });

  it("advances Resolution → PRDDraft when Resolution gate is passed", () => {
    const state = makeState("Resolution", { Resolution: "passed" });
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("PRDDraft");
  });

  it("blocks Resolution → PRDDraft when Resolution gate is pending", () => {
    const state = makeState("Resolution");
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(false);
  });

  it("advances PRDDraft → Review (no gate guards PRDDraft exit)", () => {
    const state = makeState("PRDDraft");
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Review");
  });

  it("advances Review → Handoff when Review gate is passed", () => {
    const state = makeState("Review", { Review: "passed" });
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Handoff");
  });

  it("blocks Review → Handoff when Review gate is pending", () => {
    const state = makeState("Review");
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(false);
  });

  it("rejects advance from terminal Handoff stage", () => {
    const state = makeState("Handoff");
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("terminal");
  });

  it("preserves gate statuses when advancing", () => {
    const state = makeState("Extraction", { Extraction: "passed", GapAnalysis: "pending" });
    const result = advanceStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.gates.Extraction).toBe("passed");
      expect(result.state.gates.GapAnalysis).toBe("pending");
    }
  });
});

// ---------------------------------------------------------------------------
// retreatStage
// ---------------------------------------------------------------------------

describe("retreatStage", () => {
  it("retreats Handoff → Review", () => {
    const state = makeState("Handoff");
    const result = retreatStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Review");
  });

  it("retreats Review → PRDDraft", () => {
    const state = makeState("Review");
    const result = retreatStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("PRDDraft");
  });

  it("retreats PRDDraft → Resolution", () => {
    const state = makeState("PRDDraft");
    const result = retreatStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Resolution");
  });

  it("retreats Resolution → GapAnalysis", () => {
    const state = makeState("Resolution");
    const result = retreatStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("GapAnalysis");
  });

  it("retreats GapAnalysis → Extraction", () => {
    const state = makeState("GapAnalysis");
    const result = retreatStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Extraction");
  });

  it("retreats Extraction → Intake", () => {
    const state = makeState("Extraction");
    const result = retreatStage(state, TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Intake");
  });

  it("rejects retreat from initial Intake stage", () => {
    const state = makeState("Intake");
    const result = retreatStage(state, TS2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("initial");
  });
});

// ---------------------------------------------------------------------------
// transitionTo — single-step moves only
// ---------------------------------------------------------------------------

describe("transitionTo", () => {
  it("allows a forward single-step move that respects the gate", () => {
    const state = makeState("Extraction", { Extraction: "passed" });
    const result = transitionTo(state, "GapAnalysis", TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("GapAnalysis");
  });

  it("allows a backward single-step move", () => {
    const state = makeState("GapAnalysis");
    const result = transitionTo(state, "Extraction", TS2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.currentStage).toBe("Extraction");
  });

  it("rejects a same-stage no-op", () => {
    const state = makeState("Extraction");
    const result = transitionTo(state, "Extraction", TS2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Already at");
  });

  it("rejects a forward skip of two stages", () => {
    const state = makeState("Intake");
    const result = transitionTo(state, "GapAnalysis", TS2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Illegal transition");
  });

  it("rejects a backward skip of two stages", () => {
    const state = makeState("Resolution");
    const result = transitionTo(state, "Extraction", TS2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Illegal transition");
  });

  it("rejects a forward skip to a distant stage", () => {
    const state = makeState("Intake");
    const result = transitionTo(state, "Handoff", TS2);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loopbackOnNewInput
// ---------------------------------------------------------------------------

describe("loopbackOnNewInput", () => {
  it("resets currentStage to Extraction", () => {
    const state = makePassedState("Handoff");
    const result = loopbackOnNewInput(state, TS2);
    expect(result.currentStage).toBe(LOOPBACK_TARGET);
    expect(result.currentStage).toBe("Extraction");
  });

  it("resets all gates at or after Extraction to pending", () => {
    const state = makePassedState("Handoff");
    // Manually set all gates to passed
    const fullPassedState: FlowState = {
      ...state,
      gates: {
        Extraction: "passed",
        GapAnalysis: "passed",
        Resolution: "passed",
        Review: "passed",
      },
    };
    const result = loopbackOnNewInput(fullPassedState, TS2);
    expect(result.gates.Extraction).toBe("pending");
    expect(result.gates.GapAnalysis).toBe("pending");
    expect(result.gates.Resolution).toBe("pending");
    expect(result.gates.Review).toBe("pending");
  });

  it("loopback from Handoff resets all four gates", () => {
    const state: FlowState = {
      currentStage: "Handoff",
      gates: {
        Extraction: "waived",
        GapAnalysis: "passed",
        Resolution: "passed",
        Review: "waived",
      },
      updatedAt: TS,
    };
    const result = loopbackOnNewInput(state, TS2);
    expect(result.currentStage).toBe("Extraction");
    expect(result.gates.Extraction).toBe("pending");
    expect(result.gates.GapAnalysis).toBe("pending");
    expect(result.gates.Resolution).toBe("pending");
    expect(result.gates.Review).toBe("pending");
  });

  it("loopback from Extraction resets all four gates", () => {
    const state: FlowState = {
      currentStage: "Extraction",
      gates: {
        Extraction: "passed",
        GapAnalysis: "passed",
        Resolution: "passed",
        Review: "passed",
      },
      updatedAt: TS,
    };
    const result = loopbackOnNewInput(state, TS2);
    expect(result.currentStage).toBe("Extraction");
    expect(result.gates.Extraction).toBe("pending");
    expect(result.gates.GapAnalysis).toBe("pending");
    expect(result.gates.Resolution).toBe("pending");
    expect(result.gates.Review).toBe("pending");
  });

  it("updates updatedAt", () => {
    const state = makeState("Resolution");
    const result = loopbackOnNewInput(state, TS2);
    expect(result.updatedAt).toBe(TS2);
  });

  it("loopback from Intake stage also resets gates from Extraction onwards", () => {
    const state: FlowState = {
      currentStage: "Intake",
      gates: {
        Extraction: "passed",
        GapAnalysis: "passed",
        Resolution: "pending",
        Review: "pending",
      },
      updatedAt: TS,
    };
    const result = loopbackOnNewInput(state, TS2);
    expect(result.currentStage).toBe("Extraction");
    expect(result.gates.Extraction).toBe("pending");
    expect(result.gates.GapAnalysis).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// passGate / waiveGate
// ---------------------------------------------------------------------------

describe("passGate", () => {
  it("sets the specified gate to passed", () => {
    const state = makeState("Extraction");
    const result = passGate(state, "Extraction", TS2);
    expect(result.gates.Extraction).toBe("passed");
    expect(result.updatedAt).toBe(TS2);
  });

  it("does not mutate other gates", () => {
    const state = makeState("Resolution", { GapAnalysis: "passed" });
    const result = passGate(state, "Resolution", TS2);
    expect(result.gates.GapAnalysis).toBe("passed");
    expect(result.gates.Extraction).toBe("pending");
    expect(result.gates.Review).toBe("pending");
  });
});

describe("waiveGate", () => {
  it("sets the specified gate to waived", () => {
    const state = makeState("Resolution");
    const result = waiveGate(state, "Resolution", TS2);
    expect(result.gates.Resolution).toBe("waived");
    expect(result.updatedAt).toBe(TS2);
  });

  it("does not mutate other gates", () => {
    const state = makeState("Review");
    const result = waiveGate(state, "Review", TS2);
    expect(result.gates.Resolution).toBe("pending");
    expect(result.gates.Extraction).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// validNextStages / validPrevStages
// ---------------------------------------------------------------------------

describe("validNextStages", () => {
  it("returns [Extraction] for Intake", () => {
    expect(validNextStages("Intake")).toEqual(["Extraction"]);
  });

  it("returns [] for Handoff (terminal)", () => {
    expect(validNextStages("Handoff")).toEqual([]);
  });

  it("returns the correct next for every non-terminal stage", () => {
    const expected: Array<[StageName, StageName]> = [
      ["Intake", "Extraction"],
      ["Extraction", "GapAnalysis"],
      ["GapAnalysis", "Resolution"],
      ["Resolution", "PRDDraft"],
      ["PRDDraft", "Review"],
      ["Review", "Handoff"],
    ];
    for (const [from, to] of expected) {
      expect(validNextStages(from)).toEqual([to]);
    }
  });
});

describe("validPrevStages", () => {
  it("returns [] for Intake (initial)", () => {
    expect(validPrevStages("Intake")).toEqual([]);
  });

  it("returns [Review] for Handoff", () => {
    expect(validPrevStages("Handoff")).toEqual(["Review"]);
  });
});

// ---------------------------------------------------------------------------
// STAGE_ORDER constant
// ---------------------------------------------------------------------------

describe("STAGE_ORDER", () => {
  it("has exactly 7 stages", () => {
    expect(STAGE_ORDER).toHaveLength(7);
  });

  it("starts with Intake and ends with Handoff", () => {
    expect(STAGE_ORDER[0]).toBe("Intake");
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe("Handoff");
  });
});
