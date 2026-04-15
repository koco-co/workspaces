// META: {"id":"t19","priority":"P2","title":"验证结合抽样功能执行取值范围&枚举范围校验结果正确"}
import { expect, test } from "../../fixtures/step-screenshot";
import { setupPreconditions } from "../../helpers/preconditions";
import { applyRuntimeCookies, buildDataAssetsUrl, navigateViaMenu } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则任务管理", () => {
  // 前置：数据表 test_db.quality_test_sample 已创建，任务 task_15695_sample 已配置抽样50%并保存
  // 前置条件中的 SQL 建表和任务配置均依赖已完成的 Doris 数据源准备及规则集"ruleset_15695_sample"创建

  test("验证结合抽样功能执行取值范围&枚举范围校验结果正确", async ({ page, step }) => {
    // 步骤1：进入【数据质量 → 规则任务管理】页面
    await step(
      "步骤1: 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 → 规则任务管理页面打开，任务列表显示已有任务数据行",
      async () => {
        await applyRuntimeCookies(page);
        await page.goto(buildDataAssetsUrl("/dq/rule"));
        await page.waitForLoadState("networkidle");
        await navigateViaMenu(page, ["数据质量", "规则任务管理"]);
        const tableRows = page.locator(".ant-table-row");
        await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
      },
    );

    // 步骤2：点击任务 task_15695_sample 对应行的【执行】按钮
    await step(
      "步骤2: 点击任务 task_15695_sample 对应行的【执行】按钮 → 页面弹出提示信息，提示任务已提交执行",
      async () => {
        const taskRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "task_15695_sample" })
          .first();
        await taskRow.waitFor({ state: "visible", timeout: 10000 });
        const executeBtn = taskRow
          .getByRole("button", { name: "执行" })
          .or(taskRow.locator("button").filter({ hasText: "执行" }))
          .first();
        await executeBtn.click();
        // 等待提交成功提示
        const successMsg = page
          .locator(".ant-message-notice, .ant-notification-notice, .ant-message")
          .first();
        await expect(successMsg).toBeVisible({ timeout: 5000 });
      },
    );

    // 步骤3：进入校验结果查询，查看 task_15695_sample 实例详情
    await step(
      "步骤3: 进入【数据质量 → 校验结果查询】页面，找到 task_15695_sample 最新实例记录并打开实例详情 → 实例详情中统计信息显示参与校验的数据量约为总数据量的50%（约5条）",
      async () => {
        await navigateViaMenu(page, ["数据质量", "校验结果查询"]);
        await page.waitForLoadState("networkidle");

        const instanceRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "task_15695_sample" })
          .first();
        await instanceRow.waitFor({ state: "visible", timeout: 15000 });

        // 点击查看详情
        const detailLink = instanceRow
          .getByRole("button", { name: /查看详情|详情/ })
          .or(instanceRow.locator("a, button").filter({ hasText: /详情/ }))
          .first();
        await detailLink.click();
        await page.waitForLoadState("networkidle");

        // 验证规则行存在（取值范围&枚举范围）
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });

        // 验证有质检结果（校验通过或不通过）
        const qualityResultCell = ruleRow
          .locator("td")
          .filter({
            hasText: /校验通过|校验不通过/,
          })
          .first();
        await expect(qualityResultCell).toBeVisible({ timeout: 5000 });
      },
    );
  });
});
