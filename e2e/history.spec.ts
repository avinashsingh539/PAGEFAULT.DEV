/**
 * Timeline scrubbing and replay, in a real browser.
 *
 * The Lab's history is read-only navigation over recorded events: Step/Back,
 * the clickable timeline, and the new Latest jump all move the SAME cursor
 * that `viewForCursor` paints from. These tests pin the Task 5 contract:
 *
 * - selecting a past step shows that step's event, not the latest;
 * - Latest returns to the newest event without appending a new access
 *   (the position readout before and after the round trip is identical);
 * - boundaries are safe (Back disabled at the very first event);
 * - arrow keys move the reading position, matching the transport buttons.
 */

import { expect, test } from "@playwright/test";

function parsePosition(text: string | null): { position: number; total: number } {
  const match = text === null ? null : text.match(/(\d+)\s*\/\s*(\d+)/);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(`no "position / total" in ${JSON.stringify(text)}`);
  }
  return { position: Number(match[1]), total: Number(match[2]) };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?mode=experiment");
});

async function twoAccesses(page: import("@playwright/test").Page): Promise<void> {
  const access = page.getByRole("button", { name: "ACCESS" });
  await access.click();
  await access.click();
}

test("selecting a past timeline stop shows that event, and Latest returns without appending", async ({
  page,
}) => {
  await twoAccesses(page);

  // Technical mode exposes the clickable timeline. Both mounted transports
  // flip the same switch with the same handler, so `.first()` is exact here
  // (not the fragile `.nth()` the suite otherwise avoids).
  await page.getByTestId("detail-technical").first().click();
  // The readout renders in both mounted transports from the same object;
  // the first is the in-page one, which is also the one staying put at 1280.
  const position = page.getByTestId("history-position").first();
  const explanation = page.getByTestId("event-explanation");
  await expect(position).toBeVisible();

  // ACCESS parks the cursor on the FIRST event of the newest record (it awaits
  // being stepped through), so the session is already behind latest.
  const afterAccess = parsePosition(await position.textContent());
  expect(afterAccess.total).toBeGreaterThan(afterAccess.position);
  await expect(page.getByTestId("latest-event").first()).toBeEnabled();

  // Latest takes us to the true end of the log: position === total.
  await page.getByTestId("latest-event").first().click();
  const atLatest = parsePosition(await position.textContent());
  expect(atLatest).toEqual({ position: afterAccess.total, total: afterAccess.total });
  const latestText = await explanation.textContent();

  // Back to the very first event: the readout, the explanation and the
  // timeline's own active row must all follow the cursor together.
  await page.getByTestId("timeline-stop-0-0").first().click();
  await expect(position).toContainText("1 /");
  const backAtStart = parsePosition(await position.textContent());
  expect(backAtStart).toEqual({ position: 1, total: atLatest.total });
  await expect(page.getByTestId("timeline-stop-0-0").first()).toHaveAttribute(
    "aria-current",
    "true",
  );
  const earlierText = await explanation.textContent();
  expect(earlierText).not.toBe(latestText);

  // Latest jumps straight back to the newest event - the same totals as
  // before, which proves the session did not gain a new access.
  await page.getByTestId("latest-event").first().click();
  const returned = parsePosition(await position.textContent());
  expect(returned).toEqual(atLatest);
  await expect(explanation).toHaveText(latestText ?? "");
});

test("boundaries are safe and arrow keys move the reading position", async ({ page }) => {
  await twoAccesses(page);
  await page.getByTestId("detail-technical").first().click();
  const position = page.getByTestId("history-position").first();
  const total = parsePosition(await position.textContent()).total;

  // At the very first event, Back is disabled and cannot leave the log.
  // (Both mounted transports disable once; either proves the point.)
  await page.getByTestId("timeline-stop-0-0").first().click();
  await expect(page.getByRole("button", { name: "Back" }).first()).toBeDisabled();
  expect(parsePosition(await position.textContent())).toEqual({ position: 1, total });

  // ArrowRight steps forward one event; ArrowLeft steps one back.
  await page.keyboard.press("ArrowRight");
  expect(parsePosition(await position.textContent())).toEqual({ position: 2, total });
  await page.keyboard.press("ArrowLeft");
  expect(parsePosition(await position.textContent())).toEqual({ position: 1, total });

  // At the end, Step is disabled and Latest has nowhere new to go.
  await page.getByTestId("latest-event").first().click();
  await expect(page.getByRole("button", { name: "Step" }).first()).toBeDisabled();
  await expect(page.getByTestId("latest-event").first()).toBeDisabled();
});

test.describe("beginner mode (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the strip shows the reading position and Latest returns to it", async ({ page }) => {
    await page.goto("/?mode=experiment");
    await twoAccesses(page);

    // The Lab mounts its transport twice; pick the sticky one thumb-reach away.
    const sticky = page.locator("main div.sticky.bottom-0");
    const strip = page.getByTestId("history-strip");
    const readout = page.getByTestId("history-position-beginner");
    await expect(strip).toBeVisible();
    await expect(readout).toContainText("latest");

    // Step back inside the sticky bar: the strip says how far behind latest.
    await sticky.getByRole("button", { name: "Back" }).click();
    await expect(readout).toContainText("behind latest");

    // Latest inside the strip returns, and the button retires itself.
    await page.getByTestId("latest-event-beginner").click();
    await expect(readout).toContainText("latest");
    await expect(page.getByTestId("latest-event-beginner")).toHaveCount(0);
  });
});
