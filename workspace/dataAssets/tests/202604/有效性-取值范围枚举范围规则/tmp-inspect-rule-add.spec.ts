import { expect, test } from "@playwright/test";

import { applyRuntimeCookies, buildDataAssetsUrl, selectAntOption } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test("inspect rule add page", async ({ page }) => {
  await applyRuntimeCookies(page);
  await page.goto(buildDataAssetsUrl("/dq/rule/add", 35));
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const packageListsByTable = await page.evaluate(async () => {
    const tables = [
      "quality_test_num",
      "quality_test_sample",
      "quality_test_partition",
      "quality_test_enum_pass",
    ];
    const result = {};
    for (const tableName of tables) {
      const response = await fetch("/dassets/v1/valid/monitorRulePackage/ruleSetList", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json;charset=UTF-8",
          "Accept-Language": "zh-CN",
          "X-Valid-Project-ID": "35",
        },
        body: JSON.stringify({
          dataSourceId: 55,
          schemaName: "pw",
          tableName,
        }),
      });
      const payload = await response.json();
      result[tableName] = (payload?.data ?? []).map((item) => item?.name ?? item?.packageName ?? item?.ruleSetName ?? item?.id);
    }
    return result;
  });
  console.log("PACKAGE_LISTS_BY_TABLE", JSON.stringify(packageListsByTable, null, 2));

  const stepOne = await page.evaluate(() => ({
    url: location.href,
    labels: Array.from(document.querySelectorAll(".ant-form-item-label"))
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
    buttons: Array.from(document.querySelectorAll("button"))
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
    body: document.body.innerText.slice(0, 3000),
  }));

  console.log("STEP_ONE", JSON.stringify(stepOne, null, 2));

  const sourceFormItem = page.locator(".ant-form-item").filter({ hasText: /选择数据源/ }).first();
  await page.getByLabel("规则名称").fill("tmp_inspect_rule_add");
  await selectAntOption(page, sourceFormItem.locator(".ant-select").first(), /doris/i);

  const schemaFormItem = page.locator(".ant-form-item").filter({ hasText: /选择数据库/ }).first();
  await selectAntOption(page, schemaFormItem.locator(".ant-select").first(), "pw");
  await page.waitForTimeout(1000);

  const tableFormItem = page.locator(".ant-form-item").filter({ hasText: /选择数据表/ }).first();
  await selectAntOption(page, tableFormItem.locator(".ant-select").first(), "quality_test_num");
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "下一步" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const stepTwo = await page.evaluate(() => ({
    url: location.href,
    labels: Array.from(document.querySelectorAll(".ant-form-item-label"))
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
    buttons: Array.from(document.querySelectorAll("button"))
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
    body: document.body.innerText.slice(0, 4000),
  }));

  console.log("STEP_TWO", JSON.stringify(stepTwo, null, 2));

  const packageSelect = page.locator(".ant-form-item").filter({ hasText: /规则包/ }).first().locator(".ant-select").first();
  await packageSelect.click();
  await page.waitForTimeout(500);
  const packageOptions = await page.locator(".ant-select-dropdown .ant-select-item-option-content").allTextContents();
  console.log("PACKAGE_OPTIONS_ALL", JSON.stringify(packageOptions.slice(0, 80), null, 2));
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "且关系校验包" })
    .first()
    .click();
  await page.waitForTimeout(1500);

  const ruleTypeSelect = page
    .locator(".ant-form-item")
    .filter({ hasText: /规则类型/ })
    .first()
    .locator(".ant-select")
    .first();
  await expect(ruleTypeSelect).not.toHaveAttribute(/aria-disabled/, /true/, { timeout: 10000 });
  await ruleTypeSelect.locator(".ant-select-selector").click();
  await page.waitForTimeout(500);
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: /有效性校验|有效性/ })
    .first()
    .click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "引入" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const importedRules = await page.locator(".ruleFormContainer .ruleForm, .ruleFormContainer .rule-block").count();
  console.log("IMPORTED_RULE_COUNT", importedRules);

  await page.getByRole("button", { name: "下一步" }).last().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const stepThree = await page.evaluate(() => ({
    url: location.href,
    labels: Array.from(document.querySelectorAll(".ant-form-item-label"))
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
    buttons: Array.from(document.querySelectorAll("button"))
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
    body: document.body.innerText.slice(0, 5000),
  }));

  console.log("STEP_THREE", JSON.stringify(stepThree, null, 2));

  await page
    .locator(".ant-form-item")
    .filter({ hasText: /规则拼接包/ })
    .locator("input")
    .first()
    .fill("1");
  await page
    .locator(".ant-radio-wrapper, .ant-radio-button-wrapper")
    .filter({ hasText: /立即生成/ })
    .first()
    .click();
  await page
    .locator(".ant-form-item")
    .filter({ hasText: /报告名称/ })
    .locator("input")
    .first()
    .fill("tmp_inspect_rule_add_report");
  await page
    .locator(".ant-form-item")
    .filter({ hasText: /数据周期/ })
    .locator("input")
    .nth(0)
    .fill("1");
  await page
    .locator(".ant-form-item")
    .filter({ hasText: /数据周期/ })
    .locator("input")
    .nth(1)
    .fill("0");

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/dassets/v1/valid/monitor/add") ||
      response.url().includes("/dassets/v1/valid/monitor/edit"),
  );
  await page.getByRole("button", { name: /新\s*建|保\s*存/ }).last().click();

  const saveResponse = await saveResponsePromise;
  const saveBody = await saveResponse.json().catch(() => null);
  console.log(
    "SAVE_RESPONSE",
    JSON.stringify(
      {
        url: saveResponse.url(),
        status: saveResponse.status(),
        body: saveBody,
      },
      null,
      2,
    ),
  );

  await page.waitForTimeout(3000);
  console.log("AFTER_SAVE_URL", page.url());
});
