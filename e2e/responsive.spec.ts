/**
 * Responsive regression: the Lab must not overflow the page horizontally on a
 * phone-width viewport.
 *
 * This pins the Task 4 fix. The sticky mobile transport row used to lack
 * flex-wrap, so the Beginner/Technical switch pushed the page to
 * scrollWidth=515 at innerWidth=390. The assertion measures the real rendered
 * page (documentElement.scrollWidth vs window.innerWidth) - not the CSS -
 * both before and after an access, and pins that both detail-level controls
 * stay visible and inside the viewport.
 */

import { expect, test } from "@playwright/test";

test.describe("mobile viewport (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("/lab has no horizontal page overflow before and after an access", async ({ page }) => {
    await page.goto("/?mode=experiment");

    const measure = () =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

    const fresh = await measure();
    expect(fresh.scrollWidth).toBeLessThanOrEqual(fresh.innerWidth);

    // Both transport controls remain visible and inside the viewport. The Lab
    // mounts the transport twice (in-page + sticky mobile bar), so assert every
    // instance fits rather than assuming a single mount.
    for (const testid of ["detail-beginner", "detail-technical"] as const) {
      const controls = await page.getByTestId(testid).all();
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x + box!.width).toBeLessThanOrEqual(fresh.innerWidth);
      }
    }

    // An access still works, and the post-access page still fits.
    await page.getByRole("button", { name: "ACCESS" }).click();
    await expect(page.getByTestId("access-narration")).toBeVisible();
    const after = await measure();
    expect(after.scrollWidth).toBeLessThanOrEqual(after.innerWidth);
  });
});
