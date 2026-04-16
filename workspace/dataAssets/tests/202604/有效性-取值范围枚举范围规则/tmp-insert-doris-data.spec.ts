import { test } from "../../fixtures/step-screenshot";
import { executeSqlViaBatchDoris } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test("tmp insert doris data", async ({ page }) => {
  const truncateResult = await executeSqlViaBatchDoris(
    page,
    "TRUNCATE TABLE quality_test_num;",
    `truncate_num_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("TRUNCATE_RESULT", truncateResult.resultText);

  const insertResult = await executeSqlViaBatchDoris(
    page,
    "INSERT INTO quality_test_num VALUES (1, 5.0, '2'), (2, 15.0, '4'), (3, 3.0, '1'), (4, -1.0, '3'), (5, 8.0, '5');",
    `insert_num_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("INSERT_RESULT", insertResult.resultText);

  const queryResult = await executeSqlViaBatchDoris(
    page,
    "SELECT id, score, category FROM quality_test_num ORDER BY id;",
    `query_num_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("QUERY_RESULT", queryResult.resultText);
});
