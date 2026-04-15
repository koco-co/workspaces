// META: {"id":"t26","priority":"P1","title":"验证仅配置枚举值in校验不通过时质量报告详情说明包含越界值数量统计"}
import { test, expect } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl, navigateViaMenu } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 数据质量报告", () => {
  test("验证仅配置枚举值in校验不通过时质量报告详情说明包含越界值数量统计", async ({ page, step }) => {
    // 前置：任务 task_15695_enum_fail 已执行完成，校验结果为不通过
    // 前置：category 字段不在枚举值 '1,2,3' 内的数据：id=2(category=4)、id=5(category=5)，共 2 条越界

    // 步骤1：进入数据质量报告页面
    await step("步骤1: 进入【数据质量 → 数据质量报告】页面 → 质量报告页面打开，报告列表加载完成", async () => {
      await applyRuntimeCookies(page);
      await page.goto(buildDataAssetsUrl("/dq/rule"));
      await page.waitForLoadState("networkidle");
      await navigateViaMenu(page, ["数据质量", "数据质量报告"]);
      const tableRows = page.locator(".ant-table-row");
      await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    });

    // 步骤2：找到 task_15695_enum_fail 对应枚举值规则行，查看详情说明列
    await step("步骤2: 找到任务 task_15695_enum_fail 对应的枚举值规则行，查看详情说明列内容 → 详情说明含越界值数量统计「约定范围外的值的数量总计为2个」", async () => {
      const taskRow = page.locator(".ant-table-row").filter({ hasText: "task_15695_enum_fail" }).first();
      await expect(taskRow).toBeVisible({ timeout: 10000 });

      // 验证详情说明列包含越界值存在说明
      await expect(taskRow).toContainText("字段枚举值存在约定范围外的值", { timeout: 5000 });

      // 验证越界值数量统计准确（2个越界）
      await expect(taskRow).toContainText("约定范围外的值的数量总计为2个", { timeout: 5000 });

      // 验证规则描述包含枚举值 in '1,2,3'
      await expect(taskRow).toContainText("枚举值in '1,2,3'", { timeout: 5000 });

      // 验证操作列显示【查看详情】链接
      const detailLink = taskRow.getByText("查看详情");
      await expect(detailLink).toBeVisible({ timeout: 5000 });
    }, page.locator(".ant-table-row").filter({ hasText: "task_15695_enum_fail" }).first());
  });
});
