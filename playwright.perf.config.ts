import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./perf",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 90_000,
  use: {
    baseURL: "http://localhost:5200",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "chrome",
  },
  webServer: {
    command: "npm run preview -- --port 5200 --strictPort",
    url: "http://localhost:5200",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
