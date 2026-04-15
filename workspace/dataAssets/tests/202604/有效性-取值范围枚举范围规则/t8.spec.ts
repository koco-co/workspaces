// META: {"id":"t8","priority":"P1","title":"验证取值范围设置期望值已填写但操作符未选择时点击保存提示校验错误"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl, selectAntOption } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {
  test("验证取值范围设置期望值已填写但操作符未选择时点击保存提示校验错误", async ({ page, step }) => {
    // 前置：ruleset_15695_and 已创建，含 score 字段的取值范围&枚举范围且关系规则

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

      // 选择统计函数：取值范围&枚举范围
      const statFuncSelect = page.locator(".ant-select").filter({ hasText: /统计函数|请选择/ }).first();
      await selectAntOption(page, statFuncSelect, "取值范围&枚举范围");

      const ruleConfigArea = page.locator(".ant-form-item").filter({ hasText: /字段/ }).first();
      await expect(ruleConfigArea).toBeVisible({ timeout: 5000 });
    });

    await step("步骤3: 填写字段score，取值范围仅输入期望值5（不选操作符），枚举值in 1,2,3，关系选且，强规则 → 字段已选score，操作符未选择，期望值5已填写", async () => {
      // 选择字段：score
      const fieldSelect = page.locator(".ant-select").filter({ hasText: /字段|请选择字段/ }).first();
      await selectAntOption(page, fieldSelect, "score");

      // 取值范围：仅输入期望值 5，不选操作符
      const rangeRow = page.locator(".ant-form-item").filter({ hasText: /取值范围/ }).first();
      const rangeInput = rangeRow.locator("input[type='text'], input[type='number']").first();
      await rangeInput.fill("5");

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

      // 关系选且
      await page.locator(".ant-radio-wrapper").filter({ hasText: "且" }).click();

      const fieldDisplay = page.locator(".ant-select-selection-item").filter({ hasText: "score" }).first();
      await expect(fieldDisplay).toBeVisible({ timeout: 5000 });
    }, page.locator(".ant-form-item").filter({ hasText: /取值范围/ }).first());

    await step("步骤4: 点击保存按钮 → 保存失败，取值范围操作符位置展示红色校验错误提示「请选择操作符」", async () => {
      await page.getByRole("button", { name: "保存" }).first().click();
      await page.waitForTimeout(1000);

      const errorMsg = page.locator(".ant-form-item-explain-error, .has-error .ant-form-explain, [class*='error']").filter({ hasText: /操作符/ }).first();
      await expect(
        errorMsg.or(page.getByText("请选择操作符"))
      ).toBeVisible({ timeout: 5000 });
    }, page.locator(".ant-form-item-explain-error").first());
  });
});
