/**
 * 【通用配置】json格式校验管理 - 套件专属 helpers
 *
 * 基于实际 DOM snapshot 编写的稳定操作函数
 */
import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

const PAGE_URL =
  "http://shuzhan63-test-ltqc.k8s.dtstack.cn/dataAssets/#/dq/generalConfig/jsonValidationConfig";

/** 进入 json格式校验管理页面并关闭可能出现的欢迎弹窗 */
export async function gotoJsonConfigPage(page: Page): Promise<void> {
  await page.goto(PAGE_URL);
  await page.waitForLoadState("networkidle");

  // 关闭欢迎弹窗
  const welcomeDialog = page
    .locator("dialog, .ant-modal")
    .filter({ hasText: "欢迎使用" });
  if (await welcomeDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    const knowBtn = welcomeDialog.getByRole("button", { name: "知道了" });
    if (await knowBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await knowBtn.click();
      await welcomeDialog
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => {});
    }
  }

  // 等待表格加载
  const container = page.locator(".json-format-check");
  await container.waitFor({ state: "visible", timeout: 15000 });
}

/** 点击顶部操作栏按钮 (新增/导入/导出) */
export async function clickHeaderButton(
  page: Page,
  name: string,
): Promise<void> {
  // 按钮文本可能含内部空格（如"新 增"），用精确正则匹配完整按钮名称，排除"新增子层级"等包含子串的行内按钮
  const exactPattern = new RegExp(
    `^${name.split("").join("\\s*")}$`,
  );
  await page.getByRole("button", { name: exactPattern }).click();
}

/** 等待弹窗出现并返回 locator */
export async function waitModal(
  page: Page,
  titleText?: string,
): Promise<Locator> {
  const modal = page.locator(".ant-modal:visible").last();
  await modal.waitFor({ state: "visible", timeout: 10000 });
  if (titleText) {
    await expect(
      modal.locator(".ant-modal-title"),
    ).toContainText(titleText, { timeout: 5000 });
  }
  return modal;
}

/** 在弹窗内填写 key 输入框 */
export async function fillKeyInput(
  modal: Locator,
  value: string,
): Promise<void> {
  const keyInput = modal
    .locator(".ant-form-item")
    .filter({ hasText: /^\*?\s*key$/i })
    .locator("input")
    .first();
  await keyInput.waitFor({ state: "visible", timeout: 5000 });
  await keyInput.clear();
  await keyInput.fill(value);
}

/** 在弹窗内填写中文名称 */
export async function fillNameInput(
  modal: Locator,
  value: string,
): Promise<void> {
  const nameInput = modal
    .locator(".ant-form-item")
    .filter({ hasText: "中文名称" })
    .locator("input")
    .first();
  await nameInput.clear();
  await nameInput.fill(value);
}

/** 在弹窗内填写 value 格式 */
export async function fillValueFormat(
  modal: Locator,
  value: string,
): Promise<void> {
  const valueInput = modal
    .locator(".ant-form-item")
    .filter({ hasText: "value格式" })
    .locator("input")
    .first();
  await valueInput.clear();
  await valueInput.fill(value);
}

/** 在弹窗内选择数据源类型 */
export async function selectDataSourceType(
  page: Page,
  modal: Locator,
  typeName: string,
): Promise<void> {
  const dsFormItem = modal
    .locator(".ant-form-item")
    .filter({ hasText: "数据源类型" });
  const select = dsFormItem.locator(".ant-select").first();
  await select.locator(".ant-select-selector").click();
  await page.waitForTimeout(300);
  const option = page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: typeName })
    .first();
  await option.click();
  await page.waitForTimeout(500);
}

/** 点击弹窗内的确定按钮 */
export async function clickModalConfirm(modal: Locator): Promise<void> {
  // 排除 ghost 按钮（如正则匹配测试），只点主确定
  const confirmBtn = modal
    .locator(".ant-modal-footer .ant-btn-primary, .ant-modal-footer button")
    .filter({ hasText: /确\s*定/ })
    .first();
  await confirmBtn.click();
}

/** 点击弹窗确定并等待关闭 */
export async function confirmAndWaitClose(
  page: Page,
  modal: Locator,
): Promise<void> {
  await clickModalConfirm(modal);
  await expect(modal).not.toBeVisible({ timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

/** 完整的新增 key 操作 */
export async function addKey(
  page: Page,
  keyName: string,
  opts?: {
    chineseName?: string;
    valueFormat?: string;
    dataSourceType?: string;
  },
): Promise<void> {
  await clickHeaderButton(page, "新增");
  const modal = await waitModal(page, "新建");

  // 如果需要切换数据源类型，先切（因为切换会清空其他字段）
  if (opts?.dataSourceType) {
    await selectDataSourceType(page, modal, opts.dataSourceType);
  }

  await fillKeyInput(modal, keyName);

  if (opts?.chineseName) {
    await fillNameInput(modal, opts.chineseName);
  }

  if (opts?.valueFormat) {
    await fillValueFormat(modal, opts.valueFormat);
  }

  await confirmAndWaitClose(page, modal);
}

/** 为指定 key 行新增子层级 */
export async function addChildKey(
  page: Page,
  parentKeyName: string,
  childKeyName: string,
  opts?: { chineseName?: string; valueFormat?: string },
): Promise<void> {
  const parentRow = page
    .locator(".ant-table-row")
    .filter({ hasText: parentKeyName })
    .first();
  await parentRow
    .locator(".ant-btn-link")
    .filter({ hasText: "新增子层级" })
    .click();

  const modal = await waitModal(page, "新建子层级");
  await fillKeyInput(modal, childKeyName);

  if (opts?.chineseName) {
    await fillNameInput(modal, opts.chineseName);
  }

  if (opts?.valueFormat) {
    await fillValueFormat(modal, opts.valueFormat);
  }

  await confirmAndWaitClose(page, modal);
}

/** 展开指定 key 的子层级 */
export async function expandRow(
  page: Page,
  keyName: string,
): Promise<void> {
  const row = page
    .locator(".ant-table-row")
    .filter({ hasText: keyName })
    .first();
  const expandIcon = row.locator(
    ".ant-table-row-expand-icon:not(.ant-table-row-expand-icon-spaced)",
  );
  if (await expandIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expandIcon.click();
    await page.waitForTimeout(500);
  }
}

/** 删除指定 key（单条删除 + Popconfirm 确认） */
export async function deleteKey(page: Page, keyName: string): Promise<void> {
  const row = page
    .locator(".ant-table-row")
    .filter({ hasText: keyName })
    .first();
  await row.locator(".ant-btn-link").filter({ hasText: "删除" }).click();
  // Popconfirm 确认
  const popconfirm = page.locator(".ant-popover:visible, .ant-popconfirm:visible").last();
  await popconfirm.waitFor({ state: "visible", timeout: 5000 });
  const okBtn = popconfirm.locator(".ant-btn-primary").first();
  await okBtn.click();
  await page.waitForLoadState("networkidle");
}

/** 搜索 key */
export async function searchKey(page: Page, keyword: string): Promise<void> {
  const searchInput = page.locator(".dt-search input").first();
  await searchInput.clear();
  await searchInput.fill(keyword);
  await searchInput.press("Enter");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

/** 清空搜索 */
export async function clearSearch(page: Page): Promise<void> {
  const searchInput = page.locator(".dt-search input").first();
  await searchInput.clear();
  await searchInput.press("Enter");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}
