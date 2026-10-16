/**
 * Docs: a compact learning reference, not an article site.
 *
 * The event reference is GENERATED from `lib/docsEvents.ts` (real engine event
 * objects passed through the same `presentEvent()` the Lab uses), so this page
 * and the Lab can never disagree about what a TLB miss is.
 *
 * The "does not model" section is deliberate honesty: a learner must be able to
 * tell what the simulation actually does from what it merely describes.
 */

import type { JSX } from "react";

import { Icon } from "../design/Icon";
import { Card, Container, Section, SectionHeading } from "../design/primitives";
import { DOCS_EVENT_REFERENCE } from "../lib/docsEvents";
import { hrefForRoute } from "../lib/routes";

/** The journey, in the product's own vocabulary. */
const JOURNEY: readonly { stage: string; title: string; body: string }[] = [
  {
    stage: "1",
    title: "Virtual address",
    body: "A program never addresses RAM directly. The CPU asks for a virtual address - 0x1345 in our examples - and the memory system decides where that really lives.",
  },
  {
    stage: "2",
    title: "Page number + offset",
    body: "The MMU splits the address by page size: 0x1345 with 4096-byte pages is page 1, offset 837. The offset never changes; only the page part gets translated.",
  },
  {
    stage: "3",
    title: "TLB lookup",
    body: "The TLB is a small cache of recent page-to-frame translations. A HIT answers immediately; a MISS is NOT a fault - the machine simply continues to the page table.",
  },
  {
    stage: "4",
    title: "Page table",
    body: "The authoritative map from virtual page to physical frame. A present entry names the frame; an absent one triggers a page fault.",
  },
  {
    stage: "5",
    title: "Frame + offset = physical address",
    body: "Frame 7 with offset 837 becomes physical address 0x7345. RAM is organized in frames, and this is the address the memory bus finally uses.",
  },
  {
    stage: "6",
    title: "RAM access",
    body: "Only after a successful translation does the engine report a RAM access - with the exact physical address, frame and offset it used.",
  },
];

export default function DocsScreen(): JSX.Element {
  return (
    <div data-testid="docs-screen">
      <Section>
        <Container>
          <header className="max-w-3xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Docs</h1>
            <p className="mt-3 text-base leading-relaxed text-muted">
              The vocabulary behind the lab: what each stage of the memory journey does,
              which events the machine emits, and what this simulation deliberately does
              not model.
            </p>
          </header>

          {/* ---- The journey ------------------------------------------------ */}
          <SectionHeading title="The journey of one memory access" className="mt-12" />
          <ol className="mt-4 grid gap-3 lg:grid-cols-2">
            {JOURNEY.map((step) => (
              <li
                key={step.stage}
                className="flex gap-3 rounded-card border border-line bg-surface p-4 shadow-raised"
              >
                <span
                  aria-hidden="true"
                  className="num grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong"
                >
                  {step.stage}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-ink">{step.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* ---- Concepts ---------------------------------------------------- */}
          <SectionHeading title="Core concepts" className="mt-12" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">Virtual pages &amp; offsets</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Virtual memory is chopped into fixed-size pages; an address is a{" "}
                <em className="not-italic">(page, offset)</em> pair. Two addresses in
                the same page share one translation - that is why paging translates
                pages, not bytes.
              </p>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">The page table</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                One entry per virtual page: present or not, and which physical frame.
                In this lab the table is small and visible, so you can watch page 1
                become frame 7.
              </p>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">The TLB</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                A cache in front of the page table. Hits skip the table entirely;
                misses are ordinary lookups, not errors. Caching a translation is what
                the <code className="num">TLB_FILL</code> event records.
              </p>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">Page faults</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                When the requested page is not in RAM, the engine reports{" "}
                <code className="num">PAGE_FAULT</code> and stops: no frame, no
                physical address, no RAM access. This lab detects faults; it does not
                handle them.
              </p>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">Frames &amp; physical RAM</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Physical memory is a fixed number of frames. How many frames a machine
                has is part of the Lab configuration - change it and every later
                access behaves differently.
              </p>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">Page replacement</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                When RAM fills up, the OS must choose a victim. FIFO evicts the oldest
                arrival, LRU the least recently used, Optimal the page used farthest
                in the future. Compare all three on one reference string.
              </p>
            </Card>
          </div>

          {/* ---- Event reference (generated) --------------------------------- */}
          <SectionHeading title="Event reference" className="mt-12" />
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Every event the machine can emit, with the exact wording used in the lab
            itself. These descriptions are generated from the same presentation layer
            the UI renders, so they cannot drift apart.
          </p>
          <ul className="mt-4 flex flex-col gap-2" data-testid="docs-event-reference">
            {DOCS_EVENT_REFERENCE.map((row) => (
              <li
                key={row.tag}
                className="rounded-card border border-line bg-surface p-4 shadow-raised"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <code className="num rounded-chip bg-surface-soft px-2 py-0.5 text-xs font-bold text-primary-strong">
                    {row.tag}
                  </code>
                  <span className="text-sm font-bold text-ink">{row.presented.title}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {row.presented.what}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  <span className="font-semibold text-ink">Next: </span>
                  {row.presented.next}
                </p>
              </li>
            ))}
          </ul>



          {/* ---- What is NOT modeled ------------------------------------------ */}
          <SectionHeading title="What this lab does not model" className="mt-12" />
          <div data-testid="docs-not-modeled">
            <Card className="mt-4 border-fault/40 bg-fault-soft p-5">
              <div className="flex items-start gap-3">
                <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-fault" />
                <div className="min-w-0 space-y-2 text-sm leading-relaxed text-ink">
                  <p>
                    <strong className="font-bold">Fault handling.</strong> A page fault
                    here stops the access. Real kernels load the page from disk, choose
                    a victim, and retry; that machinery is a later phase of this
                    project, not simulated today.
                  </p>
                  <p>
                    <strong className="font-bold">Disk, swap and the kernel.</strong>{" "}
                    There is no backing store and no privilege levels - only one
                    machine, executing memory accesses.
                  </p>
                  <p>
                    <strong className="font-bold">Beyond virtual memory.</strong> CPU
                    scheduling, networking and other OS topics are outside this
                    product&apos;s scope on purpose.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* ---- How to use --------------------------------------------------- */}
          <SectionHeading title="Where to try this" className="mt-12" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">Learn</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                A twelve-step guided lesson: one address, from the CPU to RAM,
                explained event by event.
              </p>
              <a
                href={hrefForRoute("learn")}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong hover:underline"
              >
                Start the lesson
                <Icon name="arrowRight" size={15} />
              </a>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">Memory Lab</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Send any address through the machine yourself: change page size, TLB
                size and frames, and watch every event.
              </p>
              <a
                href={hrefForRoute("lab")}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong hover:underline"
              >
                Open the Lab
                <Icon name="arrowRight" size={15} />
              </a>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-bold text-ink">Compare</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Run one reference string through FIFO, LRU and Optimal side by side
                and count the faults.
              </p>
              <a
                href={hrefForRoute("compare")}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong hover:underline"
              >
                Compare algorithms
                <Icon name="arrowRight" size={15} />
              </a>
            </Card>
          </div>
        </Container>
      </Section>
    </div>
  );
}
