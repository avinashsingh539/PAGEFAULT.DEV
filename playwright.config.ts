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
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
