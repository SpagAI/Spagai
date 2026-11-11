/**
 * Undo/redo for the Agent Builder, and spotting a prompt that was suddenly cleared.
 * Pure, so it can be tested.
 */
import type { AgentConfig } from "@spagai/core";

export interface History {
  past: AgentConfig[];
  present: AgentConfig;
  future: AgentConfig[];
  /** When the last undo step was recorded (typing within this window joins the same step). */
  lastAt: number;
}

/** Typing within this many milliseconds counts as one undo step. */
export const STEP_MS = 1000;
const MAX_STEPS = 100;

export function startHistory(config: AgentConfig): History {
  return { past: [], present: config, future: [], lastAt: 0 };
}

/** Record a change. `force` always starts a new undo step (e.g. deleting a section, restoring). */
export function record(h: History, next: AgentConfig, now: number, force = false): History {
  if (next === h.present) return h;
  const newStep = force || now - h.lastAt > STEP_MS || h.past.length === 0;
  return {
    past: newStep ? [...h.past, h.present].slice(-MAX_STEPS) : h.past,
    present: next,
    future: [],
    lastAt: now,
  };
}

export function undo(h: History): History {
  const prev = h.past.at(-1);
  if (!prev) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastAt: 0 };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (!next) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1), lastAt: 0 };
}

/** Characters of the person's own instructions (not the locked safety rules). */
export function promptLength(config: AgentConfig): number {
  return config.blocks.filter((b) => !b.guardrail).reduce((n, b) => n + b.content.trim().length, 0);
}

/** True when a real prompt (200+ characters) just lost most of its text in one change. */
export function wasCleared(before: AgentConfig, after: AgentConfig): boolean {
  const a = promptLength(before);
  const b = promptLength(after);
  return a >= 200 && b < a * 0.2;
}
