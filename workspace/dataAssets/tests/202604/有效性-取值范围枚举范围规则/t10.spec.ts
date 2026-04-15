// META: {"id":"t10","priority":"P1","title":"验证取值范围设置和枚举值设置均已填写但取值范围和枚举值关系未选择时点击保存提示校验错误"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl, selectAntOption } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {
  test("验证取值范围设置和枚举值设置均已填写但取值范围和枚举值关系未选择时点击保存提示校验错误", async ({ page, step }) => {
    // 前置：ruleset_15695_and 已创建

    await step("步骤1: 进入规则集管理页面，等待列表加载完成 → 规则集管理页面正常打开，列表显示已有规则集数据行", async () => {
      await applyRuntimeCookies(page);
      await page.goto(buildDataAssetsUrl("/dq/ruleSet"));
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      const tableRows = page.locator(".ant-table-row");
      await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    });

    await step("步骤2: 找到ruleset_15695_and，点击编辑，新增规则并选择取值范围&枚举范围 → 规则配置区域展开，统计函数显示取值范围&枚举范围", async () => {
      const targetRow = page.locator(".ant-table-row").filter({ hasText: "ruleset_15695_and" }).first();
      await targetRow.waitFor({ state: "visible", timeout: 10000 });
      await targetRow.getByRole("button", { name: "编辑" }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // 点击新增规则
      await page.getByRole("button", { name: "新增规则" }).first().click();
      await page.waitForTimeout(500);

      // 选择统计函数
      const statFuncSelect = page.locator(".ant-select").filter({ hasText: /统计函数|请选择/ }).first();
      await selectAntOption(page, statFuncSelect, "取值范围&枚举范围");

      const ruleConfigArea = page.locator(".ant-form-item").filter({ hasText: /字段/ }).first();
      await expect(ruleConfigArea).toBeVisible({ timeout: 5000 });
    });

    await step("步骤3: 填写字段score，取值范围>1，枚举值in 1、2、3，不选择且/或关系，强规则 → 取值范围和枚举值均已填写，关系未选择", async () => {
      // 选择字段：score
      const fieldSelect = page.locator(".ant-select").filter({ hasText: /字段|请选择字段/ }).first();
      await selectAntOption(page, fieldSelect, "score");

      // 取值范围：操作符选 >，期望值填 1
      const rangeRow = page.locator(".ant-form-item").filter({ hasText: /取值范围/ }).first();
      const rangeOpSelect = rangeRow.locator(".ant-select").first();
      await selectAntOption(page, rangeOpSelect, ">");
      const rangeInput = rangeRow.locator("input[type='text'], input[type='number']").first();
      await rangeInput.fill("1");

      // 枚举值设置：in 1、2、3
      const enumRow = page.locator(".ant-form-item").filter({ hasText: /枚举值/ }).first();
      const enumOpSelect = enumRow.locator(".ant-select").first();
      await selectAntOption(page, enumOpSelect, "in");
      const enumInput = enumRow.locator("input").last();
      await enumInput.fill("1");
      await page.keyboard.press("Enter");
      await enumInput.fill("2");
      await page.keyboard.press("Enter");
      await enumInput.fill("3");
      await page.keyboard.press("Enter");

      // 不选择且/或关系（保持默认空状态）
      const relationRow = page.locator(".ant-form-item").filter({ hasText: /且.*或|取值范围和枚举值关系/ }).first();
      await expect(relationRow).toBeVisible({ timeout: 5000 });
    }, page.locator(".ant-form-item").filter({ hasText: /且.*或|取值范围和枚举值关系/ }).first());

    await step("步骤4: 点击保存按钮 → 保存失败，关系设置位置展示红色校验错误提示「请选择规则关系」", async () => {
      await page.getByRole("button", { name: "保存" }).first().click();
      await page.waitForTimeout(1000);

      const errorMsg = page.locator(".ant-form-item-explain-error, .has-error .ant-form-explain, [class*='error']").filter({ hasText: /规则关系/ }).first();
      await expect(
        errorMsg.or(page.getByText("请选择规则关系"))
      ).toBeVisible({ timeout: 5000 });
    }, page.locator(".ant-form-item-explain-error").first());
  });
});
