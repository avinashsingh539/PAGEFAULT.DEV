/**
 * The MemoryLab screen.
 *
 * The session lives here, and it is deliberately small: a machine, a list of records
 * (one per action the user performed), a cursor into the event stream and a playing
 * flag. Every action goes through the engine's `step()`; every pixel is derived from
 * what the engine returned. See `lib/session.ts` for the exact boundary.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";

import { EngineError, step } from "../../engine";
import type { MachineState } from "../../engine";
import type { SessionCursor, SessionRecord } from "./lib/session";
import {
  appendAccess,
  appendInvalidation,
  cursorBackward,
  cursorForEntry,
  cursorForNewRecord,
  cursorForward,
  timelineEntries,
  viewForCursor,
} from "./lib/session";
import { eventDrilldown } from "./lib/facts";
import { Controls } from "./components/Controls";
import { Counters, PageTablePanel, RamPanel, TlbPanel, VerdictPanel } from "./components/Panels";
import { Pipeline } from "./components/Pipeline";
import { Timeline } from "./components/Timeline";
import { createUiLabMachine } from "./lib/lab";
import { parseAddressText, readLabUrlConfig, writeLabUrlConfig } from "./lib/url";
import type { LabUrlConfig } from "./lib/url";

/** Milliseconds between events while PLAY is on. */
const PLAY_INTERVAL_MS = 550;

export default function App(): JSX.Element {
  // Configuration comes from the URL once, so a lab setup is a link someone can share.
  const initial = useRef(readLabUrlConfig()).current;
  const [config, setConfig] = useState<LabUrlConfig>(initial);
  const [addressText, setAddressText] = useState<string>(initial.addressText);
  const [accessKind, setAccessKind] = useState<"read" | "write">(initial.accessKind);
  const [machine, setMachine] = useState<MachineState>(() => machineFromConfig(initial));
  const [records, setRecords] = useState<readonly SessionRecord[]>([]);
  const [cursor, setCursor] = useState<SessionCursor | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = useMemo(() => viewForCursor(records, cursor), [records, cursor]);
  const log = useMemo(() => timelineEntries(records), [records]);

  // Persist the configuration in the address bar whenever it changes.
  useEffect(() => {
    writeLabUrlConfig({ ...config, addressText, accessKind });
  }, [config, addressText, accessKind]);

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

  /** Rebuild the machine (and the session) for a new configuration. */
  const rebuildMachine = useCallback((next: LabUrlConfig): void => {
    setConfig(next);
    setMachine(machineFromConfig(next));
    setRecords([]);
    setCursor(null);
    setPlaying(false);
    setError(null);
  }, []);

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
      setError(caught instanceof EngineError ? `${caught.code}: ${caught.message}` : String(caught));
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
        setError(caught instanceof EngineError ? `${caught.code}: ${caught.message}` : String(caught));
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
    <div className="min-h-screen">
      <Header machine={machine} />

      <main className="mx-auto grid max-w-7xl gap-4 px-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
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
          onPageSizeChange={(pageSize) => rebuildMachine({ ...config, pageSize })}
          tlbCapacity={config.tlbCapacity}
          onTlbCapacityChange={(tlbCapacity) => rebuildMachine({ ...config, tlbCapacity })}
          error={error}
          canStep={canStep && !atEnd}
          canBack={canBack}
        />

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
        </div>

        <div className="space-y-4">
          <TlbPanel view={view} />
          <PageTablePanel machine={machine} view={view} />
          <RamPanel machine={machine} view={view} />
          <Counters view={view} />
        </div>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-600">
        The engine decides; this screen only draws what it returned. Every number above
        is an event payload or engine state.
      </footer>
    </div>
  );
}

function Header({ machine }: { machine: MachineState }): JSX.Element {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-baseline justify-between gap-2 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">
            PAGEFAULT.DEV <span className="text-slate-500">/</span> MemoryLab
          </h1>
          <p className="text-xs text-slate-500">
            CPU → virtual address → TLB → page table → frame → RAM, one engine event at a
            time
          </p>
        </div>
        <p className="text-xs text-slate-500">
          machine <span className="num text-slate-300">{machine.process.name}</span> · pid{" "}
          <span className="num text-slate-300">{machine.process.pid}</span> ·{" "}
          {machine.tlb.enabled ? `TLB ${machine.tlb.capacity} entries (FIFO)` : "no TLB"}
        </p>
      </div>
    </header>
  );
}

/** Build the lab machine for a configuration (engine-side validation still applies). */
function machineFromConfig(config: LabUrlConfig): MachineState {
  return createUiLabMachine({
    pageSize: config.pageSize,
    tlbCapacity: config.tlbCapacity ?? null,
  });
}
