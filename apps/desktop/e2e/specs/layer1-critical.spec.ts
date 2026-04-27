import { test, expect } from "@playwright/test";
import { startTauriApp, stopTauriApp } from "../utils/tauri-app";

test.describe("@critical App Lifecycle", () => {
  let fixture: Awaited<ReturnType<typeof startTauriApp>>;

  test.beforeEach(async () => {
    fixture = await startTauriApp();
  });

  test.afterEach(async () => {
    await stopTauriApp(fixture);
  });

  test("normal startup shows sidebar and workbench placeholder", async ({ page }) => {
    await page.goto("tauri://localhost");
    await expect(page.locator("text=请从左侧选择项目")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Projects")).toBeVisible();
    await expect(page.locator("text=Sessions")).toBeVisible();
    await expect(page.locator("text=Files")).toBeVisible();
  });

  test("cli_missing shows install guide on startup", async ({ page }) => {
    const badFixture = await startTauriApp({ claudeBin: "/usr/bin/false" });
    try {
      await page.goto("tauri://localhost");
      await expect(page.locator("text=Claude Code CLI 不可用")).toBeVisible({ timeout: 10000 });
    } finally {
      await stopTauriApp(badFixture);
    }
  });
});

test.describe("@critical Task Execution", () => {
  test("send input and receive events", async ({ page }) => {
    const fixture = await startTauriApp();
    try {
      await page.goto("tauri://localhost");
      await page.click("text=demo-project");
      await page.fill("textarea", "hello");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=Mock reply")).toBeVisible({ timeout: 15000 });
    } finally {
      await stopTauriApp(fixture);
    }
  });
});

test.describe("@critical Session & Navigation", () => {
  test("session resume shows historical events", async ({ page }) => {
    const fixture = await startTauriApp();
    try {
      await page.goto("tauri://localhost");
      await page.click("text=demo-project");
      await page.fill("textarea", "hello");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=Mock reply")).toBeVisible({ timeout: 15000 });
      await page.click("text=Sessions");
      await page.click("text=test-sid");
      await expect(page.locator("text=Mock reply")).toBeVisible();
    } finally {
      await stopTauriApp(fixture);
    }
  });
});

test.describe("@critical Window Events", () => {
  test("close with active task shows confirmation modal", async ({ page }) => {
    const fixture = await startTauriApp();
    try {
      await page.goto("tauri://localhost");
      await page.click("text=demo-project");
      await page.fill("textarea", "slow-task");
      await page.click('button[type="submit"]');
      await page.evaluate(() => window.close());
      await expect(page.locator("text=任务进行中")).toBeVisible({ timeout: 5000 });
    } finally {
      await stopTauriApp(fixture);
    }
  });
});
