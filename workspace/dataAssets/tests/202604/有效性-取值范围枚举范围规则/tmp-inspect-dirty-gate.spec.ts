import { expect, test } from "../../fixtures/step-screenshot";
import { gotoValidationResults, openTaskInstanceDetail } from "./rule-task-helpers";

test.use({ storageState: ".auth/session.json" });

test("tmp inspect dirty-data gate", async ({ page }) => {
  await gotoValidationResults(page);

  const instanceRow = page
    .locator(".ant-table-tbody tr:not(.ant-table-measure-row)")
    .filter({ hasText: "task_15695_and" })
    .first();
  await expect(instanceRow).toBeVisible({ timeout: 15000 });

  const detailDrawer = await openTaskInstanceDetail(page, instanceRow);
  const detailButton = detailDrawer.getByRole("button", { name: "查看明细" }).first();

  console.log("DETAIL_BUTTON_DISABLED", await detailButton.isDisabled());
  console.log("DETAIL_BUTTON_ARIA_DISABLED", await detailButton.getAttribute("aria-disabled"));

  await detailButton.hover();
  await page.waitForTimeout(1000);
  console.log("TOOLTIP_TEXT", await page.locator(".ant-tooltip:visible").last().innerText().catch(() => ""));

  await detailButton.click();
  const dataDrawer = page.locator(".ant-drawer:visible").last();
  await expect(dataDrawer).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000);

  console.log("DATA_DRAWER_TEXT_START");
  console.log((await dataDrawer.innerText()).slice(0, 4000));
  console.log("DATA_DRAWER_TEXT_END");
  console.log("DATA_DRAWER_HEADERS", await dataDrawer.locator("th").allInnerTexts());
  console.log("DATA_DRAWER_BUTTONS", await dataDrawer.locator("button").allInnerTexts());
  console.log("DATA_DRAWER_ROW_COUNT", await dataDrawer.locator(".ant-table-tbody tr").count());
  console.log(
    "SCORE_HEADER_STYLE",
    await dataDrawer
      .locator("th")
      .filter({ hasText: "score" })
      .first()
      .locator("span")
      .first()
      .getAttribute("style"),
  );
  console.log(
    "SCORE_CELL_STYLE",
    await dataDrawer.locator(".ant-table-tbody tr").nth(1).locator("td").nth(1).locator("span").first().getAttribute("style"),
  );
});
