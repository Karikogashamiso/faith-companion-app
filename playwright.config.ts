import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke e2e harness. Specs use the `.e2e.ts` suffix so `bun test` ignores them.
 * Run in CI (.github/workflows/e2e.yml) where Playwright + browsers install and
 * the Supabase env is provided as secrets. Locally: `bunx playwright test`.
 *
 * Set E2E_BASE_URL to test an already-running deployment instead of building.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run build && bun run preview --port 4173",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
