/**
 * E2E 测试共享 helper
 * 提供环境配置读取、Cookie 注入、URL 构建、菜单导航等通用能力
 */
import type { Page } from "@playwright/test";

type RuntimeEnv = Record<string, string | undefined>;
type ProjectListResponse = { data?: Array<{ id?: number | string }> };

// ── 环境变量 ────────────────────────────────────────────

export function getEnv(name: string): string | undefined {
  return (globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } })
    .process?.env?.[name];
}

function getRawBaseUrl(): string {
  return (
    getEnv("UI_AUTOTEST_BASE_URL") ??
    getEnv("E2E_BASE_URL") ??
    "http://172.16.122.52"
  );
}

// ── URL 构建 ────────────────────────────────────────────

export function normalizeBaseUrl(product: string): string {
  const rawBaseUrl = getRawBaseUrl();
  const parsed = new URL(rawBaseUrl);
  const cleanPath = parsed.pathname.replace(/\/$/, "");
  const productIndex = cleanPath.indexOf(`/${product}`);
  const productPath =
    productIndex >= 0
      ? cleanPath.slice(0, productIndex + `/${product}`.length)
      : `${cleanPath}/${product}`.replace(/\/{2,}/g, "/");
  return `${parsed.origin}${productPath || `/${product}`}`;
}

export function normalizeDataAssetsBaseUrl(): string {
  return normalizeBaseUrl("dataAssets");
}

export function normalizeOfflineBaseUrl(): string {
  return normalizeBaseUrl("batch");
}

export function buildDataAssetsUrl(
  path: string,
  pid?: number | string,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const separator = normalizedPath.includes("?") ? "&" : "?";
  const hashPath = pid
    ? `${normalizedPath}${separator}pid=${pid}`
    : normalizedPath;
  return `${normalizeDataAssetsBaseUrl()}/#${hashPath}`;
}

export function buildOfflineUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeOfflineBaseUrl()}/#${normalizedPath}`;
}

// ── Cookie 注入 ─────────────────────────────────────────

export async function applyRuntimeCookies(
  page: Page,
  product = "dataAssets",
): Promise<void> {
  const runtimeCookie = getEnv("UI_AUTOTEST_COOKIE")?.trim();
  if (!runtimeCookie) return;

  const cookieUrl = normalizeBaseUrl(product);
  const cookieMap = new Map<string, string>();
  for (const pair of runtimeCookie.split(/;\s*/)) {
    if (!pair) continue;
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!name) continue;
    cookieMap.set(name, value);
  }

  const baseUrl = getRawBaseUrl();
  await page.context().addCookies(
    Array.from(cookieMap.entries()).map(([name, value]) => ({
      name,
      value,
      url: baseUrl,
    })),
  );

  if (cookieUrl !== baseUrl) {
    await page.context().addCookies(
      Array.from(cookieMap.entries()).map(([name, value]) => ({
        name,
        value,
        url: cookieUrl,
      })),
    );
  }
}

// ── 项目 ID 获取 ────────────────────────────────────────

export async function getAccessibleProjectIds(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const response = await fetch("/dassets/v1/valid/project/getProjects", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "Accept-Language": "zh-CN",
      },
    });
    const result = (await response.json()) as ProjectListResponse;
    return (result.data ?? [])
      .map((item: { id?: number | string }) => Number(item?.id))
      .filter((id: number) => Number.isFinite(id));
  });
}

// ── 菜单导航 ────────────────────────────────────────────

/**
 * 通过侧边栏菜单导航到指定模块
 * @param menuPath 菜单路径数组，如 ['元数据', '数据地图']
 */
export async function navigateViaMenu(
  page: Page,
  menuPath: string[],
): Promise<void> {
  const sideMenu = page.locator(".ant-layout-sider").first();
  await sideMenu.waitFor({ state: "visible", timeout: 10000 });

  for (const menuName of menuPath) {
    const menuItem = sideMenu.getByText(menuName, { exact: false });
    const isVisible = await menuItem.isVisible().catch(() => false);
    if (!isVisible) {
      // 尝试展开父菜单
      const parentMenu = sideMenu
        .locator(".ant-menu-submenu-title")
        .filter({ hasText: menuName });
      if (await parentMenu.isVisible().catch(() => false)) {
        await parentMenu.click();
        await page.waitForTimeout(300);
      }
    }
    await menuItem.first().click();
    await page.waitForTimeout(500);
  }
  await page.waitForLoadState("networkidle");
}

// ── Ant Design 组件交互 ─────────────────────────────────

/**
 * Ant Design Select 下拉选择
 */
export async function selectAntOption(
  page: Page,
  triggerLocator: import("@playwright/test").Locator,
  optionText: string,
): Promise<void> {
  await triggerLocator.click();
  await page.waitForTimeout(300);
  const dropdown = page.locator(".ant-select-dropdown:visible");
  await dropdown.waitFor({ state: "visible", timeout: 5000 });
  await dropdown.getByText(optionText, { exact: false }).first().click();
  await page.waitForTimeout(300);
}

/**
 * 等待 Ant Design 全局提示消息
 */
export async function expectAntMessage(
  page: Page,
  text: string | RegExp,
  timeout = 5000,
): Promise<void> {
  const { expect } = await import("@playwright/test");
  const message = page.locator(".ant-message-notice, .ant-notification-notice");
  await expect(message.filter({ hasText: text }).first()).toBeVisible({
    timeout,
  });
}

/**
 * 等待 Ant Design Modal 可见并返回其 locator
 */
export async function waitForAntModal(
  page: Page,
  titleText?: string,
): Promise<import("@playwright/test").Locator> {
  const modal = page.locator(".ant-modal:visible");
  await modal.first().waitFor({ state: "visible", timeout: 10000 });
  if (titleText) {
    const { expect } = await import("@playwright/test");
    await expect(modal.filter({ hasText: titleText }).first()).toBeVisible();
  }
  return modal.first();
}

// ── 离线开发：项目导航 ──────────────────────────────────

/**
 * 在离线开发(batch)中按名称选择指定项目
 *
 * 流程:
 *   1. 进入 /batch/ 项目列表
 *   2. 在搜索框中搜索项目名称
 *   3. 点击匹配的项目卡片进入
 */
export async function selectBatchProject(
  page: Page,
  projectName: string,
): Promise<void> {
  const baseUrl = getRawBaseUrl();
  await applyRuntimeCookies(page, "batch");

  await page.goto(`${baseUrl}/batch/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // 尝试搜索项目
  const searchInput = page
    .locator('input[placeholder*="搜索"], input[placeholder*="项目"], .ant-input-search input')
    .first();
  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchInput.clear();
    await searchInput.fill(projectName);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
  }

  // 优先按名称匹配项目卡片
  const targetCard = page
    .locator(".left-card__proj-item")
    .filter({ hasText: projectName })
    .first();
  if (await targetCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await targetCard.click();
  } else {
    // fallback: 尝试在所有卡片中找到匹配项
    const allCards = page.locator(
      ".left-card__proj-item, [class*='proj-item'], .ant-card",
    );
    const cardCount = await allCards.count();
    let found = false;
    for (let i = 0; i < cardCount; i++) {
      const text = await allCards.nth(i).innerText().catch(() => "");
      if (text.includes(projectName)) {
        await allCards.nth(i).click();
        found = true;
        break;
      }
    }
    if (!found) {
      // 最终 fallback: 点击第一个卡片
      await allCards.first().click();
    }
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
}

// ── 离线开发：执行 SQL 任务 ──────────────────────────────

/**
 * 通过离线开发「临时查询」执行 Doris SQL
 *
 * @param projectName 项目名称，默认 "env_rebuild_test"
 *
 * 流程:
 *   1. /batch/ → 搜索并选择指定项目
 *   2. 点击左侧"临时查询"垂直 tab
 *   3. 展开"临时查询"树节点 → 右键 → "新建临时查询"
 *   4. 弹窗中填写名称, 选择"Doris SQL"类型, 确认
 *   5. 编辑器中输入 SQL
 *   6. 点击"运行"
 *   7. 等待执行完成
 */
export async function executeSqlViaBatchDoris(
  page: Page,
  sqlContent: string,
  taskName?: string,
  projectName = "env_rebuild_test",
): Promise<void> {
  const name = taskName ?? `auto_sql_${Date.now().toString(36)}`;

  // 1. 进入指定项目
  await selectBatchProject(page, projectName);

  // 2. 点击左侧"临时查询"垂直 tab
  const tempQueryTab = page
    .locator(".ant-tabs-tab, [class*='menu-item'], [class*='tab']")
    .filter({ hasText: "临时查询" })
    .first();
  await tempQueryTab.click();
  await page.waitForTimeout(2000);

  // 3. 展开"临时查询"树节点 (点击 switcher)
  const treeNode = page.locator(".ant-tree-title").filter({ hasText: "临时查询" }).first();
  if (await treeNode.isVisible({ timeout: 5000 }).catch(() => false)) {
    const treeNodeRow = treeNode.locator(
      "xpath=ancestor::*[contains(@class,'ant-tree-treenode')]",
    ).first();
    const switcher = treeNodeRow.locator(
      "span[class*='ant-tree-switcher']",
    ).first();
    if (await switcher.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isClosed = await switcher.evaluate(
        (el) => el.classList.contains("ant-tree-switcher_close"),
      ).catch(() => false);
      if (isClosed) {
        await switcher.click();
        await page.waitForTimeout(1000);
      }
    }

    // 4. 右键"临时查询"树节点标题
    await treeNode.click({ button: "right" });
    await page.waitForTimeout(500);
  }

  // 5. 点击"新建临时查询"上下文菜单
  const newQueryMenu = page.getByText("新建临时查询").first();
  await newQueryMenu.click();
  await page.waitForTimeout(1500);

  // 6. 处理新建临时查询弹窗
  const modal = page.locator(".ant-modal:visible").first();
  await modal.waitFor({ state: "visible", timeout: 10000 });

  // 填写临时查询名称
  const nameInput = modal.locator("input").first();
  await nameInput.clear();
  await nameInput.fill(name);

  // 选择"Doris SQL"类型 — 遍历所有 select 找到包含 Doris SQL 的选项
  const selects = modal.locator(".ant-select");
  const selectCount = await selects.count();
  for (let i = 0; i < selectCount; i++) {
    const sel = selects.nth(i);
    await sel.locator(".ant-select-selector").click();
    await page.waitForTimeout(500);
    const dorisOption = page
      .locator(".ant-select-dropdown:visible .ant-select-item-option")
      .filter({ hasText: /Doris\s*SQL/i })
      .first();
    if (await dorisOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dorisOption.click();
      await page.waitForTimeout(500);
      break;
    }
    // 如果不是类型选择器，关闭下拉
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // 点击确认按钮
  const okBtn = modal.locator(".ant-btn-primary").first();
  await okBtn.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // 7. 编辑器中输入 SQL
  const editorArea = page.locator(".view-lines, .monaco-editor .overflow-guard").first();
  if (await editorArea.isVisible({ timeout: 10000 }).catch(() => false)) {
    await editorArea.click();
    await page.waitForTimeout(300);
  }

  // Ctrl+A 全选 → Delete 清空 → 输入新 SQL
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(300);

  // 分块键盘输入 SQL (每块 100 字符以提高可靠性)
  const chunks = sqlContent.match(/.{1,100}/g) ?? [sqlContent];
  for (const chunk of chunks) {
    await page.keyboard.type(chunk, { delay: 0 });
  }
  await page.waitForTimeout(500);

  // 8. 点击运行按钮
  const runBtn = page
    .getByRole("button", { name: /运行/ })
    .or(page.locator("button").filter({ hasText: /运行/ }))
    .first();
  if (await runBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await runBtn.click();
  }
  await page.waitForTimeout(5000);

  // 9. 等待执行结果 (最多等 120 秒)
  await page.waitForLoadState("networkidle");

  const resultArea = page
    .locator('[class*="result"], [class*="console"], [class*="log"], .bottom-panel')
    .first();
  if (await resultArea.isVisible({ timeout: 15000 }).catch(() => false)) {
    try {
      await page.waitForFunction(
        () => {
          const el = document.querySelector(
            '[class*="result"], [class*="console"], [class*="log"], .bottom-panel',
          );
          return el && !/运行中|executing/i.test(el.textContent ?? "");
        },
        { timeout: 120000 },
      );
    } catch {
      // timeout acceptable for DDL
    }
  }
  await page.waitForTimeout(2000);
}

// ── 元数据同步 ──────────────────────────────────────────

/**
 * 创建并执行元数据同步任务（周期同步 + 临时同步）
 *
 * 实际弹窗结构（来自 page snapshot）:
 *   - "* 数据源" 单选 combobox
 *   - 表格行: 数据库(combobox) | 数据表(combobox) | 数据表过滤 | 操作
 *   - 底部按钮: 取消 | 临时同步 | 下一步
 *
 * @param datasourceName 数据源名称（如含 Doris 的数据源）
 */
export async function syncMetadata(
  page: Page,
  datasourceName?: string,
  database?: string,
  tableName?: string,
): Promise<void> {
  // 导航到元数据同步
  await applyRuntimeCookies(page);
  await page.goto(buildDataAssetsUrl("/metaDataSync"));
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // 点击新增周期同步任务
  const addBtn = page
    .getByRole("button", { name: /新增周期同步任务/ })
    .or(page.locator("button").filter({ hasText: /新增.*同步/ }))
    .first();
  await addBtn.click();
  await page.waitForTimeout(2000);

  // 等待弹窗出现
  const modal = page.locator('.ant-modal:visible, dialog:visible').first();
  await modal.waitFor({ state: "visible", timeout: 10000 });

  // 选择数据源（弹窗中的第一个 combobox: "* 数据源"）
  if (datasourceName) {
    const dsCombobox = modal.locator(".ant-select").first();
    if (await dsCombobox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dsCombobox.locator(".ant-select-selector").click();
      await page.waitForTimeout(500);
      const dsOption = page
        .locator(".ant-select-dropdown:visible .ant-select-item-option")
        .filter({ hasText: new RegExp(datasourceName, "i") })
        .first();
      if (await dsOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dsOption.click();
        await page.waitForTimeout(1000);
      } else {
        // fallback: 选第一个选项
        const firstOption = page
          .locator(".ant-select-dropdown:visible .ant-select-item-option")
          .first();
        if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstOption.click();
          await page.waitForTimeout(1000);
        }
        await page.keyboard.press("Escape");
      }
    }
  }

  // 选择数据库（表格行中的第一个 combobox）
  const dbCombobox = modal
    .locator(".ant-table-row .ant-select")
    .first();
  if (await dbCombobox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dbCombobox.locator(".ant-select-selector").click();
    await page.waitForTimeout(500);
    if (database) {
      const dbOption = page
        .locator(".ant-select-dropdown:visible .ant-select-item-option")
        .filter({ hasText: database })
        .first();
      if (await dbOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dbOption.click();
      }
    } else {
      // 选第一个可用数据库
      const firstDb = page
        .locator(".ant-select-dropdown:visible .ant-select-item-option")
        .first();
      if (await firstDb.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstDb.click();
      }
    }
    await page.waitForTimeout(1000);
  }

  // 选择数据表（表格行中的第二个 combobox）
  const tableCombobox = modal
    .locator(".ant-table-row .ant-select")
    .nth(1);
  if (await tableCombobox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tableCombobox.locator(".ant-select-selector").click();
    await page.waitForTimeout(500);
    if (tableName) {
      const tblOption = page
        .locator(".ant-select-dropdown:visible .ant-select-item-option")
        .filter({ hasText: tableName })
        .first();
      if (await tblOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await tblOption.click();
      }
    } else {
      // 选第一个可用数据表
      const firstTbl = page
        .locator(".ant-select-dropdown:visible .ant-select-item-option")
        .first();
      if (await firstTbl.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstTbl.click();
      }
    }
    await page.waitForTimeout(1000);
  }

  // 点击"临时同步"按钮
  const syncNowBtn = modal
    .getByRole("button", { name: /临时同步/ })
    .or(modal.locator("button").filter({ hasText: /临时同步/ }))
    .first();
  if (await syncNowBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await syncNowBtn.click();
    await page.waitForTimeout(3000);
  }

  // 等待同步完成（最多120秒）
  await page.waitForLoadState("networkidle");
  try {
    await page.waitForFunction(
      () => {
        const statusEls = document.querySelectorAll(
          '[class*="status"], .ant-tag, .ant-badge-status-text',
        );
        for (let i = 0; i < statusEls.length; i++) {
          if (/运行中|同步中|进行中/.test(statusEls[i].textContent ?? "")) return false;
        }
        return true;
      },
      { timeout: 120000 },
    );
  } catch {
    // timeout acceptable
  }
  await page.waitForTimeout(2000);
}

// ── 数据质量项目 ──────────────────────────────────────────

/**
 * 获取数据质量项目列表并返回指定名称的项目 ID
 */
export async function getQualityProjectId(
  page: Page,
  projectName?: string,
): Promise<number | null> {
  const ids = await getAccessibleProjectIds(page);
  if (ids.length === 0) return null;
  if (!projectName) return ids[0];

  // 如果需要按名称查找，先获取所有项目详情
  const result = await page.evaluate(async (name: string) => {
    const response = await fetch("/dassets/v1/valid/project/getProjects", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "Accept-Language": "zh-CN",
      },
    });
    const json = (await response.json()) as {
      data?: Array<{ id?: number | string; name?: string; projectName?: string }>;
    };
    const project = (json.data ?? []).find(
      (p) => (p.name ?? p.projectName ?? "").includes(name),
    );
    return project ? Number(project.id) : null;
  }, projectName);

  return result ?? ids[0];
}

// ── 时间戳工具 ──────────────────────────────────────────

export function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}
