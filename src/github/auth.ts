/**
 * GitHub auth plumbing — zero-setup demo, dry-run capable.
 *
 * Resolution order (first truthy wins):
 *   1. VSCode SecretStorage  (key: forwardMomentum.githubToken)
 *   2. FORWARD_MOMENTUM_GH_TOKEN env var
 *   3. GITHUB_TOKEN env var
 *   4. → dry-run (missing credential is NOT an error)
 *
 * The SecretStorage dependency is injected so this module is testable without
 * the vscode runtime. Only `import type` is used for vscode types — they are
 * erased at compile time and produce no runtime dependency.
 */

import type { SecretStorage } from "vscode";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Returned when a real GitHub credential is available. */
export interface LiveAuth {
  mode: "live";
  token: string;
}

/** Returned when no credential is configured — the happy offline/demo path. */
export interface DryRunAuth {
  mode: "dry-run";
}

export type AuthResult = LiveAuth | DryRunAuth;

// ---------------------------------------------------------------------------
// SecretStorage-like interface (narrow — only what we need)
// ---------------------------------------------------------------------------

/**
 * Minimal subset of the VSCode SecretStorage API.
 * Accepting this interface (rather than the concrete vscode type) lets tests
 * inject a simple mock object without any vscode runtime present.
 */
export interface SecretStorageLike {
  get(key: string): Promise<string | undefined>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The SecretStorage key used to store the GitHub token. */
export const SECRET_STORAGE_KEY = "forwardMomentum.githubToken";

/** Primary env var name — prefer this over the generic GITHUB_TOKEN. */
export const ENV_KEY_PRIMARY = "FORWARD_MOMENTUM_GH_TOKEN";

/** Generic fallback env var — widely used by CI and GitHub Actions runners. */
export const ENV_KEY_FALLBACK = "GITHUB_TOKEN";

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Resolve a GitHub credential using the priority order above.
 *
 * @param secretStorage  An object satisfying {@link SecretStorageLike}.
 *   Pass `undefined` when SecretStorage is unavailable (e.g. in pure-node
 *   tests or CLI contexts). In the extension, pass the real vscode
 *   `SecretStorage` — it already satisfies the interface.
 * @param env  Process environment map. Defaults to `process.env`. Override
 *   in tests to avoid polluting the real environment.
 *
 * @returns `{ mode: "live", token }` when any credential is found,
 *          `{ mode: "dry-run" }` otherwise — never throws for a missing cred.
 */
export async function resolveAuth(
  secretStorage: SecretStorageLike | undefined,
  env: Record<string, string | undefined> = process.env
): Promise<AuthResult> {
  // 1. Try VSCode SecretStorage
  if (secretStorage !== undefined) {
    const stored = await secretStorage.get(SECRET_STORAGE_KEY);
    if (stored) {
      return { mode: "live", token: stored };
    }
  }

  // 2. Try primary env var
  const primary = env[ENV_KEY_PRIMARY];
  if (primary) {
    return { mode: "live", token: primary };
  }

  // 3. Try generic GitHub token env var
  const fallback = env[ENV_KEY_FALLBACK];
  if (fallback) {
    return { mode: "live", token: fallback };
  }

  // 4. No credential — dry-run (valid demo path, not an error)
  return { mode: "dry-run" };
}

// Re-export for convenience so callers don't have to import vscode types
export type { SecretStorage };
