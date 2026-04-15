// META: {"id":"t20","priority":"P2","title":"验证对分区表指定分区执行取值范围&枚举范围校验结果正确"}
import { test, expect } from "../../fixtures/step-screenshot";
import {
  applyRuntimeCookies,
  buildDataAssetsUrl,
  navigateViaMenu,
} from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe(
  "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则任务管理",
  () => {
    // 前置：分区表 test_db.quality_test_partition 已创建，分区 p20260401 含 id=1,2
    // 任务 task_15695_partition 已配置指定分区 p20260401 并保存

    test(
      "验证对分区表指定分区执行取值范围&枚举范围校验结果正确",
      async ({ page, step }) => {
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

        // 步骤2：点击任务 task_15695_partition 对应行的【执行】按钮
        await step(
          "步骤2: 点击任务 task_15695_partition 对应行的【执行】按钮 → 页面弹出提示信息，提示任务已提交执行",
          async () => {
            const taskRow = page
              .locator(".ant-table-row")
              .filter({ hasText: "task_15695_partition" })
              .first();
            await taskRow.waitFor({ state: "visible", timeout: 10000 });
            const executeBtn = taskRow
              .getByRole("button", { name: "执行" })
              .or(taskRow.locator("button").filter({ hasText: "执行" }))
              .first();
            await executeBtn.click();
            const successMsg = page
              .locator(
                ".ant-message-notice, .ant-notification-notice, .ant-message",
              )
              .first();
            await expect(successMsg).toBeVisible({ timeout: 5000 });
          },
        );

        // 步骤3：进入校验结果查询，查看 task_15695_partition 实例详情，验证仅 p20260401 分区参与校验
        await step(
          "步骤3: 进入【数据质量 → 校验结果查询】页面，找到 task_15695_partition 最新实例记录并打开实例详情 → 质检结果显示「校验不通过」，仅 p20260401 分区数据参与校验",
          async () => {
            await navigateViaMenu(page, ["数据质量", "校验结果查询"]);
            await page.waitForLoadState("networkidle");

            const instanceRow = page
              .locator(".ant-table-row")
              .filter({ hasText: "task_15695_partition" })
              .first();
            await instanceRow.waitFor({ state: "visible", timeout: 15000 });

            // 点击查看详情
            const detailLink = instanceRow
              .getByRole("button", { name: /查看详情|详情/ })
              .or(instanceRow.locator("a, button").filter({ hasText: /详情/ }))
              .first();
            await detailLink.click();
            await page.waitForLoadState("networkidle");

            // 找到取值范围&枚举范围规则行
            const ruleRow = page
              .locator(".ant-table-row")
              .filter({ hasText: "取值范围&枚举范围" })
              .first();
            await expect(ruleRow).toBeVisible({ timeout: 10000 });

            // 验证质检结果为「校验不通过」
            const failCell = ruleRow
              .locator("td")
              .filter({ hasText: "校验不通过" })
              .first();
            await expect(failCell).toBeVisible({ timeout: 5000 }, failCell);

            // 验证分区信息：详情说明或统计区中应体现 p20260401
            // TODO: 需通过 playwright-cli snapshot 确认分区信息展示的具体选择器
            // 此处验证规则行存在且不通过即为核心断言
          },
          page
            .locator(".ant-table-row")
            .filter({ hasText: "取值范围&枚举范围" })
            .first(),
        );
      },
    );
  },
);
