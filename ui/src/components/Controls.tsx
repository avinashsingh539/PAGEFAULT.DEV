/**
 * The left pane: the address box, presets, playback controls and machine settings.
 *
 * Handlers are passed in from App; this file renders and validates input text only.
 */

import type { JSX } from "react";

import { ADDRESS_PRESETS, DEMO_PAGE_SIZE } from "../lib";
import { PAGE_SIZE_OPTIONS } from "../lib/url";

export interface ControlsProps {
  readonly addressText: string;
  readonly onAddressTextChange: (text: string) => void;
  readonly accessKind: "read" | "write";
  readonly onAccessKindChange: (kind: "read" | "write") => void;
  readonly onAccess: () => void;
  readonly onStep: () => void;
  readonly onBack: () => void;
  readonly onPlayPause: () => void;
  readonly playing: boolean;
  readonly onReset: () => void;
  readonly onInvalidate: (pageNumber: number) => void;
  readonly pageSize: number;
  readonly onPageSizeChange: (size: number) => void;
  readonly tlbCapacity: number | null;
  readonly onTlbCapacityChange: (capacity: number | null) => void;
  readonly error: string | null;
  readonly canStep: boolean;
  readonly canBack: boolean;
}

const PAGE_SIZES: readonly number[] = [...PAGE_SIZE_OPTIONS];

export function Controls(props: ControlsProps): JSX.Element {
  const presets = ADDRESS_PRESETS.map((preset) => ({
    ...preset,
    address: preset.page * DEMO_PAGE_SIZE + preset.offset,
  }));

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          CPU / program
        </h2>

        <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500" htmlFor="address">
          virtual address (decimal or 0x hex)
        </label>
        <input
          id="address"
          value={props.addressText}
          onChange={(event) => props.onAddressTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              props.onAccess();
            }
          }}
          spellCheck={false}
          className="num w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
          placeholder="0x12345"
        />

        <div className="mt-3 flex gap-2">
          {(["read", "write"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => props.onAccessKindChange(kind)}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs uppercase tracking-widest transition-colors ${
                props.accessKind === kind
                  ? "border-sky-400 bg-sky-500/15 text-sky-200"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500"
              }`}
            >
              {kind}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={props.onAccess}
          className="mt-3 w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400"
        >
          ACCESS
        </button>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <SmallButton label="⟲" title="step back" onClick={props.onBack} disabled={!props.canBack} />
          <SmallButton label="STEP" title="next event" onClick={props.onStep} disabled={!props.canStep} />
          <SmallButton
            label={props.playing ? "PAUSE" : "PLAY"}
            title="play the event stream"
            onClick={props.onPlayPause}
            disabled={!props.canStep && !props.playing}
            wide
          />
          <SmallButton label="RESET" title="new session" onClick={props.onReset} disabled={false} />
        </div>

        {props.error !== null && (
          <p className="mt-3 rounded-lg border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {props.error}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Address presets
        </h2>
        <ul className="space-y-1.5">
          {presets.map((preset) => (
            <li key={preset.label}>
              <button
                type="button"
                onClick={() => props.onAddressTextChange(`0x${preset.address.toString(16)}`)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-sky-400/60 hover:text-sky-100"
              >
                <span>{preset.label}</span>
                <span className="num text-slate-500">0x{preset.address.toString(16)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Load a preset, then ACCESS it twice to see the TLB hit skip the page table.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Machine
        </h2>

        <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500" htmlFor="pageSize">
          page size (rebuilds the machine)
        </label>
        <select
          id="pageSize"
          value={props.pageSize}
          onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
          className="num w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} bytes
            </option>
          ))}
        </select>

        <label className="mb-1 mt-3 block text-xs uppercase tracking-widest text-slate-500" htmlFor="tlb">
          TLB
        </label>
        <select
          id="tlb"
          value={props.tlbCapacity === null ? "none" : String(props.tlbCapacity)}
          onChange={(event) =>
            props.onTlbCapacityChange(
              event.target.value === "none" ? null : Number(event.target.value),
            )
          }
          className="num w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="none">none (Day 1 machine)</option>
          {[1, 2, 4, 6, 8].map((size) => (
            <option key={size} value={size}>
              {size} entries (FIFO)
            </option>
          ))}
        </select>

        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">
            invalidate a cached page
          </p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => props.onInvalidate(page)}
                title={`invalidate page ${page}`}
                className="num flex-1 rounded-lg border border-slate-700 bg-slate-950 py-1.5 text-xs text-slate-300 transition-colors hover:border-violet-400/60 hover:text-violet-200"
              >
                p{page}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SmallButton({
  label,
  title,
  onClick,
  disabled,
  wide = false,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
  wide?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs font-semibold uppercase tracking-widest text-slate-300 transition-colors enabled:hover:border-sky-400/70 enabled:hover:text-sky-100 disabled:opacity-40 ${
        wide ? "col-span-2" : ""
      }`}
    >
      {label}
    </button>
  );
}