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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
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
          ? "border-amber-400/60 bg-amber-400/10 text-amber-100"
          : "border-slate-800 bg-slate-950/60 text-slate-300"
      }`}
    >
      <span className="num w-14">slot {slot}</span>
      <span className="num">page {entry.pageNumber}</span>
      <span className="num text-slate-400">→ frame {entry.frameNumber}</span>
      <span className="num text-xs text-slate-500">age {entry.fillOrder}</span>
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
          <p className="text-sm text-slate-500">
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
        <p className="text-sm text-slate-500">
          This machine was built without a TLB: every access walks the page table.
        </p>
      )}
      {tlb === undefined && view.tlbEnabled && !view.tlbAfter && (
        <p className="mt-2 text-xs text-slate-500">showing the state before this access</p>
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
          <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
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
                className={`border-t border-slate-800/70 ${
                  faulted ? "text-rose-300" : touched ? "text-sky-200" : "text-slate-300"
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
                  ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-200"
                  : frame.pageNumber === null
                    ? "border-slate-800 bg-slate-950/60 text-slate-600"
                    : "border-slate-800 bg-slate-900 text-slate-300"
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
      ? { label: "TLB HIT", classes: "border-amber-400/60 bg-amber-400/10 text-amber-200" }
      : view.verdict === "miss"
        ? { label: "TLB MISS", classes: "border-sky-400/60 bg-sky-400/10 text-sky-200" }
        : view.verdict === "fault"
          ? { label: "PAGE FAULT", classes: "border-rose-400/70 bg-rose-500/10 text-rose-200" }
          : { label: "IDLE", classes: "border-slate-800 bg-slate-950/60 text-slate-400" };

  return (
    <section className={`rounded-2xl border p-4 ${verdict.classes}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.25em]">{verdict.label}</p>
      <p className="mt-1 text-sm">{view.subline}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300/90">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">page</dt>
          <dd className="num">{view.pageNumber ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">offset</dt>
          <dd className="num">{view.offset ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">frame</dt>
          <dd className="num">{view.frameNumber ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">physical</dt>
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
        <Counter label="TLB hits" value={view.hits} tone="text-amber-200" />
        <Counter label="TLB misses" value={view.misses} tone="text-sky-200" />
        <Counter label="page faults" value={view.faults} tone="text-rose-200" />
        <Counter label="events" value={view.totalEvents} />
        <Counter label="actions" value={view.records} />
      </dl>
    </Panel>
  );
}

function Counter({
  label,
  value,
  tone = "text-slate-200",
}: {
  label: string;
  value: number;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className={`num text-lg font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}