/**
 * The words of the two product tours. DOM-free data: anchors are `data-testid`
 * values the screens already render (or deliberately missing ones, for beats
 * about screens rather than elements - the overlay centers those instead).
 *
 * A tour must never claim the product did something it did not: beats about
 * post-access panels ("this explains...") describe what WILL appear after the
 * learner acts, and any beat that demonstrates an access uses the real button.
 */

import type { TourStep } from "../design/Tour";

/** Learn: the lesson, the focus, the controls, checking yourself, revisiting. */
export const LEARN_TOUR: readonly TourStep[] = [
  {
    id: "lesson",
    anchor: "panel-lesson",
    title: "One step explains one event",
    body: "This lesson follows a single address from the CPU to RAM. Each step picks one event from the engine and answers: what happened, why, and what if it did not exist.",
  },
  {
    id: "focus",
    anchor: "panel-chain",
    title: "The ring marks the stage",
    body: "The diagram highlights the stage this step is about and steps the others back. The 'focus' chip above each panel names it; the ring shows it.",
  },
  {
    id: "controls",
    anchor: "learn-step-counter",
    title: "Move through the lesson",
    body: "Next and Back walk the twelve steps one by one. Play runs them like a replay, Restart starts the lesson over. Arrow keys work too; R restarts.",
  },
  {
    id: "check",
    anchor: "learn-question",
    title: "Check yourself",
    body: "Some steps ask a question before moving on. Choosing an answer never breaks anything - the lesson keeps going either way.",
  },
  {
    id: "revisit",
    anchor: "learn-tour-launch",
    title: "Reopen this tour any time",
    body: "This button brings the whole walkthrough back. The lesson keeps its own place; the tour only explains the screen.",
  },
];

/** Lab: send an address, read the machine, replay the history. */
export const LAB_TOUR: readonly TourStep[] = [
  {
    id: "address",
    anchor: "access-submit",
    title: "Send a real address",
    body: "Type a virtual address (decimal 4933 or hex 0x1345) and press ACCESS. The button runs the actual engine - nothing here is staged.",
  },
  {
    id: "presets",
    anchor: "preset-warm-tlb",
    title: "Or start from a preset",
    body: "Shortcuts fill in the address for you: warm up the TLB, trigger a page fault, or fill RAM. Each one is ordinary accesses, never a special mode.",
  },
  {
    id: "pipeline",
    anchor: "memory-pipeline",
    title: "Watch the stages",
    body: "CPU to virtual address to TLB to page table to RAM. The station the current event is about is lit; a TLB hit visibly skips the page table.",
  },
  {
    id: "outcome",
    anchor: null,
    title: "Read what happened",
    body: "After each access, the right column explains the outcome: what happened, why, and what comes next - all read off the engine's own events.",
  },
  {
    id: "history",
    anchor: null,
    title: "Replay any moment",
    body: "Back and Step walk the event history; the position readout tells you where you are. Latest jumps back to the newest event without changing anything.",
  },
  {
    id: "configure",
    anchor: "apply-config",
    title: "Change the machine",
    body: "Page size, TLB entries, physical frames and replacement algorithm live in Settings. Apply rebuilds the machine - then access again and watch what changes.",
  },
];
