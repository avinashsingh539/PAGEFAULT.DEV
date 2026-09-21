/**
 * The MemoryLab app shell: one header, one mode switch, and the three screens.
 *
 * Only the active screen is mounted. What survives a switch is each screen's shareable
 * CONFIGURATION, because every screen writes its own inputs back into this shell's URL
 * state and re-reads them on return: a Compare exercise comes back with its reference
 * string and frame count, an Experiment with its machine, a Lesson on its step. Results
 * are recomputed on demand - the engine is pure, so replaying costs nothing and can
 * never produce a different answer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";

import { ModeNav } from "./components/ModeNav";
import CompareScreen from "./screens/CompareScreen";
import ExperimentScreen from "./screens/ExperimentScreen";
import LearnScreen from "./screens/LearnScreen";
import { readLabUrlConfig, writeLabUrlConfig } from "./lib/url";
import type { LabMode, LabUrlConfig } from "./lib/url";

/** One line per mode, so the header always says what this screen is for. */
const MODE_BLURBS: Record<LabMode, string> = {
  learn: "one address from the CPU to RAM, explained one engine event at a time",
  experiment: "CPU → virtual address → TLB → page table → frame → RAM, under your control",
  compare: "one reference string through FIFO, LRU and Optimal, step by step",
};

export default function App(): JSX.Element {
  // Configuration comes from the URL once, so a lab setup is a link someone can share.
  const initial = useRef(readLabUrlConfig()).current;
  const [urlConfig, setUrlConfig] = useState<LabUrlConfig>(initial);
  const [mode, setMode] = useState<LabMode>(initial.mode);

  const handleUrlConfigChange = useCallback((next: LabUrlConfig): void => {
    setUrlConfig(next);
  }, []);

  // The mode lives in the address bar, so a `/lab/learn?...`, `/lab/compare?...` or
  // `?mode=experiment` link opens the screen it names. Screens also report every
  // configuration change upward, and this effect writes those back into the bar without
  // navigating.
  useEffect(() => {
    writeLabUrlConfig({ ...urlConfig, mode });
  }, [urlConfig, mode]);

  const handleModeChange = useCallback((next: LabMode): void => {
    setMode(next);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">
              PAGEFAULT.DEV <span className="text-slate-500">/</span> MemoryLab
            </h1>
            <p className="text-xs text-slate-500">{MODE_BLURBS[mode]}</p>
          </div>
          <ModeNav mode={mode} onModeChange={handleModeChange} />
        </div>
      </header>

      {mode === "learn" ? (
        <LearnScreen urlConfig={urlConfig} onUrlConfigChange={handleUrlConfigChange} />
      ) : mode === "compare" ? (
        <CompareScreen urlConfig={urlConfig} onUrlConfigChange={handleUrlConfigChange} />
      ) : (
        <ExperimentScreen urlConfig={urlConfig} onUrlConfigChange={handleUrlConfigChange} />
      )}
    </div>
  );
}
