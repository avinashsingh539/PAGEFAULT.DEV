/**
 * Compare Mode, in a real browser.
 *
 * The regression the project cares about most: the documented textbook run - FIFO 15
 * faults, LRU 12, Optimal 9 - is exactly what the screen shows after RUN. The numbers
 * come from `docs/reference-values.md`, never from anything stored beside the engine.
 */

import { expect, test } from "@playwright/test";

/** The reference string Compare Mode's default run walks, page by page. */
const CLASSIC_TEXT = "7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1";

test.beforeEach(async ({ page }) => {
  await page.goto("/?mode=compare");
});

test("opens the Compare screen and runs the textbook string to the documented counts", async ({
  page,
}) => {
  await expect(page.getByTestId("mode-compare")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("run-compare").click();

  await expect(page.getByTestId("column-FIFO")).toBeVisible();
  await expect(page.getByTestId("column-LRU")).toBeVisible();
  await expect(page.getByTestId("column-OPTIMAL")).toBeVisible();

  await expect(page.getByTestId("faults-FIFO")).toContainText("15");
  await expect(page.getByTestId("faults-LRU")).toContainText("12");
  await expect(page.getByTestId("faults-OPTIMAL")).toContainText("9");
});

test("shows all three algorithms walking the SAME string, access by access", async ({ page }) => {
  await page.getByTestId("run-compare").click();

  const pages = CLASSIC_TEXT.split(" ");
  await expect(page.getByTestId("access-row-0")).toBeVisible();
  await expect(page.getByTestId("access-page-0")).toContainText(pages[0] ?? "");
  await expect(page.getByTestId(`access-page-${pages.length - 1}`)).toContainText(
    pages[pages.length - 1] ?? "",
  );
});

test("switching screens keeps the inputs, and the counts still reproduce", async ({ page }) => {
  await page.getByTestId("run-compare").click();
  await expect(page.getByTestId("faults-FIFO")).toContainText("15");

  // Moving to Learn and back: each screen's shareable configuration travels in the URL,
  // so the exercise comes back exactly as it was left.
  await page.getByTestId("mode-learn").click();
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 1 / 12");
  await page.getByTestId("mode-compare").click();

  await expect(page.locator("#referenceString")).toHaveValue(CLASSIC_TEXT);
  await expect(page.locator("#compareFrames")).toHaveValue("3");

  // One RUN later, the documented counts are exactly the same.
  await page.getByTestId("run-compare").click();
  await expect(page.getByTestId("faults-FIFO")).toContainText("15");
  await expect(page.getByTestId("faults-LRU")).toContainText("12");
  await expect(page.getByTestId("faults-OPTIMAL")).toContainText("9");
});
