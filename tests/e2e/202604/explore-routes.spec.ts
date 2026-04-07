import { test } from "@playwright/test";
const BASE = "http://172.16.122.52";
const CK = process.env.UI_AUTOTEST_COOKIE ?? "";
async function inject(page: any) {
  const m = new Map<string, string>();
  for (const p of CK.split(/;\s*/)) { if (!p) continue; const i = p.indexOf("="); if (i<=0) continue; m.set(p.slice(0,i).trim(), p.slice(i+1).trim()); }
  await page.context().addCookies(Array.from(m.entries()).map(([name,value]) => ({ name, value, url: BASE })));
}

test("Get all DA routes", async ({ page }) => {
  await inject(page);
  await page.goto(`${BASE}/dataAssets/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  
  // Expand all submenus by clicking each top-level
  const topMenus = ["元数据", "数据标准", "数据模型", "数据质量", "数据安全"];
  for (const m of topMenus) {
    const item = page.locator('[class*="ant-menu"]').filter({ hasText: m }).locator(".ant-menu-submenu-title").first();
    if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
      await item.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
  await page.waitForTimeout(1000);
  
  // Extract all menu items with data-menu-id
  const routes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-menu-id]")).map(el => ({
      text: (el as HTMLElement).innerText?.trim().split("\n")[0],
      route: el.getAttribute("data-menu-id"),
      tag: el.tagName,
    })).filter(r => r.route && r.text);
  });
  console.log("=== ALL ROUTES ===");
  for (const r of routes) console.log(`${r.text} => ${r.route}`);
});

test("Get batch project menus", async ({ page }) => {
  await inject(page);
  await page.goto(`${BASE}/batch/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  
  // Get project names
  const projects = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[class*='card'], [class*='Card'], .ant-card")).map(el =>
      (el as HTMLElement).innerText?.trim().split("\n")[0]
    ).filter(Boolean)
  );
  console.log("PROJECTS:", projects.slice(0,10).join(" | "));
  
  // Click first project card
  const firstCard = page.locator("[class*='card'], [class*='Card'], .ant-card").first();
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  console.log("PROJECT URL:", page.url());
  
  // Get all routes in project
  const routes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-menu-id], .ant-menu-item, .ant-menu-submenu-title")).map(el => ({
      text: (el as HTMLElement).innerText?.trim().split("\n")[0],
      route: el.getAttribute("data-menu-id") ?? "",
    })).filter(r => r.text);
  });
  console.log("=== PROJECT ROUTES ===");
  for (const r of routes) console.log(`${r.text} => ${r.route}`);
  
  const body = await page.locator("body").innerText();
  console.log("BODY:", body.slice(0, 800));
});
