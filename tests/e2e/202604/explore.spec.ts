import { test, expect } from "@playwright/test";

test("Explore batch page", async ({ page }) => {
  const cookieStr = process.env.UI_AUTOTEST_COOKIE ?? "";
  const baseUrl = "http://172.16.122.52";
  const cookieMap = new Map<string, string>();
  for (const pair of cookieStr.split(/;\s*/)) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    cookieMap.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  await page.context().addCookies(
    Array.from(cookieMap.entries()).map(([name, value]) => ({
      name, value, url: baseUrl,
    })),
  );

  // Explore batch
  await page.goto(`${baseUrl}/batch/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000);
  console.log("BATCH URL:", page.url());
  console.log("BATCH TITLE:", await page.title());
  const batchText = await page.locator("body").innerText();
  console.log("BATCH TEXT:", batchText.slice(0, 2000));
  const batchMenus = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ant-menu-item, .ant-menu-submenu-title, .ant-menu-item-group-title")).map(el => (el as HTMLElement).innerText?.trim()).filter(Boolean)
  );
  console.log("BATCH MENUS:", batchMenus.join(" | "));

  // Explore dataAssets
  await page.goto(`${baseUrl}/dataAssets/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000);
  console.log("DA URL:", page.url());
  const daMenus = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ant-menu-item, .ant-menu-submenu-title, .ant-menu-item-group-title")).map(el => (el as HTMLElement).innerText?.trim()).filter(Boolean)
  );
  console.log("DA MENUS:", daMenus.join(" | "));
  const daText = await page.locator("body").innerText();
  console.log("DA TEXT:", daText.slice(0, 1500));
});
