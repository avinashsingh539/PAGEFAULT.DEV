import type { JSX } from "react";

import { Icon } from "../design/Icon";
import { Card, Container, Section, SectionHeading } from "../design/primitives";
import { MemoryPipeline } from "../design/viz/MemoryPipeline";
import { AddressSplitDiagram } from "../design/viz/AddressSplitDiagram";
import { PageTableDiagram } from "../design/viz/PageTableDiagram";
import { PhysicalMemoryDiagram } from "../design/viz/PhysicalMemoryDiagram";
import { RamAccessDiagram } from "../design/viz/RamAccessDiagram";
import { TlbDiagram } from "../design/viz/TlbDiagram";
import { VirtualAddressDiagram } from "../design/viz/VirtualAddressDiagram";
import { getConcept } from "../lib/conceptData";
import { buildExperimentMachine } from "../lib/experiment";
import { DEFAULT_EXPERIMENT_CONFIG } from "../lib/experiment";
import { buildLabView } from "../lib/labView";

const CONCEPT_DIAGRAMS: Readonly<Record<string, () => JSX.Element>> = {
  "virtual-address": VirtualAddressDiagram,
  "address-translation": AddressSplitDiagram,
  "tlb": TlbDiagram,
  "page-table": PageTableDiagram,
  "physical-memory": PhysicalMemoryDiagram,
  "ram-access": RamAccessDiagram,
};

function buildPipeline() {
  const built = buildExperimentMachine(DEFAULT_EXPERIMENT_CONFIG);
  if (!built.ok) return null;
  const machine = built.value;
  const view = { record: null, pageNumber: 1, offset: 837, tlbEnabled: true, tlbEntries: [], tlbCapacity: 4, tlbEntriesSearched: 4, frameNumber: 7, physicalAddress: 0x7345, stage: "cpu", event: null, hits: 0, misses: 0, faults: 0, totalEvents: 0, records: 0 } as any;
  const labView = buildLabView(machine, [], view);
  return labView.pipeline;
}

export default function ConceptScreen(): JSX.Element {
  const segments = window.location.pathname.split("/").filter((s) => s !== "");
  const slug = segments.length >= 2 ? segments[1] : "";
  const concept = getConcept(slug ?? "");

  if (!concept) {
    return (
      <div data-testid="concept-not-found" className="flex min-h-dvh items-center justify-center">
        <Container>
          <p className="text-muted">Concept not found. <a href="/docs" className="text-primary-strong underline">Back to Docs</a></p>
        </Container>
      </div>
    );
  }

  const pipeline = buildPipeline();
  const ConceptDiagram = CONCEPT_DIAGRAMS[slug as keyof typeof CONCEPT_DIAGRAMS];

  return (
    <div data-testid="concept-screen">
      <Section>
        <Container>
          <a href="/docs" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong hover:underline">
            <Icon name="arrowRight" size={15} className="rotate-180" />
            Back to Docs
          </a>
          <header className="mt-6 max-w-3xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{concept.title}</h1>
            <p className="mt-2 text-base leading-relaxed text-muted">{concept.subtitle}</p>
          </header>
          <SectionHeading title="What it is" className="mt-10" />
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink">{concept.introduction}</p>
          <SectionHeading title="Why it matters" className="mt-8" />
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink">{concept.whyItMatters}</p>
          <SectionHeading title="Where it fits" className="mt-8" />
          <div className="mt-4 rounded-panel border border-line bg-surface p-4 shadow-raised sm:p-5">
            <p className="text-sm font-semibold text-muted mb-2">Concept diagram</p>
            {ConceptDiagram ? <ConceptDiagram /> : <p className="text-muted">Diagram unavailable.</p>}
            <SectionHeading title="Pipeline overview" className="mt-8" />
            {pipeline ? (
              <MemoryPipeline data={pipeline} layout="stack" focus={concept.focusNode as any} />
            ) : (
              <p className="text-muted">Pipeline unavailable.</p>
            )}
          </div>
          <SectionHeading title="How it works" className="mt-8" />
          <ol className="mt-3 max-w-3xl list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink">
            {concept.detailedWorking.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <Card className="mt-4 p-4">
            <p className="text-sm font-bold text-ink">Example</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{concept.example}</p>
          </Card>
          <SectionHeading title="Key terms" className="mt-8" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {concept.glossary.map((entry) => (
              <Card key={entry.term} className="p-3">
                <p className="text-sm font-bold text-ink">{entry.term}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{entry.definition}</p>
              </Card>
            ))}
          </div>
          <SectionHeading title="Observe it in PAGEFAULT.DEV" className="mt-8" />
          <ul className="mt-3 max-w-3xl list-disc space-y-1.5 pl-5 text-base leading-relaxed text-ink">
            {concept.howToObserve.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
          <a href={concept.labLink.href} className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-control bg-primary-strong px-4 py-2 text-sm font-bold text-surface transition-colors hover:bg-primary">
            {concept.labLink.label}
            <Icon name="arrowRight" size={15} />
          </a>
          <SectionHeading title="Common misconceptions" className="mt-8" />
          <div className="mt-3 space-y-3">
            {concept.misconceptions.map((m, i) => (
              <Card key={i} className="border-fault/40 bg-fault-soft p-4">
                <p className="text-sm font-bold text-fault">x {m.wrong}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{m.correction}</p>
              </Card>
            ))}
          </div>
          <SectionHeading title="Related concepts" className="mt-8" />
          <div className="mt-3 flex flex-wrap gap-2">
            {concept.related.map((link) => (
              <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-primary-strong transition-colors hover:border-primary/60 hover:bg-surface-soft">
                {link.label}
                <Icon name="arrowRight" size={13} />
              </a>
            ))}
          </div>
          <a href="/docs" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong hover:underline">
            <Icon name="arrowRight" size={15} className="rotate-180" />
            Back to Docs
          </a>
        </Container>
      </Section>
    </div>
  );
}