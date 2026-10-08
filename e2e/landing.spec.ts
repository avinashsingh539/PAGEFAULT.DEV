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

test("the hero promises the product and offers both CTAs beside a live diagram", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "See what your computer actually does",
  );
  await expect(page.getByRole("link", { name: /Start Learning/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore Memory Lab" })).toBeVisible();

  // The hero ran a real access: page 1 of the lab table, address 0x1345.
  const hero = page.getByTestId("landing-hero-pipeline");
  await expect(hero.getByTestId("memory-pipeline")).toBeVisible();
  await expect(hero.getByTestId("node-cpu-address")).toContainText("0x1345");
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

  // The same page again: a real TLB hit on state the machine kept from run one.
  await mini.getByRole("button", { name: /same page again/ }).click();
  await expect(mini.getByTestId("node-cpu-address")).toContainText("0x1999");

  // The absent page: translation genuinely stops at a page fault.
  await mini.getByRole("button", { name: /absent page/ }).click();
  await expect(mini.getByTestId("stage-fault")).toHaveAttribute("data-status", "fault");
  await expect(mini.getByTestId("stage-fault")).toHaveAttribute("data-focus", "true");
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
