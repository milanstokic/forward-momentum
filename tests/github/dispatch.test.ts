/**
 * Tests for src/github/dispatch.ts
 *
 * All tests use a DryRunClient — no real GitHub API calls, no token required.
 * A temporary directory is used as the repoRoot so tests are fully isolated.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  dispatchDesignTasks,
  isDesignGap,
  DISPATCH_STATE_FILE,
  type DispatchState,
} from "../../src/github/dispatch";

import { createClient } from "../../src/github/client";
import type { Gap } from "../../src/model/gap";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temporary directory for an engagement repo root. Cleaned up afterEach. */
function makeTempRepoRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fm-dispatch-test-"));
}

/** Remove a directory tree recursively. */
function rmdirRecursive(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Build a dry-run GitHubClient (no token, no network). */
function makeDryRunClient() {
  return createClient({ mode: "dry-run" });
}

// ---------------------------------------------------------------------------
// Sample gaps (subset of examples/sample-engagement/analysis/gaps.json)
// ---------------------------------------------------------------------------

const CONFLICT_GAP: Gap = {
  id: "conflict-001",
  kind: "conflict",
  severity: "blocking",
  summary: "Account model contradiction: guest checkout vs sign-in required",
  relatedClaims: ["claim-004", "claim-009"],
  evidence: [
    {
      sourceFile: "sources/kickoff-call.md",
      locator: "L19",
      quote: "guest checkout is a must-have",
    },
  ],
  status: "open",
};

const GAP_DESIGN_SCREEN: Gap = {
  id: "gap-002",
  kind: "gap",
  severity: "blocking",
  summary:
    "A declined / failed-payment error state is a named pain point in the call, but no error-state frame exists in the design references — the designs stop at the happy path. A missing design that blocks the payment step.",
  relatedClaims: ["claim-010"],
  evidence: [
    {
      sourceFile: "sources/design-references.md",
      locator: "L23",
      quote: "Not yet mocked: still working through the back half of the flow.",
    },
  ],
  status: "open",
};

const GAP_DESIGN_FRAME: Gap = {
  id: "gap-003",
  kind: "gap",
  severity: "non-blocking",
  summary:
    "The order-confirmation screen is described in the call as 'the payoff' but no confirmation frame appears in the design references.",
  relatedClaims: ["claim-011"],
  evidence: [
    {
      sourceFile: "sources/kickoff-call.md",
      locator: "L37",
      quote: "after they place the order, they land on a confirmation screen",
    },
  ],
  status: "open",
};

const GAP_NON_DESIGN: Gap = {
  id: "gap-001",
  kind: "gap",
  severity: "blocking",
  summary:
    "Saved-card behavior is explicitly parked and never resolved, yet guest checkout and wallets ship this release.",
  relatedClaims: ["claim-008"],
  evidence: [
    {
      sourceFile: "sources/kickoff-call.md",
      locator: "L31",
      quote: "Let's come back to the saved cards thing",
    },
  ],
  status: "open",
};

const GAP_NON_DESIGN_2: Gap = {
  id: "gap-004",
  kind: "gap",
  severity: "non-blocking",
  summary:
    "Promo / discount code handling is acknowledged but never specified — there is no requirement for where a code is entered.",
  relatedClaims: ["claim-012"],
  evidence: [
    {
      sourceFile: "sources/product-notes.md",
      locator: "L35",
      quote: "Marketing runs 'first order 20% off' promos",
    },
  ],
  status: "open",
};

/** All sample gaps */
const ALL_GAPS: Gap[] = [
  CONFLICT_GAP,
  GAP_DESIGN_SCREEN,
  GAP_DESIGN_FRAME,
  GAP_NON_DESIGN,
  GAP_NON_DESIGN_2,
];

// ---------------------------------------------------------------------------
// Suite: isDesignGap classifier
// ---------------------------------------------------------------------------

describe("isDesignGap — classifier", () => {
  it("excludes conflicts (kind !== 'gap')", () => {
    expect(isDesignGap(CONFLICT_GAP)).toBe(false);
  });

  it("includes gaps with 'design' keyword in summary", () => {
    expect(isDesignGap(GAP_DESIGN_SCREEN)).toBe(true);
  });

  it("includes gaps with 'frame' keyword in summary", () => {
    expect(isDesignGap(GAP_DESIGN_FRAME)).toBe(true);
  });

  it("includes gaps with 'screen' keyword in summary", () => {
    const gap: Gap = {
      ...GAP_NON_DESIGN,
      id: "gap-x",
      summary: "No confirmation screen designed yet for the payment flow.",
    };
    expect(isDesignGap(gap)).toBe(true);
  });

  it("includes gaps whose evidence cites design-references source", () => {
    const gap: Gap = {
      ...GAP_NON_DESIGN,
      id: "gap-y",
      summary: "Some behavior gap with no design keywords",
      evidence: [
        {
          sourceFile: "sources/design-references.md",
          locator: "L10",
          quote: "placeholder",
        },
      ],
    };
    expect(isDesignGap(gap)).toBe(true);
  });

  it("excludes non-design requirement gaps (saved-card, no design keywords)", () => {
    expect(isDesignGap(GAP_NON_DESIGN)).toBe(false);
  });

  it("excludes non-design promo-code gap", () => {
    expect(isDesignGap(GAP_NON_DESIGN_2)).toBe(false);
  });

  it("includes 'mock' keyword", () => {
    const gap: Gap = {
      ...GAP_NON_DESIGN,
      id: "gap-z",
      summary: "No mock provided for the error state.",
    };
    expect(isDesignGap(gap)).toBe(true);
  });

  it("is case-insensitive for keywords", () => {
    const gap: Gap = {
      ...GAP_NON_DESIGN,
      id: "gap-ci",
      summary: "DESIGN frame missing for the confirmation screen MOCK",
    };
    expect(isDesignGap(gap)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: dispatchDesignTasks — dry-run
// ---------------------------------------------------------------------------

describe("dispatchDesignTasks — dry-run mode", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeTempRepoRoot();
  });

  afterEach(() => {
    rmdirRecursive(repoRoot);
  });

  it("creates tasks/ directory and writes dispatch.json", async () => {
    const client = makeDryRunClient();
    await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    const dispatchFile = path.join(repoRoot, DISPATCH_STATE_FILE);
    expect(fs.existsSync(dispatchFile)).toBe(true);
  });

  it("dispatch.json is valid JSON", async () => {
    const client = makeDryRunClient();
    await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    const raw = fs.readFileSync(path.join(repoRoot, DISPATCH_STATE_FILE), "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("only dispatches design gaps (gap-002 and gap-003 from sample)", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    expect(Object.keys(state)).toContain("gap-002");
    expect(Object.keys(state)).toContain("gap-003");
  });

  it("does not dispatch the conflict", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    expect(Object.keys(state)).not.toContain("conflict-001");
  });

  it("does not dispatch non-design gaps (gap-001, gap-004)", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    expect(Object.keys(state)).not.toContain("gap-001");
    expect(Object.keys(state)).not.toContain("gap-004");
  });

  it("records mode=dry-run for dispatched entries", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    expect(state["gap-002"]?.mode).toBe("dry-run");
    expect(state["gap-003"]?.mode).toBe("dry-run");
  });

  it("records issueUrl='dry-run' for dispatched entries", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    expect(state["gap-002"]?.issueUrl).toBe("dry-run");
    expect(state["gap-003"]?.issueUrl).toBe("dry-run");
  });

  it("records status=dispatched for dispatched entries", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    expect(state["gap-002"]?.status).toBe("dispatched");
    expect(state["gap-003"]?.status).toBe("dispatched");
  });

  it("records the gap summary in the dispatch entry", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    expect(state["gap-002"]?.summary).toBe(GAP_DESIGN_SCREEN.summary);
  });

  it("records a dispatchedAt ISO timestamp", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    const ts = state["gap-002"]?.dispatchedAt;
    expect(ts).toBeTruthy();
    expect(new Date(ts!).getTime()).toBeGreaterThan(0);
  });

  it("records createIssue operations in the dry-run client", async () => {
    const client = makeDryRunClient();
    await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    if (client.mode !== "dry-run") throw new Error("Expected dry-run client");
    const createOps = client.operations.filter((op) => op.operation === "issues.create");
    expect(createOps.length).toBe(2); // gap-002 and gap-003
  });

  it("records addToProject operations in the dry-run client", async () => {
    const client = makeDryRunClient();
    await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    if (client.mode !== "dry-run") throw new Error("Expected dry-run client");
    const addOps = client.operations.filter((op) => op.operation === "projects.addItem");
    expect(addOps.length).toBe(2); // one per design gap
  });

  it("issue titles include [Design] prefix", async () => {
    const client = makeDryRunClient();
    await dispatchDesignTasks(repoRoot, ALL_GAPS, client);

    if (client.mode !== "dry-run") throw new Error("Expected dry-run client");
    const createOps = client.operations.filter((op) => op.operation === "issues.create");
    for (const op of createOps) {
      expect(String(op.params.title)).toMatch(/^\[Design\]/);
    }
  });

  it("is idempotent — skips already-dispatched gaps on second run", async () => {
    const client1 = makeDryRunClient();
    await dispatchDesignTasks(repoRoot, ALL_GAPS, client1);

    // Second run with a fresh client
    const client2 = makeDryRunClient();
    const state2 = await dispatchDesignTasks(repoRoot, ALL_GAPS, client2);

    // Both design gaps should be skipped
    expect(state2["gap-002"]?.status).toBe("skipped-already-dispatched");
    expect(state2["gap-003"]?.status).toBe("skipped-already-dispatched");

    // No new operations recorded for the second client
    if (client2.mode !== "dry-run") throw new Error("Expected dry-run client");
    expect(client2.operations.length).toBe(0);
  });

  it("handles an empty gap array gracefully", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, [], client);

    expect(Object.keys(state)).toHaveLength(0);
    const dispatchFile = path.join(repoRoot, DISPATCH_STATE_FILE);
    expect(fs.existsSync(dispatchFile)).toBe(true);
  });

  it("handles a gap array with no design gaps", async () => {
    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(
      repoRoot,
      [CONFLICT_GAP, GAP_NON_DESIGN, GAP_NON_DESIGN_2],
      client
    );

    expect(Object.keys(state)).toHaveLength(0);
  });

  it("preserves pre-existing non-design entries in dispatch.json if present", async () => {
    // Pre-seed dispatch.json with an unrelated entry
    const tasksDir = path.join(repoRoot, "tasks");
    fs.mkdirSync(tasksDir, { recursive: true });
    const existing: DispatchState = {
      "gap-999": {
        gapId: "gap-999",
        summary: "Pre-existing entry",
        mode: "dry-run",
        issueUrl: "dry-run",
        dispatchedAt: "2026-01-01T00:00:00.000Z",
        status: "dispatched",
      },
    };
    fs.writeFileSync(
      path.join(repoRoot, DISPATCH_STATE_FILE),
      JSON.stringify(existing, null, 2),
      "utf-8"
    );

    const client = makeDryRunClient();
    const state = await dispatchDesignTasks(repoRoot, [GAP_DESIGN_SCREEN], client);

    // Pre-existing entry should still be there
    expect(state["gap-999"]).toBeDefined();
    // New design gap should also be there
    expect(state["gap-002"]).toBeDefined();
  });

  it("runs with no GitHub token (resolveAuth not called — client injected)", async () => {
    // The dry-run client is injected directly, no token resolution needed.
    // This test confirms the function works with no ambient env token.
    const originalEnv = { ...process.env };
    delete process.env.FORWARD_MOMENTUM_GH_TOKEN;
    delete process.env.GITHUB_TOKEN;

    try {
      const client = makeDryRunClient();
      const state = await dispatchDesignTasks(repoRoot, ALL_GAPS, client);
      expect(Object.keys(state).length).toBeGreaterThan(0);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });
});
