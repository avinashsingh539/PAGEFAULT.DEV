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
import { Timeline } from "../components/Timeline";
import { Icon } from "../design/Icon";
import { TourOverlay, useTour } from "../design/Tour";
import { LessonDiagram } from "../design/viz/LessonDiagram";
import { parseIntegerText } from "../lib/fields";
import { buildLabView, stageToNode } from "../lib/labView";
import { TOUR_LEARN } from "../lib/prefs";
import { LEARN_TOUR } from "../lib/tourSteps";
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
import { stageConnectorText } from "../lib/stages";
import type { LabUrlConfig } from "../lib/url";
import { LEARN_MODULES, LearnModuleIndex } from "./learn/LearnModuleIndex";

/** How long each step is shown while PLAY is running. Long enough to read a sentence. */
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
  /**
   * How to leave for the Lab.
   *
   * Same rule as `onGoToCompare`: the end-of-lesson buttons ask the shell to
   * navigate rather than reaching for the router themselves, so the back button
   * keeps exactly one owner.
   */
  readonly onGoToLab: () => void;
}

export default function LearnScreen({
  urlConfig,
  onUrlConfigChange,
  onGoToCompare,
  onGoToLab,
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

  // First-visit onboarding. The tour explains this screen once; the `learn-tour-launch`
  // button below (and the final beat of the tour itself) reopens it on demand.
  const tour = useTour(TOUR_LEARN);

  const current = lessonStepAt(run, stepIndex);
  const comparison: LearnComparison | null =
    current.step.comparison === null ? null : comparisonFor(current.step.comparison);

  // The same adapter the Lab uses: one definition of "what the machine is doing",
  // so the lesson diagram and the screen it is teaching toward cannot drift apart.
  const labView = useMemo(
    () => buildLabView(current.machine, current.records, current.view),
    [current.machine, current.records, current.view],
  );

  // Which station this step is about. `chain`, `timeline` and `lesson` are not
  // stations, and neither are split/fill/physical - the seven-box diagram shows
  // those inside their parent boxes, exactly as the Lab maps them.
  const stageFocus = focusedStage(current.step.focus);
  const nodeFocus = stageFocus === null ? null : stageToNode(stageFocus);

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

  /**
   * "Next Module" at the end of the lesson.
   *
   * The lesson covers five of the six modules; the sixth - page replacement - has
   * no lesson steps and lives in Compare. So this finds the module AFTER the one
   * the current step belongs to and hands over to wherever that module actually
   * is, exactly as the index cards do. Nothing is narrated about a lesson that
   * does not exist.
   */
  const handleNextModule = useCallback((): void => {
    const currentIndex = LEARN_MODULES.findIndex((module) => module.steps.includes(stepIndex));
    const nextModule = LEARN_MODULES[currentIndex + 1] ?? null;
    if (nextModule === null) {
      return;
    }
    if (nextModule.goesTo === "compare") {
      onGoToCompare();
      return;
    }
    if (nextModule.steps.length > 0) {
      const firstStep = Math.min(...nextModule.steps);
      setPlaying(false);
      setStepIndex(clampStepIndex(firstStep));
      setStepText(String(clampStepIndex(firstStep) + 1));
      setStepError(null);
    }
  }, [stepIndex, onGoToCompare]);

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
        onStartTour={tour.start}
      />

      {/*
        40 / 60. The left column is the story: controls, narration, question, facts.
        The right column is the machine itself, drawn from the same `buildLabView`
        adapter the Lab uses, so what is explained here is what the Lab will show.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="flex flex-col gap-4">
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

          <LessonFacts state={current} />

          {comparison === null ? null : <ComparisonCard comparison={comparison} />}
          {current.evidence === null ? null : <EvidenceCard evidence={current.evidence} />}
        </div>

        <div className="flex flex-col gap-4">
          {/*
            The PRIMARY diagram: one focused station at a time, not the whole machine.
            `LessonDiagram` reuses the same node boxes the Lab draws, so the learner
            meets exactly the picture they will meet in the Lab - but shows only the
            subject and the little context that led to it, so a lesson reads as a
            lesson rather than as a second Lab.
          */}
          <FocusFrame focus={current.step.focus} panel="chain" title="the translation chain">
            <LessonDiagram
              data={labView.pipeline}
              focus={nodeFocus}
              caption={
                stageFocus === null ? null : (
                  <p className="px-1 text-xs leading-snug text-muted" data-testid="pipeline-connector">
                    {stageConnectorText(stageFocus)}
                  </p>
                )
              }
            />
          </FocusFrame>

          {/*
            The DETAIL lives behind a disclosure, not on the stage. A learner who
            wants the whole machine - the event log, the TLB, the page table, RAM and
            the running totals - opens it; a learner following one step is not made
            to scroll past it. Each panel keeps its FocusFrame, so the dimming the
            lesson drives is the same whether the section is open or closed.
          */}
          <details
            data-testid="learn-technical"
            className="group rounded-card border border-line bg-surface-soft/40 shadow-raised"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <Icon name="info" size={16} className="text-primary-strong" />
                Technical details
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
                <span className="group-open:hidden">show</span>
                <span className="hidden group-open:inline">hide</span>
                <Icon
                  name="chevronRight"
                  size={15}
                  className="text-line-strong transition-transform duration-200 group-open:rotate-90"
                />
              </span>
            </summary>

            <div className="flex flex-col gap-4 border-t border-line px-4 py-4">
              <FocusFrame focus={current.step.focus} panel="timeline" title="the event log">
                <Timeline
                  entries={timelineEntries(current.records)}
                  cursor={current.cursor}
                  onSelect={handleSelectEvent}
                />
              </FocusFrame>

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
          </details>
        </div>
      </div>

      {isLastStep(stepIndex) ? (
        <section
          data-testid="learn-end"
          className="rounded-card border border-line bg-surface p-4 text-center shadow-raised"
        >
          <p className="text-sm leading-relaxed text-muted">
            That is the whole lesson: three real memory accesses, twelve steps, every number
            read from engine events. The machine is still running - take it for a spin, or
            keep going with the next module.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              data-testid="learn-try-lab"
              onClick={onGoToLab}
              className="rounded-lg bg-primary-strong px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-surface transition-colors hover:bg-primary"
            >
              Try it in the Lab →
            </button>
            <button
              type="button"
              data-testid="learn-next-module"
              onClick={handleNextModule}
              className="rounded-lg border border-line bg-surface-soft px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink transition-colors hover:border-primary/60"
            >
              Next Module →
            </button>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-line px-2 pt-4 text-center text-xs text-muted">
        Every step above is read from the events the engine returned for three real memory
        accesses. Nothing on this screen is written by hand: if the engine and the lesson ever
        disagree, the screen says so.
      </footer>

      {tour.overlayProps === null ? null : <TourOverlay {...tour.overlayProps} steps={LEARN_TOUR} />}
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


