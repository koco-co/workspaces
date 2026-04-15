// META: {"id":"t11","priority":"P1","title":"验证取值范围和枚举值均未填写时点击保存提示至少填写一项"}
import type { Locator } from "@playwright/test";
import { expect, test } from "../../fixtures/step-screenshot";
import {
  addRuleToPackage,
  gotoRuleSetList,
  openRuleSetEditor,
  selectRuleFieldAndFunction,
} from "./rule-editor-helpers";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {
  test("验证取值范围和枚举值均未填写时点击保存提示至少填写一项", async ({ page, step }) => {
    let ruleForm: Locator;

    await step(
      "步骤1: 进入规则集管理页面，等待列表加载完成 → 规则集管理页面正常打开，列表显示已有规则集数据行",
      async () => {
        await gotoRuleSetList(page);
        await expect(page.locator(".ant-table-row").first()).toBeVisible({ timeout: 10000 });
      },
      page.locator(".ant-table-tbody"),
    );

    await step(
      "步骤2: 找到ruleset_15695_and，点击编辑，新增规则并选择取值范围&枚举范围 → 规则配置区域展开，统计函数显示取值范围&枚举范围",
      async () => {
        await openRuleSetEditor(page, "ruleset_15695_and", ["且关系校验包"]);
        await expect(page.getByText("且关系校验包")).toBeVisible({ timeout: 10000 });

        ruleForm = await addRuleToPackage(page, "且关系校验包");
        const functionRow = await selectRuleFieldAndFunction(page, ruleForm, "score");
        await expect(functionRow.locator(".ant-select").first()).toContainText("取值范围&枚举范围");
      },
      page.locator(".ruleForm").last(),
    );

    await step(
      "步骤3: 填写字段score，取值范围和枚举值均不填写，保持为空 → 字段已选score，取值范围和枚举值均为空",
      async () => {
        await expect(ruleForm).toContainText("score");
        await expect(ruleForm.locator(".rule__function-list__item").first()).toContainText(
          "取值范围&枚举范围",
        );
      },
      page.locator(".ruleForm").last(),
    );

    await step(
      "步骤4: 点击保存按钮 → 保存失败，展示红色校验错误提示「取值范围和枚举值至少填写一项」",
      async () => {
        await page.getByRole("button", { name: /保\s*存/ }).click();
        await page.waitForTimeout(500);

        await expect(
          page
            .locator(".ant-form-item-explain-error, .has-error .ant-form-explain, [class*='error']")
            .filter({ hasText: /至少填写一项/ })
            .first()
            .or(page.getByText("取值范围和枚举值至少填写一项")),
        ).toBeVisible({ timeout: 5000 });
      },
      page.locator(".ant-form-item-explain-error, [class*='error']").first(),
    );
  });
});
