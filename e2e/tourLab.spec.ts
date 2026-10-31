/**
 * The Lab guided tour, in a real browser.
 *
 * Same shape as `tourLearn.spec.ts`: this spec opts into a first-visit context so
 * the auto-start fires, then drives the REAL six-beat `LAB_TOUR` against the real
 * Lab screen. The beats walk the workflow a newcomer must learn - send an address,
 * use a preset, read the pipeline, read the outcome, replay history, change the
 * machine - and the last beat is anchored to the Settings Apply button.
 *
 * The narrow-viewport test is here because the Lab is the screen the Task 4
 * overflow fix protects, and a tour card is the newest thing that could
 * reintroduce a horizontal scrollbar on a phone.
 */

import { expect, test } from "@playwright/test";

// A clean, first-visit context: no persisted tours, so the auto-start fires.
test.use({ storageState: { cookies: [], origins: [] } });

/** The six beats, by title - asserted in order so progression is real. */
const BEATS = [
  "Send a real address",
  "Or start from a preset",
  "Watch the stages",
  "Read what happened",
  "Replay any moment",
  "Change the machine",
] as const;

test("the Lab tour opens itself on a first visit and walks every beat", async ({ page }) => {
  await page.goto("/?mode=experiment");

  // The card is the visible element (the overlay's outer div is a zero-height
  // fixed-position wrapper), so every open/close assertion targets the card.
  const card = page.getByTestId("tour-lab-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText(BEATS[0]);
  await expect(card).toContainText("1 / 6");

  for (let step = 1; step < BEATS.length; step += 1) {
    await page.getByTestId("tour-lab-next").click();
    await expect(card).toContainText(BEATS[step]);
    await expect(card).toContainText(`${step + 1} / ${BEATS.length}`);
  }

  // Finish, and it stays gone across a reload.
  await expect(page.getByTestId("tour-lab-finish")).toBeVisible();
  await page.getByTestId("tour-lab-finish").click();
  await expect(card).toBeHidden();

  await page.reload();
  await expect(card).toBeHidden();
});

test("the Lab tour never blocks the real access controls", async ({ page }) => {
  await page.goto("/?mode=experiment");
  const card = page.getByTestId("tour-lab-card");
  await expect(card).toBeVisible();

  // The tour is an overlay, not a modal: the ACCESS button is still clickable
  // underneath it, and running a real access still drives the real engine.
  await page.getByRole("button", { name: "ACCESS" }).click();
  await expect(page.getByTestId("access-narration")).toBeVisible();

  // Dismiss, and the Lab is fully usable afterwards.
  await page.getByTestId("tour-lab-skip").click();
  await expect(card).toBeHidden();
  await expect(page.getByTestId("access-narration")).toBeVisible();
});

test("the Lab tour can always be reopened from its launch button", async ({ page }) => {
  await page.goto("/?mode=experiment");

  // Skip it first so it is firmly "seen" (Skip persists like Finish).
  await page.getByTestId("tour-lab-skip").click();
  const card = page.getByTestId("tour-lab-card");
  await expect(card).toBeHidden();

  const launch = page.getByTestId("lab-tour-launch");
  await expect(launch).toBeVisible();

  await launch.click();
  await expect(card).toBeVisible();
  await expect(card).toContainText(BEATS[0]);
  await expect(card).toContainText("1 / 6");
});

test.describe("narrow viewport (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the open Lab tour does not overflow the page horizontally", async ({ page }) => {
    await page.goto("/?mode=experiment");
    const card = page.getByTestId("tour-lab-card");
    await expect(card).toBeVisible();

    // The tour card is a bottom sheet on a phone; it must not create a scrollbar.
    const measure = () =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

    const open = await measure();
    expect(open.scrollWidth).toBeLessThanOrEqual(open.innerWidth);

    // The card's own controls stay reachable and inside the viewport.
    const next = page.getByTestId("tour-lab-next");
    await expect(next).toBeVisible();
    const box = await next.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(open.innerWidth);

    // After dismissing, the page still fits.
    await page.getByTestId("tour-lab-skip").click();
    const closed = await measure();
    expect(closed.scrollWidth).toBeLessThanOrEqual(closed.innerWidth);
  });
});

test.describe("viewport awareness (360px)", () => {
  test.use({ viewport: { width: 360, height: 844 } });

  test("scrolls the active target into view when moving between steps", async ({ page }) => {
    await page.goto("/?mode=experiment", { waitUntil: "networkidle" });

    const card = page.getByTestId("tour-lab-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(BEATS[0]);

    // Record initial scroll position.
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Navigate to beat 3 (memory-pipeline), which sits below the initial
    // viewport at 360px. The page should scroll down to reveal it.
    await page.getByTestId("tour-lab-next").click();
    await expect(card).toContainText(BEATS[1]);
    await page.getByTestId("tour-lab-next").click();
    await expect(card).toContainText(BEATS[2]);

    // Wait for the auto-scroll to settle.
    await page.waitForTimeout(600);

    // The page should have scrolled down from its initial position.
    const midScrollY = await page.evaluate(() => window.scrollY);
    expect(midScrollY).toBeGreaterThanOrEqual(initialScrollY);

    // The target element should be within the visual viewport.
    const pipelineBox = await page.getByTestId("memory-pipeline").boundingBox();
    expect(pipelineBox).not.toBeNull();
    expect(pipelineBox!.top).toBeGreaterThanOrEqual(0);
    expect(pipelineBox!.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);

    // Navigate back to beat 1 (access-submit), which is above the current
    // scroll position. The page should scroll upward.
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(card).toContainText(BEATS[0]);
    await page.waitForTimeout(600);

    const backScrollY = await page.evaluate(() => window.scrollY);
    expect(backScrollY).toBeLessThan(midScrollY);

    // The target element should be within the visual viewport after scrolling up.
    const accessBox = await page.getByTestId("access-submit").boundingBox();
    expect(accessBox).not.toBeNull();
    expect(accessBox!.top).toBeGreaterThanOrEqual(0);
    expect(accessBox!.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);

    // The spotlight overlay strips should be present around the active target.
    const overlayCount = await page.locator(".fixed.z-\\[68\\]").count();
    expect(overlayCount).toBeGreaterThanOrEqual(1);

    // The highlight ring should be visible around the active target.
    const ringBox = await page.locator(".fixed.z-\\[69\\]").first().boundingBox();
    expect(ringBox).not.toBeNull();

    // The tour card and its buttons must stay inside the viewport.
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.x).toBeGreaterThanOrEqual(0);
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const nextBox = await page.getByTestId("tour-lab-next").boundingBox();
    expect(nextBox).not.toBeNull();
    expect(nextBox!.x + nextBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);

    // Dismiss: overlay, ring, and card all go away; page still fits.
    await page.getByTestId("tour-lab-skip").click();
    await expect(card).toBeHidden();
    await expect(page.locator(".fixed.z-\\[69\\]").first()).toBeHidden();

    const measure = () =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
    const after = await measure();
    expect(after.scrollWidth).toBeLessThanOrEqual(after.innerWidth);
  });
});
