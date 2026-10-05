/**
 * The application shell and router.
 *
 * Two ideas are separated here, and keeping them separate is what lets the redesign
 * happen without breaking anything:
 *
 *   1. WHICH PAGE is open        - `AppRoute`, resolved from the address bar.
 *   2. WHAT THAT PAGE IS SET TO  - `LabUrlConfig`, the lab's shareable state.
 *
 * A page never owns the URL, and the URL never owns the simulation. Switching from
 * the Lab to Compare and back keeps the address you typed and the reference string
 * you built, exactly as before, because those values live in this shell and not in
 * the screens.
 *
 * Only ONE screen is mounted at a time. Results are never carried between screens
 * in memory: the engine is pure, so a screen recomputes from the configuration on
 * demand and can never show a stale answer.
 */

import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";

import { AppShell } from "./design/AppShell";
import { Container } from "./design/primitives";
import { PageHeader } from "./design/PageHeader";

import CompareScreen from "./screens/CompareScreen";
import ExperimentScreen from "./screens/ExperimentScreen";
import LearnScreen from "./screens/LearnScreen";
import LandingScreen from "./screens/LandingScreen";
import DocsScreen from "./screens/DocsScreen";

import { readLabUrlConfig, writeLabUrlConfig } from "./lib/url";
import type { LabMode, LabUrlConfig } from "./lib/url";
import { ROUTE_MODES, hrefForRoute, resolveAppRoute } from "./lib/routes";
import type { AppRoute } from "./lib/routes";

/** One line per page, so the header always says what this screen is for. */
const PAGE_META: Readonly<Partial<Record<AppRoute, { readonly lede: string }>>> = {
  learn: { lede: "One address, from the CPU to RAM, explained one event at a time." },
  lab: { lede: "Send an address through the TLB, the page table and into RAM, under your control." },
  compare: { lede: "One reference string through FIFO, LRU and Optimal, side by side." },
};

export default function App(): JSX.Element {
  // The address bar is the source of truth for both questions, read once on mount.
  const [urlConfig, setUrlConfig] = useState<LabUrlConfig>(() => readLabUrlConfig());
  const [route, setRoute] = useState<AppRoute>(() =>
    resolveAppRoute(window.location.pathname, window.location.search),
  );

  // Back and forward. A pushState from elsewhere in the app fires this too, so the
  // config is re-read alongside the route: arriving at a Compare link must bring
  // its reference string with it.
  useEffect(() => {
    const onPopState = (): void => {
      setUrlConfig(readLabUrlConfig());
      setRoute(resolveAppRoute(window.location.pathname, window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // The route is authoritative for the mode: `/docs` is the docs even if the bar
  // still carries a stale `?mode=` from the Lab the visitor came from.
  const routeMode: LabMode | null = ROUTE_MODES[route] ?? null;

  // Mirror the configuration back into the URL, but only while a page that owns
  // configuration is mounted. Writing `?mode=experiment` onto `/docs` would make a
  // shareable Docs link lie about where it goes.
  useEffect(() => {
    if (routeMode === null) {
      return;
    }
    writeLabUrlConfig({ ...urlConfig, mode: routeMode });
  }, [urlConfig, routeMode]);

  const handleUrlConfigChange = useCallback((next: LabUrlConfig): void => {
    setUrlConfig(next);
  }, []);

  const handleNavigate = useCallback((next: AppRoute): void => {
    const nextMode = ROUTE_MODES[next];

    window.history.pushState(null, "", hrefForRoute(next));
    if (nextMode !== undefined) {
      // Carry the configuration across the switch, exactly as the old mode switch
      // did: the Lab keeps the address you typed, Compare keeps the string you built.
      setUrlConfig((previous) => ({ ...previous, mode: nextMode }));
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // Screens receive the config with the mode forced to match the page, so a screen
  // never has to wonder which page it is being rendered as.
  const screenConfig: LabUrlConfig =
    routeMode === null ? urlConfig : { ...urlConfig, mode: routeMode };

  return (
    <AppShell route={route} onNavigate={handleNavigate}>
      {route === "landing" ? (
        <LandingScreen onNavigate={handleNavigate} />
      ) : route === "docs" ? (
        <DocsScreen />
      ) : (
        <Container width="wide" className="py-8 sm:py-10">
          <PageHeader
            title={route === "lab" ? "Memory Lab" : route === "learn" ? "Learn" : "Compare"}
            lede={PAGE_META[route]?.lede}
            className="mb-8"
          />
          {route === "learn" ? (
            <LearnScreen
              urlConfig={screenConfig}
              onUrlConfigChange={handleUrlConfigChange}
              onGoToCompare={() => handleNavigate("compare")}
            />
          ) : route === "compare" ? (
            <CompareScreen
              urlConfig={screenConfig}
              onUrlConfigChange={handleUrlConfigChange}
            />
          ) : (
            <ExperimentScreen
              urlConfig={screenConfig}
              onUrlConfigChange={handleUrlConfigChange}
            />
          )}
        </Container>
      )}
    </AppShell>
  );
}
