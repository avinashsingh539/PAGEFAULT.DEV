/**
 * The Experiment screen: a freely configurable machine driven one action at a time.
 *
 * This is Day 3's MemoryLab grown up: the same session model (machine, records, cursor,
 * timeline), but the machine is built from the user's own configuration - page size, TLB
 * entries, frame count - and the session gains two new maintenance actions alongside
 * accesses and invalidations: a whole-TLB flush and a page unmap.
 *
 * The one rule has not changed: every action goes through the engine's `step()` (or,
 * for the replacement panel, through `runReferenceString`), and every pixel is derived
 * from what the engine returned. The form is validated twice: once for immediate
 * feedback, once by the engine when the machine is built. When they disagree, the
 * engine wins.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { step } from "../../../engine";
import type { MachineState } from "../../../engine";
import type { MaintenanceRecord, SessionCursor, SessionRecord } from "../lib/session";
import {
  appendAccess,
  appendInvalidation,
  appendMaintenance,
  cursorBackward,
  cursorForEntry,
  cursorForNewRecord,
  cursorForward,
  timelineEntries,
  viewForCursor,
} from "../lib/session";
import { eventDrilldown } from "../lib/facts";
import { Controls } from "../components/Controls";
import { Counters, PageTablePanel, RamPanel, TlbPanel, VerdictPanel } from "../components/Panels";
import { Pipeline } from "../components/Pipeline";
import { Timeline } from "../components/Timeline";
import { ConfigPanel } from "../components/ConfigPanel";
import { AlgorithmCard, ReplacementTimeline } from "../components/ReplacementPanel";
import { DEFAULT_COMPARE_REFERENCE_TEXT, compare, parseCompareFrameCount } from "../lib/compare";
import { parseReferenceString } from "../lib/fields";
import type { CompareColumn } from "../lib/compare";
import {
  DEFAULT_EXPERIMENT_CONFIG,
  buildExperimentMachine,
  messageForError,
  textForConfig,
  validateExperimentConfig,
} from "../lib/experiment";
import type {
  ExperimentConfig,
  ExperimentFieldErrors,
  ExperimentFormText,
} from "../lib/experiment";
import { parseAddressText } from "../lib/url";
import type { LabUrlConfig } from "../lib/url";

/** Milliseconds between events while PLAY is on. */
const PLAY_INTERVAL_MS = 550;

/** Pages offered for the maintenance actions: the mapped range plus both fault cases. */
const EXPERIMENT_FIRST_PAGES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Which column of the comparison the Experiment screen replays in its own panel. */
function columnForAlgorithm(
  columns: readonly CompareColumn[],
  algorithm: ExperimentConfig["algorithm"],
): CompareColumn | null {
  return columns.find((column) => column.algorithm === algorithm) ?? null;
}

export interface ExperimentScreenProps {
  /** The URL configuration, kept in sync by the app shell as the user works. */
  readonly urlConfig: LabUrlConfig;
  readonly onUrlConfigChange: (next: LabUrlConfig) => void;
}

export default function ExperimentScreen({ urlConfig, onUrlConfigChange }: ExperimentScreenProps): JSX.Element {
  // The machine comes from the URL once, so a lab setup is a link someone can share.
  // Any later change goes through the form so a half-typed field cannot break it.
  const [config, setConfig] = useState<ExperimentConfig>(() => configFromUrl(urlConfig));
  const [form, setForm] = useState<ExperimentFormText>(() => textForConfig(configFromUrl(urlConfig)));
  const [fieldErrors, setFieldErrors] = useState<ExperimentFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [addressText, setAddressText] = useState<string>(urlConfig.addressText);
  const [accessKind, setAccessKind] = useState<"read" | "write">(urlConfig.accessKind);
  const [machine, setMachine] = useState<MachineState>(() => machineFromConfig(configFromUrl(urlConfig)));
  const [records, setRecords] = useState<readonly SessionRecord[]>([]);
  const [cursor, setCursor] = useState<SessionCursor | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The reference string the replacement experiment runs, and what came out.
  const [referenceText, setReferenceText] = useState<string>(urlConfig.referenceText);
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [replacementColumns, setReplacementColumns] = useState<readonly CompareColumn[] | null>(null);

  const view = useMemo(() => viewForCursor(records, cursor), [records, cursor]);
  const log = useMemo(() => timelineEntries(records), [records]);
  const experimentColumn = useMemo(
    () => (replacementColumns === null ? null : columnForAlgorithm(replacementColumns, config.algorithm)),
    [replacementColumns, config.algorithm],
  );

  // Persist the sharable configuration whenever it changes.
  useEffect(() => {
    onUrlConfigChange({
      ...urlConfig,
      mode: "experiment",
      addressText,
      accessKind,
      pageSize: config.pageSize,
      tlbCapacity: config.tlbCapacity,
      frameCount: config.frameCount,
      algorithm: config.algorithm,
      referenceText,
    });
    // urlConfig intentionally omitted: it is the value being written, not read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressText, accessKind, config, referenceText]);

  const canStep =
    cursor !== null &&
    view.record !== null &&
    (cursor.eventIndex + 1 < (view.record.events.length ?? 0) ||
      cursor.recordIndex + 1 < records.length);
  const canBack = cursor !== null && (cursor.eventIndex > 0 || cursor.recordIndex > 0);
  const atEnd =
    cursor !== null &&
    view.record !== null &&
    cursor.eventIndex + 1 >= view.record.events.length &&
    cursor.recordIndex + 1 >= records.length;

  /** Rebuild the machine (and the session) for a validated configuration. */
  const rebuildMachine = useCallback((next: ExperimentConfig): void => {
    const built = buildExperimentMachine(next);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setConfig(next);
    setForm(textForConfig(next));
    setFieldErrors({});
    setFormError(null);
    setMachine(built.value);
    setRecords([]);
    setCursor(null);
    setPlaying(false);
    setError(null);
    setReplacementColumns(null);
    setReplacementError(null);
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof ExperimentFormText, value: string): void => {
      const next = { ...form, [field]: value };
      setForm(next);
      // Re-validate the whole form so a previously highlighted field clears the
      // moment its own message goes away. The machine itself is NOT rebuilt until
      // APPLY: a half-typed number must not be able to touch it.
      setFieldErrors(validateExperimentConfig(next).fieldErrors);
      setFormError(null);
    },
    [form],
  );

  const handleApply = useCallback((): void => {
    const validated = validateExperimentConfig(form);
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      setFormError(validated.error);
      return;
    }
    rebuildMachine(validated.value);
  }, [form, rebuildMachine]);

  const handleAccess = useCallback((): void => {
    const address = parseAddressText(addressText);
    if (address === null) {
      setError("That is not a virtual address. Use decimal (74565) or hex (0x12345).");
      return;
    }
    try {
      const result = step(machine, { type: "ACCESS_ADDRESS", address, access: accessKind });
      const record: SessionRecord = {
        kind: "access",
        stateBefore: machine,
        address,
        accessKind,
        events: [...result.events],
        stateAfter: result.state,
      };
      const nextRecords = appendAccess(records, record);
      setMachine(result.state);
      setRecords(nextRecords);
      setCursor(cursorForNewRecord(nextRecords));
      setError(null);
    } catch (caught) {
      setError(messageForError(caught));
    }
  }, [accessKind, addressText, machine, records]);

  const handleInvalidate = useCallback(
    (pageNumber: number): void => {
      try {
        const result = step(machine, { type: "INVALIDATE_TLB", pageNumber });
        // A no-op invalidation (the page was not cached) has nothing to show, and the
        // engine said so by returning no events. Silence, not a fake step.
        if (result.events.length === 0) {
          setError(`Page ${pageNumber} is not cached, so there is nothing to invalidate.`);
          return;
        }
        const record: SessionRecord = {
          kind: "invalidation",
          stateBefore: machine,
          pageNumber,
          events: [...result.events],
          stateAfter: result.state,
        };
        const nextRecords = appendInvalidation(records, record);
        setMachine(result.state);
        setRecords(nextRecords);
        setCursor(cursorForNewRecord(nextRecords));
        setError(null);
      } catch (caught) {
        setError(messageForError(caught));
      }
    },
    [machine, records],
  );

  const handleClearTlb = useCallback((): void => {
    try {
      const result = step(machine, { type: "CLEAR_TLB" });
      // An empty TLB reports no events: telling the user "entries flushed" after
      // dropping nothing would be a lie, so this says nothing at all instead.
      if (result.events.length === 0) {
        setError("The TLB is already empty, so there was nothing to flush.");
        return;
      }
      const record: MaintenanceRecord = {
        kind: "maintenance",
        stateBefore: machine,
        action: "CLEAR_TLB",
        pageNumber: null,
        events: [...result.events],
        stateAfter: result.state,
      };
      const nextRecords = appendMaintenance(records, record);
      setMachine(result.state);
      setRecords(nextRecords);
      setCursor(cursorForNewRecord(nextRecords));
      setError(null);
    } catch (caught) {
      setError(messageForError(caught));
    }
  }, [machine, records]);

  const handleUnmap = useCallback(
    (pageNumber: number): void => {
      try {
        const result = step(machine, { type: "UNMAP_PAGE", pageNumber });
        // Nothing to remove also produces nothing to show: the guarantee (that page
        // is not mapped) already holds, so the engine correctly reports no events.
        if (result.events.length === 0) {
          setError(`Page ${pageNumber} is not mapped, so there is nothing to remove.`);
          return;
        }
        const record: MaintenanceRecord = {
          kind: "maintenance",
          stateBefore: machine,
          action: "UNMAP_PAGE",
          pageNumber,
          events: [...result.events],
          stateAfter: result.state,
        };
        const nextRecords = appendMaintenance(records, record);
        setMachine(result.state);
        setRecords(nextRecords);
        setCursor(cursorForNewRecord(nextRecords));
        setError(null);
      } catch (caught) {
        setError(messageForError(caught));
      }
    },
    [machine, records],
  );

  const handleStep = useCallback((): void => {
    if (cursor === null) {
      if (records.length > 0) {
        setCursor({ recordIndex: 0, eventIndex: 0 });
      }
      return;
    }
    setCursor(cursorForward(records, cursor));
  }, [cursor, records]);

  const handleBack = useCallback((): void => {
    if (cursor !== null) {
      setCursor(cursorBackward(cursor));
    }
  }, [cursor]);

  /** Run the replacement experiment: the same engine run the textbook uses. */
  const handleRunReplacement = useCallback((): void => {
    const parsed = parseReferenceString(referenceText);
    if (!parsed.ok) {
      setReplacementError(parsed.error);
      return;
    }
    const counted = parseCompareFrameCount(String(config.frameCount));
    if (!counted.ok || counted.value === null) {
      setReplacementError(counted.ok ? "Frame count must be at least 1." : counted.error);
      return;
    }
    const result = compare(parsed.value, counted.value);
    if (!result.ok) {
      setReplacementError(result.error);
      return;
    }
    setReplacementColumns(result.value.columns);
    setReplacementError(null);
  }, [referenceText, config.frameCount]);

  // PLAY advances the cursor on a timer and stops honestly at the end of the log.
  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      setCursor((current) => {
        if (current === null) {
          return current;
        }
        const advanced = cursorForward(records, current);
        if (
          advanced.recordIndex === current.recordIndex &&
          advanced.eventIndex === current.eventIndex
        ) {
          setPlaying(false); // end of the log
          return current;
        }
        return advanced;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, records]);

  // Keyboard: arrows step, space plays/pauses. Cheap, and it feels like a lab.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      if (event.key === "ArrowRight") {
        handleStep();
      } else if (event.key === "ArrowLeft") {
        handleBack();
      } else if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleStep, handleBack]);

  return (
    <div>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Controls
            addressText={addressText}
            onAddressTextChange={(text) => {
              setAddressText(text);
              setError(null);
            }}
            accessKind={accessKind}
            onAccessKindChange={setAccessKind}
            onAccess={handleAccess}
            onStep={handleStep}
            onBack={handleBack}
            onPlayPause={() => setPlaying((value) => !value)}
            playing={playing}
            onReset={() => rebuildMachine(config)}
            onInvalidate={handleInvalidate}
            pageSize={config.pageSize}
            onPageSizeChange={(pageSize) => handleFieldChange("pageSize", String(pageSize))}
            tlbCapacity={config.tlbCapacity}
            onTlbCapacityChange={(tlbCapacity) =>
              handleFieldChange("tlbCapacity", tlbCapacity === null ? "none" : String(tlbCapacity))
            }
            error={error}
            canStep={canStep && !atEnd}
            canBack={canBack}
          />
          <ConfigPanel
            form={form}
            fieldErrors={fieldErrors}
            formError={formError}
            onFieldChange={handleFieldChange}
            onApply={handleApply}
            onReset={() => rebuildMachine(config)}
            tlbEnabled={machine.tlb.enabled}
            tlbOccupied={machine.tlb.entries.length}
            maintenancePages={EXPERIMENT_FIRST_PAGES}
            onClearTlb={handleClearTlb}
            onUnmapPage={handleUnmap}
          />
        </div>

        <div className="space-y-4">
          <Pipeline view={view} record={view.record} />
          <VerdictPanel view={view} />
          <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
            {eventDrilldown(view.event)}
          </p>
          <Timeline
            entries={log}
            cursor={cursor}
            onSelect={(entry) => setCursor(cursorForEntry(entry))}
          />
          <ReplacementExperiment
            referenceText={referenceText}
            onReferenceTextChange={setReferenceText}
            algorithm={config.algorithm}
            frameCount={config.frameCount}
            column={experimentColumn}
            error={replacementError}
            onRun={handleRunReplacement}
            onClear={() => {
              setReplacementColumns(null);
              setReplacementError(null);
            }}
          />
        </div>

        <div className="space-y-4">
          <TlbPanel view={view} />
          <PageTablePanel machine={machine} view={view} />
          <RamPanel machine={machine} view={view} />
          <Counters view={view} />
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-600">
        The engine decides; this screen only draws what it returned. Every number above is an
        event payload or engine state.
      </footer>
    </div>
  );
}

/** Read the initial experiment configuration off the URL, validating it first. */
function configFromUrl(url: LabUrlConfig): ExperimentConfig {
  const validated = validateExperimentConfig({
    pageSize: String(url.pageSize),
    tlbCapacity: url.tlbCapacity === null ? "none" : String(url.tlbCapacity),
    frameCount: String(url.frameCount),
    algorithm: url.algorithm,
  });
  return validated.ok ? validated.value : { ...DEFAULT_EXPERIMENT_CONFIG };
}

/** Build the first machine for a configuration; the engine was already consulted. */
function machineFromConfig(config: ExperimentConfig): MachineState {
  const built = buildExperimentMachine(config);
  if (built.ok) {
    return built.value;
  }
  // configFromUrl already validated this configuration against the engine, so this
  // fallback is unreachable in practice; the default is guaranteed valid instead.
  const fallback = buildExperimentMachine(DEFAULT_EXPERIMENT_CONFIG);
  if (fallback.ok) {
    return fallback.value;
  }
  throw new Error("The default experiment machine failed to build; this is a bug, not user input.");
}

/**
 * The Experiment screen's replacement panel: one text box, one RUN, and the chosen
 * algorithm's own timeline. Compare Mode shows all three columns; this panel shows the
 * one the user selected, against the same reference string.
 *
 * Data comes from `lib/compare.ts` - which calls the engine's one shared harness - so
 * the only thing being shown is what `runReferenceString` produced.
 */
function ReplacementExperiment({
  referenceText,
  onReferenceTextChange,
  algorithm,
  frameCount,
  column,
  error,
  onRun,
  onClear,
}: {
  referenceText: string;
  onReferenceTextChange: (text: string) => void;
  algorithm: ExperimentConfig["algorithm"];
  frameCount: number;
  column: CompareColumn | null;
  error: string | null;
  onRun: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        Replacement experiment
      </h2>

      <p className="mb-3 text-xs text-slate-500">
        Runs this reference string through {algorithm} with {frameCount} frames - the
        algorithm and frame count from the configuration on the left. Address-level
        faults above stay translation facts; the run happens here, through the
        engine&apos;s one shared harness.
      </p>

      <label
        className="mb-1 block text-xs uppercase tracking-widest text-slate-500"
        htmlFor="experimentReference"
      >
        reference string (page numbers, spaces or commas)
      </label>
      <input
        id="experimentReference"
        value={referenceText}
        onChange={(event) => onReferenceTextChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onRun();
          }
        }}
        spellCheck={false}
        placeholder={DEFAULT_COMPARE_REFERENCE_TEXT}
        className="num w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
      />

      {error === null ? null : (
        <p
          data-testid="replacement-error"
          className="mt-2 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="run-replacement"
          onClick={onRun}
          className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 transition-colors hover:bg-sky-400"
        >
          run
        </button>
        <button
          type="button"
          data-testid="clear-replacement"
          onClick={onClear}
          className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:border-slate-500"
        >
          clear
        </button>
      </div>

      {column === null ? null : (
        <div className="mt-3 space-y-3">
          <AlgorithmCard column={column} frameCount={frameCount} />
          <ReplacementTimeline
            columns={[column]}
            referenceString={column.steps.map((step) => step.pageNumber)}
          />
        </div>
      )}
    </section>
  );
}
