/**
 * The Learn guided tour, in a real browser.
 *
 * This spec opts INTO a first-visit context (empty storage) because the tour
 * auto-opens only once - the default suite state, set in `playwright.config.ts`,
 * is a returning visitor who has already seen it. Every assertion here is about
 * the real overlay wired into the real screen: it opens itself on a first visit,
 * walks its five beats, remembers being finished or skipped, and can always be
 * reopened by the "Take the tour" button.
 *
 * The five beats are the ones in `lib/tourSteps.ts` (`LEARN_TOUR`), and the last
 * beat anchors to that same launch button - so the tour points at its own
 * replay control, which is the honest way to promise "you can come back here".
 */

import { expect, test } from "@playwright/test";

// A clean, first-visit context: no persisted tours, so the auto-start fires.
test.use({ storageState: { cookies: [], origins: [] } });

/** The five beats, by title - asserted in order so progression is real. */
const BEATS = [
  "One step explains one event",
  "The ring marks the stage",
  "Move through the lesson",
  "Check yourself",
  "Reopen this tour any time",
] as const;

test("the Learn tour opens itself on a first visit and shows its first beat", async ({ page }) => {
  await page.goto("/?mode=learn");

  // The card is on screen (the overlay's outer div is a zero-height fixed-position
  // wrapper, so the card is the element that actually has a box to assert on).
  const card = page.getByTestId("tour-learn-card");
  await expect(card).toBeVisible();

  // ...on the first beat, with the guided-tour counter reading 1 of 5.
  await expect(card).toContainText(BEATS[0]);
  await expect(card).toContainText("1 / 5");

  // The first beat is anchored to the lesson panel, not floating centered.
  await expect(page.getByTestId("panel-lesson")).toBeVisible();
});

test("Next walks every beat and Finish persists so a reload does not reopen", async ({ page }) => {
  await page.goto("/?mode=learn");

  const card = page.getByTestId("tour-learn-card");

  // Walk 2..5, asserting each beat's title so progression is genuine.
  for (let step = 1; step < BEATS.length; step += 1) {
    await page.getByTestId("tour-learn-next").click();
    await expect(card).toContainText(BEATS[step]);
    await expect(card).toContainText(`${step + 1} / ${BEATS.length}`);
  }

  // On the last beat the primary action becomes Finish.
  await expect(page.getByTestId("tour-learn-finish")).toBeVisible();
  await page.getByTestId("tour-learn-finish").click();

  // The card is gone, and it stayed gone across a reload: "seen" persisted.
  await expect(card).toBeHidden();
  await page.reload();
  await expect(card).toBeHidden();
});

test("Back moves back but cannot leave the tour; Skip dismisses and persists", async ({ page }) => {
  await page.goto("/?mode=learn");

  const card = page.getByTestId("tour-learn-card");

  // Advance to beat 2, then go back to beat 1.
  await page.getByTestId("tour-learn-next").click();
  await expect(card).toContainText("2 / 5");
  await card.getByRole("button", { name: "Back" }).click();
  await expect(card).toContainText("1 / 5");

  // Back is now disabled - the tour cannot be walked out of at the top.
  await expect(card.getByRole("button", { name: "Back" })).toBeDisabled();

  // Skip dismisses immediately and is remembered, just like Finish.
  await page.getByTestId("tour-learn-skip").click();
  await expect(card).toBeHidden();

  await page.reload();
  await expect(card).toBeHidden();
});

test("Escape dismisses the tour without blocking the page", async ({ page }) => {
  await page.goto("/?mode=learn");
  const card = page.getByTestId("tour-learn-card");
  await expect(card).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  // The lesson is still fully usable after dismissal - the overlay never locked it.
  await expect(page.getByTestId("learn-step-counter")).toContainText("Step 1 / 12");
});

test("the tour can always be reopened, even after it was seen", async ({ page }) => {
  // First visit: Skip it so it is firmly "seen" (Skip persists like Finish).
  await page.goto("/?mode=learn");
  await page.getByTestId("tour-learn-skip").click();
  const card = page.getByTestId("tour-learn-card");
  await expect(card).toBeHidden();

  // The launch button lives in the module index header.
  const launch = page.getByTestId("learn-tour-launch");
  await expect(launch).toBeVisible();

  // Reopen: it starts again at beat 1.
  await launch.click();
  await expect(card).toBeVisible();
  await expect(card).toContainText(BEATS[0]);
  await expect(card).toContainText("1 / 5");

  // And it can be reopened a second time, proving reopen is not one-shot.
  await page.getByTestId("tour-learn-skip").click();
  await launch.click();
  await expect(card).toContainText(BEATS[0]);
});

  test.use({ viewport: { width: 360, height: 844 } });

  test("scrolls the active target into view when moving between steps", async ({ page }) => {
    await page.goto("/?mode=learn", { waitUntil: "networkidle" });

    const card = page.getByTestId("tour-learn-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(BEATS[0]);

    // Record initial scroll position.
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Navigate through beats 2, 3, 4 (panel-chain, learn-step-counter, learn-question)
    // which may sit below the initial viewport at 360px.
    await page.getByTestId("tour-learn-next").click();
    await expect(card).toContainText(BEATS[1]);
    await page.getByTestId("tour-learn-next").click();
    await expect(card).toContainText(BEATS[2]);

    // Wait for the auto-scroll to settle.
    await page.waitForTimeout(600);

    const midScrollY = await page.evaluate(() => window.scrollY);
    expect(midScrollY).toBeGreaterThanOrEqual(initialScrollY);

    // The active target (learn-step-counter) should be within the viewport.
    const targetBox = await page.getByTestId("learn-step-counter").boundingBox();
    expect(targetBox).not.toBeNull();
    expect(targetBox!.top).toBeGreaterThanOrEqual(0);
    expect(targetBox!.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);

    // Navigate to beat 4 (learn-question), which may be further down.
    await page.getByTestId("tour-learn-next").click();
    await expect(card).toContainText(BEATS[3]);
    await page.waitForTimeout(600);

    // Navigate back to beat 1 (panel-lesson), which is above.
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(card).toContainText(BEATS[0]);
    await page.waitForTimeout(600);

    const backScrollY = await page.evaluate(() => window.scrollY);
    expect(backScrollY).toBeLessThan(midScrollY);

    // The target element should be within the visual viewport after scrolling up.
    const lessonBox = await page.getByTestId("panel-lesson").boundingBox();
    expect(lessonBox).not.toBeNull();
    expect(lessonBox!.top).toBeGreaterThanOrEqual(0);
    expect(lessonBox!.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);

    // The highlight ring should be visible around the active target.
    const ringBox = await page.locator(".fixed.z-\\[69\\]").first().boundingBox();
    expect(ringBox).not.toBeNull();

    // The tour card and its buttons must stay inside the viewport.
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.x).toBeGreaterThanOrEqual(0);
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const nextBox = await page.getByTestId("tour-learn-next").boundingBox();
    expect(nextBox).not.toBeNull();
    expect(nextBox!.x + nextBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);

    // Dismiss: overlay, ring, and card all go away; page still fits.
    await page.getByTestId("tour-learn-skip").click();
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
