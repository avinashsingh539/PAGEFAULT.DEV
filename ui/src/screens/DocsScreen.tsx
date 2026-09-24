/**
 * Documentation index.
 *
 * NOTE: this is the Task 2 shell; Task 13 builds the three-pane layout, the
 * Concepts / Simulation Model / Event Reference / Glossary articles and the mobile
 * collapsible navigation. It exists now so the nav's fourth entry leads somewhere.
 *
 * The event descriptions here MUST be generated from `lib/eventPresentation.ts`
 * rather than retyped, or the docs and the Lab will slowly disagree about what a
 * TLB miss is.
 */

import type { JSX } from "react";

import { Container, Section } from "../design/primitives";

export default function DocsScreen(): JSX.Element {
  return (
    <Section>
      <Container>
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Docs</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          The concepts behind the simulation, the model it follows, every event it can emit,
          and the vocabulary used throughout.
        </p>
        <p className="mt-6 rounded-card border border-line bg-surface p-4 text-sm text-muted">
          The full articles are being written. In the meantime, the event reference is the
          single source of truth in{" "}
          <code className="num rounded-chip bg-surface-soft px-1.5 py-0.5 text-primary-strong">
            ui/src/lib/eventPresentation.ts
          </code>
          .
        </p>
      </Container>
    </Section>
  );
}
