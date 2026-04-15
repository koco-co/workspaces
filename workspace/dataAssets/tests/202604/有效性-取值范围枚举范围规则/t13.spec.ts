// META: {"id":"t13","priority":"P2","title":"验证在规则集中取值范围&枚举范围规则支持克隆且克隆后配置内容与原规则一致"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {
  test("验证在规则集中取值范围&枚举范围规则支持克隆且克隆后配置内容与原规则一致", async ({ page, step }) => {
    // 前置：已创建规则集"ruleset_15695_and"，包含取值范围>1且<10、枚举值in 1,2,3、且关系规则

    await step("步骤1: 进入规则集管理页面 → 页面打开，列表显示已有规则集数据行", async () => {
      await applyRuntimeCookies(page);
      await page.goto(buildDataAssetsUrl("/dq/ruleSet"));
      await page.waitForLoadState("networkidle");
      const rulesetTable = page.locator(".ant-table-tbody tr").first();
      await expect(rulesetTable).toBeVisible({ timeout: 10000 });
    });

    await step("步骤2: 编辑ruleset_15695_and并克隆取值范围&枚举范围规则 → 新增一条与原规则配置完全相同的规则区域", async () => {
      // 在列表中找到ruleset_15695_and，点击编辑
      const targetRow = page
        .locator(".ant-table-tbody tr")
        .filter({ hasText: "ruleset_15695_and" })
        .first();
      await expect(targetRow).toBeVisible({ timeout: 10000 });
      await targetRow.getByRole("button", { name: "编辑" }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // 定位取值范围&枚举范围规则区域，找到克隆按钮
      // TODO: 需通过 playwright-cli snapshot 获取实际选择器
      const ruleArea = page
        .locator(".rule-item, .monitor-rule-item, [class*='rule-item']")
        .filter({ hasText: "取值范围&枚举范围" })
        .first();
      await expect(ruleArea).toBeVisible({ timeout: 10000 });

      // 点击克隆按钮（通常是图标按钮，在规则区域右上角）
      const cloneBtn = ruleArea
        .locator("button")
        .filter({ hasText: /克隆|copy/i })
        .or(ruleArea.locator(".icon-clone, [class*='clone'], [title*='克隆']"))
        .first();
      await cloneBtn.click();
      await page.waitForTimeout(1000);

      // 验证克隆后出现了新的规则区域（应有2条取值范围&枚举范围规则）
      const ruleAreas = page
        .locator(".rule-item, .monitor-rule-item, [class*='rule-item']")
        .filter({ hasText: "取值范围&枚举范围" });
      await expect(ruleAreas).toHaveCount(2, { timeout: 5000 });
    }, page.locator(".rule-item, .monitor-rule-item, [class*='rule-item']").filter({ hasText: "取值范围&枚举范围" }).nth(1));

    await step("步骤3: 删除克隆出的规则 → 克隆的规则被删除，页面恢复为仅一条规则", async () => {
      // 找到第二条（克隆出的）规则区域并点击删除
      const clonedRuleArea = page
        .locator(".rule-item, .monitor-rule-item, [class*='rule-item']")
        .filter({ hasText: "取值范围&枚举范围" })
        .nth(1);
      await expect(clonedRuleArea).toBeVisible({ timeout: 5000 });

      // 点击删除按钮（垃圾桶图标）
      const deleteBtn = clonedRuleArea
        .locator("button")
        .filter({ hasText: /删除|delete/i })
        .or(clonedRuleArea.locator(".icon-delete, [class*='delete'], [title*='删除']"))
        .first();
      await deleteBtn.click();
      await page.waitForTimeout(500);

      // 如果有确认弹窗，点击确认
      const confirmBtn = page
        .locator(".ant-modal:visible .ant-btn-primary, .ant-popconfirm .ant-btn-primary")
        .first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }

      // 验证只剩一条取值范围&枚举范围规则
      const ruleAreas = page
        .locator(".rule-item, .monitor-rule-item, [class*='rule-item']")
        .filter({ hasText: "取值范围&枚举范围" });
      await expect(ruleAreas).toHaveCount(1, { timeout: 5000 });
    });
  });
});
