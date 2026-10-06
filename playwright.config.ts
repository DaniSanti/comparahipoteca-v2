import { defineConfig, devices } from "@playwright/test";

const preview = "npm run preview -- --host localhost --port 4173 --strictPort";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    serviceWorkers: "block",
    // Optional local fallback for environments that already provide Chromium.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI has already built dist in this job; local runs always build afresh.
    command: process.env.PLAYWRIGHT_SKIP_BUILD === "1"
      ? preview
      : `npm run build && ${preview}`,
    url: "http://localhost:4173",
    reuseExistingServer: false,
    env: { VITE_GA_MEASUREMENT_ID: "G-E2ETEST000" },
    timeout: 60_000,
  },
});
