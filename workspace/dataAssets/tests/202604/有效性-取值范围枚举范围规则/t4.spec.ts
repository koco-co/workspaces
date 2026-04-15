// META: {"id":"t4","priority":"P1","title":"验证在规则集中仅填写枚举值可正常保存"}
import { expect, test } from "../../fixtures/step-screenshot";
import {
  addRuleToPackage,
  configureRangeEnumRule,
  getRulePackage,
  getRuleSetListRow,
  getSelectOptions,
  gotoRuleSetList,
  openRuleSetEditor,
  saveRuleSet,
} from "./rule-editor-helpers";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  test("验证在规则集中仅填写枚举值可正常保存", async ({ page, step }) => {
    await step(
      "步骤1: 进入规则集管理页面 → 规则集管理页面打开，列表显示已有规则集数据行",
      async () => {
        await gotoRuleSetList(page);
        await expect(page.locator(".ant-table-row").first()).toBeVisible({ timeout: 15000 });
      },
      page.locator(".ant-table-tbody"),
    );

    await step(
      "步骤2: 找到 ruleset_15695_enum 点击编辑，新增规则仅填写枚举值 in 1,2,3 → Step2 打开，枚举值操作符默认回显 in，展开可见 in 和 not in",
      async () => {
        await openRuleSetEditor(page, "ruleset_15695_enum", ["仅枚举值包"]);
        await expect(
          page.locator(".ruleSetMonitor__package").filter({ hasText: "仅枚举值包" }).first(),
        ).toBeVisible({ timeout: 10000 });

        const ruleForm = await addRuleToPackage(page, "仅枚举值包");
        const functionRow = await configureRangeEnumRule(page, ruleForm, {
          field: "category",
          enumOperator: "in",
          enumValues: ["1", "2", "3"],
          ruleStrength: "强规则",
        });

        await expect(functionRow.locator(".ant-select").nth(3)).toContainText("in");
        const enumOptions = await getSelectOptions(page, functionRow.locator(".ant-select").nth(3));
        expect(enumOptions).toContain("in");
        expect(enumOptions).toContain("not in");

        await expect(ruleForm).toContainText("category");
      },
      page.locator(".ruleSetMonitor__package").filter({ hasText: "仅枚举值包" }).first(),
    );

    await step(
      "步骤3: 保存规则后重新进入编辑页 → 新增规则成功落库，回显枚举值 in 1、2、3",
      async () => {
        await saveRuleSet(page);
        await gotoRuleSetList(page);

        await expect(getRuleSetListRow(page, "ruleset_15695_enum")).toBeVisible({ timeout: 10000 });

        await openRuleSetEditor(page, "ruleset_15695_enum", ["仅枚举值包"]);
        const packageSection = await getRulePackage(page, "仅枚举值包");
        const savedRuleForm = packageSection.locator(".ruleForm").last();
        const savedFunctionRow = savedRuleForm.locator(".rule__function-list__item").first();

        await expect(savedRuleForm).toContainText("category");
        await expect(savedFunctionRow.locator(".ant-select").nth(3)).toContainText("in");
        const enumTags = savedRuleForm.locator(".ant-tag, .ant-select-selection-item");
        await expect(enumTags.filter({ hasText: "1" }).first()).toBeVisible();
        await expect(enumTags.filter({ hasText: "2" }).first()).toBeVisible();
        await expect(enumTags.filter({ hasText: "3" }).first()).toBeVisible();
      },
      page.locator(".ruleForm").last(),
    );
  });
});
