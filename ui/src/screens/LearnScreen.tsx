/**
 * Learn Mode: a guided lesson that drives the SAME engine Experiment and Compare use.
 *
 * WHAT THIS SCREEN IS RESPONSIBLE FOR
 *
 * The lesson's script decides which engine action to perform and which truthful event to
 * look at. It never decides what that event says. So this screen does exactly three
 * things:
 *
 *   1. it plays the lesson through the engine ONCE (`runLesson`, memoised) and shows one
 *      step of the result at a time;
 *   2. it dims everything except the part of the machine the current step is about;
 *   3. it renders numbers that came out of engine events, with a dash wherever the engine
 *      produced nothing - which is the honest way to show that a page fault has no frame,
 *      no physical address and no RAM access.
 *
 * Because `step()` is pure and the script is fixed, stepping Back and Restarting need no
 * undo: the lesson is already played, and moving through it is moving through one
 * deterministic run.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import {
  ComparisonCard,
  EvidenceCard,
  FocusFrame,
  LearnControls,
  LessonFacts,
  LessonTotals,
  NarrationCard,
  QuestionCard,
} from "../components/LessonPanels";
import { PageTablePanel, RamPanel, TlbPanel } from "../components/Panels";
import { Pipeline } from "../components/Pipeline";
import { Timeline } from "../components/Timeline";
import { parseIntegerText } from "../lib/fields";
import {
  advanceForPlay,
  clampStepIndex,
  comparisonFor,
  focusedStage,
  isFirstStep,
  isLastStep,
  lastStepIndex,
  lessonCommandFor,
  lessonStepAt,
  nextStepIndex,
  previousStepIndex,
  runLesson,
  stepIndexForEvent,
} from "../lib/lesson";
import type { LearnComparison } from "../lib/lesson";
import { timelineEntries } from "../lib/session";
import type { TimelineEntry } from "../lib/session";
import type { LabUrlConfig } from "../lib/url";

/** How long each step is shown while PLAY is running. Long enough to read a sentence. */
import { LearnModuleIndex } from "./learn/LearnModuleIndex";
const LEARN_INTERVAL_MS = 3200;

export interface LearnScreenProps {
  readonly urlConfig: LabUrlConfig;
  readonly onUrlConfigChange: (next: LabUrlConfig) => void;
  /**
   * How to leave for Compare.
   *
   * Passed in rather than navigated from inside the screen: routing is the app
   * shell's job, and a screen that reached for the router itself would be the first
   * place in this codebase where a page could quietly break the back button.
   */
  readonly onGoToCompare: () => void;
}

export default function LearnScreen({
  urlConfig,
  onUrlConfigChange,
  onGoToCompare,
}: LearnScreenProps): JSX.Element {
  // The engine runs the lesson once, when the screen opens. Every step below is a view of
  // that one deterministic run - never a fresh guess about what the hardware would do.
  const run = useMemo(() => runLesson(), []);
  const totalSteps = lastStepIndex() + 1;

  const [stepIndex, setStepIndex] = useState<number>(() => clampStepIndex(urlConfig.step));
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState<Readonly<Record<string, number>>>({});
  const [stepText, setStepText] = useState<string>(() =>
    String(clampStepIndex(urlConfig.step) + 1),
  );
  const [stepError, setStepError] = useState<string | null>(null);

  const current = lessonStepAt(run, stepIndex);
  const comparison: LearnComparison | null =
    current.step.comparison === null ? null : comparisonFor(current.step.comparison);

  const handleBack = useCallback((): void => {
    setPlaying(false);
    setStepIndex((index) => previousStepIndex(index));
  }, []);

  const handleNext = useCallback((): void => {
    setPlaying(false);
    setStepIndex((index) => nextStepIndex(index));
  }, []);

  const handleRestart = useCallback((): void => {
    setPlaying(false);
    setStepIndex(clampStepIndex(0));
    setAnswers({});
    setStepError(null);
  }, []);

  const handleTogglePlay = useCallback((): void => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Pressing PLAY at the end replays the lesson rather than doing nothing at all.
    setStepIndex((index) => (isLastStep(index) ? clampStepIndex(0) : index));
    setPlaying(true);
  }, [playing]);

  /** Clicking a row of the event log moves the lesson to the step that explains it. */
  const handleSelectEvent = useCallback(
    (entry: TimelineEntry): void => {
      const index = stepIndexForEvent(run, entry.recordIndex, entry.event.type);
      if (index === null) {
        return;
      }
      setPlaying(false);
      setStepIndex(clampStepIndex(index));
    },
    [run],
  );

  const handleGoToStep = useCallback((): void => {
    const parsed = parseIntegerText(stepText);
    if (!parsed.ok) {
      setStepError(parsed.error);
      return;
    }
    if (parsed.value < 1 || parsed.value > totalSteps) {
      setStepError(`Enter a step between 1 and ${totalSteps}.`);
      return;
    }
    setStepError(null);
    setPlaying(false);
    setStepIndex(clampStepIndex(parsed.value - 1));
  }, [stepText, totalSteps]);

  const handleChoose = useCallback((stepId: string, optionIndex: number): void => {
    setAnswers((chosen) => ({ ...chosen, [stepId]: optionIndex }));
  }, []);

  // The keyboard and the buttons drive the same handlers, so they cannot drift apart:
  // ArrowRight next, ArrowLeft back, Space play/pause, R restart - and nothing at all
  // while the learner is typing in a field.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const command = lessonCommandFor(event.key, isTextField(event.target));
      if (command === null) {
        return;
      }
      if (command !== "restart") {
        // Arrow keys and Space would scroll the page; the lesson owns them while it is on.
        event.preventDefault();
      }

      switch (command) {
        case "next":
          handleNext();
          return;
        case "back":
          handleBack();
          return;
        case "toggle-play":
          handleTogglePlay();
          return;
        case "restart":
          handleRestart();
          return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBack, handleNext, handleRestart, handleTogglePlay]);

  // Play: one step per tick, stopping on the last step instead of wrapping around.
  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    if (isLastStep(stepIndex)) {
      setPlaying(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setStepIndex((index) => advanceForPlay(index).index);
    }, LEARN_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [playing, stepIndex]);

  // Keep the jump box showing the step the learner is actually on.
  useEffect(() => {
    setStepText(String(stepIndex + 1));
  }, [stepIndex]);

  // A lesson step is a shareable link: `?mode=learn&step=5`.
  useEffect(() => {
    onUrlConfigChange({ ...urlConfig, mode: "learn", step: stepIndex });
    // urlConfig intentionally omitted: it is the value being written, not read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const nextStepState = isLastStep(stepIndex) ? null : lessonStepAt(run, nextStepIndex(stepIndex));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <LearnModuleIndex
        currentStep={stepIndex}
        onStart={(index) => {
          setStepIndex(clampStepIndex(index));
          setStepText(String(clampStepIndex(index) + 1));
          setStepError(null);
        }}
        onCompare={onGoToCompare}
      />
      <LearnControls
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        playing={playing}
        canBack={!isFirstStep(stepIndex)}
        canNext={!isLastStep(stepIndex)}
        onBack={handleBack}
        onNext={handleNext}
        onTogglePlay={handleTogglePlay}
        onRestart={handleRestart}
        stepText={stepText}
        stepError={stepError}
        onStepTextChange={(text) => {
          setStepText(text);
          setStepError(null);
        }}
        onGoToStep={handleGoToStep}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <FocusFrame focus={current.step.focus} panel="lesson" title="the lesson">
            <NarrationCard
              state={current}
              totalSteps={totalSteps}
              nextTitle={nextStepState === null ? null : nextStepState.step.title}
              nextFocus={nextStepState === null ? null : nextStepState.step.focus}
            />
          </FocusFrame>

          {current.step.question === null ? null : (
            <QuestionCard
              stepId={current.step.id}
              question={current.step.question}
              chosenIndex={answers[current.step.id] ?? null}
              onChoose={handleChoose}
            />
          )}

          <FocusFrame focus={current.step.focus} panel="chain" title="the translation chain">
            <Pipeline
              view={current.view}
              record={current.record}
              focus={focusedStage(current.step.focus)}
            />
          </FocusFrame>

          <FocusFrame focus={current.step.focus} panel="timeline" title="the event log">
            <Timeline
              entries={timelineEntries(current.records)}
              cursor={current.cursor}
              onSelect={handleSelectEvent}
            />
          </FocusFrame>
        </div>

        <div className="space-y-4">
          <LessonFacts state={current} />

          {comparison === null ? null : <ComparisonCard comparison={comparison} />}
          {current.evidence === null ? null : <EvidenceCard evidence={current.evidence} />}

          <FocusFrame focus={current.step.focus} panel="tlb" title="the TLB">
            <TlbPanel view={current.view} tlb={current.machine.tlb} />
          </FocusFrame>

          <FocusFrame focus={current.step.focus} panel="pageTable" title="the page table">
            <PageTablePanel machine={current.machine} view={current.view} />
          </FocusFrame>

          <FocusFrame focus={current.step.focus} panel="ram" title="RAM">
            <RamPanel machine={current.machine} view={current.view} />
          </FocusFrame>

          <LessonTotals totals={run.totals} />
        </div>
      </div>

      <footer className="border-t border-line px-2 pt-4 text-center text-xs text-muted">
        Every step above is read from the events the engine returned for three real memory
        accesses. Nothing on this screen is written by hand: if the engine and the lesson ever
        disagree, the screen says so.
      </footer>
    </div>
  );
}

/**
 * True when the key event happened inside a text field.
 *
 * This is the DOM half of the shortcut guard; the rule itself lives in
 * `lessonCommandFor()`, so the "do not steal keys while typing" behaviour can be tested
 * without a browser.
 */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}


