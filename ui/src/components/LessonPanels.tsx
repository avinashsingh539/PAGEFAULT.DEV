/**
 * The Learn screen's panels: the narration, the question, the proof, the comparison and
 * the controls.
 *
 * Everything here is PRESENTATION. Each component receives already-derived values - a
 * step's engine facts, an evidence table built by counting engine events, a comparison
 * built by running two real engine runs - and none of them computes an OS fact, decides
 * a hit, or formats a number the engine did not produce.
 *
 * The dimming rule lives in `FocusFrame`: one part of the screen is the subject of a
 * step, and everything else is pushed back rather than removed, so the learner keeps the
 * context while their attention is aimed.
 */

import type { JSX, ReactNode } from "react";

import type {
  LearnComparison,
  LearnEvidence,
  LearnFocus,
  LearnProgress,
  LearnQuestion,
  LearnStepState,
} from "../lib/lesson";
import { isPanelFocused } from "../lib/lesson";
import type { LearnPanelKey } from "../lib/lesson";

/** How the screen names each focus. Labels only - they name a place, not a fact. */
const FOCUS_LABELS: Record<LearnFocus, string> = {
  cpu: "the CPU",
  virtual: "the virtual address",
  split: "page number + offset",
  tlb: "the TLB",
  pageTable: "the page table",
  fill: "the TLB fill",
  frame: "the frame",
  physical: "the physical address",
  ram: "RAM",
  fault: "the page fault",
  chain: "the translation chain",
  timeline: "the event log",
  lesson: "the lesson",
};

/** How far an access has got, in words. */
const REACHED_LABELS: Record<LearnProgress["reached"], string> = {
  none: "nothing has happened yet",
  translation: "the virtual address",
  tlb: "the TLB",
  pageTable: "the page table",
  frame: "a frame",
  ram: "RAM",
  fault: "a page fault",
};

export function focusLabel(focus: LearnFocus): string {
  return FOCUS_LABELS[focus];
}

/**
 * One region of the Learn screen, lit or pushed back.
 *
 * `data-dimmed` is what the tests read: a step that dims the wrong region is a step that
 * teaches the wrong thing, so the dimming is asserted rather than eyeballed.
 */
export function FocusFrame({
  focus,
  panel,
  title,
  children,
}: {
  focus: LearnFocus;
  panel: LearnPanelKey;
  title?: string;
  children: ReactNode;
}): JSX.Element {
  const active = isPanelFocused(focus, panel);

  return (
    <div
      data-testid={`panel-${panel}`}
      data-dimmed={active ? "false" : "true"}
      className={`rounded-2xl transition-opacity duration-200 ${
        active ? "opacity-100 ring-1 ring-sky-400/40" : "opacity-40"
      }`}
    >
      {title === undefined ? null : (
        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-300/70">
          {active ? `focus · ${title}` : title}
        </p>
      )}
      {children}
    </div>
  );
}

/** The narration: WHAT, WHY, WHY NECESSARY and - where it means something - WITHOUT IT. */
export function NarrationCard({
  state,
  totalSteps,
  nextTitle,
  nextFocus,
}: {
  state: LearnStepState;
  totalSteps: number;
  nextTitle: string | null;
  nextFocus: LearnFocus | null;
}): JSX.Element {
  const { step, checkpoint } = state;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">{step.title}</h2>
        <span className="num text-xs uppercase tracking-widest text-slate-500">
          step {state.index + 1} / {totalSteps}
        </span>
      </header>

      <p className="mb-4 text-xs text-slate-500" data-testid="learn-focus">
        Subject of this step: <span className="text-sky-300">{focusLabel(step.focus)}</span>
      </p>

      <div className="space-y-3">
        <Explanation label="What is happening?" body={step.what} />
        <Explanation label="Why is it happening?" body={step.why} />
        <Explanation label="Why is it necessary?" body={step.whyNecessary} />
        {step.withoutIt === null ? null : (
          <Explanation label="What if it did not exist?" body={step.withoutIt} tone="warn" />
        )}
      </div>

      {checkpoint.ok ? null : (
        <p
          data-testid="learn-checkpoint-warning"
          className="mt-4 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          The engine disagrees with this step&apos;s script: missing [{checkpoint.missing.join(", ")}],
          unexpected [{checkpoint.unexpected.join(", ")}]. The engine&apos;s version is the one shown.
        </p>
      )}

      {nextTitle === null ? null : (
        <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500" data-testid="learn-next-up">
          Next: <span className="text-slate-300">{nextTitle}</span>
          {nextFocus === null ? null : <> — the focus moves to {focusLabel(nextFocus)}</>}
        </p>
      )}
    </section>
  );
}

function Explanation({
  label,
  body,
  tone = "normal",
}: {
  label: string;
  body: string;
  tone?: "normal" | "warn";
}): JSX.Element {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        tone === "warn" ? "border-violet-500/40 bg-violet-500/5" : "border-slate-800 bg-slate-950/40"
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
          tone === "warn" ? "text-violet-300" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

/** One question per teaching beat. Choosing is the learner's; the answer is the lesson's. */
export function QuestionCard({
  stepId,
  question,
  chosenIndex,
  onChoose,
}: {
  stepId: string;
  question: LearnQuestion;
  chosenIndex: number | null;
  onChoose: (stepId: string, optionIndex: number) => void;
}): JSX.Element {
  const answered = chosenIndex !== null;
  const correct = chosenIndex === question.answerIndex;

  return (
    <section
      data-testid="learn-question"
      className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-300">
        Check yourself
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{question.prompt}</p>

      <ul className="mt-3 space-y-2">
        {question.options.map((option, optionIndex) => {
          const isChosen = chosenIndex === optionIndex;
          const isAnswer = optionIndex === question.answerIndex;
          return (
            <li key={option}>
              <button
                type="button"
                data-testid={`learn-answer-${optionIndex}`}
                disabled={answered}
                onClick={() => onChoose(stepId, optionIndex)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  answered && isAnswer
                    ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-100"
                    : answered && isChosen
                      ? "border-rose-400/70 bg-rose-500/10 text-rose-100"
                      : "border-slate-700 bg-slate-950 text-slate-300 enabled:hover:border-sky-400/70 enabled:hover:text-sky-100 disabled:opacity-60"
                }`}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <p
          data-testid="learn-answer-explanation"
          className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            correct
              ? "border-emerald-400/50 bg-emerald-400/5 text-emerald-100"
              : "border-amber-400/50 bg-amber-400/5 text-amber-100"
          }`}
        >
          <span className="font-semibold uppercase tracking-widest">
            {correct ? "Correct. " : "Not quite. "}
          </span>
          {question.explanation}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The numbers of this step, every one of them read off an engine event.
 *
 * The panel is deliberately blunt about where the numbers come from: a dash means the
 * engine produced no such value on this access, which is exactly what the page-fault
 * steps are about.
 */
export function LessonFacts({ state }: { state: LearnStepState }): JSX.Element {
  const { view, progress } = state;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        Engine facts at this step
      </h2>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Fact label="page" value={view.pageNumber} />
        <Fact label="offset" value={view.offset} />
        <Fact label="frame" value={view.frameNumber} />
        <Fact label="physical" value={view.physicalAddress} hex />
      </dl>

      <p className="mt-3 text-xs text-slate-400" data-testid="learn-reached">
        So far this access has reached:{" "}
        <span className="text-sky-300" data-testid="learn-reached-value">
          {REACHED_LABELS[progress.reached]}
        </span>
      </p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        <Flag label="TLB lookup" on={progress.tlbLookedUp} />
        <Flag label="TLB hit" on={progress.tlbHit} />
        <Flag label="TLB miss" on={progress.tlbMiss} />
        <Flag label="page table" on={progress.pageTableWalked} />
        <Flag label="TLB fill" on={progress.tlbFilled} />
        <Flag label="RAM" on={progress.ramAccessed} />
        <Flag label="fault" on={progress.faulted} />
      </ul>

      <p className="mt-3 text-xs text-slate-500">
        Every value above is printed from the engine&apos;s own events. A dash means the engine
        produced no such value on this access.
      </p>
    </section>
  );
}

function Flag({ label, on }: { label: string; on: boolean }): JSX.Element {
  return (
    <li
      data-testid={`flag-${label.toLowerCase().replaceAll(" ", "-")}`}
      data-on={on ? "true" : "false"}
      className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${
        on ? "border-sky-400/60 bg-sky-400/10 text-sky-200" : "border-slate-800 bg-slate-950 text-slate-600"
      }`}
    >
      {label}
    </li>
  );
}

function Fact({
  label,
  value,
  hex = false,
}: {
  label: string;
  value: number | null;
  hex?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="num text-base font-semibold text-slate-200" data-testid={`fact-${label}`}>
        {value === null ? "—" : hex ? `0x${value.toString(16)}` : value}
      </dd>
    </div>
  );
}

/** The proof card: numbers counted from the engine's event stream. */
export function EvidenceCard({ evidence }: { evidence: LearnEvidence }): JSX.Element {
  return (
    <section
      data-testid="learn-evidence"
      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
        {evidence.title}
      </h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        {evidence.rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-300">{row.label}</dt>
            <dd className="num text-base font-semibold text-emerald-200">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">{evidence.note}</p>
    </section>
  );
}

/**
 * The "what if it did not exist?" panel.
 *
 * Both columns are counts from two real engine runs - one machine with the mechanism,
 * one without it - so the comparison cannot drift away from the simulation. The last
 * line is the teaching point: the outcome is identical, the work is not.
 */
export function ComparisonCard({ comparison }: { comparison: LearnComparison }): JSX.Element {
  return (
    <section
      data-testid="learn-comparison"
      className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
        {comparison.title}
      </h2>
      <p className="mt-1 text-xs text-slate-400">{comparison.question}</p>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500">
            <th className="pb-1 font-medium">counted events</th>
            <th className="pb-1 text-right font-medium">{comparison.withLabel}</th>
            <th className="pb-1 text-right font-medium">{comparison.withoutLabel}</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-800">
              <td className="py-1.5 text-slate-300">{row.label}</td>
              <td
                className="num py-1.5 text-right font-semibold text-violet-100"
                data-testid={`comparison-with-${row.label.replaceAll(" ", "-")}`}
              >
                {row.withMechanism}
              </td>
              <td
                className="num py-1.5 text-right font-semibold text-violet-200/70"
                data-testid={`comparison-without-${row.label.replaceAll(" ", "-")}`}
              >
                {row.withoutMechanism}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs leading-relaxed text-slate-300">{comparison.conclusion}</p>
      <p className="mt-2 text-xs text-slate-500">
        The &quot;without&quot; column is a second machine built by the engine, identical except that it
        has no TLB. Both columns are counted from the events those two runs produced.
      </p>
    </section>
  );
}

/** Totals for the whole lesson, folded from every event the engine produced. */
export function LessonTotals({
  totals,
}: {
  totals: {
    readonly accesses: number;
    readonly events: number;
    readonly tlbHits: number;
    readonly tlbMisses: number;
    readonly pageTableWalks: number;
    readonly pageFaults: number;
    readonly ramAccesses: number;
  };
}): JSX.Element {
  const rows: readonly { readonly label: string; readonly value: number }[] = [
    { label: "engine actions", value: totals.accesses },
    { label: "engine events", value: totals.events },
    { label: "TLB hits", value: totals.tlbHits },
    { label: "TLB misses", value: totals.tlbMisses },
    { label: "page-table walks", value: totals.pageTableWalks },
    { label: "page faults", value: totals.pageFaults },
    { label: "RAM accesses", value: totals.ramAccesses },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        The whole lesson
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        The lesson runs its three accesses through the engine once, when it opens. These are the
        totals of everything it did.
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5">
            <dt className="text-[10px] uppercase tracking-widest text-slate-500">{row.label}</dt>
            <dd className="num text-base font-semibold text-slate-200">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The lesson controls: Back, Next, Play/Pause, Restart, a progress bar and a jump box.
 *
 * The keyboard shortcuts in the screen call exactly these handlers, so the buttons and
 * the keys cannot drift apart.
 */
export function LearnControls({
  stepIndex,
  totalSteps,
  playing,
  canBack,
  canNext,
  onBack,
  onNext,
  onTogglePlay,
  onRestart,
  stepText,
  stepError,
  onStepTextChange,
  onGoToStep,
}: {
  stepIndex: number;
  totalSteps: number;
  playing: boolean;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  stepText: string;
  stepError: string | null;
  onStepTextChange: (text: string) => void;
  onGoToStep: () => void;
}): JSX.Element {
  const percent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="num text-sm font-semibold text-slate-100" data-testid="learn-step-counter">
            Step {stepIndex + 1} / {totalSteps}
          </span>
          <span className="text-xs text-slate-500">
            arrows move, space plays, R restarts
          </span>
        </div>
        <span className="num text-xs text-slate-500" data-testid="learn-progress-value">
          {percent}%
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-valuenow={stepIndex + 1}
        aria-label="lesson progress"
        data-testid="learn-progress"
      >
        <div
          className="h-full rounded-full bg-sky-400 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ControlButton label="← back" testId="learn-back" onClick={onBack} disabled={!canBack} />
        <ControlButton label="next →" testId="learn-next" onClick={onNext} disabled={!canNext} primary />
        <ControlButton
          label={playing ? "pause" : "play"}
          testId="learn-play"
          onClick={onTogglePlay}
          disabled={false}
        />
        <ControlButton label="⟲ restart" testId="learn-restart" onClick={onRestart} disabled={false} />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label
            className="mb-1 block text-xs uppercase tracking-widest text-slate-500"
            htmlFor="learnStepInput"
          >
            go to step
          </label>
          <input
            id="learnStepInput"
            data-testid="learn-step-input"
            value={stepText}
            inputMode="numeric"
            spellCheck={false}
            onChange={(event) => onStepTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onGoToStep();
              }
            }}
            className="num w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
          />
        </div>
        <button
          type="button"
          data-testid="learn-go"
          onClick={onGoToStep}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:border-slate-500"
        >
          go
        </button>
        {stepError === null ? null : (
          <p data-testid="learn-step-error" className="text-xs text-rose-300">
            {stepError}
          </p>
        )}
      </div>
    </section>
  );
}

function ControlButton({
  label,
  testId,
  onClick,
  disabled,
  primary = false,
}: {
  label: string;
  testId: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-40 ${
        primary
          ? "bg-sky-500 text-slate-950 enabled:hover:bg-sky-400"
          : "border border-slate-700 bg-slate-950 text-slate-300 enabled:hover:border-slate-500"
      }`}
    >
      {label}
    </button>
  );
}




