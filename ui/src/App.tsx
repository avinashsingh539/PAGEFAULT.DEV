/**
 * The MemoryLab app shell: one header, one mode switch, and the two screens.
 *
 * Each screen owns its own session and its own state. This shell only keeps the mode
 * (Experiment or Compare) and the URL configuration, which it reads once from the
 * address bar and writes back whenever a screen reports a change. Switching screens
 * never destroys the other screen's session: each screen keeps its own `useState`, so
 * going back and forth is a tab switch, not a restart.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";

import { ModeNav } from "./components/ModeNav";
import CompareScreen from "./screens/CompareScreen";
import ExperimentScreen from "./screens/ExperimentScreen";
import { readLabUrlConfig, writeLabUrlConfig } from "./lib/url";
import type { LabMode, LabUrlConfig } from "./lib/url";

export default function App(): JSX.Element {
  // Configuration comes from the URL once, so a lab setup is a link someone can share.
  const initial = useRef(readLabUrlConfig()).current;
  const [urlConfig, setUrlConfig] = useState<LabUrlConfig>(initial);
  const [mode, setMode] = useState<LabMode>(initial.mode);

  const handleUrlConfigChange = useCallback((next: LabUrlConfig): void => {
    setUrlConfig(next);
  }, []);

  // The mode lives in the address bar, so a `/lab/compare?...` or `?mode=experiment`
  // link opens the screen it names. Screens also report every configuration change
  // upward, and this effect writes those back into the bar without navigating.
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
            <p className="text-xs text-slate-500">
              {mode === "experiment"
                ? "CPU → virtual address → TLB → page table → frame → RAM, one engine event at a time"
                : "one reference string through FIFO, LRU and Optimal, step by step"}
            </p>
          </div>
          <ModeNav mode={mode} onModeChange={handleModeChange} />
        </div>
      </header>

      {mode === "compare" ? (
        <CompareScreen urlConfig={urlConfig} onUrlConfigChange={handleUrlConfigChange} />
      ) : (
        <ExperimentScreen urlConfig={urlConfig} onUrlConfigChange={handleUrlConfigChange} />
      )}
    </div>
  );
}
