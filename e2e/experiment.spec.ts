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

const CLASSIC_TEXT = "7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1";

/** Step the cursor to the end of the newest record. */
async function stepToEnd(page: import("@playwright/test").Page): Promise<void> {
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
  await expect(page.getByRole("heading", { name: /MemoryLab/ })).toBeVisible();
  // The default experiment machine: 16 frames, a 4-entry TLB.
  await expect(page.locator("#frameCount")).toHaveValue("16");
  await expect(page.locator("#tlbCapacity")).toHaveValue("4");
  await expect(page.getByTestId("clear-tlb")).toContainText("(0 cached)");
});
