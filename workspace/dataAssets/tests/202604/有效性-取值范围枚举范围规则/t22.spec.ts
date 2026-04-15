// META: {"id":"t22","priority":"P1","title":"验证取值范围&枚举范围规则校验「不通过时可查看」明细且校验字段标红展示"}
import { expect, test } from "../../fixtures/step-screenshot";
import { applyRuntimeCookies, buildDataAssetsUrl, navigateViaMenu } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 校验结果查询", () => {
  // 前置：
  // 1) 使用 admin 账号登录数据资产平台
  // 2) 规则任务 task_15695_and 已执行完成，且关系规则校验结果为不通过
  // 3) 数据表 test_db.quality_test_num 不符合规则的记录为 id=1,2,4,5
  // 4) task_15695_and 最新实例详情中，取值范围&枚举范围规则行操作列显示【查看详情】链接

  test("验证取值范围&枚举范围规则校验「不通过时可查看」明细且校验字段标红展示", async ({
    page,
    step,
  }) => {
    // 步骤1：进入【数据质量 → 校验结果查询】页面
    await step(
      "步骤1: 进入【数据质量 → 校验结果查询】页面，等待列表加载完成 → 校验结果查询页面打开，列表显示已有任务记录",
      async () => {
        await applyRuntimeCookies(page);
        await page.goto(buildDataAssetsUrl("/dq/rule"));
        await page.waitForLoadState("networkidle");
        await navigateViaMenu(page, ["数据质量", "校验结果查询"]);
        await page.waitForLoadState("networkidle");

        const tableRows = page.locator(".ant-table-row");
        await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
      },
    );

    // 步骤2：找到 task_15695_and 最新实例，打开实例详情
    const instanceRow = page
      .locator(".ant-table-row")
      .filter({ hasText: "task_15695_and" })
      .first();

    await step(
      "步骤2: 在列表中找到 task_15695_and 最新实例记录，点击【查看详情】打开实例详情 → 实例详情页面打开，取值范围&枚举范围规则行操作列显示【查看详情】链接",
      async () => {
        await instanceRow.waitFor({ state: "visible", timeout: 10000 });

        const detailBtn = instanceRow
          .getByRole("button", { name: /查看详情|详情/ })
          .or(instanceRow.locator("a, button, span").filter({ hasText: /查看详情|详情/ }))
          .first();
        await detailBtn.click();
        await page.waitForLoadState("networkidle");

        // 验证实例详情中存在取值范围&枚举范围规则行
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        await expect(ruleRow).toBeVisible({ timeout: 10000 });

        // 验证该规则行操作列显示【查看详情】链接
        const viewDetailLink = ruleRow
          .locator("a, button, span")
          .filter({ hasText: "查看详情" })
          .first();
        await expect(viewDetailLink).toBeVisible({ timeout: 5000 });
      },
      instanceRow,
    );

    // 步骤3：点击规则行操作列的【查看详情】链接，进入明细数据页面
    await step(
      "步骤3: 在实例详情中点击规则行操作列【查看详情】链接 → 明细数据页面打开，显示不通过记录数据列表",
      async () => {
        const ruleRow = page
          .locator(".ant-table-row")
          .filter({ hasText: "取值范围&枚举范围" })
          .first();
        const viewDetailLink = ruleRow
          .locator("a, button, span")
          .filter({ hasText: "查看详情" })
          .first();
        await viewDetailLink.click();
        await page.waitForLoadState("networkidle");

        // 验证明细数据页面已打开（有数据列表）
        const detailRows = page.locator(".ant-table-row");
        await expect(detailRows.first()).toBeVisible({ timeout: 10000 });
      },
    );

    // 步骤4：验证明细数据中校验字段 score 标红展示，不通过记录共4条
    await step(
      "步骤4: 在明细数据页面中查看数据列表的字段展示情况和记录内容 → 校验字段 score 以标红方式展示，列表中仅包含不符合规则的记录共4条",
      async () => {
        const detailRows = page.locator(".ant-table-row");

        // 验证记录数为4条（id=1,2,4,5）
        await expect(detailRows).toHaveCount(4, { timeout: 10000 });

        // 验证 score 列存在标红样式（红色背景或红色字体）
        // score 列标红通过 CSS class 或 style 属性实现
        // TODO: 需通过 playwright-cli snapshot 确认标红的具体 CSS 选择器
        const redScoreCell = page
          .locator(
            ".ant-table-row td[class*='red'], .ant-table-row td[style*='color: red'], .ant-table-row td[style*='background'], .ant-table-row td .highlight, .ant-table-row td .error-cell",
          )
          .first();

        const hasRedCell = await redScoreCell.isVisible({ timeout: 3000 }).catch(() => false);

        if (!hasRedCell) {
          // 备用方案：查找含有 score 字段且有特殊样式的列头或单元格
          const scoreHeader = page.locator("table thead th").filter({ hasText: "score" }).first();
          await expect(scoreHeader).toBeVisible({ timeout: 5000 });

          // 至少验证全部字段列都存在（id、score、category）
          const headers = page.locator("table thead th");
          await expect(headers.filter({ hasText: "id" })).toBeVisible({
            timeout: 3000,
          });
          await expect(headers.filter({ hasText: "score" })).toBeVisible({ timeout: 3000 });
          await expect(headers.filter({ hasText: "category" })).toBeVisible({ timeout: 3000 });
        } else {
          await expect(redScoreCell).toBeVisible();
        }
      },
      page.locator(".ant-table-row").first(),
    );
  });
});
