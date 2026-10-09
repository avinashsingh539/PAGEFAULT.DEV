/**
 * Landing page: exactly seven sections, top to bottom.
 *
 * 1. Hero                 - headline, the two CTAs, and a LIVE engine-driven diagram
 * 2. Proof strip          - three factual points about what the product is
 * 3. What You'll Learn    - five cards, each with a visual
 * 4. Learning path        - the six Learn modules in order, straight from LEARN_MODULES
 * 5. Try It Now           - a miniature Memory Lab that runs the REAL engine in place
 * 6. Students/Developers  - two cards, four bullets each
 * 7. Final CTA            - "Ready to see what happens inside memory?"
 *
 * THE HONESTY RULE APPLIES HERE TOO. The hero and the miniature Lab both run
 * `step()` on the lab machine and draw through `buildLabView()` - the same
 * engine, the same adapter, the same seven boxes as the Lab and the lesson.
 * Nothing on this page is a mock-up: the hero plays a real access back event by
 * event, and the mini Lab's second run on the same page is a real TLB hit
 * because the machine's state genuinely carries over.
 *
 * THE FOOTER IS NOT HERE ON PURPOSE. The shell renders `SiteFooter` once for
 * every route; section 7 is the closing CTA that sits directly above it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX, MouseEvent } from "react";

import { createLabMachine, step } from "../../../engine";
import type { MachineState } from "../../../engine";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/Icon";
import { Card, Container, Section, SectionHeading } from "../design/primitives";
import { usePrefersReducedMotion } from "../design/motion";
import { EventExplanation } from "../design/viz/EventExplanation";
import { MemoryPipeline } from "../design/viz/MemoryPipeline";
import { messageForError } from "../lib/experiment";
import { buildLabView } from "../lib/labView";
import { appendAccess, viewForCursor } from "../lib/session";
import type { SessionCursor, SessionRecord } from "../lib/session";
import { hrefForRoute } from "../lib/routes";
import { parseAddressText } from "../lib/url";
import type { AppRoute } from "../lib/routes";
import { LEARN_MODULES } from "./learn/LearnModuleIndex";

/** How often the hero advances one engine event. Slow enough to read the box it lights. */
const HERO_INTERVAL_MS = 1600;

/**
 * The hero's access: page 1 of the lab table, which maps to frame 7 - the
 * documented reference value, so the hero matches `docs/reference-values.md`.
 */
const HERO_ADDRESS = 0x1345;

const PROOF_POINTS: readonly { title: string; body: string; icon: IconName }[] = [
  {
    title: "Deterministic",
    body: "The same configuration and the same access always produce the same events - every run reproduces the last.",
    icon: "check",
  },
  {
    title: "Step-by-step",
    body: "One engine event at a time, each with an explanation of what happened and why it matters.",
    icon: "step",
  },
  {
    title: "Compare 3 algorithms",
    body: "FIFO, LRU and Optimal run on the same reference string, side by side, with their fault counts in the open.",
    icon: "table",
  },
];

const TOPIC_CARDS: readonly { title: string; blurb: string; icon: IconName }[] = [
  {
    title: "Virtual Memory",
    blurb: "Why the address a program uses is not where the byte lives, and how the two are joined.",
    icon: "route",
  },
  {
    title: "Paging",
    blurb: "One virtual address becomes a page and an offset; the page table turns the page into a frame.",
    icon: "table",
  },
  {
    title: "TLB",
    blurb: "The cache that lets the CPU skip the page table walk entirely - and what a hit actually saves.",
    icon: "layers",
  },
  {
    title: "Page Faults",
    blurb: "What happens when the wanted page is not in RAM, and why translation genuinely stops there.",
    icon: "alert",
  },
  {
    title: "Page Replacement",
    blurb: "FIFO, LRU and Optimal deciding which page leaves when RAM fills up.",
    icon: "bolt",
  },
];

const AUDIENCE_CARDS: readonly {
  readonly title: string;
  readonly icon: IconName;
  readonly bullets: readonly string[];
}[] = [
  {
    title: "Students",
    icon: "book",
    bullets: ["visual explanations", "guided lessons", "interactive experiments", "algorithm comparisons"],
  },
  {
    title: "Developers",
    icon: "cpu",
    bullets: ["deterministic simulations", "configurable systems", "event timelines", "reproducible experiments"],
  },
];

/** The three preset addresses of the mini Lab: first touch, same page, absent page. */
const MINI_PRESETS: readonly { readonly label: string; readonly text: string }[] = [
  { label: "first touch", text: "0x1345" },
  { label: "same page again", text: "0x1999" },
  { label: "absent page", text: "0x6064" },
];

export default function LandingScreen({
  onNavigate,
}: {
  onNavigate: (route: AppRoute) => void;
}): JSX.Element {
  /** Every CTA leaves through the router, so the back button keeps exactly one owner. */
  const goTo =
    (route: AppRoute) =>
    (event: MouseEvent<HTMLAnchorElement>): void => {
      event.preventDefault();
      onNavigate(route);
    };

  return (
    <>
      {/* 1 - Hero */}
      <Section spacing="loose" className="bg-surface">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
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
                  onClick={goTo("learn")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-primary-strong px-6 text-base font-semibold text-surface transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-primary active:scale-[0.98]"
                >
                  Start Learning
                  <Icon name="arrowRight" size={18} />
                </a>
                <a
                  href={hrefForRoute("lab")}
                  onClick={goTo("lab")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-line bg-surface px-6 text-base font-semibold text-ink transition-colors hover:bg-surface-soft"
                >
                  Explore Memory Lab
                </a>
              </div>
            </div>

            <HeroLivePipeline />
          </div>
        </Container>
      </Section>

      {/* 2 - Proof strip */}
      <Section spacing="tight" className="border-y border-line bg-surface-soft">
        <Container>
          <ul data-testid="landing-proof" className="grid gap-4 sm:grid-cols-3">
            {PROOF_POINTS.map((point) => (
              <li
                key={point.title}
                className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-raised"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-primary-soft text-primary-strong">
                  <Icon name={point.icon} size={18} />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{point.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 3 - What You'll Learn */}
      <Section className="bg-surface">
        <Container>
          <SectionHeading
            title="What You'll Learn"
            lede="Five ideas that together explain how a program's address becomes a byte in RAM - and what the OS does when it cannot."
            align="center"
            className="mb-8"
          />
          <ul data-testid="landing-topics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOPIC_CARDS.map((topic) => (
              <li key={topic.title} className="flex">
                <Card className="flex h-full w-full flex-col gap-3 p-5">
                  <span className="grid size-11 place-items-center rounded-chip bg-primary-soft text-primary-strong">
                    <Icon name={topic.icon} size={22} />
                  </span>
                  <h3 className="text-base font-bold text-ink">{topic.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{topic.blurb}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 4 - Learning path */}
      <Section className="border-y border-line bg-surface-soft">
        <Container>
          <SectionHeading
            title="Learning Path"
            lede="Six modules in order - or start anywhere: none of them are locked."
            align="center"
            className="mb-8"
          />
          <ol data-testid="landing-path" className="mx-auto flex max-w-md flex-col items-stretch">
            {LEARN_MODULES.map((module, index) => (
              <li key={module.id} className="flex flex-col items-center">
                <div className="flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-raised">
                  <span className="num text-xs font-bold text-muted">0{index + 1}</span>
                  <span className="text-sm font-bold text-ink">{module.title}</span>
                  <span className="ml-auto text-[0.6875rem] text-muted">
                    {module.steps.length === 0 ? "in Compare" : `${module.steps.length} steps`}
                  </span>
                </div>
                {index < LEARN_MODULES.length - 1 ? (
                  <span aria-hidden="true" className="py-1 text-line-strong">
                    <Icon name="arrowDown" size={16} />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* 5 - Try It Now: the miniature Lab, running the real engine in place */}
      <Section className="bg-surface">
        <Container>
          <SectionHeading
            title="Try It Now"
            lede="A miniature Memory Lab, right here: enter a virtual address and the same engine the full Lab runs answers on this page."
            align="center"
            className="mb-8"
          />
          <MiniLab />
        </Container>
      </Section>

      {/* 6 - Students / Developers */}
      <Section className="border-y border-line bg-surface-soft">
        <Container>
          <SectionHeading title="Students / Developers" align="center" className="mb-8" />
          <div data-testid="landing-audience" className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {AUDIENCE_CARDS.map((card) => (
              <Card key={card.title} className="flex flex-col gap-4 p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-chip bg-primary-soft text-primary-strong">
                    <Icon name={card.icon} size={20} />
                  </span>
                  <h3 className="text-lg font-bold text-ink">{card.title}</h3>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {card.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm text-muted">
                      <span className="mt-0.5 text-primary-strong">
                        <Icon name="check" size={14} />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* 7 - Final CTA (the site footer itself is rendered once by the shell) */}
      <Section className="bg-primary-soft">
        <Container>
          <div className="flex flex-col items-center gap-6 text-center">
            <h2 className="text-balance text-2xl font-extrabold text-ink sm:text-3xl lg:text-4xl">
              Ready to see what happens inside memory?
            </h2>
            <a
              href={hrefForRoute("learn")}
              onClick={goTo("learn")}
              data-testid="landing-final-cta"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-primary-strong px-6 text-base font-semibold text-surface transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-primary active:scale-[0.98]"
            >
              Start Learning
              <Icon name="arrowRight" size={18} />
            </a>
          </div>
        </Container>
      </Section>
    </>
  );
}

/**
 * The hero's live drawing: ONE real access, condensed into a five-stop concept flow.
 *
 * The record is produced once by `step()`; the timer only moves a highlight token
 * across that run's five stations, so the animation can never invent a frame, a
 * hit or a fault the engine did not emit. There are no tables, counters, logs or
 * controls here: the Hero introduces the idea, and Try It Now operates it.
 */

/** The five stops the hero shows, in hardware order. */
const HERO_STOPS = [
  { key: "cpu", label: "CPU", icon: "cpu" },
  { key: "virtual", label: "Virtual Address", icon: "route" },
  { key: "tlb", label: "TLB", icon: "layers" },
  { key: "pageTable", label: "Page Table", icon: "table" },
  { key: "ram", label: "RAM", icon: "memory" },
] as const;

function HeroLivePipeline(): JSX.Element {
  const machine = useMemo(() => createLabMachine({ processName: "landing-hero" }), []);

  const records = useMemo(() => {
    const result = step(machine, { type: "ACCESS_ADDRESS", address: HERO_ADDRESS, access: "read" });
    const record: SessionRecord = {
      kind: "access",
      stateBefore: machine,
      address: HERO_ADDRESS,
      accessKind: "read",
      events: [...result.events],
      stateAfter: result.state,
    };
    return appendAccess([], record);
  }, [machine]);

  const totalEvents = records[0]?.events.length ?? 0;
  const [eventIndex, setEventIndex] = useState<number>(0);
  const reducedMotion = usePrefersReducedMotion();

  // Advance a highlight token, not the cursor: the hero draws one fixed concept
  // flow and lights each stop in turn. Reduced motion parks the token on the CPU
  // instead of travelling it - the address is still shown, nothing is removed.
  // An empty record stops the clock: there would be nothing to animate and
  // nothing honest to show.
  useEffect(() => {
    if (totalEvents === 0 || reducedMotion) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setEventIndex((index) => (index + 1) % HERO_STOPS.length);
    }, HERO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [totalEvents, reducedMotion]);

  const addressText = totalEvents === 0 ? "—" : `0x${HERO_ADDRESS.toString(16)}`;
  const activeStop = totalEvents === 0 ? -1 : eventIndex % HERO_STOPS.length;

  return (
    <div
      data-testid="landing-hero-pipeline"
      className="rounded-card border border-line bg-surface p-5 shadow-raised sm:p-8"
    >
      <header className="mb-5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-strong">
          Live memory flow
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-chip bg-hit-soft px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-hit">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full bg-hit ${reducedMotion ? "" : "animate-pulse"}`}
          />
          live
        </span>
      </header>
      <ol
        aria-label="One address travelling from the CPU to RAM"
        className="mx-auto flex w-full max-w-md flex-col items-stretch"
      >
        {HERO_STOPS.map((stop, index) => (
          <li key={stop.key} className="flex flex-col items-stretch">
            <div
              className={`flex items-center gap-3 rounded-card border px-4 py-3 transition-colors duration-500 ${
                index === activeStop
                  ? "border-primary bg-primary-soft shadow-raised"
                  : "border-line bg-surface-soft/60"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-9 shrink-0 place-items-center rounded-chip transition-colors duration-500 ${
                  index === activeStop ? "bg-primary-strong text-surface" : "bg-line text-muted"
                }`}
              >
                <Icon name={stop.icon} size={18} />
              </span>
              <span className="text-sm font-bold text-ink">{stop.label}</span>
              {index === activeStop ? (
                <span className="num ml-auto rounded-chip bg-surface px-2 py-0.5 text-xs font-semibold text-primary-strong shadow-raised">
                  {addressText}
                </span>
              ) : null}
            </div>
            {index < HERO_STOPS.length - 1 ? (
              <span aria-hidden="true" className="flex justify-center py-1 text-line-strong">
                <Icon name="arrowDown" size={16} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        One address, travelling through the memory system.
      </p>
    </div>
  );
}

/**
 * The miniature Lab: the Lab's own action, minus the console around it.
 *
 * State accumulates exactly as the real Lab's does - the machine `step()` returned
 * becomes the machine the NEXT run starts from - so touching the same page twice
 * shows a real TLB hit, and the absent page really faults. Nothing here is a
 * shortcut: it is `step()`, `appendAccess()` and `buildLabView()`, the same three
 * calls ExperimentScreen makes, with only the address field left in.
 */
function MiniLab(): JSX.Element {
  const [machine, setMachine] = useState<MachineState>(() =>
    createLabMachine({ processName: "landing-mini-lab" }),
  );
  const [records, setRecords] = useState<readonly SessionRecord[]>([]);
  const [cursor, setCursor] = useState<SessionCursor | null>(null);
  const [addressText, setAddressText] = useState<string>("0x1345");
  const [error, setError] = useState<string | null>(null);

  const view = useMemo(() => viewForCursor(records, cursor), [records, cursor]);
  const labView = useMemo(() => buildLabView(machine, records, view), [machine, records, view]);

  const runAddress = useCallback(
    (text: string): void => {
      const address = parseAddressText(text);
      if (address === null) {
        setError("That is not a virtual address. Use decimal (74565) or hex (0x12345).");
        return;
      }
      try {
        const result = step(machine, { type: "ACCESS_ADDRESS", address, access: "read" });
        const record: SessionRecord = {
          kind: "access",
          stateBefore: machine,
          address,
          accessKind: "read",
          events: [...result.events],
          stateAfter: result.state,
        };
        const nextRecords = appendAccess(records, record);
        setMachine(result.state);
        setRecords(nextRecords);
        // Park the cursor on the LAST event of the access: the mini has no transport
        // controls to step with, so the outcome - the frame, the physical address, or
        // the fault that stopped translation - is what the visitor came to see. The
        // cursor is a presentation position over real events, never an engine fact.
        const newest = nextRecords[nextRecords.length - 1];
        setCursor({
          recordIndex: nextRecords.length - 1,
          eventIndex: newest === undefined ? 0 : newest.events.length - 1,
        });
        setError(null);
      } catch (caught) {
        setError(messageForError(caught));
      }
    },
    [machine, records],
  );

  return (
    <div
      data-testid="landing-mini-lab"
      className="mx-auto flex max-w-3xl flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-raised"
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          runAddress(addressText);
        }}
      >
        <div>
          <label
            htmlFor="landingMiniAddress"
            className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted"
          >
            virtual address
          </label>
          <input
            id="landingMiniAddress"
            data-testid="landing-mini-address"
            value={addressText}
            spellCheck={false}
            onChange={(event) => setAddressText(event.target.value)}
            className="num w-40 rounded-lg border border-line bg-surface-soft px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          data-testid="landing-mini-run"
          className="rounded-lg bg-primary-strong px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-surface transition-colors hover:bg-primary"
        >
          ACCESS
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Try:</span>
        {MINI_PRESETS.map((preset) => (
          <button
            key={preset.text}
            type="button"
            onClick={() => {
              setAddressText(preset.text);
              runAddress(preset.text);
            }}
            className="rounded-chip border border-line bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary/60"
          >
            {preset.text} <span className="font-normal text-muted">({preset.label})</span>
          </button>
        ))}
      </div>

      {error === null ? null : (
        <p role="alert" data-testid="landing-mini-error" className="text-xs font-semibold text-error">
          {error}
        </p>
      )}

      <MemoryPipeline
        data={labView.pipeline}
        focus={labView.focus}
        request={labView.request}
        layout="stack"
      />

      <EventExplanation event={labView.presentation} showFacts />

      <p className="text-xs leading-relaxed text-muted">
        The machine keeps its state between runs: touch the same page twice and the TLB hits;
        touch the absent page and translation stops with a real page fault.
      </p>
    </div>
  );
}
