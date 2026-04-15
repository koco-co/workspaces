// META: {"id":"t1","priority":"P0","title":"验证在规则集中按完整顺序新建取值范围&枚举范围且关系规则（数值类型字段）"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

// 前置条件（需手动执行 SQL 或确认表已存在）：
// DROP TABLE IF EXISTS test_db.quality_test_num;
// CREATE TABLE test_db.quality_test_num (
//   id INT NOT NULL, score DOUBLE, category VARCHAR(50)
// ) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num"="1");
// INSERT INTO test_db.quality_test_num VALUES
//   (1, 5.0, '2'), (2, 15.0, '4'), (3, 3.0, '1'), (4, -1.0, '3'), (5, 8.0, '5');

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {

  test("验证在规则集中按完整顺序新建取值范围&枚举范围且关系规则（数值类型字段）", async ({
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

    // 步骤2：点击【新建规则集】，在 Step 1 基础信息中填写并点击【下一步】
    await step(
      "步骤2: 点击新建规则集，填写 Step1 基础信息后点击下一步 → 进入 Step2 监控规则页面",
      async () => {
        await page.getByRole("button", { name: "新建规则集" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 选择数据源: Doris
        const datasourceFormItem = page
          .locator(".ant-form-item")
          .filter({ hasText: "选择数据源" })
          .first();
        const datasourceSelect = datasourceFormItem.locator(".ant-select").first();
        await datasourceSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("Doris", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 选择数据库: test_db
        const databaseFormItem = page
          .locator(".ant-form-item")
          .filter({ hasText: "选择数据库" })
          .first();
        const databaseSelect = databaseFormItem.locator(".ant-select").first();
        await databaseSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("test_db", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 选择数据表: quality_test_num
        const tableFormItem = page
          .locator(".ant-form-item")
          .filter({ hasText: "选择数据表" })
          .first();
        const tableSelect = tableFormItem.locator(".ant-select").first();
        await tableSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("quality_test_num", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 填写规则包名称: 且关系校验包
        const rulePackNameInput = page
          .locator(".ant-form-item")
          .filter({ hasText: "规则包名称" })
          .locator("input")
          .first();
        await rulePackNameInput.fill("且关系校验包");

        // 点击下一步
        await page.getByRole("button", { name: "下一步" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 验证进入 Step2 监控规则页面
        const step2Indicator = page
          .locator(".ant-steps-item-active, .step-active, [class*='step']")
          .filter({ hasText: /监控规则|Step.?2/i });
        // TODO: 需通过 playwright-cli snapshot 获取 Step2 的实际选择器
        await expect(page.getByRole("button", { name: "新增规则" })).toBeVisible({
          timeout: 10000,
        });
      },
      page.getByRole("button", { name: "新增规则" }),
    );

    // 步骤3：在规则包"且关系校验包"下新增规则，统计函数选择【取值范围&枚举范围】，并填写规则配置
    await step(
      "步骤3: 新增取值范围&枚举范围规则并填写配置 → 规则配置区域展开正常，各字段可正常录入",
      async () => {
        // 点击新增规则
        await page.getByRole("button", { name: "新增规则" }).click();
        await page.waitForTimeout(1000);

        // 选择统计函数: 取值范围&枚举范围
        const statFuncFormItem = page
          .locator(".ant-form-item")
          .filter({ hasText: /统计函数|规则类型/ })
          .first();
        const statFuncSelect = statFuncFormItem.locator(".ant-select").first();
        await statFuncSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("取值范围&枚举范围", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 选择字段: score
        const fieldFormItem = page
          .locator(".ant-form-item")
          .filter({ hasText: "字段" })
          .last();
        const fieldSelect = fieldFormItem.locator(".ant-select").first();
        await fieldSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(500);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("score", { exact: false })
          .first()
          .click();
        await page.waitForTimeout(500);

        // 取值范围设置: > 1
        // 第一个取值范围行：选择操作符 > 并输入 1
        // TODO: 需通过 playwright-cli snapshot 确认取值范围操作符选择器
        const rangeRows = page.locator("[class*='range-row'], [class*='rangeRow']");
        // 操作符1: >
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

        // 期望值1: 1
        const rangeInput1 = page
          .locator(".ant-form-item")
          .filter({ hasText: /取值范围/ })
          .locator("input[type='text'], input[type='number']")
          .first();
        await rangeInput1.fill("1");
        await page.waitForTimeout(300);

        // 操作符2: <，期望值 10
        const rangeOp2Select = page
          .locator(".ant-form-item")
          .filter({ hasText: /取值范围/ })
          .locator(".ant-select")
          .nth(1);
        await rangeOp2Select.locator(".ant-select-selector").click();
        await page.waitForTimeout(300);
        await page
          .locator(".ant-select-dropdown:visible")
          .getByText("<", { exact: true })
          .first()
          .click();
        await page.waitForTimeout(300);

        const rangeInput2 = page
          .locator(".ant-form-item")
          .filter({ hasText: /取值范围/ })
          .locator("input[type='text'], input[type='number']")
          .nth(1);
        await rangeInput2.fill("10");
        await page.waitForTimeout(300);

        // 枚举值设置: in 操作符（默认），输入 1、2、3
        // 枚举值 in/not in 操作符默认应为 in，验证下拉框可见
        const enumOpSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /枚举值/ })
          .locator(".ant-select")
          .first();
        await expect(enumOpSelect).toBeVisible({ timeout: 5000 });

        // 输入枚举值: 1, 2, 3 (每个值回车确认)
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

        // 取值范围和枚举值关系: 且
        const relationFormItem = page
          .locator(".ant-form-item")
          .filter({ hasText: /关系/ });
        const andRadio = relationFormItem
          .locator(".ant-radio-button-wrapper")
          .filter({ hasText: "且" })
          .first();
        await andRadio.click();
        await page.waitForTimeout(300);

        // 验证枚举值操作符下拉框显示 in 和 not in 选项
        await enumOpSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(300);
        const dropdown = page.locator(".ant-select-dropdown:visible");
        await expect(dropdown.getByText("in", { exact: true })).toBeVisible();
        await expect(dropdown.getByText("not in", { exact: false })).toBeVisible();
        // 关闭下拉框
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      },
      page.locator(".ant-form-item").filter({ hasText: /枚举值/ }).first(),
    );

    // 步骤4：点击规则行【保存】，再点击页面底部【保存】完成规则集创建
    await step(
      "步骤4: 保存规则并完成规则集创建 → 规则集保存成功，规则列表显示正确信息",
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

        // 验证规则列表中对应规则信息
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });
        await expect(ruleRow).toContainText("score");
      },
      page.locator(".ant-table-row").filter({ hasText: "取值范围&枚举范围" }).first(),
    );
  });
});
