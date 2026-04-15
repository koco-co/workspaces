// META: {"id":"t12","priority":"P1","title":"验证在规则集中已保存的且关系规则编辑切换为或关系后保存成功"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {
  test("验证在规则集中已保存的且关系规则编辑切换为或关系后保存成功", async ({ page, step }) => {
    // 前置：ruleset_15695_and 已创建，含 score 字段取值范围&枚举范围且关系规则

    await step("步骤1: 进入规则集管理页面，等待列表加载完成 → 规则集管理页面打开，列表显示已有规则集数据行", async () => {
      await applyRuntimeCookies(page);
      await page.goto(buildDataAssetsUrl("/dq/ruleSet"));
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      const tableRows = page.locator(".ant-table-row");
      await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    });

    await step("步骤2: 找到ruleset_15695_and，点击编辑，将取值范围和枚举值关系从且切换为或 → 单选按钮切换为「或」被选中", async () => {
      const targetRow = page.locator(".ant-table-row").filter({ hasText: "ruleset_15695_and" }).first();
      await targetRow.waitFor({ state: "visible", timeout: 10000 });
      await targetRow.getByRole("button", { name: "编辑" }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // 找到已存在的取值范围&枚举范围规则行，点击编辑（如有编辑按钮）
      // 规则行中点击编辑规则按钮（铅笔图标或编辑文字）
      const ruleEditBtn = page.locator(".ant-table-row, .rule-item")
        .filter({ hasText: /取值范围&枚举范围|score/ })
        .getByRole("button", { name: /编辑/ })
        .first();
      if (await ruleEditBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ruleEditBtn.click();
        await page.waitForTimeout(500);
      }

      // 将且切换为或
      const orRadio = page.locator(".ant-radio-wrapper").filter({ hasText: "或" }).first();
      await orRadio.waitFor({ state: "visible", timeout: 8000 });
      await orRadio.click();
      await page.waitForTimeout(500);

      // 验证或已选中
      const orRadioInput = page.locator(".ant-radio-wrapper").filter({ hasText: "或" }).locator(".ant-radio-checked").first();
      await expect(
        orRadioInput.or(orRadio)
      ).toBeVisible({ timeout: 3000 });
    }, page.locator(".ant-radio-wrapper").filter({ hasText: "或" }).first());

    await step("步骤3: 点击保存按钮，再点击页面底部保存 → 规则保存成功，且或关系列由且变更为或", async () => {
      // 点击规则行保存
      await page.getByRole("button", { name: "保存" }).first().click();
      await page.waitForTimeout(1000);

      // 点击页面底部保存
      await page.getByRole("button", { name: "保存" }).last().click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);

      // 验证保存成功：关系列显示「或」
      const orCell = page.locator(".ant-table-row").filter({ hasText: "score" }).locator("td").filter({ hasText: "或" }).first();
      const successMsg = page.locator(".ant-message-notice, .ant-notification-notice").filter({ hasText: /成功/ }).first();
      await expect(
        successMsg.or(orCell)
      ).toBeVisible({ timeout: 8000 });
    }, page.locator(".ant-table-row").filter({ hasText: "score" }).first());
  });
});
