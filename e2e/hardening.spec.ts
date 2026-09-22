/**
 * Production hardening, in a real browser, against the built bundle.
 *
 * This spec is about what happens when the app is handed something it did not expect:
 * a URL someone edited by hand, a config field someone typed a word into, a reference
 * string someone pasted from a broken document. The standard is not "it shows a nice
 * error" - it is that it shows SOMETHING, keeps working, and never puts `NaN` on the
 * screen.
 *
 * `NaN` is called out specifically and repeatedly because it is the failure mode this
 * codebase is most afraid of. It is a number to JavaScript, it survives arithmetic, it
 * compares false against everything including itself, and it would render as the
 * literal text "NaN" in a page number or a fault count - a wrong answer that looks
 * like an answer.
 *
 * The URL rules themselves are unit-tested without a browser in
 * `tests/ui/urlParams.test.ts`. What is tested HERE is the same class of input through
 * the whole stack: parser, store, React, the engine, and the pixels.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Anything the page reported as a failure while the test was running. */
function watchForFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console.error: ${message.text()}`);
    }
  });
  return failures;
}

/**
 * Every hostile URL the app must survive without a crash, a blank page or a `NaN`.
 *
 * The names are the trap here: only `address`, `access`, `pageSize`, `tlb`, `frames`,
 * `algo`, `ref`, `step` and `mode` are read. A URL that uses `frameCount` or
 * `algorithm` - the names of the matching FIELDS, which is what a person would guess -
 * must be ignored rather than half-applied.
 */
const HOSTILE_URLS: readonly string[] = [
  "/?step=-1",
  "/?step=abc",
  "/?step=9999",
  "/?step=1.5",
  "/?pageSize=banana",
  "/?pageSize=0",
  "/?frames=-10",
  "/?frames=abc",
  "/?tlb=abc",
  "/?tlb=-1",
  "/?algo=INVALID",
  "/?algo=fifo",
  "/?mode=nope",
  "/?mode=learn&step=-1",
  "/?mode=learn&step=abc",
  "/?mode=learn&step=9999",
  "/?mode=compare&ref=abc&frames=-3",
  "/?mode=compare&ref=7,,0",
  "/?mode=experiment&address=banana&pageSize=banana&frames=-10&tlb=abc&algo=INVALID",
  "/?frameCount=-10&tlbCapacity=abc&algorithm=INVALID&pageCount=4",
];

test.describe("malformed URLs", () => {
  for (const url of HOSTILE_URLS) {
    test(`opens without crashing: ${url}`, async ({ page }) => {
      const failures = watchForFailures(page);
      await page.goto(url);

      // The mode navigation only exists once React has rendered the shell. If the
      // parser had thrown, this would still be a bare `<div id="root">`.
      await expect(page.getByTestId("mode-learn")).toBeVisible();

      // The whole page, not one panel: NaN must not reach the screen anywhere.
      await expect(page.locator("body")).not.toContainText("NaN");

      expect(failures).toEqual([]);
    });
  }
});

/**
 * Deep links. These use the query-string form (`/?mode=...`) rather than the path form
 * (`/lab/learn?...`), because `vite preview` - like any static server without a
 * fallback rule - answers the path form with a 404 before the app ever loads. The path
 * form's requirement is a hosting configuration, and it is documented in
 * `docs/deployment.md` rather than asserted here against a server that cannot honour it.
 */
test.describe("deep links", () => {
  test("a lesson step link opens on that step", async ({ page }) => {
    await page.goto("/?mode=learn&step=4");
    await expect(page.getByTestId("mode-learn")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("learn-step-counter")).toContainText("Step 5 / 12");
    await expect(page).toHaveURL(/step=4/);
  });

  test("an over-large lesson step opens the LAST step instead of nothing", async ({ page }) => {
    await page.goto("/?mode=learn&step=9999");
    await expect(page.getByTestId("learn-step-counter")).toContainText("Step 12 / 12");
  });

  test("an Experiment link configures the machine it names", async ({ page }) => {
    await page.goto("/?mode=experiment&address=0x2000&pageSize=8192&tlb=2&frames=8&algo=LRU");

    await expect(page.locator("#address")).toHaveValue("0x2000");
    await expect(page.locator("#pageSize")).toHaveValue("8192");
    await expect(page.locator("#tlbCapacity")).toHaveValue("2");
    await expect(page.locator("#frameCount")).toHaveValue("8");
    await expect(page.getByTestId("algorithm-LRU")).toHaveAttribute("aria-pressed", "true");
  });

  test("a Compare link configures the run it names", async ({ page }) => {
    await page.goto("/?mode=compare&ref=1%202%203&frames=4");
    await expect(page.locator("#referenceString")).toHaveValue("1 2 3");
    await expect(page.locator("#compareFrames")).toHaveValue("4");
  });

  test("an unknown mode opens the default lab rather than an error page", async ({ page }) => {
    const failures = watchForFailures(page);
    await page.goto("/?mode=definitely-not-a-mode");
    await expect(page.getByTestId("mode-experiment")).toHaveAttribute("aria-current", "page");
    expect(failures).toEqual([]);
  });
});

test.describe("invalid input in the production build", () => {
  test("Experiment refuses a word in the address box instead of accessing NaN", async ({ page }) => {
    const failures = watchForFailures(page);
    await page.goto("/?mode=experiment");

    await page.locator("#address").fill("banana");
    await page.getByRole("button", { name: "ACCESS" }).click();

    // The message the screen owns, naming both accepted formats.
    await expect(page.getByText("That is not a virtual address", { exact: false })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("NaN");
    expect(failures).toEqual([]);
  });

  test("Experiment refuses a bad config field and points at the field that caused it", async ({ page }) => {
    const failures = watchForFailures(page);
    await page.goto("/?mode=experiment");

    await page.locator("#pageSize").fill("banana");
    // Live validation should already have marked the field; APPLY must not undo it.
    await expect(page.locator("#pageSize")).toHaveAttribute("aria-invalid", "true");
    await page.getByTestId("apply-config").click();
    await expect(page.getByTestId("error-pageSize")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("NaN");
    expect(failures).toEqual([]);
  });

  test("Compare refuses a malformed reference string instead of publishing a wrong count", async ({ page }) => {
    const failures = watchForFailures(page);
    await page.goto("/?mode=compare");

    // A doubled separator: an empty entry that would otherwise be dropped, which would
    // publish a fault count for a DIFFERENT string than the one on screen.
    await page.locator("#referenceString").fill("7,,0");
    await page.getByTestId("run-compare").click();

    await expect(page.getByTestId("compare-error")).toBeVisible();
    expect(failures).toEqual([]);
  });

  test("the documented counts survive a bad entry followed by a good one", async ({ page }) => {
    await page.goto("/?mode=compare");

    await page.locator("#referenceString").fill("7,,0");
    await page.getByTestId("run-compare").click();
    await expect(page.getByTestId("compare-error")).toBeVisible();

    // Recovery matters more than the refusal: the same screen must still be usable.
    await page.locator("#referenceString").fill("7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1");
    await page.getByTestId("run-compare").click();

    await expect(page.getByTestId("faults-FIFO")).toContainText("15");
    await expect(page.getByTestId("faults-LRU")).toContainText("12");
    await expect(page.getByTestId("faults-OPTIMAL")).toContainText("9");
  });
});
