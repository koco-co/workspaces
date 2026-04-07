import { test } from "@playwright/test";
const BASE = "http://172.16.122.52";
const CK = process.env.UI_AUTOTEST_COOKIE ?? "";
async function inject(page: any) {
  const m = new Map<string, string>();
  for (const p of CK.split(/;\s*/)) { if (!p) continue; const i = p.indexOf("="); if (i<=0) continue; m.set(p.slice(0,i).trim(), p.slice(i+1).trim()); }
  await page.context().addCookies(Array.from(m.entries()).map(([name,value]) => ({ name, value, url: BASE })));
}

test("Get submenu routes by navigating", async ({ page }) => {
  await inject(page);
  
  const topMenus = [
    { name: "元数据", subs: ["数据地图", "元数据同步", "元模型管理", "元数据管理", "订阅的数据", "完整度分析", "血缘分析"] },
    { name: "数据标准", subs: ["标准统计", "标准定义", "标准映射", "词根管理", "码表管理", "行业模版", "数据库拾取"] },
    { name: "数据模型", subs: ["建表", "规范设计", "我的模型"] },
    { name: "数据质量", subs: ["概览", "规则任务配置", "任务实例查询", "质量报告", "项目信息", "脏数据管理"] },
    { name: "数据治理", subs: [] },
    { name: "数据安全", subs: [] },
  ];
  
  for (const menu of topMenus) {
    // Navigate to the top-level menu
    await page.goto(`${BASE}/dataAssets/`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    
    // Click top-level menu
    const topItem = page.locator("li[data-menu-id]").filter({ hasText: new RegExp(`^${menu.name}$`) }).first();
    if (await topItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await topItem.click({ force: true });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      console.log(`\n${menu.name} => ${page.url().split("#")[1] || page.url()}`);
    }
    
    // Now collect all data-menu-id from the submenu area
    const allRoutes = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-menu-id]")).map(el => ({
        text: (el as HTMLElement).innerText?.trim().split("\n")[0],
        route: el.getAttribute("data-menu-id"),
      }))
    );
    
    // Click each submenu if it exists
    for (const sub of menu.subs) {
      const subItem = page.locator("li[data-menu-id]").filter({ hasText: sub }).first();
      if (await subItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await subItem.click({ force: true });
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);
        console.log(`  ${sub} => ${page.url().split("#")[1] || page.url()}`);
      } else {
        // Try popup menu
        const popup = page.locator(".ant-menu-submenu-popup li").filter({ hasText: sub }).first();
        if (await popup.isVisible({ timeout: 500 }).catch(() => false)) {
          await popup.click({ force: true });
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1000);
          console.log(`  ${sub} (popup) => ${page.url().split("#")[1] || page.url()}`);
        } else {
          console.log(`  ${sub} => NOT FOUND`);
        }
      }
    }
    
    // Also check data-security submenus
    if (menu.name === "数据安全" || menu.name === "数据治理") {
      const subRoutes = allRoutes.filter(r => !["资产盘点","元数据","数据标准","数据模型","数据质量","数据治理","数据安全","平台管理"].includes(r.text||""));
      for (const r of subRoutes) {
        if (r.text && r.route) console.log(`  ${r.text} => ${r.route}`);
      }
    }
  }
});
