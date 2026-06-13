/**
 * Tests for src/github/auth.ts
 *
 * SecretStorage is injected as a mock — no vscode runtime required.
 * No real token values are used or committed.
 */

import { describe, it, expect } from "vitest";
import {
  resolveAuth,
  SECRET_STORAGE_KEY,
  ENV_KEY_PRIMARY,
  ENV_KEY_FALLBACK,
} from "../../src/github/auth";
import type { SecretStorageLike } from "../../src/github/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A mock SecretStorage that returns a pre-set value (or undefined). */
function mockStorage(value: string | undefined): SecretStorageLike {
  return {
    async get(key: string) {
      // Only respond to the expected key; ignore others.
      return key === SECRET_STORAGE_KEY ? value : undefined;
    },
  };
}

/** A blank environment with no GitHub-related vars. */
function emptyEnv(): Record<string, string | undefined> {
  return {};
}

// ---------------------------------------------------------------------------
// Suite 1: token present in SecretStorage → live mode
// ---------------------------------------------------------------------------

describe("resolveAuth — token in SecretStorage", () => {
  it("returns live mode when SecretStorage has a token", async () => {
    const storage = mockStorage("ghp_FAKE_STORAGE_TOKEN");
    const result = await resolveAuth(storage, emptyEnv());

    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.token).toBe("ghp_FAKE_STORAGE_TOKEN");
    }
  });

  it("uses the configured SECRET_STORAGE_KEY", async () => {
    let capturedKey: string | undefined;
    const storage: SecretStorageLike = {
      async get(key: string) {
        capturedKey = key;
        return "ghp_FAKE_STORAGE_TOKEN";
      },
    };

    await resolveAuth(storage, emptyEnv());
    expect(capturedKey).toBe(SECRET_STORAGE_KEY);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: no credential at all → dry-run (not an error)
// ---------------------------------------------------------------------------

describe("resolveAuth — no credential → dry-run", () => {
  it("returns dry-run when SecretStorage is absent and env is empty", async () => {
    const result = await resolveAuth(undefined, emptyEnv());
    expect(result.mode).toBe("dry-run");
  });

  it("returns dry-run when SecretStorage returns undefined and env is empty", async () => {
    const storage = mockStorage(undefined);
    const result = await resolveAuth(storage, emptyEnv());
    expect(result.mode).toBe("dry-run");
  });

  it("does NOT throw when no credential is present", async () => {
    await expect(resolveAuth(undefined, emptyEnv())).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: env fallback — primary env var
// ---------------------------------------------------------------------------

describe("resolveAuth — primary env var fallback", () => {
  it("returns live mode when FORWARD_MOMENTUM_GH_TOKEN is set", async () => {
    const env = { [ENV_KEY_PRIMARY]: "ghp_FAKE_PRIMARY_ENV" };
    const result = await resolveAuth(undefined, env);

    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.token).toBe("ghp_FAKE_PRIMARY_ENV");
    }
  });

  it("uses FORWARD_MOMENTUM_GH_TOKEN even when GITHUB_TOKEN is also set", async () => {
    const env = {
      [ENV_KEY_PRIMARY]: "ghp_FAKE_PRIMARY_ENV",
      [ENV_KEY_FALLBACK]: "ghp_FAKE_FALLBACK_ENV",
    };
    const result = await resolveAuth(undefined, env);

    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      // Primary must win over fallback
      expect(result.token).toBe("ghp_FAKE_PRIMARY_ENV");
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 4: env fallback — generic GITHUB_TOKEN
// ---------------------------------------------------------------------------

describe("resolveAuth — GITHUB_TOKEN fallback", () => {
  it("returns live mode when only GITHUB_TOKEN is set", async () => {
    const env = { [ENV_KEY_FALLBACK]: "ghp_FAKE_FALLBACK_ENV" };
    const result = await resolveAuth(undefined, env);

    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.token).toBe("ghp_FAKE_FALLBACK_ENV");
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 5: SecretStorage wins over env vars (priority order)
// ---------------------------------------------------------------------------

describe("resolveAuth — SecretStorage takes priority over env", () => {
  it("prefers SecretStorage token over FORWARD_MOMENTUM_GH_TOKEN", async () => {
    const storage = mockStorage("ghp_FAKE_STORAGE_TOKEN");
    const env = { [ENV_KEY_PRIMARY]: "ghp_FAKE_PRIMARY_ENV" };
    const result = await resolveAuth(storage, env);

    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.token).toBe("ghp_FAKE_STORAGE_TOKEN");
    }
  });

  it("prefers SecretStorage token over GITHUB_TOKEN", async () => {
    const storage = mockStorage("ghp_FAKE_STORAGE_TOKEN");
    const env = { [ENV_KEY_FALLBACK]: "ghp_FAKE_FALLBACK_ENV" };
    const result = await resolveAuth(storage, env);

    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.token).toBe("ghp_FAKE_STORAGE_TOKEN");
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 6: SecretStorage returns empty string — falls through to env
// ---------------------------------------------------------------------------

describe("resolveAuth — empty SecretStorage value falls through", () => {
  it("falls through to env when SecretStorage returns empty string", async () => {
    const storage = mockStorage("");
    const env = { [ENV_KEY_PRIMARY]: "ghp_FAKE_PRIMARY_ENV" };
    const result = await resolveAuth(storage, env);

    // Empty string is falsy → should fall through to env
    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.token).toBe("ghp_FAKE_PRIMARY_ENV");
    }
  });

  it("returns dry-run when SecretStorage returns empty string and env is empty", async () => {
    const storage = mockStorage("");
    const result = await resolveAuth(storage, emptyEnv());
    expect(result.mode).toBe("dry-run");
  });
});

// ---------------------------------------------------------------------------
// Suite 7: discriminated union shape
// ---------------------------------------------------------------------------

describe("resolveAuth — result shape", () => {
  it("live result has mode and token, nothing else required", async () => {
    const storage = mockStorage("ghp_FAKE_STORAGE_TOKEN");
    const result = await resolveAuth(storage, emptyEnv());

    expect(result).toHaveProperty("mode", "live");
    expect(result).toHaveProperty("token");
  });

  it("dry-run result has mode only", async () => {
    const result = await resolveAuth(undefined, emptyEnv());
    expect(result).toHaveProperty("mode", "dry-run");
    expect(result).not.toHaveProperty("token");
  });
});
