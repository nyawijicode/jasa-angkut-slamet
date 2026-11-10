import { defineConfig, devices } from "playwright/test";

const localChannel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5199",
    trace: "on-first-retry",
    // Keep the PWA service worker out of the way so request stubs always
    // intercept search/tile/route requests in every browser engine.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], channel: localChannel },
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], channel: localChannel },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5199",
    url: "http://localhost:5199",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
