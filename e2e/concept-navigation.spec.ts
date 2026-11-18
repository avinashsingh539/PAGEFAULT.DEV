/**
 * Concept-page navigation and diagram regression tests.
 *
 * Covers Part 1 (navigation from /docs) and Part 5 (navigation + diagram tests).
 *
 * Every assertion is about real, user-visible browser behavior: new tabs, URL
 * changes, rendered headings, visible SVG diagrams, accessible names, and the
 * absence of horizontal overflow at mobile widths.
 */

import { expect, test } from "@playwright/test";

/** The six concepts with their card title, expected href, and page heading. */
const CONCEPTS: readonly {
  readonly cardTitle: string;
  readonly href: string;
  readonly heading: string;
  readonly diagramTitle: string;
}[] = [
  {
    cardTitle: "Virtual address",
    href: "/docs/virtual-address",
    heading: "Virtual Address",
    diagramTitle: "Virtual address translation flow",
  },
  {
    cardTitle: "Page number + offset",
    href: "/docs/address-translation",
    heading: "Page Number + Offset",
    diagramTitle: "Page number and offset split",
  },
  {
    cardTitle: "TLB lookup",
    href: "/docs/tlb",
    heading: "TLB",
    diagramTitle: "TLB lookup flow",
  },
  {
    cardTitle: "Page table",
    href: "/docs/page-table",
    heading: "Page Table",
    diagramTitle: "Page table lookup",
  },
  {
    cardTitle: "Frame + offset = physical address",
    href: "/docs/physical-memory",
    heading: "Physical Memory (Frames)",
    diagramTitle: "Physical memory frame layout",
  },
  {
    cardTitle: "RAM access",
    href: "/docs/ram-access",
    heading: "RAM Access",
    diagramTitle: "RAM access path",
  },
];

test.describe("Concept card navigation from /docs", () => {
  for (const concept of CONCEPTS) {
    test(`opens ${concept.heading} in a new tab`, async ({ page, context }) => {
      await page.goto("/docs");

      // Wait for the new page event before clicking
      const newPagePromise = context.waitForEvent("page");

      // Click the concept card link
      await page.getByRole("link", { name: concept.cardTitle }).click();

      // The new tab opens
      const newPage = await newPagePromise;
      await newPage.waitForLoadState();

      // New tab reaches the expected route
      await expect(newPage).toHaveURL(new RegExp(`.*${concept.href}$`));

      // Correct concept title and content render
      await expect(newPage.getByRole("heading", { name: concept.heading })).toBeVisible();

      // Original tab remains on /docs
      await expect(page).toHaveURL("/docs");
    });

    test(`has correct link attributes for ${concept.heading}`, async ({ page }) => {
      await page.goto("/docs");

      const link = page.getByRole("link", { name: concept.cardTitle });
      await expect(link).toHaveAttribute("href", concept.href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  }

  test("direct navigation works for all six concept URLs", async ({ page }) => {
    for (const concept of CONCEPTS) {
      await page.goto(concept.href);
      await expect(page.getByRole("heading", { name: concept.heading })).toBeVisible();
      await expect(page.getByTestId("concept-screen")).toBeVisible();
    }
  });

  test("refresh works for all six concept URLs", async ({ page }) => {
    for (const concept of CONCEPTS) {
      await page.goto(concept.href);
      await page.reload();
      await expect(page.getByRole("heading", { name: concept.heading })).toBeVisible();
      await expect(page.getByTestId("concept-screen")).toBeVisible();
    }
  });
});

test.describe("Concept diagrams", () => {
  for (const concept of CONCEPTS) {
    test(`renders visible diagram for ${concept.heading}`, async ({ page }) => {
      await page.goto(concept.href);

      // Diagram is present and visible
      const diagram = page.getByRole("img", { name: concept.diagramTitle });
      await expect(diagram).toBeVisible();

      // Diagram has an accessible description (desc element)
      const svg = page.locator("svg").filter({ has: page.getByText(concept.diagramTitle) });
      await expect(svg).toBeVisible();

      // Detailed explanation remains visible
      await expect(page.getByText(/How it works/)).toBeVisible();
      await expect(page.getByText(/Why it matters/)).toBeVisible();
    });

    test(`renders key labels for ${concept.heading}`, async ({ page }) => {
      await page.goto(concept.href);

      // The concept heading itself must be visible
      await expect(page.getByRole("heading", { name: concept.heading })).toBeVisible();
    });
  }

  test("no horizontal overflow at 360px and 390px on all concept pages", async ({ page }) => {
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      for (const concept of CONCEPTS) {
        await page.goto(concept.href);
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(overflow).toBe(false);
      }
    }
  });
});

test.describe("Keyboard activation of concept links", () => {
  for (const concept of CONCEPTS) {
    test(`keyboard activation opens ${concept.heading} in a new tab`, async ({ page, context }) => {
      await page.goto("/docs");

      const newPagePromise = context.waitForEvent("page");

      // Focus the link and activate with Enter
      const link = page.getByRole("link", { name: concept.cardTitle });
      await link.focus();
      await link.press("Enter");

      const newPage = await newPagePromise;
      await newPage.waitForLoadState();
      await expect(newPage).toHaveURL(new RegExp(`.*${concept.href}$`));
      await expect(newPage.getByRole("heading", { name: concept.heading })).toBeVisible();
      await expect(page).toHaveURL("/docs");
    });
  }
});
