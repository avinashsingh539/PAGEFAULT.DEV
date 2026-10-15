/** TEMPORARY Task 6 before/after inspection shots (deleted after review). */
import { test } from "@playwright/test";

test("learn before/after + docs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?mode=learn");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "shots/t6-learn-1440.png", fullPage: false });
  await page.goto("/docs");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/t6-docs-1440.png", fullPage: false });
});
