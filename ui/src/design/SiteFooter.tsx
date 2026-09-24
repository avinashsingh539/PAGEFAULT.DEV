/**
 * The site footer: the same on every page, because a footer that changes shape
 * between screens is one more thing a visitor has to re-learn.
 */

import type { JSX } from "react";

import { Container } from "./primitives";
import { Icon } from "./Icon";
import type { AppRoute } from "../lib/routes";
import { hrefForRoute } from "../lib/routes";

const FOOTER_LINKS: readonly { route: AppRoute; label: string }[] = [
  { route: "learn", label: "Learn" },
  { route: "lab", label: "Memory Lab" },
  { route: "compare", label: "Compare" },
  { route: "docs", label: "Docs" },
];

export function SiteFooter({
  onNavigate,
}: {
  onNavigate: (route: AppRoute) => void;
}): JSX.Element {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <Container width="wide">
        <div className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="text-sm font-extrabold tracking-tight text-ink">
              PAGEFAULT<span className="text-primary">.DEV</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              An interactive computer-systems laboratory. Every run is deterministic: the
              same addresses produce the same events, every time.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Explore
            </p>
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.route}
                href={hrefForRoute(link.route)}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(link.route);
                }}
                className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary-strong"
              >
                {link.label}
                <Icon name="chevronRight" size={14} />
              </a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-line py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>PAGEFAULT.DEV — built for learning, not for production workloads.</p>
          <p className="num">Paging · TLB · Page faults · Replacement</p>
        </div>
      </Container>
    </footer>
  );
}
