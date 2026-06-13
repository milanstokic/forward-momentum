/**
 * CLI runner — invokes the `claude` CLI as a subprocess to execute a skill
 * command (e.g. `/fm-extract`, `/fm-gaps`) with the engagement repo as cwd.
 *
 * Design principles:
 *  - Injectable spawn function so the caller can substitute a mock in tests.
 *  - Timeout is enforced externally via a race between the subprocess promise
 *    and a timer promise; the subprocess is killed on timeout.
 *  - Returns a structured RunResult; never swallows errors silently.
 *  - No I/O side-effects beyond spawning the child process.
 */

import type { ChildProcess } from "child_process";
import { spawn as nodeSpawn } from "child_process";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

/** A typed error thrown when the subprocess times out. */
export class CliTimeoutError extends Error {
  constructor(
    public readonly command: string,
    public readonly timeoutMs: number
  ) {
    super(`CLI command "${command}" timed out after ${timeoutMs}ms`);
    this.name = "CliTimeoutError";
  }
}

/** A typed error thrown for unexpected spawn failures (e.g. ENOENT). */
export class CliSpawnError extends Error {
  constructor(
    public readonly command: string,
    public readonly cause: Error
  ) {
    super(`Failed to spawn CLI command "${command}": ${cause.message}`);
    this.name = "CliSpawnError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// SpawnFn injectable interface
// ---------------------------------------------------------------------------

/**
 * Minimal interface of the Node `spawn` function used by runCliCommand.
 * Tests may substitute a mock implementation.
 */
export type SpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; shell?: boolean }
) => ChildProcess;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RunCliOptions {
  /** Absolute path to the engagement repo root (used as cwd for claude CLI). */
  cwd: string;
  /**
   * Timeout in milliseconds. The subprocess is killed and CliTimeoutError is
   * thrown if the process does not finish within this window.
   * Default: 120_000 (2 minutes).
   */
  timeoutMs?: number;
  /**
   * Injectable spawn function. Defaults to Node's `child_process.spawn`.
   * Pass a mock in tests.
   */
  spawnFn?: SpawnFn;
}

// ---------------------------------------------------------------------------
// runCliCommand
// ---------------------------------------------------------------------------

/**
 * Run `claude <slashCommand>` in the given engagement repo directory.
 *
 * @param slashCommand  The slash command to run, e.g. "/fm-extract". The
 *   leading slash is preserved so the string is passed as `claude /fm-extract`.
 * @param options       Execution options (cwd, timeout, injectable spawnFn).
 * @returns RunResult   Structured result with ok/exitCode/stdout/stderr.
 * @throws CliTimeoutError  if the process times out.
 * @throws CliSpawnError    if the process cannot be spawned.
 */
export async function runCliCommand(
  slashCommand: string,
  options: RunCliOptions
): Promise<RunResult> {
  const { cwd, timeoutMs = 120_000, spawnFn = nodeSpawn } = options;

  // claude CLI expects a plain string prompt when invoked non-interactively.
  // We pass the command name as the first positional argument.
  const args = [slashCommand, "--print"];

  let child: ChildProcess;
  try {
    child = spawnFn("claude", args, { cwd });
  } catch (err) {
    throw new CliSpawnError(slashCommand, err instanceof Error ? err : new Error(String(err)));
  }

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  if (child.stdout) {
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk.toString()));
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk.toString()));
  }

  const processPromise = new Promise<RunResult>((resolve, reject) => {
    child.on("error", (err: Error) => {
      reject(new CliSpawnError(slashCommand, err));
    });

    child.on("close", (code: number | null) => {
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      // Kill the child process on timeout
      child.kill("SIGTERM");
      reject(new CliTimeoutError(slashCommand, timeoutMs));
    }, timeoutMs);
    // Unref so the timer doesn't keep the Node event loop alive in tests
    if (typeof timer.unref === "function") timer.unref();
  });

  return Promise.race([processPromise, timeoutPromise]);
}
