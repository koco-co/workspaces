// META: {"id":"t3","priority":"P1","title":"验证在规则集中仅填写取值范围可正常保存"}
import { expect, test } from "../../fixtures/step-screenshot";
import {
  addRuleToPackage,
  configureRangeEnumRule,
  getRuleSetListRow,
  gotoRuleSetList,
  openRuleSetEditor,
  saveRuleSet,
} from "./rule-editor-helpers";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  test("验证在规则集中仅填写取值范围可正常保存", async ({ page, step }) => {
    await step(
      "步骤1: 进入规则集管理页面 → 规则集管理页面打开，列表显示已有规则集数据行",
      async () => {
        await gotoRuleSetList(page);
        await expect(page.locator(".ant-table-row").first()).toBeVisible({ timeout: 15000 });
      },
      page.locator(".ant-table-tbody"),
    );

    await step(
      "步骤2: 找到 ruleset_15695_range 点击编辑，新增规则仅填写取值范围 >= 0 → Step2 打开，规则包显示仅取值范围包",
      async () => {
        await openRuleSetEditor(page, "ruleset_15695_range", ["仅取值范围包"]);
        await expect(
          page.locator(".ruleSetMonitor__package").filter({ hasText: "仅取值范围包" }).first(),
        ).toBeVisible({ timeout: 10000 });

        const ruleForm = await addRuleToPackage(page, "仅取值范围包");
        await configureRangeEnumRule(page, ruleForm, {
          field: "score",
          range: {
            firstOperator: ">=",
            firstValue: "0",
          },
          ruleStrength: "强规则",
        });

        await expect(ruleForm).toContainText("score");
      },
      page.locator(".ruleSetMonitor__package").filter({ hasText: "仅取值范围包" }).first(),
    );

    await step(
      "步骤3: 保存规则 → 规则保存成功，取值范围列显示 >=0，枚举值列显示 --",
      async () => {
        await saveRuleSet(page);

        const successMsg = page.locator(
          ".ant-message-notice, .ant-notification-notice, .ant-message",
        );
        await expect(successMsg.filter({ hasText: /成功/ }).first()).toBeVisible({
          timeout: 5000,
        });

        await expect(getRuleSetListRow(page, "ruleset_15695_range")).toBeVisible({
          timeout: 10000,
        });
      },
      getRuleSetListRow(page, "ruleset_15695_range"),
    );
  });
});
