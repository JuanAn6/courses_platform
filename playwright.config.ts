import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against their own server and database so they never touch dev data:
 * port 3100, database course_platform_e2e (dropped, migrated and seeded on every run),
 * build output in .next-e2e and uploads in storage-e2e.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "mysql://root@localhost:3306/course_platform_e2e";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run e2e:prepare && npx next dev --port ${PORT}`,
    url: `${BASE_URL}/login`,
    // Always start fresh so every run gets a clean, freshly seeded database.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      E2E_DATABASE_URL,
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: BASE_URL,
      NEXT_DIST_DIR: ".next-e2e",
      STORAGE_DIR: "./storage-e2e",
    },
  },
});
