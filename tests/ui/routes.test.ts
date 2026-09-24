/**
 * The route resolver is the one function every page depends on, and the one an
 * address bar can hand anything at all to. It is tested here without a browser
 * for the same reason `urlParams.test.ts` exists: a rule about hostile input that
 * can only be checked in a real browser is a rule that gets checked rarely.
 *
 * The two behaviours worth protecting above all others:
 *
 *   1. It NEVER THROWS, whatever the path or query.
 *   2. A link it does not understand still opens a working page - never a blank
 *      screen and never an error page.
 */

import { describe, expect, it } from "vitest";

import { hrefForRoute, resolveAppRoute, ROUTE_LABELS } from "../../ui/src/lib/routes";
import type { AppRoute } from "../../ui/src/lib/routes";

/** Split an href the way the browser would hand it to the resolver. */
function resolveHref(href: string): AppRoute {
  const url = new URL(href, "https://pagefault.dev");
  return resolveAppRoute(url.pathname, url.search);
}

describe("resolveAppRoute", () => {
  it("opens the landing page at a bare root", () => {
    expect(resolveAppRoute("/", "")).toBe("landing");
  });

  it("honours every documented ?mode= spelling", () => {
    expect(resolveAppRoute("/", "?mode=learn")).toBe("learn");
    expect(resolveAppRoute("/", "?mode=experiment")).toBe("lab");
    expect(resolveAppRoute("/", "?mode=compare")).toBe("compare");
  });

  it("honours the path form, with or without the /lab prefix", () => {
    expect(resolveAppRoute("/learn", "")).toBe("learn");
    expect(resolveAppRoute("/lab/learn", "")).toBe("learn");
    expect(resolveAppRoute("/compare", "")).toBe("compare");
    expect(resolveAppRoute("/lab/compare", "")).toBe("compare");
    expect(resolveAppRoute("/lab", "")).toBe("lab");
    expect(resolveAppRoute("/lab/experiment", "")).toBe("lab");
    expect(resolveAppRoute("/docs", "")).toBe("docs");
  });

  it("is case-insensitive about path segments", () => {
    expect(resolveAppRoute("/LEARN", "")).toBe("learn");
    expect(resolveAppRoute("/Docs", "")).toBe("docs");
  });

  // The E2E suite depends on this one: `/?mode=definitely-not-a-mode` must open
  // the Lab with the experiment nav item marked current, not an error page.
  it("sends an unknown mode to the Lab rather than an error page", () => {
    expect(resolveAppRoute("/", "?mode=nope")).toBe("lab");
    expect(resolveAppRoute("/", "?mode=definitely-not-a-mode")).toBe("lab");
    expect(resolveAppRoute("/", "?mode=")).toBe("lab");
    expect(resolveAppRoute("/", "?mode=LEARN")).toBe("lab");
  });

  it("lets a real path win over a stale ?mode=", () => {
    expect(resolveAppRoute("/docs", "?mode=learn")).toBe("docs");
    expect(resolveAppRoute("/learn", "?mode=compare")).toBe("learn");
  });

  it("ignores a missing ?mode= entirely, so a bare / stays the landing page", () => {
    // These are the hostile URLs the hardening spec opens: a root with parameters
    // that are not `mode`. They must land on the landing page, not the Lab.
    expect(resolveAppRoute("/", "?step=-1")).toBe("landing");
    expect(resolveAppRoute("/", "?frameCount=-10&tlbCapacity=abc")).toBe("landing");
  });

  it("sends an unknown path with no mode to the landing page", () => {
    expect(resolveAppRoute("/nope", "")).toBe("landing");
    expect(resolveAppRoute("/a/b/c/d", "")).toBe("landing");
  });

  it("never throws, for any of a large pile of hostile locations", () => {
    const paths = [
      "/", "//", "///", "/%", "/%2e%2e", "/../..", "/lab/", "/lab//", "/lab/../",
      "/\u0000", "/<>", "/a".repeat(500), "/-/../etc/passwd", "/lab/" + "x".repeat(2000),
    ];
    const searches = [
      "", "?", "?=", "?mode", "?mode=", "?mode=%00", "?mode=%%%%", "?&&&", "?mode=a&mode=b",
      "?mode=" + "z".repeat(3000), "?" + "a=1&".repeat(500),
    ];

    for (const path of paths) {
      for (const search of searches) {
        expect(() => resolveAppRoute(path, search)).not.toThrow();
      }
    }
  });
});

describe("hrefForRoute", () => {
  it("produces a URL that resolves back to the same route", () => {
    const routes: readonly AppRoute[] = ["landing", "learn", "lab", "compare", "docs"];
    for (const route of routes) {
      expect(resolveHref(hrefForRoute(route))).toBe(route);
    }
  });

  it("uses the query form for the lab pages so links stay shareable", () => {
    expect(hrefForRoute("learn")).toBe("/?mode=learn");
    expect(hrefForRoute("lab")).toBe("/?mode=experiment");
    expect(hrefForRoute("compare")).toBe("/?mode=compare");
    expect(hrefForRoute("docs")).toBe("/docs");
    expect(hrefForRoute("landing")).toBe("/");
  });
});

describe("navigation vocabulary", () => {
  // The redesign brief forbids implementation nouns in navigation. This is a
  // cheap guard, because the temptation to call the Lab "Simulation" is strong.
  it("never exposes engine jargon in a nav label", () => {
    const forbidden = ["engine", "machine", "event", "simulation"];
    for (const label of Object.values(ROUTE_LABELS)) {
      const lower = label.toLowerCase();
      for (const word of forbidden) {
        expect(lower).not.toContain(word);
      }
    }
  });
});
