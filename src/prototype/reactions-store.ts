/**
 * Reaction store — append-only persistence for teammate reactions on a prototype.
 *
 * Reactions live as JSON-lines in <prototypeDir>/reactions.jsonl, one Reaction
 * per line (see src/model/prototype.ts). This is the capture half of the wedge:
 * fm-gap-analysis later folds these back in as new/sharpened gaps, anchored by
 * provenance "prototype@<screen>".
 *
 * Single source of truth = the file on disk. No in-memory authority.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { parseReactions } from "../model/guards.js";
import type { Reaction } from "../model/prototype.js";

export const REACTIONS_FILE = "reactions.jsonl";

/** The author-supplied parts of a reaction; id + ts are stamped on append. */
export interface NewReaction {
  author: string;
  screen: string;
  element?: string;
  text: string;
}

export interface AppendOptions {
  /** ISO8601 timestamp; defaults to now. Injectable for deterministic tests. */
  now?: string;
  /** Stable id; defaults to a generated one. Injectable for deterministic tests. */
  id?: string;
}

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function generateId(now: string): string {
  // Deterministic-ish, collision-resistant enough for single-user scratch:
  // timestamp + a short random suffix. (Extension runtime — Math.random is fine.)
  const stamp = Date.parse(now).toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `react-${stamp}-${rand}`;
}

/**
 * Appends a reaction to <prototypeDir>/reactions.jsonl, creating the file (and
 * directory) if needed. Returns the persisted Reaction. Throws on invalid input.
 */
export function appendReaction(
  prototypeDir: string,
  input: NewReaction,
  opts: AppendOptions = {}
): Reaction {
  if (!isNonEmpty(input.author)) throw new Error("reaction.author is required");
  if (!isNonEmpty(input.screen)) throw new Error("reaction.screen is required");
  if (!isNonEmpty(input.text)) throw new Error("reaction.text is required");

  const now = opts.now ?? new Date().toISOString();
  const reaction: Reaction = {
    id: opts.id ?? generateId(now),
    author: input.author,
    screen: input.screen,
    text: input.text,
    ts: now,
  };
  if (isNonEmpty(input.element)) {
    reaction.element = input.element;
  }

  fs.mkdirSync(prototypeDir, { recursive: true });
  fs.appendFileSync(
    path.join(prototypeDir, REACTIONS_FILE),
    JSON.stringify(reaction) + "\n",
    "utf-8"
  );
  return reaction;
}

/**
 * Reads all reactions for a prototype. Returns [] when no file exists yet.
 * Throws if the file is present but contains a malformed line (loud, locatable).
 */
export function readReactions(prototypeDir: string): Reaction[] {
  const file = path.join(prototypeDir, REACTIONS_FILE);
  if (!fs.existsSync(file)) return [];

  const parsed = parseReactions(fs.readFileSync(file, "utf-8"));
  if (!parsed.ok) {
    throw new Error(
      `${REACTIONS_FILE} has malformed entries:\n` +
        parsed.errors.map((e) => `  ${e.field}: ${e.message}`).join("\n")
    );
  }
  return parsed.data;
}
