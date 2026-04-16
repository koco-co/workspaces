import { test } from "../../fixtures/step-screenshot";
import { executeSqlViaBatchDoris } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test("tmp overwrite doris data", async ({ page }) => {
  const overwriteResult = await executeSqlViaBatchDoris(
    page,
    "INSERT OVERWRITE TABLE quality_test_num VALUES (1, 5.0, '2'), (2, 15.0, '4'), (3, 3.0, '1'), (4, -1.0, '3'), (5, 8.0, '5');",
    `overwrite_num_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("OVERWRITE_RESULT", overwriteResult.resultText);

  const queryResult = await executeSqlViaBatchDoris(
    page,
    "SELECT id, score, category FROM quality_test_num ORDER BY id;",
    `query_after_overwrite_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("QUERY_RESULT", queryResult.resultText);
});
