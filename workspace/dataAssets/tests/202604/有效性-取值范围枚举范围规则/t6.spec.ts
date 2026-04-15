// META: {"id":"t6","priority":"P1","title":"验证原有枚举值规则同步新增in/not in选项且保存后回显正确"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  // 前置：已存在规则集 "ruleset_15695_enum_orig"（含"原枚举值包"规则包，关联 test_db.quality_test_num）
  // 该规则集已通过手动或脚本创建完成

  test("验证原有枚举值规则同步新增in/not in选项且保存后回显正确", async ({
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

    // 步骤2：找到 "ruleset_15695_enum_orig"，点击编辑，新增规则选择原有【枚举值】规则类型，查看枚举值下拉框选项
    await step(
      "步骤2: 找到 ruleset_15695_enum_orig 点击编辑，新增规则选择原有枚举值规则类型，查看下拉框选项 → 枚举值设置下拉框包含 in 和 not in，默认显示 in",
      async () => {
        const targetRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "ruleset_15695_enum_orig" })
          .first();
        await expect(targetRow).toBeVisible({ timeout: 10000 });

        await targetRow.getByRole("button", { name: "编辑" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 验证进入 Step2 监控规则
        await expect(page.getByText("原枚举值包")).toBeVisible({ timeout: 10000 });

        // 点击新增规则
        await page.getByRole("button", { name: "新增规则" }).click();
        await page.waitForTimeout(1000);

        // 选择统计函数: 枚举值（原有规则类型，非取值范围&枚举范围）
        const statFuncSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /统计函数|规则类型/ })
          .locator(".ant-select")
          .first();
        await statFuncSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        // 注意：此处选择原有的【枚举值】规则类型，而非【取值范围&枚举范围】
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("枚举值", { exact: true })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 查看枚举值设置行中下拉框选项，验证包含 in 和 not in
        const enumOpSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值设置|枚举值/ })
          .locator(".ant-select")
          .first();
        await expect(enumOpSelect).toBeVisible({ timeout: 5000 });

        // 验证默认显示 in
        await expect(enumOpSelect).toContainText("in");

        // 展开下拉框验证选项
        await enumOpSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(300);
        const dropdown = page.locator(".ant-select-dropdown:visible");
        await expect(dropdown.getByText("in", { exact: true })).toBeVisible();
        await expect(dropdown.getByText("not in", { exact: false })).toBeVisible();
        // 关闭下拉框
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      },
      page.locator(".ant-form-item").filter({ hasText: /枚举值设置|枚举值/ }).first(),
    );

    // 步骤3：选择 not in，填写字段和枚举值，保存后重新进入验证回显
    await step(
      "步骤3: 选择 not in，填写 category 字段和枚举值 4、5，保存后重新进入验证回显 → 枚举值列显示 not in '4,5'，回显操作符为 not in，枚举值回显 4、5",
      async () => {
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

        // 枚举值操作符：选择 not in
        const enumOpSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值设置|枚举值/ })
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

        // 验证操作符已切换为 not in
        await expect(enumOpSelect).toContainText("not in");

        // 输入枚举值: 4, 5
        const enumInput = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值设置|枚举值/ })
          .locator("input")
          .last();
        await enumInput.fill("4");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await enumInput.fill("5");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);

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
          .filter({ hasText: /枚举值/ })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });
        await expect(ruleRow).toContainText("not in");
        await expect(ruleRow).toContainText("4,5");

        // 重新进入编辑页验证回显
        const targetRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "ruleset_15695_enum_orig" })
          .first();
        await targetRow.getByRole("button", { name: "编辑" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 验证枚举值操作符回显为 not in
        const savedEnumOpSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值设置|枚举值/ })
          .locator(".ant-select")
          .first();
        await expect(savedEnumOpSelect).toContainText("not in");

        // 验证枚举值信息回显 4 和 5
        const enumTags = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值设置|枚举值/ })
          .locator(".ant-tag, .ant-select-selection-item");
        await expect(enumTags.filter({ hasText: "4" }).first()).toBeVisible();
        await expect(enumTags.filter({ hasText: "5" }).first()).toBeVisible();
      },
      page.locator(".ant-table-row").filter({ hasText: /枚举值/ }).first(),
    );
  });
});
