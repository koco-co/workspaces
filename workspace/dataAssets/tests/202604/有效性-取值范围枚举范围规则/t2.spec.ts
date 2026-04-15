// META: {"id":"t2","priority":"P1","title":"验证在规则集中配置取值范围&枚举范围规则或关系时保存成功"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  // 前置：已存在规则集 "ruleset_15695_or"（含"或关系校验包"规则包，关联 test_db.quality_test_num）
  // 该规则集已通过 t1 或手动创建完成

  test("验证在规则集中配置取值范围&枚举范围规则或关系时保存成功", async ({
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

    // 步骤2：找到 "ruleset_15695_or"，点击编辑，新增取值范围&枚举范围规则，配置或关系
    await step(
      "步骤2: 找到 ruleset_15695_or 点击编辑，新增规则并配置或关系 → Step2 打开，规则包显示或关系校验包",
      async () => {
        // 在列表中找到目标规则集行并点击编辑
        const targetRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "ruleset_15695_or" })
          .first();
        await expect(targetRow).toBeVisible({ timeout: 10000 });

        // 点击编辑按钮
        await targetRow.getByRole("button", { name: "编辑" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 验证进入 Step2 监控规则（规则包名称应显示"或关系校验包"）
        await expect(page.getByText("或关系校验包")).toBeVisible({ timeout: 10000 });

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

        // 选择字段: score
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
          .getByText("score", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 取值范围设置: > 1
        const rangeOp1Select = page
          .locator(".ant-form-item")
          .filter({ hasText: /取值范围/ })
          .locator(".ant-select")
          .first();
        await rangeOp1Select.locator(".ant-select-selector").click();
        await page.waitForTimeout(300);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText(">", { exact: true })
          .first()
          .click();
        await page.waitForTimeout(300);

        const rangeInput1 = page
          .locator(".ant-form-item")
          .filter({ hasText: /取值范围/ })
          .locator("input")
          .first();
        await rangeInput1.fill("1");
        await page.waitForTimeout(300);

        // 枚举值设置: in -1
        // 操作符默认为 in，直接输入枚举值
        const enumInput = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator("input")
          .last();
        await enumInput.fill("-1");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);

        // 取值范围和枚举值关系: 或
        const relationFormItem = page
          .locator(".ant-form-item")
          .filter({ hasText: /关系/ });
        const orRadio = relationFormItem
          .locator(".ant-radio-button-wrapper")
          .filter({ hasText: "或" })
          .first();
        await orRadio.click();
        await page.waitForTimeout(300);

        // 验证规则集编辑页 Step2 打开正常
        await expect(page.getByText("test_db.quality_test_num", { exact: false })).toBeVisible({
          timeout: 5000,
        });
      },
      page.getByText("或关系校验包"),
    );

    // 步骤3：点击【保存】按钮，再点击页面底部【保存】完成规则集保存
    await step(
      "步骤3: 保存规则并完成规则集保存 → 规则保存成功，且或关系列显示「或」",
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

        // 验证规则列表中且或关系列显示「或」
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });
        await expect(ruleRow).toContainText("或");
      },
      page.locator(".ant-table-row").filter({ hasText: "取值范围&枚举范围" }).first(),
    );
  });
});
