// META: {"id":"t7","priority":"P1","title":"验证string类型字段在规则集中配置取值范围&枚举范围规则时系统可正常保存"}
import { expect, test } from "../../fixtures/step-screenshot";
import {
  addRuleToPackage,
  configureRangeEnumRule,
  getRuleSetListRow,
  getSelectOptions,
  gotoRuleSetList,
  openRuleSetEditor,
  saveRuleSet,
} from "./rule-editor-helpers";

test.use({ storageState: ".auth/session.json" });

test.describe("【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695) - 规则集管理", () => {
  test("验证string类型字段在规则集中配置取值范围&枚举范围规则时系统可正常保存", async ({
    page,
    step,
  }) => {
    await step(
      "步骤1: 进入规则集管理页面，等待列表加载完成 → 规则集管理页面打开，列表显示已有规则集数据行",
      async () => {
        await gotoRuleSetList(page);
        await expect(page.locator(".ant-table-row").first()).toBeVisible({ timeout: 10000 });
      },
      page.locator(".ant-table-tbody"),
    );

    await step(
      "步骤2: 找到ruleset_15695_str，点击编辑按钮进入Step2，新增取值范围&枚举范围规则并填写字段 → 规则配置区域展开，score_str可被选中",
      async () => {
        await openRuleSetEditor(page, "ruleset_15695_str", ["string强转包"]);
        await expect(
          page.locator(".ruleSetMonitor__package").filter({ hasText: "string强转包" }).first(),
        ).toBeVisible({ timeout: 10000 });

        const ruleForm = await addRuleToPackage(page, "string强转包");
        const functionRow = await configureRangeEnumRule(page, ruleForm, {
          field: "score_str",
          range: {
            firstOperator: ">",
            firstValue: "1",
            condition: "且",
            secondOperator: "<",
            secondValue: "10",
          },
          enumOperator: "in",
          enumValues: ["5", "5.5", "15"],
          relation: "且",
          ruleStrength: "强规则",
        });

        const enumOptions = await getSelectOptions(page, functionRow.locator(".ant-select").nth(3));
        expect(enumOptions).toContain("in");
        expect(enumOptions).toContain("not in");
        await expect(ruleForm).toContainText("score_str");
      },
      page.locator(".ruleForm").last(),
    );

    await step(
      "步骤3: 填写取值范围>1 且 <10、枚举值in 5、5.5、15、关系选且、强规则，点击保存 → 规则保存成功，string类型字段可正常配置",
      async () => {
        await saveRuleSet(page);
      },
      page.getByRole("button", { name: /保\s*存/ }),
    );

    await step(
      "步骤4: 验证规则保存成功，string类型字段可正常配置取值范围&枚举范围规则 → 列表中显示对应规则",
      async () => {
        const successMsg = page.locator(
          ".ant-message-notice, .ant-notification-notice, .ant-message",
        );
        const ruleRow = getRuleSetListRow(page, "ruleset_15695_str");
        await expect(successMsg.filter({ hasText: /成功/ }).first().or(ruleRow)).toBeVisible({
          timeout: 8000,
        });
      },
      getRuleSetListRow(page, "ruleset_15695_str"),
    );
  });
});
