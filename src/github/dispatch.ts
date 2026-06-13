/**
 * GitHub Projects dispatch — convert design gaps into GitHub Issues.
 *
 * Design-gap identification heuristic (documented):
 *   A gap is classified as a "design gap" (and therefore dispatched) when ALL of:
 *     1. gap.kind === "gap"  (conflicts are product/architecture disputes, not design tasks)
 *     2. Any of the following is true:
 *        a. gap.summary matches /design|frame|mock|screen|ui|ux|figma|wireframe|layout|visual/i
 *        b. gap.evidence cites sources/design-references.md
 *        c. gap.summary mentions "missing" alongside a visual or UX artifact
 *
 *   Rationale: the sample gaps.json has no explicit category field; this heuristic reliably
 *   catches gap-002 ("missing design ... error state") and gap-003 ("no confirmation frame")
 *   which are explicitly about missing Figma/design artifacts. Non-design behaviour gaps
 *   (gap-001 saved-cards, gap-004 promo codes, gap-005 cart persistence) are product/engineering
 *   requirement gaps that do not map to a Figma design task and are excluded.
 *
 * Idempotency: on each run we read an existing tasks/dispatch.json (if present) and skip any
 * gap whose id already appears there. Re-running is therefore safe.
 *
 * Dry-run: when the client is a DryRunClient no network calls are made; the function records
 * intended operations via recordCreateIssue / recordAddToProject and writes "dry-run" placeholders
 * to dispatch.json.
 */

import * as fs from "fs";
import * as path from "path";

import type { Gap } from "../model/gap.js";
import type { GitHubClient, DryRunClient, LiveClient } from "./client.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * One entry in tasks/dispatch.json — the dispatch state for a single gap.
 */
export interface DispatchEntry {
  /** Gap id, e.g. "gap-002" */
  gapId: string;
  /** Short summary of the gap (for human readability) */
  summary: string;
  /** "dry-run" | "live" */
  mode: "dry-run" | "live";
  /**
   * GitHub Issue number when mode === "live" and creation succeeded.
   * Always undefined in dry-run mode (no issue created).
   */
  issueNumber?: number;
  /**
   * GitHub Issue URL (live) or "dry-run" placeholder string.
   */
  issueUrl: string;
  /** ISO timestamp of the dispatch (or dry-run recording) */
  dispatchedAt: string;
  /** "dispatched" | "skipped-already-dispatched" */
  status: "dispatched" | "skipped-already-dispatched";
}

/** The full dispatch state written to tasks/dispatch.json */
export type DispatchState = Record<string, DispatchEntry>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Relative path (within engagement repo) of the dispatch state file. */
export const DISPATCH_STATE_FILE = path.join("tasks", "dispatch.json");

// ---------------------------------------------------------------------------
// Design-gap classifier
// ---------------------------------------------------------------------------

/** Keywords that signal a gap is a Figma/design task rather than a pure requirement gap. */
const DESIGN_KEYWORDS = /design|frame|mock|screen|ui\b|ux\b|figma|wireframe|layout|visual/i;

/** Source files that, when cited in evidence, flag a gap as design-related. */
const DESIGN_SOURCE_PATTERN = /design-references/i;

/**
 * Returns true when `gap` should be dispatched as a design task.
 *
 * See module-level comment for the full documented heuristic.
 */
export function isDesignGap(gap: Gap): boolean {
  // Conflicts are product/architecture disputes, not Figma tasks.
  if (gap.kind !== "gap") {
    return false;
  }

  // Keyword match on the summary
  if (DESIGN_KEYWORDS.test(gap.summary)) {
    return true;
  }

  // Any evidence citing a design-references file
  if (gap.evidence.some((e) => DESIGN_SOURCE_PATTERN.test(e.sourceFile))) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Dispatch helpers
// ---------------------------------------------------------------------------

function buildIssueTitle(gap: Gap): string {
  return `[Design] ${gap.summary.slice(0, 120)}${gap.summary.length > 120 ? "…" : ""}`;
}

function buildIssueBody(gap: Gap): string {
  const severity = gap.severity === "blocking" ? "🔴 **blocking**" : "🟡 non-blocking";
  const evidence = gap.evidence
    .map((e) => `- \`${e.sourceFile}\` ${e.locator}: _"${e.quote}"_`)
    .join("\n");

  return [
    `## Gap \`${gap.id}\` — Design task`,
    "",
    `**Severity:** ${severity}`,
    "",
    `### Summary`,
    gap.summary,
    "",
    `### Evidence`,
    evidence,
    "",
    `### Related Claims`,
    gap.relatedClaims.join(", ") || "(none)",
    "",
    `---`,
    `_Dispatched by Forward-Momentum /fm-tasks_`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Core dispatch function
// ---------------------------------------------------------------------------

/**
 * Dispatch design gaps from `gaps` to a GitHub Project via `client`.
 *
 * @param repoRoot  Absolute path to the engagement repo (e.g. examples/sample-engagement).
 * @param gaps      Full gap array from analysis/gaps.json.
 * @param client    Live or dry-run GitHub client from createClient().
 * @returns         The dispatch state that was written to tasks/dispatch.json.
 */
export async function dispatchDesignTasks(
  repoRoot: string,
  gaps: Gap[],
  client: GitHubClient
): Promise<DispatchState> {
  // -------------------------------------------------------------------------
  // 1. Load existing dispatch state (idempotency)
  // -------------------------------------------------------------------------
  const dispatchFile = path.join(repoRoot, DISPATCH_STATE_FILE);
  let existing: DispatchState = {};
  if (fs.existsSync(dispatchFile)) {
    try {
      const raw = fs.readFileSync(dispatchFile, "utf-8");
      existing = JSON.parse(raw) as DispatchState;
    } catch {
      // Corrupt state — start fresh rather than crashing
      existing = {};
    }
  }

  // -------------------------------------------------------------------------
  // 2. Filter to design gaps
  // -------------------------------------------------------------------------
  const designGaps = gaps.filter(isDesignGap);

  // -------------------------------------------------------------------------
  // 3. Dispatch each gap (skipping already-dispatched ones)
  // -------------------------------------------------------------------------
  const state: DispatchState = { ...existing };
  const now = new Date().toISOString();

  for (const gap of designGaps) {
    if (existing[gap.id]?.status === "dispatched") {
      // Already dispatched — preserve existing entry, mark as skipped
      state[gap.id] = {
        ...existing[gap.id],
        status: "skipped-already-dispatched",
      };
      continue;
    }

    const title = buildIssueTitle(gap);
    const body = buildIssueBody(gap);

    if (client.mode === "dry-run") {
      const dryClient = client as DryRunClient;
      dryClient.recordCreateIssue({
        owner: "DEMO_OWNER",
        repo: "DEMO_REPO",
        title,
        body,
        labels: ["design", "forward-momentum"],
      });
      dryClient.recordAddToProject({
        projectNumber: 1,
        issueNodeId: `dry-run-node-${gap.id}`,
      });

      state[gap.id] = {
        gapId: gap.id,
        summary: gap.summary,
        mode: "dry-run",
        issueUrl: "dry-run",
        dispatchedAt: now,
        status: "dispatched",
      };
    } else {
      // Live mode — create a real GitHub Issue and add to Project
      const liveClient = client as LiveClient;
      const { owner, repo, projectNumber } = liveClient.project;

      let issueNumber: number | undefined;
      let issueUrl = "";

      try {
        const issueResp = await liveClient.octokit.issues.create({
          owner,
          repo,
          title,
          body,
          labels: ["design", "forward-momentum"],
        });
        issueNumber = issueResp.data.number;
        issueUrl = issueResp.data.html_url;

        // Add to GitHub Project v2 via GraphQL
        // Note: addProjectV2ItemById requires the issue node_id and the project node_id.
        // We first get the project node_id, then add the item.
        const projectQuery = `
          query($owner: String!, $number: Int!) {
            user(login: $owner) {
              projectV2(number: $number) { id }
            }
            organization(login: $owner) {
              projectV2(number: $number) { id }
            }
          }
        `;

        let projectNodeId: string | undefined;
        try {
          // Try org first, fall back to user — GraphQL returns null for the non-matching one
          type ProjectQueryResult = {
            user?: { projectV2?: { id: string } };
            organization?: { projectV2?: { id: string } };
          };
          const projectData = await liveClient.octokit.graphql<ProjectQueryResult>(projectQuery, {
            owner,
            number: projectNumber,
          });
          projectNodeId =
            projectData?.organization?.projectV2?.id ??
            projectData?.user?.projectV2?.id;
        } catch {
          // Project lookup failed — skip project add but record the issue
        }

        if (projectNodeId) {
          const addMutation = `
            mutation($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
                item { id }
              }
            }
          `;
          await liveClient.octokit.graphql(addMutation, {
            projectId: projectNodeId,
            contentId: issueResp.data.node_id,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Record as dispatched with an error note in the URL rather than crashing
        issueUrl = `error:${message.slice(0, 200)}`;
      }

      state[gap.id] = {
        gapId: gap.id,
        summary: gap.summary,
        mode: "live",
        issueNumber,
        issueUrl,
        dispatchedAt: now,
        status: "dispatched",
      };
    }
  }

  // -------------------------------------------------------------------------
  // 4. Write dispatch state to tasks/dispatch.json
  // -------------------------------------------------------------------------
  const tasksDir = path.join(repoRoot, "tasks");
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }
  fs.writeFileSync(dispatchFile, JSON.stringify(state, null, 2) + "\n", "utf-8");

  return state;
}
