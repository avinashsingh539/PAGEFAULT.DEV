/**
 * The landing page, in a real browser.
 *
 * The brief's contract: exactly seven sections, the two hero CTAs beside a LIVE
 * engine-driven diagram, three proof points, five topic cards each with a visual,
 * the six-module learning path, a miniature Lab that really runs the engine, the
 * Students/Developers bullets, and the closing CTA that leaves through the router.
 *
 * Every value asserted here is one the engine produced - the same rule every
 * other spec follows. Nothing below is a screenshot test: if the engine and the
 * page ever disagree, these tests are what turn red.
 */

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("the page is exactly seven sections", async ({ page }) => {
  await expect(page.locator("main > section")).toHaveCount(7);
});

test("the hero promises the product and offers both CTAs beside a live flow", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "See what your computer actually does",
  );
  await expect(page.getByRole("link", { name: /Start Learning/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore Memory Lab" })).toBeVisible();

  // The hero is a concept flow, not a lab: five stations, no tables, no counters,
  // no event log. The running engine backs the address token that travels it.
  const hero = page.getByTestId("landing-hero-pipeline");
  await expect(hero.getByText("Live memory flow")).toBeVisible();
  const stops = hero.locator("ol > li");
  await expect(stops).toHaveCount(5);
  for (const name of ["CPU", "Virtual Address", "TLB", "Page Table", "RAM"]) {
    await expect(hero.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(hero.getByText("One address, travelling through the memory system.")).toBeVisible();

  // The engine ran a real access, so whatever stop currently holds the token
  // names the documented reference address - and no detail boxes exist here.
  await expect(hero.getByText("0x1345", { exact: true })).toBeVisible();
  await expect(hero.getByTestId("memory-pipeline")).toHaveCount(0);
  await expect(hero.getByTestId("node-cpu-address")).toHaveCount(0);
});

test("the proof strip names three factual points", async ({ page }) => {
  const proof = page.getByTestId("landing-proof");
  await expect(proof.getByText("Deterministic", { exact: true })).toBeVisible();
  await expect(proof.getByText("Step-by-step", { exact: true })).toBeVisible();
  await expect(proof.getByText("Compare 3 algorithms", { exact: true })).toBeVisible();
});

test("What You'll Learn shows five cards, each with a visual", async ({ page }) => {
  const topics = page.getByTestId("landing-topics");
  await expect(topics.locator("li")).toHaveCount(5);
  for (const name of ["Virtual Memory", "Paging", "TLB", "Page Faults", "Page Replacement"]) {
    await expect(topics.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  // Every card carries an icon - "must have a visual" is a contract, not a mood.
  await expect(topics.locator("li svg")).toHaveCount(5);
});

test("the learning path lists the six modules in order", async ({ page }) => {
  const path = page.getByTestId("landing-path");
  await expect(path.locator("li")).toHaveCount(6);
  for (const title of ["Basics", "Addresses", "Paging", "TLB", "Faults", "Replacement"]) {
    await expect(path.getByText(title, { exact: true })).toBeVisible();
  }
});

test("the miniature Lab answers an address with the real engine", async ({ page }) => {
  const mini = page.getByTestId("landing-mini-lab");
  await expect(mini).toBeVisible();

  // Nothing has run yet, so the machine honestly reports "not yet".
  await expect(mini.getByTestId("node-cpu-address")).toContainText("—");

  // First touch of page 1: the documented reference value - frame 7.
  await mini.getByRole("button", { name: /first touch/ }).click();
  await expect(mini.getByTestId("node-cpu-address")).toContainText("0x1345");
  await expect(mini.getByTestId("node-frame-number")).toContainText("7");
  await expect(mini.getByTestId("landing-mini-runs")).toContainText("1 access");

  // A MISS had to consult the page table, so that column is drawn as done.
  await expect(mini.getByTestId("stage-pageTable")).toHaveAttribute("data-status", "done");

  // The same page again: a real TLB hit on state the machine kept from run one.
  await mini.getByRole("button", { name: /same page again/ }).click();
  await expect(mini.getByTestId("node-cpu-address")).toContainText("0x1999");

  // The hit is not a claim: the cache really holds page 1 -> frame 7, and the
  // engine's own derivation marks the page table SKIPPED because the TLB spared
  // the walk. That is `stageStatuses()` responding to a genuine TLB_HIT event.
  await expect(mini.getByTestId("tlb-entry-1")).toContainText("frame 7");
  await expect(mini.getByTestId("stage-pageTable")).toHaveAttribute("data-status", "skipped");
  await expect(mini.getByTestId("landing-mini-runs")).toContainText("2 accesses");

  // The absent page: translation genuinely stops at a page fault.
  await mini.getByRole("button", { name: /absent page/ }).click();
  await expect(mini.getByTestId("stage-fault")).toHaveAttribute("data-status", "fault");
  await expect(mini.getByTestId("stage-fault")).toHaveAttribute("data-focus", "true");
  await expect(mini.getByTestId("landing-mini-runs")).toContainText("3 accesses");

  // The console footer reports the machine as it now stands: one cached
  // translation in a four-entry cache, and the six present lab pages in RAM.
  // A fault fills nothing, so both counts are exactly what the engine left.
  await expect(mini.getByTestId("landing-mini-stat-tlb")).toContainText("1 of 4");
  await expect(mini.getByTestId("landing-mini-stat-pages")).toContainText("6");
});

test("Try It Now is a console to operate, not a second copy of the hero", async ({ page }) => {
  const mini = page.getByTestId("landing-mini-lab");
  const hero = page.getByTestId("landing-hero-pipeline");

  // The hero WATCHES: one flat list of five stations, nothing to type into, and
  // no read-out of the machine's state at all.
  await expect(hero.locator("ol > li")).toHaveCount(5);
  await expect(hero.getByRole("textbox")).toHaveCount(0);
  await expect(hero.getByRole("button")).toHaveCount(0);
  await expect(hero.getByTestId("event-explanation")).toHaveCount(0);

  // The console OPERATES: an address field, a run button, presets, and its own
  // titled header with a counter - none of which exist above the fold.
  await expect(mini.getByText("Live console")).toBeVisible();
  await expect(mini.getByRole("textbox")).toHaveCount(1);
  await expect(mini.getByRole("button", { name: "ACCESS" })).toBeVisible();
  await expect(mini.getByTestId("landing-mini-runs")).toContainText("0 accesses");

  // Different shapes: the console is a two-column grid, and its footer strip is
  // a state read-out the hero never has.
  await expect(mini.locator("> div.grid")).toHaveCount(1);
  await expect(mini.locator("> dl")).toHaveCount(1);
  await expect(hero.locator("> ol")).toHaveCount(1);

  // It is the DETAILED form of the shared pipeline; the hero deliberately
  // renders none of it, which is the whole point of the split.
  await expect(mini.getByTestId("memory-pipeline")).toHaveCount(1);
  await expect(hero.getByTestId("memory-pipeline")).toHaveCount(0);

  // Operating it produces the explanation panel - the hero can never do this.
  await mini.getByRole("button", { name: /first touch/ }).click();
  await expect(mini.getByTestId("event-explanation")).toBeVisible();
  await expect(mini.getByTestId("landing-mini-stat-runs")).toContainText("1");
});

test("the miniature Lab refuses an address it cannot parse", async ({ page }) => {
  const mini = page.getByTestId("landing-mini-lab");
  await mini.getByTestId("landing-mini-address").fill("banana");
  await mini.getByTestId("landing-mini-run").click();
  await expect(mini.getByTestId("landing-mini-error")).toContainText("not a virtual address");
});

test("Students and Developers cards carry their bullets", async ({ page }) => {
  const audience = page.getByTestId("landing-audience");
  await expect(audience.getByRole("heading", { name: "Students" })).toBeVisible();
  await expect(audience.getByText("visual explanations")).toBeVisible();
  await expect(audience.getByText("algorithm comparisons")).toBeVisible();
  await expect(audience.getByRole("heading", { name: "Developers" })).toBeVisible();
  await expect(audience.getByText("deterministic simulations")).toBeVisible();
  await expect(audience.getByText("reproducible experiments")).toBeVisible();
});

test("the closing CTA sends the visitor to Learn", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: /Ready to see what happens inside memory/ }),
  ).toBeVisible();
  await page.getByTestId("landing-final-cta").click();
  await expect(page.getByTestId("mode-learn")).toHaveAttribute("aria-current", "page");
});
