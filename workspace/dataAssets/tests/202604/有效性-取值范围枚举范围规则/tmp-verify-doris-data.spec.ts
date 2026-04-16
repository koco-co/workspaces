import { test } from "../../fixtures/step-screenshot";
import { executeSqlViaBatchDoris } from "../../helpers/test-setup";
import { runPreconditions } from "./test-data";

test.use({ storageState: ".auth/session.json" });

test("tmp verify doris data", async ({ page }) => {
  await runPreconditions(page);

  const countResult = await executeSqlViaBatchDoris(
    page,
    "SELECT COUNT(*) FROM quality_test_num;",
    `verify_count_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("COUNT_RESULT", countResult.resultText);

  const dataResult = await executeSqlViaBatchDoris(
    page,
    "SELECT id, score, category FROM quality_test_num ORDER BY id;",
    `verify_data_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("DATA_RESULT", dataResult.resultText);
});
