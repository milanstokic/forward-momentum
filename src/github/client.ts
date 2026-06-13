/**
 * GitHub Octokit client factory — authenticated or dry-run.
 *
 * Demo project config is bundled here as constants (no setup required for
 * non-engineering demo users). Fill in real values before running a live demo:
 *   DEMO_PROJECT.owner        — GitHub org / user that owns the repo
 *   DEMO_PROJECT.repo         — Repository name (must have Issues enabled)
 *   DEMO_PROJECT.projectNumber — GitHub Projects (v2) project number
 *
 * createClient() returns either:
 *   - An authenticated Octokit instance (live mode) whose calls hit the real API.
 *   - A DryRunClient (dry-run mode) that records intended operations in memory
 *     instead of executing them. T13 dispatch can call the same interface and
 *     log what it WOULD create when no credential is present.
 *
 * A meaningful error is only surfaced for genuinely broken configuration — e.g.
 * a token that is structurally invalid. A missing token → dry-run, not an error.
 */

import { Octokit } from "@octokit/rest";
import type { AuthResult } from "./auth.js";

// ---------------------------------------------------------------------------
// Demo project config — PLACEHOLDER VALUES, fill in before live demo
// ---------------------------------------------------------------------------

export interface ProjectConfig {
  /** GitHub org or username that owns the demo repo/project. */
  owner: string;
  /** Repository name for issues + project board. */
  repo: string;
  /** GitHub Projects (v2) project number (visible in the project URL). */
  projectNumber: number;
}

/**
 * Bundled demo project config.
 *
 * DEMO CONFIG — replace before running a live demo.
 * These values intentionally do not point at a real resource until a maintainer
 * fills them in. No secret, only public identifiers.
 */
export const DEMO_PROJECT: ProjectConfig = {
  owner: "YOUR_ORG_OR_USER", // DEMO CONFIG — replace with real owner
  repo: "YOUR_DEMO_REPO", // DEMO CONFIG — replace with real repo
  projectNumber: 1, // DEMO CONFIG — replace with real project number
};

// ---------------------------------------------------------------------------
// Dry-run client
// ---------------------------------------------------------------------------

/** A single recorded operation entry. */
export interface DryRunOperation {
  operation: string;
  params: Record<string, unknown>;
  recordedAt: string; // ISO timestamp
}

/**
 * Dry-run client — records intended GitHub API calls instead of executing them.
 *
 * T13 dispatch can call `createIssue()` / `addToProject()` on this interface
 * and the demo runs fully offline; the log is inspectable and loggable.
 */
export interface DryRunClient {
  readonly mode: "dry-run";
  /** All operations recorded so far, in call order. */
  readonly operations: DryRunOperation[];
  /**
   * Record that an issue WOULD be created.
   * Returns a fake issue number so callers can chain calls realistically.
   */
  recordCreateIssue(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
  }): DryRunOperation;
  /**
   * Record that an issue WOULD be added to a GitHub Project.
   */
  recordAddToProject(params: {
    projectNumber: number;
    issueNodeId: string;
  }): DryRunOperation;
}

/**
 * Authenticated Octokit client (live mode).
 * Wraps the raw Octokit instance and tags it with the project config so
 * dispatch code doesn't need to rediscover where to send requests.
 */
export interface LiveClient {
  readonly mode: "live";
  readonly octokit: Octokit;
  readonly project: ProjectConfig;
}

export type GitHubClient = LiveClient | DryRunClient;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a GitHub client appropriate for the given auth result.
 *
 * @param auth  Result from `resolveAuth()`.
 * @param project  Project config to use; defaults to {@link DEMO_PROJECT}.
 * @throws {Error} Only for genuinely broken config — e.g. a token that fails
 *   structural validation (not for a missing token, which → dry-run).
 */
export function createClient(
  auth: AuthResult,
  project: ProjectConfig = DEMO_PROJECT
): GitHubClient {
  if (auth.mode === "dry-run") {
    return makeDryRunClient();
  }

  // Live mode: validate the token structurally before constructing Octokit.
  // A GitHub token must be a non-empty string; beyond that, the API will reject
  // invalid credentials with a 401 — we don't need to do deeper validation here.
  if (!auth.token || auth.token.trim() === "") {
    throw new Error(
      "Forward Momentum: GitHub token is present but empty or whitespace-only. " +
        "Check the value stored in VSCode SecretStorage under the key " +
        "'forwardMomentum.githubToken' or the FORWARD_MOMENTUM_GH_TOKEN / " +
        "GITHUB_TOKEN environment variable."
    );
  }

  return {
    mode: "live",
    octokit: new Octokit({ auth: auth.token }),
    project,
  };
}

// ---------------------------------------------------------------------------
// Internal dry-run factory
// ---------------------------------------------------------------------------

function makeDryRunClient(): DryRunClient {
  const operations: DryRunOperation[] = [];

  function record(
    operation: string,
    params: Record<string, unknown>
  ): DryRunOperation {
    const entry: DryRunOperation = {
      operation,
      params,
      recordedAt: new Date().toISOString(),
    };
    operations.push(entry);
    return entry;
  }

  return {
    mode: "dry-run",
    get operations() {
      return operations;
    },
    recordCreateIssue(params) {
      return record("issues.create", params as Record<string, unknown>);
    },
    recordAddToProject(params) {
      return record("projects.addItem", params as Record<string, unknown>);
    },
  };
}
