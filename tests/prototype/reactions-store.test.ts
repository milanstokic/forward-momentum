import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendReaction,
  readReactions,
  REACTIONS_FILE,
} from "../../src/prototype/reactions-store.js";
import { parseReactions } from "../../src/model/guards.js";

describe("reactions-store", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fm-react-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const base = {
    author: "product",
    screen: "confirmation-screen",
    text: "as a guest, how do they find this order again? no order tracking.",
  };

  it("creates reactions.jsonl on first append and round-trips via readReactions", () => {
    const r = appendReaction(dir, base, { now: "2026-06-13T11:30:00Z", id: "react-1" });
    expect(existsSync(join(dir, REACTIONS_FILE))).toBe(true);
    expect(r.screen).toBe("confirmation-screen");

    const all = readReactions(dir);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({
      id: "react-1",
      author: "product",
      screen: "confirmation-screen",
      text: base.text,
      ts: "2026-06-13T11:30:00Z",
    });
  });

  it("writes valid JSONL (one parseable Reaction per line)", () => {
    appendReaction(dir, base, { now: "2026-06-13T11:30:00Z", id: "react-1" });
    appendReaction(dir, { ...base, screen: "payment" }, { now: "2026-06-13T11:31:00Z", id: "react-2" });

    const contents = readFileSync(join(dir, REACTIONS_FILE), "utf-8");
    const lines = contents.split("\n").filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(2);

    const parsed = parseReactions(contents);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.map((r) => r.screen)).toEqual([
        "confirmation-screen",
        "payment",
      ]);
    }
  });

  it("appends to a pre-existing file, preserving order", () => {
    // Seed a file written out-of-band.
    writeFileSync(
      join(dir, REACTIONS_FILE),
      JSON.stringify({
        id: "seed",
        author: "design",
        screen: "cart",
        text: "seed reaction",
        ts: "2026-06-13T10:00:00Z",
      }) + "\n",
      "utf-8"
    );

    appendReaction(dir, base, { now: "2026-06-13T11:30:00Z", id: "react-1" });
    const all = readReactions(dir);
    expect(all.map((r) => r.id)).toEqual(["seed", "react-1"]);
  });

  it("includes element only when provided", () => {
    appendReaction(dir, { ...base, element: "#place-order-btn" }, { id: "with-el" });
    appendReaction(dir, base, { id: "no-el" });
    const all = readReactions(dir);
    expect(all.find((r) => r.id === "with-el")?.element).toBe("#place-order-btn");
    expect(all.find((r) => r.id === "no-el")?.element).toBeUndefined();
  });

  it("generates a unique-ish id and an ISO ts when not injected", () => {
    const r = appendReaction(dir, base);
    expect(r.id).toMatch(/^react-/);
    expect(Number.isNaN(Date.parse(r.ts))).toBe(false);
  });

  it("returns [] when no reactions file exists yet", () => {
    expect(readReactions(dir)).toEqual([]);
  });

  it("rejects an empty comment", () => {
    expect(() => appendReaction(dir, { ...base, text: "   " })).toThrow();
  });

  it("rejects a missing screen anchor", () => {
    expect(() => appendReaction(dir, { ...base, screen: "" })).toThrow();
  });

  it("throws a loud error when the file has a malformed line", () => {
    writeFileSync(join(dir, REACTIONS_FILE), "{ not json\n", "utf-8");
    expect(() => readReactions(dir)).toThrow(/malformed/);
  });
});
