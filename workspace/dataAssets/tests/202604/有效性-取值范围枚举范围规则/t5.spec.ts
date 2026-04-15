// META: {"id":"t5","priority":"P1","title":"验证在规则集中枚举值选择not in后保存成功且编辑时回显正确"}
import { expect, test } from "../../fixtures/step-screenshot";
import {
  addRuleToPackage,
  configureRangeEnumRule,
  getRulePackage,
  getRuleSetListRow,
  gotoRuleSetList,
  openRuleSetEditor,
  saveRuleSet,
} from "./rule-editor-helpers";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  test("验证在规则集中枚举值选择not in后保存成功且编辑时回显正确", async ({ page, step }) => {
    await step(
      "步骤1: 进入规则集管理页面 → 规则集管理页面打开，列表显示已有规则集数据行",
      async () => {
        await gotoRuleSetList(page);
        await expect(page.locator(".ant-table-row").first()).toBeVisible({ timeout: 15000 });
      },
      page.locator(".ant-table-tbody"),
    );

    await step(
      "步骤2: 找到 ruleset_15695_notin 点击编辑，新增规则配置枚举值 not in 4,5 → Step2 打开，枚举值操作符支持 in/not in 切换，当前显示 not in",
      async () => {
        await openRuleSetEditor(page, "ruleset_15695_notin", ["notin校验包"]);
        await expect(page.getByText("notin校验包")).toBeVisible({ timeout: 10000 });

        const ruleForm = await addRuleToPackage(page, "notin校验包");
        const functionRow = await configureRangeEnumRule(page, ruleForm, {
          field: "category",
          enumOperator: "not in",
          enumValues: ["4", "5"],
          ruleStrength: "强规则",
        });

        await expect(functionRow.locator(".ant-select").nth(3)).toContainText("not in");
        await expect(page.getByText("test_db.quality_test_num", { exact: false })).toBeVisible({
          timeout: 5000,
        });
      },
      page.getByText("notin校验包"),
    );

    await step(
      "步骤3: 保存规则集后重新进入编辑页 → 枚举值列显示 not in '4,5'，回显操作符为 not in，枚举值回显 4、5",
      async () => {
        await saveRuleSet(page);

        const successMsg = page.locator(
          ".ant-message-notice, .ant-notification-notice, .ant-message",
        );
        await expect(successMsg.filter({ hasText: /成功/ }).first()).toBeVisible({
          timeout: 5000,
        });

        await expect(getRuleSetListRow(page, "ruleset_15695_notin")).toBeVisible({
          timeout: 10000,
        });

        await openRuleSetEditor(page, "ruleset_15695_notin", ["notin校验包"]);
        const packageSection = await getRulePackage(page, "notin校验包");
        const savedRuleForm = packageSection.locator(".ruleForm").last();
        await expect(savedRuleForm).toContainText("取值范围&枚举范围");

        const savedFunctionRow = savedRuleForm.locator(".rule__function-list__item").first();
        await expect(savedFunctionRow.locator(".ant-select").nth(3)).toContainText("not in");

        const enumTags = savedRuleForm.locator(".ant-tag, .ant-select-selection-item");
        await expect(enumTags.filter({ hasText: "4" }).first()).toBeVisible();
        await expect(enumTags.filter({ hasText: "5" }).first()).toBeVisible();
      },
      page.locator(".ruleForm").last(),
    );
  });
});
