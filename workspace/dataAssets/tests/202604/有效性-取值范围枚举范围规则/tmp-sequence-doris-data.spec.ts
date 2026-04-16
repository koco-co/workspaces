import { test } from "../../fixtures/step-screenshot";
import { executeSqlSequenceViaBatchDoris, executeSqlViaBatchDoris } from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });

test("tmp sequence doris data", async ({ page }) => {
  const results = await executeSqlSequenceViaBatchDoris(
    page,
    [
      "TRUNCATE TABLE quality_test_num",
      "INSERT INTO quality_test_num VALUES (1, 5.0, '2'), (2, 15.0, '4'), (3, 3.0, '1'), (4, -1.0, '3'), (5, 8.0, '5')",
    ],
    `sequence_num_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("SEQUENCE_RESULTS", JSON.stringify(results));

  const queryResult = await executeSqlViaBatchDoris(
    page,
    "SELECT id, score, category FROM quality_test_num ORDER BY id;",
    `query_after_sequence_${Date.now().toString(36)}`,
    "pw",
  );
  console.log("QUERY_RESULT", queryResult.resultText);
});
