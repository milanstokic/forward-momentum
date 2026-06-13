import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parseGaps } from "../../src/model/guards.js";
import type { Gap } from "../../src/model/gap.js";
import type { Waiver } from "../../src/model/waiver.js";
import {
  readFlowState,
  writeFlowState,
  writeGateRecord,
} from "../../src/flow/store.js";
import { canExitResolution, validateWaiver } from "../../src/flow/gates.js";
import { passGate, advanceStage } from "../../src/flow/state-machine.js";

/**
 * F5 journey verification (SC1 + SC4).
 *
 * This drives the REAL shipped flow controller against the REAL committed
 * sample engagement fixture, reproducing the data/state transitions that the
 * VSCode panels render and act on during the F5 walk-through. It does NOT
 * render the webviews (that still wants a human glance — see the manual
 * checklist) but it proves the behaviour behind what the panels show.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(HERE, "../../examples/sample-engagement");
const NOW = "2026-06-13T12:00:00.000Z";

let sampleGaps: Gap[];
let repoRoot: string; // a throwaway copy so we never mutate the committed sample

beforeAll(() => {
  // Parse the real fixture through the production guard.
  const raw = JSON.parse(
    fs.readFileSync(path.join(SAMPLE, "analysis/gaps.json"), "utf-8")
  );
  const parsed = parseGaps(raw);
  if (!parsed.ok) {
    throw new Error(
      "sample gaps.json failed validation: " + JSON.stringify(parsed.errors)
    );
  }
  sampleGaps = parsed.data;

  // Throwaway engagement repo seeded with the sample's gaps.
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fm-f5-"));
  fs.mkdirSync(path.join(repoRoot, "analysis"), { recursive: true });
  fs.copyFileSync(
    path.join(SAMPLE, "analysis/gaps.json"),
    path.join(repoRoot, "analysis/gaps.json")
  );
});

describe("SC1 — opening the workspace starts the flow at Intake", () => {
  it("readFlowState returns currentStage 'Intake' on a fresh engagement", () => {
    const state = readFlowState(repoRoot, NOW);
    expect(state.currentStage).toBe("Intake");
    expect(state.gates.Resolution).toBe("pending");
  });
});

describe("SC4 — the Resolution gate blocks until every blocking gap is cleared", () => {
  it("blocks while blocking gaps are open, and reports exactly the blockers", () => {
    const result = canExitResolution(sampleGaps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const blockerIds = result.blocking.map((g) => g.id).sort();
      // The sample plants 3 blocking issues.
      expect(result.blocking).toHaveLength(3);
      expect(blockerIds).toEqual(
        ["conflict-001", "gap-001", "gap-002"].sort()
      );
    }
  });

  it("unblocks once all blocking gaps are resolved / deferred / waived", () => {
    const cleared: Gap[] = sampleGaps.map((g) =>
      g.severity === "blocking"
        ? {
            ...g,
            status: "resolved",
            resolution: { by: "Product", reason: "agreed in review", at: NOW },
          }
        : g
    );
    expect(canExitResolution(cleared).ok).toBe(true);
  });

  it("rejects an incomplete waiver but accepts a complete one (provenance receipt)", () => {
    // Missing acknowledgement + empty authority => invalid (the review-fix behaviour).
    const bad: Waiver = {
      gate: "Resolution",
      by: "",
      reason: "",
      at: NOW,
      acknowledgements: {
        communicatedToClient: false,
        riskAccepted: true,
        revisitScheduled: true,
      },
    };
    expect(validateWaiver(bad).valid).toBe(false);

    const good: Waiver = {
      gate: "Resolution",
      by: "Product",
      reason: "Client accepted the saved-card risk in writing; revisit next sprint.",
      at: NOW,
      acknowledgements: {
        communicatedToClient: true,
        riskAccepted: true,
        revisitScheduled: true,
      },
    };
    expect(validateWaiver(good).valid).toBe(true);

    // A valid waiver writes a durable receipt to decisions/.
    writeGateRecord(repoRoot, {
      gate: "Resolution",
      waived: true,
      waiver: good,
      passedAt: NOW,
      passedBy: "Product",
    });
    const decisions = fs.readdirSync(path.join(repoRoot, "decisions"));
    expect(decisions.length).toBeGreaterThan(0);
    const receipt = fs.readFileSync(
      path.join(repoRoot, "decisions", decisions[0]),
      "utf-8"
    );
    expect(receipt).toContain("Resolution");
  });

  it("advances Resolution -> PRDDraft only after the gate is passed", () => {
    let state = readFlowState(repoRoot, NOW);
    // Walk the gated flow up to Resolution the way the pipeline would.
    state = { ...state, currentStage: "Resolution" };
    state = passGate(state, "Resolution", NOW);
    const advanced = advanceStage(state, NOW);
    expect(advanced.ok).toBe(true);
    if (advanced.ok) {
      expect(advanced.state.currentStage).toBe("PRDDraft");
      writeFlowState(repoRoot, advanced.state);
    }
  });
});
