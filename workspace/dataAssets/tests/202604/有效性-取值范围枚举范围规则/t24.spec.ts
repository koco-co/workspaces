// META: {"id":"t24","priority":"P1","title":"验证取值范围&枚举范围规则校验「通过时不记录」明细数据且操作列不显示查看详情"}
import { expect, test } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl, navigateViaMenu } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 校验结果查询", () => {
  test("验证取值范围&枚举范围规则校验「通过时不记录」明细数据且操作列不显示查看详情", async ({
    page,
    step,
  }) => {
    // 前置：规则任务 task_15695_or 已执行完成，或关系下全部记录均满足，校验结果为通过

    // 步骤1：进入校验结果查询页面
    await step(
      "步骤1: 进入【数据质量 → 校验结果查询】页面 → 校验结果查询页面打开，列表显示已有任务记录",
      async () => {
        await applyRuntimeCookies(page);
        await page.goto(buildDataAssetsUrl("/dq/rule"));
        await page.waitForLoadState("networkidle");
        await navigateViaMenu(page, ["数据质量", "校验结果查询"]);
        const tableRows = page.locator(".ant-table-row");
        await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
      },
    );

    // 步骤2：找到 task_15695_or 最新实例记录，点击【查看详情】打开实例详情
    await step(
      "步骤2: 找到 task_15695_or 最新实例记录，点击【查看详情】打开实例详情 → 实例详情页面打开，取值范围&枚举范围规则行数据加载完成",
      async () => {
        const taskRow = page.locator(".ant-table-row").filter({ hasText: "task_15695_or" }).first();
        await expect(taskRow).toBeVisible({ timeout: 10000 });
        await taskRow.getByText("查看详情").first().click();
        await page.waitForLoadState("networkidle");

        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });
      },
      page.locator(".ant-table-row").filter({ hasText: "取值范围&枚举范围" }).first(),
    );

    // 步骤3：验证质检结果、详情说明、操作列内容
    await step(
      "步骤3: 查看规则行的质检结果列、详情说明列和操作列 → 质检结果为「校验通过」，详情说明含规则描述，操作列显示 --",
      async () => {
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();

        // 验证质检结果列显示「校验通过」
        await expect(ruleRow).toContainText("校验通过", { timeout: 5000 });

        // 验证详情说明列包含或关系规则描述
        await expect(ruleRow).toContainText("取值范围>1", { timeout: 5000 });
        await expect(ruleRow).toContainText("枚举值in '-1'", { timeout: 5000 });

        // 验证操作列不显示【查看详情】链接，只显示 --
        const detailLink = ruleRow.getByText("查看详情");
        await expect(detailLink).not.toBeVisible({ timeout: 5000 });

        const dashText = ruleRow.getByText("--");
        await expect(dashText.first()).toBeVisible({ timeout: 5000 });
      },
      page.locator(".ant-table-row").filter({ hasText: "取值范围&枚举范围" }).first(),
    );
  });
});
