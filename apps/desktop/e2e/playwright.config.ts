import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../results/html" }],
  ],
  webServer: {
    command: "bun run --filter @kata/desktop dev:vite -- --mode e2e",
    port: 1420,
    reuseExistingServer: !process.env.CI,
    env: { KATA_ROOT: "./e2e/fixtures/test-projects/demo-project" },
  },
  use: {
    baseURL: "http://localhost:1420",
    trace: process.env.CI ? "on-first-retry" : "on",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "component",
      grep: /@component/,
      use: { headless: true },
    },
    {
      name: "critical",
      grep: /@critical/,
      use: { headless: true },
    },
  ],
});
