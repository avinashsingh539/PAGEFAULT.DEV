/**
 * The global shell: skip link, header, the routed page, footer.
 *
 * Every screen is mounted inside this, which is why the hostile-URL E2E tests can
 * assert that `mode-learn` is visible on any page the app decides to render: the
 * navigation is part of the shell, not of any one screen.
 *
 * `min-h-dvh` plus `flex-col` with `flex-1` on the outlet is what pins the footer
 * to the bottom of a short page without pinning it over a tall one.
 */

import type { JSX, ReactNode } from "react";

import { TopNav } from "./TopNav";
import { SiteFooter } from "./SiteFooter";
import type { AppRoute } from "../lib/routes";

export function AppShell({
  route,
  onNavigate,
  children,
}: {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-strong focus:shadow-card"
      >
        Skip to main content
      </a>
      <TopNav route={route} onNavigate={onNavigate} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}
