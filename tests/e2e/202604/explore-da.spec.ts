import { test, expect } from "@playwright/test";

const BASE_URL = "http://172.16.122.52";
const COOKIE_STR = process.env.UI_AUTOTEST_COOKIE ?? "";

async function injectCookies(page: import("@playwright/test").Page) {
  const cookieMap = new Map<string, string>();
  for (const pair of COOKIE_STR.split(/;\s*/)) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    cookieMap.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  await page.context().addCookies(
    Array.from(cookieMap.entries()).map(([name, value]) => ({
      name, value, url: BASE_URL,
    })),
  );
}

test("Explore dataAssets subroutes", async ({ page }) => {
  await injectCookies(page);
  await page.goto(`${BASE_URL}/dataAssets/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // Click each top-level menu and record the URL
  const sidebar = page.locator(".ant-layout-sider, .ant-menu-root").first();
  const topMenus = ["元数据", "数据标准", "数据模型", "数据质量", "数据安全"];
  
  for (const menuName of topMenus) {
    const menuItem = sidebar.locator(".ant-menu-submenu-title, .ant-menu-item").filter({ hasText: menuName }).first();
    if (await menuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuItem.click();
      await page.waitForTimeout(1000);
      
      // Get sub-menu items
      const subMenus = await page.evaluate((name: string) => {
        const items = document.querySelectorAll(".ant-menu-item");
        return Array.from(items).map(el => ({
          text: (el as HTMLElement).innerText?.trim(),
          class: (el as HTMLElement).className,
        })).filter(i => i.text);
      }, menuName);
      
      console.log(`=== ${menuName} SUBMENUS: ${subMenus.map(s => s.text).join(" | ")} ===`);
      
      // Click first submenu item
      if (subMenus.length > 0) {
        const firstSub = sidebar.locator(".ant-menu-item").filter({ hasText: subMenus[0].text }).first();
        if (await firstSub.isVisible().catch(() => false)) {
          await firstSub.click();
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(2000);
          console.log(`  ${subMenus[0].text} URL: ${page.url()}`);
        }
      }
    }
  }
});

test("Explore batch project", async ({ page }) => {
  await injectCookies(page);
  await page.goto(`${BASE_URL}/batch/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // Click first project
  const projectCard = page.locator(".ant-card, [class*='project-card'], [class*='ProjectCard']").first();
  if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    const projectName = await projectCard.innerText();
    console.log("Clicking project:", projectName.slice(0, 50));
    await projectCard.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    console.log("PROJECT URL:", page.url());
    
    // Get menus
    const menus = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".ant-menu-item, .ant-menu-submenu-title")).map(el => (el as HTMLElement).innerText?.trim()).filter(Boolean)
    );
    console.log("PROJECT MENUS:", menus.join(" | "));
    
    // Try clicking "数据开发" menu
    const devMenu = page.locator(".ant-menu-item, .ant-menu-submenu-title").filter({ hasText: /数据开发|任务开发|开发/ }).first();
    if (await devMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await devMenu.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      console.log("DEV URL:", page.url());
    }
    
    // Check page body
    const bodyText = await page.locator("body").innerText();
    console.log("BODY:", bodyText.slice(0, 1500));
  }
});
