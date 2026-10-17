/**
 * Playwright configuration for the MemoryLab e2e specs.
 *
 * The specs run against the BUILT app (`vite preview` on `dist/`), not against the dev
 * server, so what a test sees is exactly what would ship. `npm run e2e` builds first
 * for the same reason: a test that passes on stale output teaches the wrong lesson.
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // The whole suite runs as a RETURNING visitor who has already taken the two
    // product tours. The tours auto-open on a first visit, and Playwright gives
    // every test a fresh context - without this, all ~60 pre-existing specs would
    // meet an auto-opening overlay that was shipped long after they were written,
    // and several would fail on covered controls (on a phone the tour card is a
    // full-width bottom sheet). The two first-visit specs opt back into a clean
    // context with `test.use({ storageState: { cookies: [], origins: [] } })`.
    storageState: "e2e/returning-user.storage.json",
  },
  webServer: {
    // `root: "ui"` in vite.config.mts makes `outDir: "../dist"` resolve to the repo
    // root, so the preview server must run from there too: it looks for `dist/` under
    // the config's root, i.e. `ui/dist`, unless told where the project really is.
    command: "npx vite preview --config vite.config.mts --port 4173 --strictPort",
    cwd: ".",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
