import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The engine must run in a plain Node environment: no browser, no DOM, no jsdom.
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
  },
});