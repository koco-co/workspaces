// META: {"id":"t4","priority":"P1","title":"验证在规则集中仅填写枚举值可正常保存"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  // 前置：已存在规则集 "ruleset_15695_enum"（含"仅枚举值包"规则包，关联 test_db.quality_test_num）
  // 该规则集已通过手动或脚本创建完成

  test("验证在规则集中仅填写枚举值可正常保存", async ({ page, step }) => {
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

    // 步骤2：找到 "ruleset_15695_enum"，点击编辑，新增取值范围&枚举范围规则，仅填写枚举值 in 1、2、3
    await step(
      "步骤2: 找到 ruleset_15695_enum 点击编辑，新增规则仅填写枚举值 in 1,2,3 → Step2 打开，枚举值操作符默认回显 in，展开可见 in 和 not in",
      async () => {
        const targetRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "ruleset_15695_enum" })
          .first();
        await expect(targetRow).toBeVisible({ timeout: 10000 });

        await targetRow.getByRole("button", { name: "编辑" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 验证进入 Step2 监控规则
        await expect(page.getByText("仅枚举值包")).toBeVisible({ timeout: 10000 });

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

        // 枚举值设置：验证操作符默认为 in，可展开看到 in 和 not in
        const enumOpSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator(".ant-select")
          .first();
        await expect(enumOpSelect).toBeVisible({ timeout: 5000 });

        // 展开验证选项
        await enumOpSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(300);
        const dropdown = page.locator(".ant-select-dropdown:visible");
        await expect(dropdown.getByText("in", { exact: true })).toBeVisible();
        await expect(dropdown.getByText("not in", { exact: false })).toBeVisible();
        // 选择 in（或保持默认）
        await dropdown.getByText("in", { exact: true }).click();
        await page.waitForTimeout(300);

        // 输入枚举值: 1, 2, 3
        const enumInput = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator("input")
          .last();
        await enumInput.fill("1");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await enumInput.fill("2");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await enumInput.fill("3");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);

        // 验证 Step2 关联表信息
        await expect(page.getByText("test_db.quality_test_num", { exact: false })).toBeVisible({
          timeout: 5000,
        });
      },
      page.getByText("仅枚举值包"),
    );

    // 步骤3：点击【保存】按钮，再点击页面底部【保存】完成规则集保存
    await step(
      "步骤3: 保存规则 → 规则保存成功，枚举值列显示 in '1,2,3'，取值范围列显示 --",
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

        // 验证规则列表中枚举值列显示 in '1,2,3'
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });
        await expect(ruleRow).toContainText("in");
        await expect(ruleRow).toContainText("1,2,3");

        // 验证取值范围列显示 --（无取值范围）
        await expect(ruleRow).toContainText("--");
      },
      page.locator(".ant-table-row").filter({ hasText: "取值范围&枚举范围" }).first(),
    );
  });
});
