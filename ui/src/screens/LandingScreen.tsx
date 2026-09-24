/**
 * Landing page.
 *
 * NOTE: this is the Task 2 shell of a page that Task 12 completes. It exists now so
 * that the new navigation, the footer and the router have a real destination to
 * point at - a nav item that leads nowhere is worse than a nav item that is not
 * there yet. The seven sections, the proof strip, the learning path and the
 * miniature Lab arrive in Task 12, once the shared visualisation components exist.
 */

import type { JSX } from "react";

import { Container, Section } from "../design/primitives";
import { Icon } from "../design/Icon";
import { hrefForRoute } from "../lib/routes";
import type { AppRoute } from "../lib/routes";

export default function LandingScreen({
  onNavigate,
}: {
  onNavigate: (route: AppRoute) => void;
}): JSX.Element {
  return (
    <>
      <Section spacing="loose" className="bg-surface">
        <Container>
          <div className="max-w-3xl">
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] text-ink sm:text-5xl lg:text-6xl">
              See what your computer actually does.
            </h1>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted">
              Step through a memory access and watch a virtual address travel from the CPU,
              through the TLB and the page table, and into RAM - one event at a time, with an
              explanation for every single one.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={hrefForRoute("learn")}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate("learn");
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-primary-strong px-6 text-base font-semibold text-surface transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-primary active:scale-[0.98]"
              >
                Start Learning
                <Icon name="arrowRight" size={18} />
              </a>
              <a
                href={hrefForRoute("lab")}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate("lab");
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-line bg-surface px-6 text-base font-semibold text-ink transition-colors hover:bg-surface-soft"
              >
                Explore Memory Lab
              </a>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
