import { expect, test } from "../../fixtures/step-screenshot";
import { ensureRuleTasks, executeTaskAndWaitForResult } from "./rule-task-helpers";

test.use({ storageState: ".auth/session.json" });

test("tmp inspect task detail drawer", async ({ page }) => {
  await ensureRuleTasks(page, ["task_15695_and"]);
  const instanceRow = await executeTaskAndWaitForResult(page, "task_15695_and");
  const detailResponsePromise = page.waitForResponse((response) => {
    return (
      response.url().includes("/monitorRecord/detailReport") &&
      response.request().method() === "POST"
    );
  });

  await instanceRow.getByRole("button", { name: "pw.quality_test_num" }).click();
  const detailResponse = await detailResponsePromise;
  console.log("DETAIL_RESPONSE_JSON", JSON.stringify(await detailResponse.json()).slice(0, 4000));

  const drawer = page.locator(".dtc-drawer:visible").last();
  await expect(drawer).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(3000);

  console.log("DRAWER_TEXT_START");
  console.log((await drawer.innerText()).slice(0, 4000));
  console.log("DRAWER_TEXT_END");

  console.log(
    "DRAWER_RULE_MATCH_COUNT",
    await drawer.locator("text=取值范围&枚举范围").count(),
  );
  console.log("DRAWER_TABLE_COUNT", await drawer.locator("table").count());
  console.log("DRAWER_BUTTONS", await drawer.locator("button").allInnerTexts());
  console.log("DRAWER_LINKS", await drawer.locator("a").allInnerTexts());

  const viewDetailButton = drawer.getByRole("button", { name: "查看明细" }).first();
  await viewDetailButton.click();
  await page.waitForTimeout(3000);

  const visibleDrawerCount = await page.locator(".dtc-drawer:visible").count();
  console.log("VISIBLE_DRAWER_COUNT_AFTER_VIEW_DETAIL", visibleDrawerCount);

  const activeDrawer = page.locator(".dtc-drawer:visible").last();
  console.log("DETAIL_DRAWER_TEXT_START");
  console.log((await activeDrawer.innerText()).slice(0, 4000));
  console.log("DETAIL_DRAWER_TEXT_END");
  console.log("DETAIL_DRAWER_TABLE_COUNT", await activeDrawer.locator("table").count());
  console.log("DETAIL_DRAWER_BUTTONS", await activeDrawer.locator("button").allInnerTexts());
  console.log("DETAIL_DRAWER_HEADERS", await activeDrawer.locator("th").allInnerTexts());
});
