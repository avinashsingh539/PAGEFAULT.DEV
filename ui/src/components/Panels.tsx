/**
 * The right-hand state panels: TLB, page table, RAM, verdict, counters.
 *
 * Everything rendered here is engine state or an engine event payload. The panels
 * highlight rows based on event data (the touched page or frame) but never decide
 * whether anything is a hit, a miss or a fault.
 */

import type { JSX } from "react";
import type { ReactNode } from "react";

import type { MachineState, SessionView, TlbEntry, TlbState } from "../lib";
import { pageTableRows } from "../lib";

function Panel({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="rounded-card border border-line bg-surface shadow-raised p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function isHot(view: SessionView, entry: TlbEntry): boolean {
  return view.pageNumber !== null && entry.pageNumber === view.pageNumber;
}

function TlbRow({ entry, slot, hot }: { entry: TlbEntry; slot: number; hot: boolean }): JSX.Element {
  return (
    <li
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
        hot
          ? "border-fault/50 bg-fault-soft text-fault"
          : "border-line bg-surface-soft text-ink"
      }`}
    >
      <span className="num w-14">slot {slot}</span>
      <span className="num">page {entry.pageNumber}</span>
      <span className="num text-muted">→ frame {entry.frameNumber}</span>
      <span className="num text-xs text-muted">age {entry.fillOrder}</span>
    </li>
  );
}

/**
 * The TLB exactly as the engine sees it right now, newest entry highlighted.
 *
 * `tlb` is an optional override for screens that hold engine state but no cursor into an
 * event stream - Learn Mode's opening steps, before any access has happened. Without it
 * the panel describes the TLB the cursor implies; with it, the TLB the engine reports.
 * Either way the entries are engine state, never a copy the UI maintains.
 */
export function TlbPanel({ view, tlb }: { view: SessionView; tlb?: TlbState }): JSX.Element {
  const enabled = tlb === undefined ? view.tlbEnabled : tlb.enabled;
  const entries = tlb === undefined ? view.tlbEntries : tlb.entries;
  const capacity = tlb === undefined ? view.tlbCapacity : tlb.capacity;
  const occupancy = entries.length;

  return (
    <Panel title={enabled ? `TLB (${occupancy}/${capacity} entries)` : "TLB (disabled)"}>
      {enabled ? (
        entries.length === 0 ? (
          <p className="text-sm text-muted">
            Empty — every access will miss until a translation is cached.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry, slot) => (
              <TlbRow key={entry.pageNumber} entry={entry} slot={slot} hot={isHot(view, entry)} />
            ))}
          </ul>
        )
      ) : (
        <p className="text-sm text-muted">
          This machine was built without a TLB: every access walks the page table.
        </p>
      )}
      {tlb === undefined && view.tlbEnabled && !view.tlbAfter && (
        <p className="mt-2 text-xs text-muted">showing the state before this access</p>
      )}
    </Panel>
  );
}

/** The page table, with the row the current access touched highlighted. */
export function PageTablePanel({
  machine,
  view,
}: {
  machine: MachineState;
  view: SessionView;
}): JSX.Element {
  const rows = pageTableRows(machine);
  const faultedPage = view.verdict === "fault" ? view.pageNumber : null;

  return (
    <Panel title="Page table">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-muted">
            <th className="pb-1 font-medium">page</th>
            <th className="pb-1 font-medium">frame</th>
            <th className="pb-1 font-medium">state</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const touched = view.pageNumber === row.pageNumber;
            const faulted = touched && faultedPage === row.pageNumber;
            return (
              <tr
                key={row.pageNumber}
                className={`border-t border-line/70 ${
                  faulted ? "text-error" : touched ? "text-primary-strong" : "text-ink"
                }`}
              >
                <td className="num py-1">{row.pageNumber}</td>
                <td className="num py-1">{row.present ? row.frameNumber : "—"}</td>
                <td className="py-1 text-xs">
                  {faulted
                    ? "not resident — fault"
                    : row.present
                      ? touched
                        ? "resident (touched)"
                        : "resident"
                      : "absent"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

/** Physical RAM: one chip per frame, the touched one lit. */
export function RamPanel({ machine, view }: { machine: MachineState; view: SessionView }): JSX.Element {
  const touched = view.event?.type === "RAM_ACCESS" ? view.frameNumber : null;

  return (
    <Panel title={`RAM (${machine.memory.frameCount} frames × ${machine.memory.pageSize} B)`}>
      <ul className="grid grid-cols-4 gap-1.5">
        {machine.memory.frames.map((frame) => {
          const hot = frame.frameNumber === touched;
          return (
            <li
              key={frame.frameNumber}
              className={`num rounded-lg border px-2 py-2 text-center text-xs ${
                hot
                  ? "border-hit/50 bg-hit-soft text-hit"
                  : frame.pageNumber === null
                    ? "border-line bg-surface-soft text-muted"
                    : "border-line bg-surface-soft text-ink"
              }`}
            >
              <div className="font-semibold">f{frame.frameNumber}</div>
              <div className="text-[11px] opacity-80">
                {frame.pageNumber === null ? "free" : `p${frame.pageNumber}`}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The verdict banner: one label plus the numbers of this access, all read off events. */
export function VerdictPanel({ view }: { view: SessionView }): JSX.Element {
  const verdict =
    view.verdict === "hit"
      ? { label: "TLB HIT", classes: "border-fault/50 bg-fault-soft text-fault" }
      : view.verdict === "miss"
        ? { label: "TLB MISS", classes: "border-primary/40 bg-primary-soft text-primary-strong" }
        : view.verdict === "fault"
          ? { label: "PAGE FAULT", classes: "border-error/60 bg-error-soft text-error" }
          : { label: "IDLE", classes: "border-line bg-surface-soft text-muted" };

  return (
    <section className={`rounded-2xl border p-4 ${verdict.classes}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.25em]">{verdict.label}</p>
      <p className="mt-1 text-sm">{view.subline}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink/90">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">page</dt>
          <dd className="num">{view.pageNumber ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">offset</dt>
          <dd className="num">{view.offset ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">frame</dt>
          <dd className="num">{view.frameNumber ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">physical</dt>
          <dd className="num">
            {view.physicalAddress === null ? "—" : `0x${view.physicalAddress.toString(16)}`}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** The session counters, folded from whole-record verdicts. */
export function Counters({ view }: { view: SessionView }): JSX.Element {
  const total = view.hits + view.misses + view.faults;
  return (
    <Panel title="Session">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Counter label="accesses" value={total} />
        <Counter label="TLB hits" value={view.hits} tone="text-fault" />
        <Counter label="TLB misses" value={view.misses} tone="text-primary-strong" />
        <Counter label="page faults" value={view.faults} tone="text-error" />
        <Counter label="events" value={view.totalEvents} />
        <Counter label="actions" value={view.records} />
      </dl>
    </Panel>
  );
}

function Counter({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: number;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-surface-soft px-3 py-2">
      <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className={`num text-lg font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}