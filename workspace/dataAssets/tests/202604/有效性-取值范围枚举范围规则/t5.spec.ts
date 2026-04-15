// META: {"id":"t5","priority":"P1","title":"验证在规则集中枚举值选择not in后保存成功且编辑时回显正确"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  // 前置：已存在规则集 "ruleset_15695_notin"（含"notin校验包"规则包，关联 test_db.quality_test_num）
  // 该规则集已通过手动或脚本创建完成

  test("验证在规则集中枚举值选择not in后保存成功且编辑时回显正确", async ({
    page,
    step,
  }) => {
    const url = buildDataAssetsUrl("/dq/ruleSet");

    // 步骤1：进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成
    await step(
      "步骤1: 进入规则集管理页面 → 规则集管理页面打开，列表显示已有规则集数据行",
      async () => {
        await applyRuntimeCookies(page);
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        const tableRow = page.locator(".ant-table-row").first();
        await expect(tableRow).toBeVisible({ timeout: 15000 });
      },
      page.locator(".ant-table-tbody"),
    );

    // 步骤2：找到 "ruleset_15695_notin"，点击编辑，新增取值范围&枚举范围规则，配置枚举值 not in 4、5
    await step(
      "步骤2: 找到 ruleset_15695_notin 点击编辑，新增规则配置枚举值 not in 4,5 → Step2 打开，枚举值操作符支持 in/not in 切换，当前显示 not in",
      async () => {
        const targetRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "ruleset_15695_notin" })
          .first();
        await expect(targetRow).toBeVisible({ timeout: 10000 });

        await targetRow.getByRole("button", { name: "编辑" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 验证进入 Step2 监控规则
        await expect(page.getByText("notin校验包")).toBeVisible({ timeout: 10000 });

        // 点击新增规则
        await page.getByRole("button", { name: "新增规则" }).click();
        await page.waitForTimeout(1000);

        // 选择统计函数: 取值范围&枚举范围
        const statFuncSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /统计函数|规则类型/ })
          .locator(".ant-select")
          .first();
        await statFuncSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("取值范围&枚举范围", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 选择字段: category
        const fieldSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: "字段" })
          .last()
          .locator(".ant-select")
          .first();
        await fieldSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("category", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 取值范围设置：不填写，保持为空

        // 枚举值操作符：切换为 not in
        const enumOpSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator(".ant-select")
          .first();
        await enumOpSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(300);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("not in", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(300);

        // 验证当前操作符显示为 not in
        await expect(enumOpSelect).toContainText("not in");

        // 输入枚举值: 4, 5
        const enumInput = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator("input")
          .last();
        await enumInput.fill("4");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await enumInput.fill("5");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);

        // 验证 Step2 关联表信息
        await expect(page.getByText("test_db.quality_test_num", { exact: false })).toBeVisible({
          timeout: 5000,
        });
      },
      page.getByText("notin校验包"),
    );

    // 步骤3：保存规则集，保存成功后重新进入编辑页验证回显
    await step(
      "步骤3: 保存规则集后重新进入编辑页 → 枚举值列显示 not in '4,5'，回显操作符为 not in，枚举值回显 4、5",
      async () => {
        // 点击规则行保存
        await page.getByRole("button", { name: "保存" }).first().click();
        await page.waitForTimeout(1000);

        // 点击页面底部保存
        await page.getByRole("button", { name: "保存" }).last().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1500);

        // 验证保存成功提示
        const successMsg = page.locator(
          ".ant-message-notice, .ant-notification-notice",
        );
        await expect(
          successMsg.filter({ hasText: /成功/ }).first(),
        ).toBeVisible({ timeout: 5000 });

        // 验证规则列表中枚举值列显示 not in '4,5'
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });
        await expect(ruleRow).toContainText("not in");
        await expect(ruleRow).toContainText("4,5");

        // 重新进入编辑页验证回显
        const targetRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "ruleset_15695_notin" })
          .first();
        await targetRow.getByRole("button", { name: "编辑" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 找到已保存的取值范围&枚举范围规则行的编辑态
        // 验证枚举值操作符回显为 not in
        const savedEnumOpSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator(".ant-select")
          .first();
        await expect(savedEnumOpSelect).toContainText("not in");

        // 验证枚举值回显 4 和 5
        const enumTags = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator(".ant-tag, .ant-select-selection-item");
        await expect(enumTags.filter({ hasText: "4" }).first()).toBeVisible();
        await expect(enumTags.filter({ hasText: "5" }).first()).toBeVisible();
      },
      page.locator(".ant-table-row").filter({ hasText: "取值范围&枚举范围" }).first(),
    );
  });
});
