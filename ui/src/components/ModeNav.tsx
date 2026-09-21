/**
 * The screen switch: Learn, Experiment or Compare.
 *
 * This component owns no routing machinery beyond calling `onModeChange`: the app
 * shell keeps `mode` in state and writes it into the URL, so a `/lab/learn?...`,
 * `/lab/compare?...` or `?mode=experiment` link opens the screen it names on a fresh load.
 */

import type { JSX } from "react";

import { LAB_MODES } from "../lib/url";
import type { LabMode } from "../lib/url";

const MODE_LABELS: Record<LabMode, string> = {
  learn: "Learn",
  experiment: "Experiment",
  compare: "Compare",
};

export function ModeNav({
  mode,
  onModeChange,
}: {
  mode: LabMode;
  onModeChange: (mode: LabMode) => void;
}): JSX.Element {
  return (
    <nav aria-label="lab mode" className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
      {LAB_MODES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          data-testid={`mode-${candidate}`}
          aria-current={candidate === mode ? "page" : undefined}
          onClick={() => onModeChange(candidate)}
          className={`rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
            candidate === mode
              ? "bg-sky-500 text-slate-950"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          {MODE_LABELS[candidate]}
        </button>
      ))}
    </nav>
  );
}
