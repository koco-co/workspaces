import { expect, test } from "../../fixtures/step-screenshot";
import { ensureRuleTasks } from "./rule-task-helpers";

test.use({ storageState: ".auth/session.json" });

const TABLE_ROWS = ".ant-table-tbody tr:not(.ant-table-measure-row)";

test("tmp inspect task row execute entry", async ({ page }) => {
  await ensureRuleTasks(page, ["task_15695_and"]);

  const targetRow = page.locator(TABLE_ROWS).filter({ hasText: "task_15695_and" }).first();
  await expect(targetRow).toBeVisible({ timeout: 15000 });

  console.log("ROW_HTML_START");
  console.log(await targetRow.innerHTML());
  console.log("ROW_HTML_END");
  console.log("ROW_A_COUNT", await targetRow.locator("a").count());

  const tableCell = targetRow.locator("td").nth(1);
  console.log("TABLE_CELL_HTML_START");
  console.log(await tableCell.innerHTML());
  console.log("TABLE_CELL_HTML_END");

  const tableAnchors = tableCell.locator("a");
  console.log("TABLE_CELL_A_COUNT", await tableAnchors.count());

  if ((await tableAnchors.count()) > 0) {
    await tableAnchors.first().click({ force: true });
    await page.waitForTimeout(1000);
    console.log("AFTER_ANCHOR_CLICK_DTC_DRAWER_COUNT", await page.locator(".dtc-drawer").count());
    console.log(
      "AFTER_ANCHOR_CLICK_EXECUTE_COUNT",
      await page.getByRole("button", { name: "立即执行" }).count(),
    );
  }

  if ((await page.locator(".dtc-drawer").count()) === 0) {
    await tableCell.click({ force: true });
    await page.waitForTimeout(1000);
    console.log("AFTER_CELL_CLICK_DTC_DRAWER_COUNT", await page.locator(".dtc-drawer").count());
    console.log(
      "AFTER_CELL_CLICK_EXECUTE_COUNT",
      await page.getByRole("button", { name: "立即执行" }).count(),
    );
  }

  if ((await page.locator(".dtc-drawer").count()) === 0) {
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".ant-table-tbody tr"));
      const row = rows.find((item) => item.textContent?.includes("task_15695_and"));
      const clickable = row?.querySelector("td:nth-child(2) a") as HTMLElement | null;
      clickable?.click();
    });
    await page.waitForTimeout(1000);
    console.log("AFTER_EVAL_CLICK_DTC_DRAWER_COUNT", await page.locator(".dtc-drawer").count());
    console.log(
      "AFTER_EVAL_CLICK_EXECUTE_COUNT",
      await page.getByRole("button", { name: "立即执行" }).count(),
    );
  }
});
