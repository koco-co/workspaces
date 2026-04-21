// META: {"id":"t2","priority":"P1","title":"【P1】验证「格式-json格式校验」统计规则悬浮提示内容正确"}
import { expect, test } from "../../fixtures/step-screenshot";
import { selectAntOption, uniqueName } from "../../helpers/test-setup";
import {
  FORMAT_JSON_VERIFICATION_FUNC,
  VALUE_FORMAT_TABLE,
} from "./data-15694";
import { addRuleToPackage, createRuleSetDraft } from "./json-format-utils";

test.use({ storageState: process.env.UI_AUTOTEST_SESSION_PATH ?? ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，json中key对应的value值格式校验(#15694)";
const PAGE_NAME = "规则集管理";

/**
 * 「格式-json格式校验」统计规则的 tooltip 文案（来自 I18N key: AH）
 */
const JSON_FORMAT_TOOLTIP_TEXT = "校验内容为key名对应的value格式是否符合要求";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  test(
    "【P1】验证「格式-json格式校验」统计规则悬浮提示内容正确",
    async ({ page, step }) => {
      const packageName = uniqueName("t2_pkg");

      await step("步骤1: 导航到新建规则集页面并创建草稿 → 进入监控规则步骤", async () => {
        await createRuleSetDraft(page, VALUE_FORMAT_TABLE, [packageName]);
      });

      const ruleForm = await step(
        "步骤2: 在规则包中添加有效性校验规则 → 规则表单渲染",
        async () => {
          const form = await addRuleToPackage(page, packageName, "有效性校验");
          await expect(form).toBeVisible();
          return form;
        },
      );

      await step(
        "步骤3: 选择 json/string 类型字段（info）→ 字段选择成功",
        async () => {
          const fieldSelect = ruleForm
            .locator(".ant-form-item")
            .filter({ hasText: /字段/ })
            .locator(".ant-select")
            .first();
          await selectAntOption(page, fieldSelect, "info");
          await page.waitForTimeout(300);
        },
      );

      await step(
        "步骤4: 在统计函数下拉中选择「格式-json格式校验」→ 选择成功，校验key配置区域出现",
        async () => {
          const functionRow = ruleForm.locator(".rule__function-list__item").first();
          const functionSelect = functionRow.locator(".ant-select").first();
          await selectAntOption(page, functionSelect, FORMAT_JSON_VERIFICATION_FUNC);
          await page.waitForTimeout(500);
        },
      );

      const tooltipIcon = ruleForm
        .locator(".anticon-question-circle, [role='img'][aria-label*='question'], .ant-tooltip-open, [class*='tooltipIcon'], [class*='help-icon'], .anticon-info-circle")
        .first();

      await step(
        "步骤5: 确认统计函数旁边有 tooltip/help 图标 → 图标可见",
        async () => {
          // tooltip 图标可能以多种形式出现：问号圆圈、info 圆圈等
          const possibleIcons = ruleForm.locator(
            ".anticon-question-circle, .anticon-info-circle, [role='img'][aria-label*='question'], [class*='tooltip'], [class*='help']",
          );
          await expect(possibleIcons.first()).toBeVisible({ timeout: 10000 });
        },
        tooltipIcon,
      );

      await step(
        "步骤6: hover tooltip 图标，验证提示内容包含 json格式校验 说明文案 → tooltip 内容正确",
        async () => {
          const icon = ruleForm
            .locator(
              ".anticon-question-circle, .anticon-info-circle, [role='img'][aria-label*='question'], [class*='tooltip'], [class*='help']",
            )
            .first();

          await icon.hover();
          await page.waitForTimeout(800);

          // tooltip 内容浮层
          const tooltipContent = page
            .locator(
              ".ant-tooltip-inner, [role='tooltip'], .ant-popover-inner-content",
            )
            .first();

          await expect(tooltipContent).toBeVisible({ timeout: 5000 });
          await expect(tooltipContent).toContainText(JSON_FORMAT_TOOLTIP_TEXT);
        },
        page.locator(".ant-tooltip-inner, [role='tooltip']").first(),
      );
    },
  );
});
