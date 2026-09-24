/**
 * Global navigation.
 *
 * The vocabulary is the product's, not the engine's: a visitor is offered Learn,
 * Lab, Compare and Docs. Words like "Engine", "Machine", "Events" and "Simulation"
 * are implementation nouns and deliberately absent from navigation - a learner
 * arrives knowing none of them and must not have to learn our vocabulary before
 * they can find the lesson.
 *
 * The `mode-*` test ids and the `aria-current` contract are carried over unchanged
 * from the old screen switch: the E2E suite asserts on them, and an active nav item
 * marked with `aria-current="page"` is also the correct thing for a screen reader
 * to announce, so the test and the accessibility rule agree.
 *
 * Desktop gets a single row; below `md` the links collapse behind a disclosure so
 * that the 360px row has no horizontal overflow. Every target is at least 44px.
 */

import { useEffect, useId, useState } from "react";
import type { JSX } from "react";

import { Icon } from "./Icon";
import { Container } from "./primitives";
import { cx } from "./cx";
import type { AppRoute } from "../lib/routes";
import { ROUTE_LABELS, hrefForRoute } from "../lib/routes";

/**
 * The four nav entries, in order.
 *
 * `testId` is the historical E2E hook, which names the old `experiment` screen. It
 * is an internal identifier, not user-facing text, so the visible label can be the
 * friendlier "Lab" without touching the tests.
 */
const NAV_ITEMS: readonly { route: AppRoute; testId: string | null }[] = [
  { route: "learn", testId: "mode-learn" },
  { route: "lab", testId: "mode-experiment" },
  { route: "compare", testId: "mode-compare" },
  { route: "docs", testId: null },
];

export function TopNav({
  route,
  onNavigate,
}: {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  // The menu is a disclosure, not a page: Escape closes it, and choosing a
  // destination closes it, because leaving it open over the new page is the
  // classic mobile-menu bug.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  const choose = (next: AppRoute): void => {
    setMenuOpen(false);
    onNavigate(next);
  };

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md"
    >
      <Container width="wide">
        <div className="flex h-16 items-center justify-between gap-4">
          <a
            href={hrefForRoute("landing")}
            onClick={(event) => {
              event.preventDefault();
              choose("landing");
            }}
            className="flex items-center gap-2.5 rounded-chip py-2 text-base font-extrabold tracking-tight text-ink"
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-[0.6rem] bg-primary text-sm font-black text-surface"
            >
              P
            </span>
            PAGEFAULT<span className="text-primary">.DEV</span>
          </a>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.route}
                route={item.route}
                label={ROUTE_LABELS[item.route]}
                active={route === item.route}
                testId={item.testId}
                onChoose={choose}
              />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={hrefForRoute("learn")}
              onClick={(event) => {
                event.preventDefault();
                choose("learn");
              }}
              data-testid="start-learning"
              className="hidden items-center gap-1.5 rounded-control bg-primary-strong px-4 py-2.5 text-sm font-semibold text-surface transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-primary active:scale-[0.98] sm:inline-flex"
            >
              Start Learning
              <Icon name="arrowRight" size={16} />
            </a>

            <button
              type="button"
              data-testid="nav-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="grid size-11 place-items-center rounded-control border border-line bg-surface text-ink transition-colors hover:bg-surface-soft md:hidden"
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </Container>

      <div id={menuId} hidden={!menuOpen} className="border-t border-line bg-surface md:hidden">
        <Container width="wide">
          <nav aria-label="Main menu" className="flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.route}
                route={item.route}
                label={ROUTE_LABELS[item.route]}
                active={route === item.route}
                testId={null}
                onChoose={choose}
                className="justify-start py-3.5 text-base"
              />
            ))}
            <a
              href={hrefForRoute("learn")}
              onClick={(event) => {
                event.preventDefault();
                choose("learn");
              }}
              className="mx-2 my-2 flex items-center justify-center gap-2 rounded-control bg-primary-strong px-4 py-3 text-sm font-semibold text-surface"
            >
              Start Learning
              <Icon name="arrowRight" size={16} />
            </a>
          </nav>
        </Container>
      </div>
    </header>
  );
}

/**
 * One nav entry. An anchor, not a button: it has a real `href`, so it can be
 * middle-clicked, copied, and crawled, and it still looks and behaves like a tab.
 * The click handler upgrades it to a client-side transition and the browser URL
 * is updated for the back button.
 */
function NavLink({
  route,
  label,
  active,
  testId,
  onChoose,
  className,
}: {
  route: AppRoute;
  label: string;
  active: boolean;
  testId: string | null;
  onChoose: (route: AppRoute) => void;
  className?: string;
}): JSX.Element {
  return (
    <a
      href={hrefForRoute(route)}
      // The test id is rendered on the DESKTOP nav only. The mobile menu is a second
      // control for the same four links, not a second source of truth: emitting the
      // same id twice would make `getByTestId("mode-learn")` match two nodes and turn
      // every navigation assertion into a strict-mode violation.
      data-testid={testId ?? undefined}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        onChoose(route);
      }}
      className={cx(
        "flex min-h-11 items-center rounded-control px-3.5 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-primary-soft text-primary-strong"
          : "text-muted hover:bg-surface-soft hover:text-ink",
        className,
      )}
    >
      {label}
    </a>
  );
}

