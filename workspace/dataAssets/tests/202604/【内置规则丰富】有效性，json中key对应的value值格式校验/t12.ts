// META: {"id":"t12","priority":"P1","title":"【P1】验证未选择校验key时保存规则提示「请选择校验key」"}
import { expect, test } from "../../fixtures/step-screenshot";
import { selectAntOption, uniqueName } from "../../helpers/test-setup";
import {
  FORMAT_JSON_VERIFICATION_FUNC,
  VALUE_FORMAT_TABLE,
} from "./data-15694";
import {
  addRuleToPackage,
  createRuleSetDraft,
} from "./json-format-utils";

test.use({ storageState: process.env.UI_AUTOTEST_SESSION_PATH ?? ".auth/session.json" });

const SUITE_NAME = "【内置规则丰富】有效性，json中key对应的value值格式校验(#15694)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  test(
    "【P1】验证未选择校验key时保存规则提示「请选择校验key」",
    async ({ page, step }) => {
      const packageName = uniqueName("t12_pkg");

      await step("步骤1: 导航到新建规则集页面，进入监控规则步骤 → 页面正常加载", async () => {
        await createRuleSetDraft(page, VALUE_FORMAT_TABLE, [packageName]);
      });

      const ruleForm = await step(
        "步骤2: 在规则包中添加有效性校验规则 → 规则表单渲染可见",
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
        "步骤4: 选择统计函数「格式-json格式校验」→ 选择成功，校验key配置区域出现",
        async () => {
          const functionRow = ruleForm.locator(".rule__function-list__item").first();
          const functionSelect = functionRow.locator(".ant-select").first();
          await selectAntOption(page, functionSelect, FORMAT_JSON_VERIFICATION_FUNC);
          await page.waitForTimeout(500);

          // 校验key 配置区域（TreeSelect）应出现
          const keySelectArea = ruleForm.locator(".ant-tree-select, .ant-select").nth(1);
          await expect(keySelectArea).toBeVisible({ timeout: 10000 });
        },
      );

      // 不选择任何校验key，直接点击保存
      const saveBtn = ruleForm
        .getByRole("button", { name: /保\s*存/ })
        .or(page.getByRole("button", { name: /保\s*存/ }))
        .first();

      await step(
        "步骤5: 不选择校验key，直接点击【保存】→ 出现「请选择校验key」错误提示",
        async () => {
          await saveBtn.click();
          await page.waitForTimeout(500);

          // 「请选择校验key」错误提示可能出现在：
          // 1. 表单校验错误文字（.ant-form-item-explain-error）
          // 2. Message/Toast 提示（.ant-message-notice）
          const formError = ruleForm
            .locator(".ant-form-item-explain-error")
            .filter({ hasText: "请选择校验key" })
            .first();

          const messageToast = page
            .locator(".ant-message-notice, .ant-notification-notice, .ant-message")
            .filter({ hasText: "请选择校验key" })
            .first();

          // 等待任意一种提示出现
          await Promise.any([
            formError.waitFor({ state: "visible", timeout: 5000 }),
            messageToast.waitFor({ state: "visible", timeout: 5000 }),
          ]);

          // 断言至少有一个提示可见
          const formErrorVisible = await formError.isVisible().catch(() => false);
          const messageToastVisible = await messageToast.isVisible().catch(() => false);

          expect(
            formErrorVisible || messageToastVisible,
            "点击保存后，应出现「请选择校验key」错误提示",
          ).toBe(true);
        },
        ruleForm.locator(".ant-form-item-explain-error").first(),
      );
    },
  );
});
