/**
 * Learn Mode, in a real browser.
 *
 * The learner's journey the brief demands: OPEN LEARN MODE, answer nothing yet or
 * answer a question, move NEXT through the translation, watch the first access
 * TLB MISS and walk the page table, see the second access TLB HIT with the page table
 * skipped, then meet the page fault - and watch translation stop there instead of
 * producing a frame, a physical address or a RAM access.
 *
 * Every expected engine value is the documented lab value (page 1 lives in frame 7, so
 * x at 0x1345 resolves to 0x7345) - never a number the UI computed for itself. That is
 * what these tests prove: the screen shows engine facts, the lesson engine-pure.
 */

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?mode=learn");
});

test("opens the Learn screen by default and shows step 1 of 12", async ({ page }) => {
  await expect(page.getByTestId("mode-learn")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 1 / 12");
  await expect(page.getByRole("heading", { name: /The program starts/ })).toBeVisible();
  // Nothing has happened yet, so the fact panel shows the honest nothing.
  await expect(page.getByTestId("fact-page")).toContainText("—");
  await expect(page.getByTestId("fact-physical")).toContainText("—");
});

test("NEXT walks the translation: virtual address, split, TLB MISS, page table, fill, RAM", async ({
  page,
}) => {
  const next = page.getByTestId("learn-next");

  await next.click();
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 2 / 12");

  await next.click(); // virtual address: the access runs here
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 3 / 12");
  await expect(page.getByTestId("fact-page")).toContainText("—"); // the split has not happened yet

  await next.click(); // address split
  await expect(page.getByTestId("fact-page")).toContainText("1");
  await expect(page.getByTestId("fact-offset")).toContainText("837");

  await next.click(); // TLB lookup: the miss
  await expect(page.getByTestId("stage-tlb")).toHaveAttribute("data-focus", "true");
  await expect(page.getByTestId("learn-reached-value")).toContainText("the TLB");

  await next.click(); // page table
  await expect(page.getByTestId("fact-frame")).toContainText("7");

  await next.click(); // TLB fill
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 7 / 12");

  await next.click(); // physical address
  await expect(page.getByTestId("fact-physical")).toContainText("0x7345");
  // Honest projection: the cursor is on PHYSICAL_ADDRESS_GENERATED, so the RAM access is
  // still one engine event ahead of it.
  await expect(page.getByTestId("learn-reached-value")).toContainText("a frame");
});

test("the second access hits the cached translation and skips the page table", async ({ page }) => {
  for (let press = 0; press < 8; press += 1) {
    await page.getByTestId("learn-next").click();
  }

  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 9 / 12");
  await expect(page.getByTestId("stage-tlb")).toHaveAttribute("data-focus", "true");
  await expect(page.getByTestId("learn-reached-value")).toContainText("the TLB");

  // The engine's own comparison for what the cache saved is shown, computed from real runs.
  await expect(page.getByTestId("learn-comparison")).toBeVisible();
  await expect(page.getByTestId("comparison-with-page-table-walks")).toContainText("1");
  await expect(page.getByTestId("comparison-without-page-table-walks")).toContainText("2");

  await page.getByTestId("learn-next").click(); // the proof step
  await expect(page.getByTestId("learn-evidence")).toBeVisible();
});

test("the page fault stops translation: no frame, no physical address, no RAM access", async ({
  page,
}) => {
  for (let press = 0; press < 11; press += 1) {
    await page.getByTestId("learn-next").click();
  }

  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 12 / 12");
  await expect(page.getByTestId("stage-fault")).toHaveAttribute("data-focus", "true");
  await expect(page.getByTestId("stage-fault")).toHaveAttribute("data-status", "fault");
  await expect(page.getByTestId("fact-frame")).toContainText("—");
  await expect(page.getByTestId("fact-physical")).toContainText("—");
  await expect(page.getByRole("heading", { name: /Translation stops here/ })).toBeVisible();
});

test("the learner answers a question and the explanation follows", async ({ page }) => {
  await page.getByTestId("learn-next").click();
  await page.getByTestId("learn-next").click(); // step 3 has the virtual-address question

  await expect(page.getByTestId("learn-question")).toBeVisible();
  await page.getByTestId("learn-answer-1").click();
  await expect(page.getByTestId("learn-answer-explanation")).toContainText("Correct.");
});

test("keyboard controls work and stay out of the way inside text fields", async ({ page }) => {
  const counter = page.getByTestId("learn-step-counter");
  await expect(counter).toContainText("Step 1 / 12");

  await page.keyboard.press("ArrowRight");
  await expect(counter).toContainText("Step 2 / 12");

  await page.keyboard.press("ArrowLeft");
  await expect(counter).toContainText("Step 1 / 12");

  await page.keyboard.press("r");
  await expect(counter).toContainText("Step 1 / 12");

  // While the learner is typing a step number, the arrows must edit the field, not move.
  const input = page.getByTestId("learn-step-input");
  await input.click();
  await input.fill("4");
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toContainText("Step 1 / 12");
  await expect(input).toHaveValue("4");
});

test("the focused component is lit and the rest is dimmed", async ({ page }) => {
  for (let press = 0; press < 4; press += 1) {
    await page.getByTestId("learn-next").click();
  }

  // Step 5 is about the TLB: its panel is lit, the RAM panel is pushed back.
  await expect(page.getByTestId("panel-tlb")).toHaveAttribute("data-dimmed", "false");
  await expect(page.getByTestId("panel-ram")).toHaveAttribute("data-dimmed", "true");
  await expect(page.getByTestId("panel-chain")).toHaveAttribute("data-dimmed", "false");
  await expect(page.getByTestId("pipeline-connector")).toContainText("continues to Page Table");
});

test("a shared link opens the lesson at its own step", async ({ page }) => {
  await page.goto("/?mode=learn&step=4");
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 5 / 12");

  // ...and the address bar follows the lesson as it moves.
  await page.getByTestId("learn-next").click();
  await expect(page).toHaveURL(/step=5/);
});

