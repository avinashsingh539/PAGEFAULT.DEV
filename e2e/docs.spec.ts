/**
 * The Docs page as a learning resource, in a real browser.
 *
 * The brief's bar for Docs was "not a placeholder": a compact reference with real
 * content, honest boundaries, and working links into the three experiences. This
 * spec pins exactly that - the journey is spelled out, the core concepts are
 * present, the event reference is generated (non-empty, and it names a real engine
 * event), the "does not model" honesty section exists, and the three outbound
 * links actually navigate rather than being decoration.
 *
 * It runs in the default returning-user storage state (no tours), which is fine:
 * Docs has no tour, and the assertions are about content and navigation only.
 */

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs");
});

test("renders real content: journey, concepts, generated event reference, honesty section", async ({
  page,
}) => {
  const screen = page.getByTestId("docs-screen");
  await expect(screen).toBeVisible();

  // The journey is told end to end, in the product's own vocabulary.
  await expect(screen).toContainText("Virtual address");
  await expect(screen).toContainText("Page number + offset");
  await expect(screen).toContainText("TLB lookup");
  await expect(screen).toContainText("RAM access");

  // Core concept cards are present, not an empty shell.
  for (const heading of [
    "Virtual pages & offsets",
    "The page table",
    "The TLB",
    "Page faults",
    "Frames & physical RAM",
    "Page replacement",
  ]) {
    await expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  }

  // The event reference is GENERATED and non-empty, and it names a real engine
  // event - the same event the Lab would emit, so the two cannot drift.
  const reference = page.getByTestId("docs-event-reference");
  await expect(reference).toBeVisible();
  await expect(reference.locator("li")).not.toHaveCount(0);
  await expect(reference).toContainText("TLB MISS");

  // The honesty section is there: a learner can tell modelled from described.
  await expect(page.getByTestId("docs-not-modeled")).toBeVisible();
});

test("the three outbound links navigate to the real experiences", async ({ page }) => {
  const screen = page.getByTestId("docs-screen");

  // Learn
  await screen.getByRole("link", { name: /Start the lesson/ }).click();
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 1 / 12");

  // Lab
  await page.goto("/docs");
  await page.getByTestId("docs-screen").getByRole("link", { name: /Open the Lab/ }).click();
  await expect(page.getByRole("button", { name: "ACCESS" })).toBeVisible();

  // Compare
  await page.goto("/docs");
  await page.getByTestId("docs-screen").getByRole("link", { name: /Compare algorithms/ }).click();
  await expect(page.getByTestId("mode-compare")).toHaveAttribute("aria-current", "page");
});
