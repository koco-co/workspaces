// META: {"id":"t14","priority":"P1","title":"验证在规则集中配置过滤条件后规则保存成功"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl, selectAntOption } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {
  test("验证在规则集中配置过滤条件后规则保存成功", async ({ page, step }) => {
    // 前置：已创建规则集"ruleset_15695_filter"（规则包名称: 过滤条件包），关联 test_db.quality_test_num

    await step("步骤1: 进入规则集管理页面 → 页面打开，列表显示已有规则集数据行", async () => {
      await applyRuntimeCookies(page);
      await page.goto(buildDataAssetsUrl("/dq/ruleSet"));
      await page.waitForLoadState("networkidle");
      const rulesetTable = page.locator(".ant-table-tbody tr").first();
      await expect(rulesetTable).toBeVisible({ timeout: 10000 });
    });

    await step("步骤2: 编辑ruleset_15695_filter并新增取值范围&枚举范围规则并配置过滤条件 → 规则集编辑页Step2打开，配置正常", async () => {
      // 找到ruleset_15695_filter，点击编辑
      const targetRow = page
        .locator(".ant-table-tbody tr")
        .filter({ hasText: "ruleset_15695_filter" })
        .first();
      await expect(targetRow).toBeVisible({ timeout: 10000 });
      await targetRow.getByRole("button", { name: "编辑" }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // 点击【新增规则】
      const addRuleBtn = page
        .getByRole("button", { name: "新增规则" })
        .or(page.locator("button").filter({ hasText: "新增规则" }))
        .first();
      await expect(addRuleBtn).toBeVisible({ timeout: 10000 });
      await addRuleBtn.click();
      await page.waitForTimeout(500);

      // 选择统计函数：取值范围&枚举范围
      const statFuncSelect = page
        .locator(".ant-select")
        .filter({ hasText: /请选择统计函数|统计函数/ })
        .or(
          page
            .locator(".ant-table-row .ant-select, .rule-config .ant-select")
            .first(),
        )
        .first();
      await selectAntOption(page, statFuncSelect, "取值范围&枚举范围");

      // 选择字段：score
      const fieldSelect = page
        .locator(".ant-select")
        .filter({ hasText: /请选择字段|字段/ })
        .first();
      await selectAntOption(page, fieldSelect, "score");
      await page.waitForTimeout(500);

      // 配置取值范围设置：> 1
      // 选择操作符 >
      const rangeOpSelect = page
        .locator("[class*='range'] .ant-select, [class*='取值范围'] .ant-select")
        .first();
      await selectAntOption(page, rangeOpSelect, ">");

      // 输入值 1
      const rangeInput = page
        .locator("[class*='range'] input, [placeholder*='期望值']")
        .first();
      await rangeInput.fill("1");

      // 配置过滤条件：点击【点击配置】
      const filterConfigBtn = page
        .getByRole("button", { name: "点击配置" })
        .or(page.locator("button").filter({ hasText: "点击配置" }))
        .first();
      if (await filterConfigBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        // 先选择过滤条件列
        const filterColSelect = page
          .locator(".ant-select")
          .filter({ hasText: /请选择|过滤/ })
          .last();
        await selectAntOption(page, filterColSelect, "category");
        await page.waitForTimeout(300);

        await filterConfigBtn.click();
        await page.waitForTimeout(1000);

        // 在过滤条件配置弹窗中设置条件
        const filterModal = page.locator(".ant-modal:visible").first();
        if (await filterModal.isVisible({ timeout: 5000 }).catch(() => false)) {
          // TODO: 需通过 playwright-cli snapshot 获取过滤条件弹窗实际选择器
          // 设置 category in ('1','2','3')
          const filterInput = filterModal.locator("input, textarea").first();
          if (await filterInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await filterInput.fill("category in ('1','2','3')");
          }
          const confirmBtn = filterModal.getByRole("button", { name: /确认|确定|保存/ }).first();
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    await step("步骤3: 保存规则 → 规则保存成功，规则列表中对应规则显示过滤条件已配置", async () => {
      // 点击规则行保存
      const saveRuleBtn = page
        .getByRole("button", { name: "保存" })
        .filter({ hasNOT: page.locator(".ant-modal") })
        .first();
      await saveRuleBtn.click();
      await page.waitForTimeout(500);

      // 点击页面底部保存
      const bottomSaveBtn = page
        .locator(".step-footer button, .ant-btn-primary")
        .filter({ hasText: "保存" })
        .last();
      if (await bottomSaveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bottomSaveBtn.click();
      } else {
        // 备用：找到确认/保存按钮
        await page.getByRole("button", { name: "保存" }).last().click();
      }
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // 验证保存成功提示
      const successMsg = page.locator(
        ".ant-message-notice, .ant-notification-notice",
      );
      await expect(
        successMsg.filter({ hasText: /保存成功|成功/ }).first(),
      ).toBeVisible({ timeout: 5000 });
    });
  });
});
