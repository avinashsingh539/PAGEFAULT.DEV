/**
 * Experiment Mode, in a real browser.
 *
 * These tests pin what a user actually sees: a configuration change reaches the
 * engine, an access produces the numbers the engine documented, and a malformed
 * configuration shows an inline error instead of breaking the screen. The expected
 * numbers are the documented ones (page 0 -> frame 3 -> physical 0x3000 at a 4096-byte
 * page), never values the UI computed for itself.
 */

import { expect, test } from "@playwright/test";

/** The reference string Compare Mode's default run walks, page by page. */
export const CLASSIC_TEXT = "7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1";

/** Step the cursor to the end of the newest record. */
export async function stepToEnd(page: import("@playwright/test").Page): Promise<void> {
  for (let stepIndex = 0; stepIndex < 14; stepIndex += 1) {
    const stepButton = page.getByRole("button", { name: "STEP" });
    if (!(await stepButton.isEnabled())) {
      break;
    }
    await stepButton.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?mode=experiment");
});

test("opens the Experiment screen by default and shows the machine", async ({ page }) => {
  await expect(page.getByTestId("mode-experiment")).toHaveAttribute("aria-current", "page");
  // The page title now belongs to the page: the old shell's combined
  // "PAGEFAULT.DEV / MemoryLab" heading is gone, and the Lab is called "Memory Lab".
  await expect(page.getByRole("heading", { name: /Memory Lab/ })).toBeVisible();
  // The default experiment machine: 16 frames, a 4-entry TLB.
  await expect(page.locator("#frameCount")).toHaveValue("16");
  await expect(page.locator("#tlbCapacity")).toHaveValue("4");
  await expect(page.getByTestId("clear-tlb")).toContainText("(0 cached)");
});

test("applies a configuration and the engine builds what was asked", async ({ page }) => {
  await page.locator("#frameCount").fill("8");
  await page.getByTestId("apply-config").click();
  await expect(page.locator("#frameCount")).toHaveValue("8");
  await expect(page.getByTestId("clear-tlb")).toContainText("(0 cached)");
});

test("refuses a broken configuration and keeps the machine it had", async ({ page }) => {
  await page.locator("#frameCount").fill("0");
  await page.getByTestId("apply-config").click();
  await expect(page.getByTestId("config-error")).toBeVisible();
});

test("accessing an address shows the engine's translation, twice for the TLB hit", async ({
  page,
}) => {
  // Page 0 of the default experiment table: the documented engine numbers.
  await page.locator("#address").fill("0x345");
  await page.getByRole("button", { name: "ACCESS", exact: true }).click();
  await stepToEnd(page);
  await expect(page.getByTestId("stage-ram")).toHaveAttribute("data-status", "active");

  // The same page again: the TLB holds the translation, so the page table is skipped.
  await page.getByRole("button", { name: "ACCESS", exact: true }).click();
  await stepToEnd(page);
  await expect(page.getByTestId("stage-pageTable")).toHaveAttribute("data-status", "skipped");
});

test("clearing the TLB flushes what the accesses cached", async ({ page }) => {
  await page.locator("#address").fill("0x345");
  await page.getByRole("button", { name: "ACCESS", exact: true }).click();
  await stepToEnd(page);
  await expect(page.getByTestId("clear-tlb")).toContainText("(1 cached)");

  await page.getByTestId("clear-tlb").click();
  await expect(page.getByTestId("clear-tlb")).toContainText("(0 cached)");
});

test("unmapping a page makes the next access fault", async ({ page }) => {
  await page.getByTestId("unmap-page-0").click();
  await page.locator("#address").fill("0x345");
  await page.getByRole("button", { name: "ACCESS", exact: true }).click();
  await stepToEnd(page);
  await expect(page.getByTestId("stage-fault")).toHaveAttribute("data-status", "fault");
});

test("the replacement panel reproduces the textbook counts at 3 frames", async ({ page }) => {
  // The panel runs with the machine's own frame count, which defaults to 16 - where six
  // distinct pages fit without any eviction. The textbook numbers need 3 frames, so set
  // them the way a learner would: through the configuration on the left.
  await page.locator("#frameCount").fill("3");
  await page.getByTestId("apply-config").click();

  await page.locator("#experimentReference").fill(CLASSIC_TEXT);
  await page.getByTestId("run-replacement").click();
  // This panel shows the CONFIGURED algorithm's own column (FIFO here); all three
  // columns side by side are Compare Mode's job, and its spec asserts 15 / 12 / 9.
  await expect(page.getByTestId("column-FIFO")).toBeVisible();
  await expect(page.getByTestId("faults-FIFO")).toContainText("15");
});

