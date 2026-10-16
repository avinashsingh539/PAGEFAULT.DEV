/**
 * The Learn index: the path, and where you are on it.
 *
 * NOTHING IS LOCKED. Every module is open, and a learner who arrives knowing
 * nothing can jump straight to page replacement, while one who wants the story in
 * order can walk it from the beginning.
 *
 * THE MODULES ARE NOT INVENTED. Each names the lesson steps it covers, using the
 * real `LESSON_STEPS` titles, and each card's button moves the existing lesson to
 * that module's first step. No new lesson text is written here, because a summary
 * that quietly disagreed with the lesson would be worse than no index at all.
 *
 * ONE MODULE POINTS AWAY. Page replacement has no lesson steps today - the lesson
 * covers translation, the TLB and faults - so its card sends the learner to
 * Compare, where the three algorithms are actually runnable. Claiming a lesson
 * exists when it does not would be a small dishonesty with real consequences.
 */

import type { JSX } from "react";

import { Icon } from "../../design/Icon";
import type { IconName } from "../../design/Icon";
import { cx } from "../../design/cx";

export interface LearnModule {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** Zero-based lesson step indices this module covers. Empty means "no lesson". */
  readonly steps: readonly number[];
  /** Where a learner actually goes. */
  readonly goesTo: "lesson" | "compare";
  readonly icon: IconName;
}

export const LEARN_MODULES: readonly LearnModule[] = [
  {
    id: "basics",
    title: "Basics",
    summary: "Where a program's variables live, and why the CPU cannot simply read them.",
    steps: [0, 1],
    goesTo: "lesson",
    icon: "book",
  },
  {
    id: "addresses",
    title: "Addresses",
    summary: "The address a program uses, and how one number becomes a page and an offset.",
    steps: [2, 3],
    goesTo: "lesson",
    icon: "route",
  },
  {
    id: "paging",
    title: "Paging",
    summary: "The page table, and how a page number becomes a physical frame.",
    steps: [5, 7],
    goesTo: "lesson",
    icon: "table",
  },
  {
    id: "tlb",
    title: "TLB",
    summary: "The cache that lets the CPU skip the page table entirely.",
    steps: [4, 6, 8, 9],
    goesTo: "lesson",
    icon: "layers",
  },
  {
    id: "faults",
    title: "Faults",
    summary: "What happens when the page the program wants is not in RAM.",
    steps: [10, 11],
    goesTo: "lesson",
    icon: "alert",
  },
  {
    id: "replacement",
    title: "Replacement",
    summary: "What the operating system does when RAM fills up: FIFO, LRU and Optimal.",
    steps: [],
    goesTo: "compare",
    icon: "bolt",
  },
];

/** `currentStep` is the lesson's current step; it drives both the rail and the labels. */
export function LearnModuleIndex({
  currentStep,
  onStart,
  onCompare,
  onStartTour,
}: {
  currentStep: number;
  onStart: (stepIndex: number) => void;
  onCompare: () => void;
  /** Reopens the guided tour. Optional so the index can render without a tour host. */
  onStartTour?: () => void;
}): JSX.Element {
  const start = (module: LearnModule): void => {
    if (module.goesTo === "compare") {
      onCompare();
    } else if (module.steps.length > 0) {
      onStart(Math.min(...module.steps));
    }
  };

  return (
    <section
      data-testid="learn-modules"
      className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            Understand computer systems step by step
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            Six short modules. None of them are locked, and you can start anywhere.
          </p>
        </div>
        {onStartTour === undefined ? null : (
          <button
            type="button"
            data-testid="learn-tour-launch"
            onClick={onStartTour}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary/60 hover:bg-surface-soft"
          >
            <Icon name="info" size={15} className="text-primary-strong" />
            Take the tour
          </button>
        )}
      </header>
      <ol
        aria-label="Learning path"
        className="flex flex-wrap items-center gap-1.5"
        data-testid="learn-path"
      >
        {LEARN_MODULES.map((module, index) => {
          const started = module.steps.some((step) => step <= currentStep);
          const current = module.steps.includes(currentStep);
          return (
            <li key={module.id} className="flex items-center gap-1.5">
              <span
                aria-current={current ? "step" : undefined}
                data-module={module.id}
                className={cx(
                  "grid size-7 place-items-center rounded-full border text-[0.6875rem] font-bold",
                  current
                    ? "border-primary bg-primary text-surface"
                    : started
                      ? "border-hit/40 bg-hit-soft text-hit"
                      : "border-line bg-surface text-muted",
                )}
              >
                {index + 1}
              </span>
              <span className={cx("text-xs font-semibold", current ? "text-ink" : "text-muted")}>
                {module.title}
              </span>
              {index < LEARN_MODULES.length - 1 ? (
                <span aria-hidden="true" className="mx-0.5 h-px w-4 bg-line-strong" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LEARN_MODULES.map((module, index) => {
          const stepCount = module.steps.length;
          const inModule = module.steps.includes(currentStep);
          const started = module.steps.some((step) => step <= currentStep);
          const label =
            module.goesTo !== "lesson"
              ? "Open"
              : inModule
                ? "Continue"
                : started
                  ? "Revisit"
                  : "Start";

          return (
            <li key={module.id} className="flex">
              <div
                data-testid={`learn-module-${module.id}`}
                className={cx(
                  "flex w-full flex-col gap-3 rounded-card border bg-surface p-4 transition-[transform,box-shadow] duration-200",
                  inModule
                    ? "border-primary shadow-card"
                    : "border-line shadow-raised hover:-translate-y-1 hover:shadow-card",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-chip bg-primary-soft text-primary-strong">
                    <Icon name={module.icon} size={16} />
                  </span>
                  <span className="num text-xs font-bold text-muted">0{index + 1}</span>
                  <h3 className="text-base font-bold text-ink">{module.title}</h3>
                </div>

                <p className="text-sm leading-relaxed text-muted">{module.summary}</p>

                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted">
                  <div className="flex gap-1">
                    <dt>Concept</dt>
                    <dd className="font-semibold text-ink">
                      {stepCount === 0 ? "in Compare" : `${stepCount} steps`}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Simulation</dt>
                    <dd className="font-semibold text-ink">
                      {stepCount === 0 ? "3 algorithms" : "yes"}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Duration</dt>
                    <dd className="font-semibold text-ink">
                      {stepCount === 0 ? "~5 min" : `~${Math.max(2, stepCount)} min`}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  data-testid={`learn-start-${module.id}`}
                  onClick={() => start(module)}
                  className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-soft hover:text-primary-strong"
                >
                  {label}
                  <Icon name="arrowRight" size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}