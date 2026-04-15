// META: {"id":"t1","priority":"P0","title":"验证在规则集中按完整顺序新建取值范围&枚举范围且关系规则（数值类型字段）"}
import { test, expect } from "../../fixtures/step-screenshot";
import {
  applyRuntimeCookies,
  buildDataAssetsUrl,
  selectAntOption,
} from "../../helpers/test-setup";
import {
  authDatasourceToProject,
  ensureQualityProject,
  runPreconditions,
} from "./test-data";

test.use({ storageState: ".auth/session.json" });

const SUITE_NAME =
  "【内置规则丰富】有效性，支持设置字段多规则的且或关系(#15695)";
const PAGE_NAME = "规则集管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  // ── 前置条件：建表 + 数据源导入 + 元数据同步 + 质量项目 + 授权 ──
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: ".auth/session.json",
    });
    try {
      // Step 1-3: 建表、数据源导入、元数据同步
      await runPreconditions(page);

      // Step 4-5: 创建质量项目 & 数据源授权
      const { projectId } = await ensureQualityProject(page);
      if (projectId) {
        await authDatasourceToProject(page, projectId);
      }
    } finally {
      await page.close();
    }
  });

  test("验证在规则集中按完整顺序新建取值范围&枚举范围且关系规则（数值类型字段）", async ({
    page,
    step,
  }) => {
    const url = buildDataAssetsUrl("/dq/ruleSet");

    // 步骤1：进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成
    await step(
      "步骤1: 进入规则集管理页面 → 规则集管理页面打开，列表或空态可见",
      async () => {
        await applyRuntimeCookies(page);
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        // 等待页面加载完成（可能有数据行，也可能是空态）
        const tableBody = page.locator(
          ".ant-table-tbody, .ant-empty, [class*='empty']",
        );
        await expect(tableBody.first()).toBeVisible({ timeout: 15000 });
      },
      page.locator(".ant-table-tbody"),
    );

    // 步骤2：点击【新建规则集】，在 Step 1 基础信息中填写并点击【下一步】
    await step(
      "步骤2: 点击新建规则集，填写 Step1 基础信息后点击下一步 → 进入 Step2 监控规则页面",
      async () => {
        // 点击新增规则集按钮
        const addBtn = page
          .getByRole("button", { name: /新增规则集|新建规则集/ })
          .or(page.locator("button").filter({ hasText: /新增规则集|新建规则集/ }))
          .first();
        await addBtn.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // 选择数据源：找包含 Doris 的选项
        // 源码中 label 格式为 "${dataSourceName}（${sourceTypeValue}）"
        const sourceSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /选择数据源/ })
          .locator(".ant-select")
          .first();
        await selectAntOption(page, sourceSelect.locator(".ant-select-selector"), "Doris");
        await page.waitForTimeout(1000);

        // 选择数据库/Schema: test_db
        const schemaSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /选择数据库/ })
          .locator(".ant-select")
          .first();
        await selectAntOption(page, schemaSelect.locator(".ant-select-selector"), "test_db");
        await page.waitForTimeout(1000);

        // 选择数据表: quality_test_num
        const tableSelect = page
          .locator(".ant-form-item")
          .filter({ hasText: /选择数据表/ })
          .locator(".ant-select")
          .first();
        await selectAntOption(
          page,
          tableSelect.locator(".ant-select-selector"),
          "quality_test_num",
        );
        await page.waitForTimeout(500);

        // 填写规则包名称（在 Table 中的第一行 Input）
        // 源码: Form.List name="tableConfig" → Table 列 "规则包名称"
        const packageNameInput = page
          .locator(".ant-table-row")
          .first()
          .locator("input")
          .first();
        await packageNameInput.clear();
        await packageNameInput.fill("且关系校验包");
        await page.waitForTimeout(300);

        // 点击下一步
        await page.getByRole("button", { name: "下一步" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1500);

        // 验证进入 Step2 监控规则页面
        // 源码 I18N: step tab "监控规则"
        await expect(
          page.getByText("监控规则", { exact: false }).first(),
        ).toBeVisible({ timeout: 10000 });
      },
      page.getByText("监控规则").first(),
    );

    // 步骤3：在规则包"且关系校验包"下新增规则
    await step(
      "步骤3: 新增取值范围&枚举范围规则并填写配置 → 规则配置区域展开正常，各字段可正常录入",
      async () => {
        // 点击新增规则（规则包内的新增按钮）
        const addRuleBtn = page
          .getByRole("button", { name: /新增规则|新增/ })
          .or(page.locator("button").filter({ hasText: /新增规则/ }))
          .first();
        await addRuleBtn.click();
        await page.waitForTimeout(1000);

        // 选择统计函数: 取值范围&枚举范围
        // 源码 API: GET_RULE_FUNCTION → /dassets/v1/valid/function/getFunctions
        const statFuncSelect = page
          .locator(".ant-form-item, [class*='form-item']")
          .filter({ hasText: /统计函数/ })
          .locator(".ant-select")
          .first();
        await selectAntOption(
          page,
          statFuncSelect.locator(".ant-select-selector"),
          "取值范围&枚举范围",
        );
        await page.waitForTimeout(500);

        // 选择字段: score
        const fieldSelect = page
          .locator(".ant-form-item, [class*='form-item']")
          .filter({ hasText: /^字段|选择字段/ })
          .last()
          .locator(".ant-select")
          .first();
        await selectAntOption(
          page,
          fieldSelect.locator(".ant-select-selector"),
          "score",
        );
        await page.waitForTimeout(500);

        // 取值范围设置: > 1 且 < 10
        // 源码: Form.Item name=['range','firstOperator'] + ['range','firstThreshold']
        //        + ['range','condition'] + ['range','secondOperator'] + ['range','secondThreshold']

        // 第一操作符: >
        const rangeSelects = page
          .locator("[class*='range'], .ant-form-item")
          .filter({ hasText: /取值范围/ })
          .locator(".ant-select");
        const firstOpSelect = rangeSelects.first();
        await selectAntOption(
          page,
          firstOpSelect.locator(".ant-select-selector"),
          ">",
        );
        await page.waitForTimeout(300);

        // 第一期望值: 1
        const rangeInputs = page
          .locator("[class*='range'], .ant-form-item")
          .filter({ hasText: /取值范围/ })
          .locator("input[type='text'], input:not([type])")
          .filter({ hasNot: page.locator(".ant-select-selection-search-input") });
        const firstInput = rangeInputs.first();
        await firstInput.fill("1");
        await page.waitForTimeout(300);

        // 且/或 条件选择: 且
        // 源码: RadioGroup for condition (AND/OR)
        const conditionRadio = page
          .locator(".ant-radio-wrapper, .ant-radio-button-wrapper")
          .filter({ hasText: "且" })
          .first();
        await conditionRadio.click();
        await page.waitForTimeout(300);

        // 第二操作符: <
        const secondOpSelect = rangeSelects.nth(1);
        await selectAntOption(
          page,
          secondOpSelect.locator(".ant-select-selector"),
          "<",
        );
        await page.waitForTimeout(300);

        // 第二期望值: 10
        const secondInput = rangeInputs.nth(1);
        await secondInput.fill("10");
        await page.waitForTimeout(300);

        // 枚举值设置: in 1、2、3
        // 源码: Select mode="tags" for enum values, operator select for in/not in
        // 先确认枚举值操作符默认为 in
        const enumSection = page
          .locator("[class*='form-item'], .ant-form-item, [class*='col-inline-form']")
          .filter({ hasText: /枚举值/ });
        const enumOpSelect = enumSection.locator(".ant-select").first();
        await expect(enumOpSelect).toBeVisible({ timeout: 5000 });

        // 输入枚举值: 使用 tags 模式输入
        const enumTagInput = enumSection
          .locator(".ant-select")
          .last()
          .locator("input")
          .first();
        if (await enumTagInput.isVisible().catch(() => false)) {
          for (const val of ["1", "2", "3"]) {
            await enumTagInput.fill(val);
            await page.keyboard.press("Enter");
            await page.waitForTimeout(200);
          }
        } else {
          // 备用方案：直接在枚举值输入区域输入
          const enumInput = enumSection.locator("input").last();
          for (const val of ["1", "2", "3"]) {
            await enumInput.fill(val);
            await page.keyboard.press("Enter");
            await page.waitForTimeout(200);
          }
        }

        // 取值范围和枚举值关系: 且
        // 如果上面已经点了且，这里可能已自动设置
        // 源码中 condition radio 在取值范围行内，另有一个关系选择在枚举值和取值范围之间
        // 需要确认是否有两个独立的「且/或」选择器
        const relationRadios = page
          .locator(".ant-radio-wrapper, .ant-radio-button-wrapper")
          .filter({ hasText: "且" });
        if ((await relationRadios.count()) > 1) {
          // 可能有第二个「且」选择器用于枚举值和取值范围的关系
          await relationRadios.last().click();
          await page.waitForTimeout(300);
        }

        // 验证枚举值操作符下拉框显示 in 和 not in
        await enumOpSelect.locator(".ant-select-selector").click();
        await page.waitForTimeout(300);
        const dropdown = page.locator(".ant-select-dropdown:visible");
        await expect(
          dropdown.getByText("in", { exact: true }).first(),
        ).toBeVisible();
        await expect(
          dropdown.getByText("not in", { exact: false }).first(),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      },
      page
        .locator(".ant-form-item, [class*='form-item']")
        .filter({ hasText: /枚举值/ })
        .first(),
    );

    // 步骤4：点击规则行【保存】，再点击页面底部【保存】完成规则集创建
    await step(
      "步骤4: 保存规则并完成规则集创建 → 规则集保存成功，规则列表显示正确信息",
      async () => {
        // 点击规则行保存
        await page.getByRole("button", { name: "保存" }).first().click();
        await page.waitForTimeout(1000);

        // 点击页面底部保存
        await page.getByRole("button", { name: "保存" }).last().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1500);

        // 验证保存成功提示
        const successMsg = page.locator(
          ".ant-message-notice, .ant-notification-notice, .ant-message",
        );
        await expect(
          successMsg.filter({ hasText: /成功/ }).first(),
        ).toBeVisible({ timeout: 10000 });
      },
      page.locator(".ant-message-notice, .ant-notification-notice").first(),
    );
  });
});
