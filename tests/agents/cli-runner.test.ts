import { describe, it, expect, vi } from "vitest";
import type { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { Readable } from "stream";
import {
  runCliCommand,
  CliTimeoutError,
  CliSpawnError,
  type SpawnFn,
} from "../../src/agents/cli-runner.js";

// ---------------------------------------------------------------------------
// Helpers — minimal mock ChildProcess
// ---------------------------------------------------------------------------

interface MockChildProcess extends ChildProcess {
  _emitClose: (code: number | null) => void;
  _emitError: (err: Error) => void;
  _writeStdout: (data: string) => void;
  _writeStderr: (data: string) => void;
}

function makeMockProcess(): MockChildProcess {
  const emitter = new EventEmitter() as MockChildProcess;

  const stdoutEmitter = new EventEmitter() as unknown as Readable;
  const stderrEmitter = new EventEmitter() as unknown as Readable;

  emitter.stdout = stdoutEmitter;
  emitter.stderr = stderrEmitter;
  emitter.stdin = null;
  emitter.stdio = [null, stdoutEmitter, stderrEmitter, null, null] as unknown as ChildProcess["stdio"];
  emitter.pid = 99999;
  emitter.killed = false;
  emitter.exitCode = null;
  emitter.signalCode = null;
  emitter.spawnargs = [];
  emitter.spawnfile = "claude";
  emitter.connected = false;
  emitter.kill = vi.fn(() => true) as unknown as ChildProcess["kill"];
  emitter.send = vi.fn() as unknown as ChildProcess["send"];
  emitter.disconnect = vi.fn();
  emitter.unref = vi.fn();
  emitter.ref = vi.fn();

  emitter._emitClose = (code: number | null) => {
    emitter.emit("close", code);
  };
  emitter._emitError = (err: Error) => {
    emitter.emit("error", err);
  };
  emitter._writeStdout = (data: string) => {
    stdoutEmitter.emit("data", Buffer.from(data));
  };
  emitter._writeStderr = (data: string) => {
    stderrEmitter.emit("data", Buffer.from(data));
  };

  return emitter;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runCliCommand", () => {
  describe("success case", () => {
    it("resolves with ok=true and captured stdout on exit code 0", async () => {
      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-extract", {
        cwd: "/fake/repo",
        spawnFn,
      });

      mockProcess._writeStdout("Extracted 5 claims\n");
      mockProcess._emitClose(0);

      const result = await resultPromise;
      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Extracted 5 claims\n");
      expect(result.stderr).toBe("");
    });

    it("passes the slash command and --print flag to spawn", async () => {
      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-gaps", {
        cwd: "/fake/repo",
        spawnFn,
      });

      mockProcess._emitClose(0);
      await resultPromise;

      expect(spawnFn).toHaveBeenCalledWith("claude", ["/fm-gaps", "--print"], {
        cwd: "/fake/repo",
      });
    });

    it("captures both stdout and stderr", async () => {
      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-extract", {
        cwd: "/fake/repo",
        spawnFn,
      });

      mockProcess._writeStdout("output line\n");
      mockProcess._writeStderr("warning: something\n");
      mockProcess._emitClose(0);

      const result = await resultPromise;
      expect(result.stdout).toBe("output line\n");
      expect(result.stderr).toBe("warning: something\n");
    });
  });

  describe("non-zero exit code", () => {
    it("resolves with ok=false on exit code 1", async () => {
      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-extract", {
        cwd: "/fake/repo",
        spawnFn,
      });

      mockProcess._writeStderr("Error: skill failed\n");
      mockProcess._emitClose(1);

      const result = await resultPromise;
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("Error: skill failed\n");
    });

    it("resolves with ok=false on exit code 2", async () => {
      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-gaps", {
        cwd: "/fake/repo",
        spawnFn,
      });

      mockProcess._emitClose(2);

      const result = await resultPromise;
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it("resolves with exitCode=null when the process is killed by a signal", async () => {
      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-extract", {
        cwd: "/fake/repo",
        spawnFn,
      });

      mockProcess._emitClose(null);

      const result = await resultPromise;
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(null);
    });
  });

  describe("timeout", () => {
    it("throws CliTimeoutError and kills the process when timeoutMs elapses", async () => {
      vi.useFakeTimers();

      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-extract", {
        cwd: "/fake/repo",
        timeoutMs: 5_000,
        spawnFn,
      });

      // Advance past the timeout without the process closing
      vi.advanceTimersByTime(6_000);

      await expect(resultPromise).rejects.toThrow(CliTimeoutError);
      await expect(resultPromise).rejects.toMatchObject({
        timeoutMs: 5_000,
        command: "/fm-extract",
      });

      // The process should have been killed
      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");

      vi.useRealTimers();
    });

    it("uses the default 120s timeout when none is specified", async () => {
      vi.useFakeTimers();

      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-extract", {
        cwd: "/fake/repo",
        spawnFn,
      });

      // Less than 120s — should not time out yet
      vi.advanceTimersByTime(119_000);
      // Process finishes just before the timeout
      mockProcess._emitClose(0);

      const result = await resultPromise;
      expect(result.ok).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("spawn error", () => {
    it("throws CliSpawnError when the spawn function throws", async () => {
      const spawnFn: SpawnFn = vi.fn(() => {
        throw new Error("ENOENT: claude not found");
      });

      await expect(
        runCliCommand("/fm-extract", { cwd: "/fake/repo", spawnFn })
      ).rejects.toThrow(CliSpawnError);

      await expect(
        runCliCommand("/fm-extract", { cwd: "/fake/repo", spawnFn })
      ).rejects.toMatchObject({ command: "/fm-extract" });
    });

    it("throws CliSpawnError when the process emits an 'error' event", async () => {
      const mockProcess = makeMockProcess();
      const spawnFn: SpawnFn = vi.fn(() => mockProcess as unknown as ChildProcess);

      const resultPromise = runCliCommand("/fm-extract", {
        cwd: "/fake/repo",
        spawnFn,
      });

      mockProcess._emitError(new Error("ENOENT"));

      await expect(resultPromise).rejects.toThrow(CliSpawnError);
    });
  });
});
