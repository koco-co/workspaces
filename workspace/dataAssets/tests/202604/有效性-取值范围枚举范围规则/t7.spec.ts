// META: {"id":"t7","priority":"P1","title":"验证string类型字段在规则集中配置取值范围&枚举范围规则时系统可正常保存"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl, selectAntOption } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

// 前置条件（需手动执行 SQL 或确认表已存在）：
// DROP TABLE IF EXISTS test_db.quality_test_str;
// CREATE TABLE test_db.quality_test_str (
//   id INT NOT NULL, score_str VARCHAR(50), category VARCHAR(50)
// ) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num"="1");
// INSERT INTO test_db.quality_test_str VALUES
//   (1, '5', '2'), (2, '5.0', '4'), (3, '15.0', '1'), (4, 'abc', '3'), (5, '-1.0', '5');

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {

  test("验证string类型字段在规则集中配置取值范围&枚举范围规则时系统可正常保存", async ({ page, step }) => {
    // 前置：ruleset_15695_str 已通过数据准备阶段创建（含 string强转包）

    await step("步骤1: 进入规则集管理页面，等待列表加载完成 → 规则集管理页面打开，列表显示已有规则集数据行", async () => {
      await applyRuntimeCookies(page);
      await page.goto(buildDataAssetsUrl("/dq/ruleSet"));
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      const tableRows = page.locator(".ant-table-row");
      await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    });

    await step("步骤2: 找到ruleset_15695_str，点击编辑按钮进入Step2，新增取值范围&枚举范围规则并填写字段 → 规则配置区域展开，score_str可被选中", async () => {
      const targetRow = page.locator(".ant-table-row").filter({ hasText: "ruleset_15695_str" }).first();
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

      // 选择字段：score_str
      const fieldSelect = page.locator(".ant-select").filter({ hasText: /字段|请选择字段/ }).first();
      await selectAntOption(page, fieldSelect, "score_str");

      const ruleArea = page.locator(".ant-form, .rule-config-area").first();
      await expect(ruleArea).toBeVisible({ timeout: 5000 });
    }, page.locator(".ant-form, .rule-config-area").first());

    await step("步骤3: 填写取值范围>1 且 <10、枚举值in 5、5.5、15、关系选且、强规则，点击保存 → 规则保存成功，string类型字段可正常配置", async () => {
      // 取值范围第一个条件：操作符选 >，期望值填 1
      const rangeRow = page.locator(".ant-form-item").filter({ hasText: /取值范围/ }).first();
      const rangeOpSelect = rangeRow.locator(".ant-select").first();
      await selectAntOption(page, rangeOpSelect, ">");
      const rangeInput = rangeRow.locator("input[type='text'], input[type='number']").first();
      await rangeInput.fill("1");

      // 取值范围第二个条件：操作符选 <，期望值填 10
      const rangeOp2 = rangeRow.locator(".ant-select").nth(1);
      await selectAntOption(page, rangeOp2, "<");
      const rangeInput2 = rangeRow.locator("input[type='text'], input[type='number']").nth(1);
      await rangeInput2.fill("10");

      // 枚举值设置：操作符选 in，输入 5、5.5、15
      const enumRow = page.locator(".ant-form-item").filter({ hasText: /枚举值/ }).first();
      const enumOpSelect = enumRow.locator(".ant-select").first();
      await selectAntOption(page, enumOpSelect, "in");
      const enumInput = enumRow.locator("input").last();
      await enumInput.fill("5");
      await page.keyboard.press("Enter");
      await enumInput.fill("5.5");
      await page.keyboard.press("Enter");
      await enumInput.fill("15");
      await page.keyboard.press("Enter");

      // 关系选且
      await page.locator(".ant-radio-wrapper").filter({ hasText: "且" }).click();

      // 点击规则行保存
      await page.getByRole("button", { name: "保存" }).first().click();
      await page.waitForTimeout(1000);

      // 点击页面底部保存
      await page.getByRole("button", { name: "保存" }).last().click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    });

    await step("步骤4: 验证规则保存成功，string类型字段可正常配置取值范围&枚举范围规则 → 列表中显示对应规则", async () => {
      const successMsg = page.locator(".ant-message-notice, .ant-notification-notice");
      const ruleRow = page.locator(".ant-table-row").filter({ hasText: "score_str" }).first();
      await expect(
        successMsg.filter({ hasText: /成功/ }).first().or(ruleRow)
      ).toBeVisible({ timeout: 8000 });
    }, page.locator(".ant-table-row").filter({ hasText: "score_str" }).first());
  });
});
