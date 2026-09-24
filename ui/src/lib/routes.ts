/**
 * Which page the address bar names.
 *
 * This is a deliberately tiny router. The product is five pages served as static
 * files, and the URL scheme is already a public, documented contract:
 *
 *   /?mode=learn        Learn        /lab/learn       Learn
 *   /?mode=experiment   Memory Lab   /lab/experiment  Memory Lab
 *   /?mode=compare      Compare      /lab/compare     Compare
 *   /                   Landing      /docs            Docs
 *
 * Both spellings work, so the links written in the documentation keep working
 * whether or not the static host rewrites unknown paths onto index.html. The path
 * form is what a human would type; the query form is what the 47 E2E tests and the
 * shared-link UI already use, so neither is broken to accommodate the redesign.
 *
 * The rule that matters most: this function never THROWS and never returns
 * nothing. An address it does not understand becomes the landing page, and an
 * explicit `?mode=` it does not understand becomes the Lab - the same "a broken
 * link opens a working screen" rule the URL parser has always followed.
 */

import type { LabMode } from "./url";
import { isLabMode } from "./url";

export type AppRoute = "landing" | "learn" | "lab" | "compare" | "docs";

/** The Lab route is the one whose `?mode=` value is `experiment`. */
export const ROUTE_MODES: Readonly<Partial<Record<AppRoute, LabMode>>> = {
  learn: "learn",
  lab: "experiment",
  compare: "compare",
};

/** The label each page's nav entry shows. Never "Engine", "Machine" or "Simulation". */
export const ROUTE_LABELS: Readonly<Record<AppRoute, string>> = {
  landing: "Home",
  learn: "Learn",
  lab: "Lab",
  compare: "Compare",
  docs: "Docs",
};

/**
 * The href a nav entry points at.
 *
 * Always the query form, so a link is a complete, shareable description of the
 * destination and works on a static host with no rewrite rule.
 */
export function hrefForRoute(route: AppRoute): string {
  const mode = ROUTE_MODES[route];
  return mode === undefined ? (route === "docs" ? "/docs" : "/") : `/?mode=${mode}`;
}

/**
 * Resolve a location to a page.
 *
 * Order matters. A path segment that names a page wins, because `/docs?mode=learn`
 * is plainly a request for the docs. Only when the path is not a page does the
 * query decide - and then only if a `mode` parameter is actually present, which is
 * what keeps a bare `/` free to mean "the landing page".
 */
export function resolveAppRoute(pathname: string, search: string): AppRoute {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  const last = (segments[segments.length - 1] ?? "").toLowerCase();

  if (last === "docs" || last === "compare" || last === "learn") {
    return last;
  }
  if (last === "lab" || last === "experiment") {
    return "lab";
  }

  const fromQuery = new URLSearchParams(search).get("mode");
  if (fromQuery !== null) {
    if (isLabMode(fromQuery)) {
      return fromQuery === "experiment" ? "lab" : fromQuery;
    }
    // A mode that names nothing is a link that lost an argument, not a 404.
    return "lab";
  }

  return "landing";
}
