import { test } from "../../fixtures/step-screenshot";
import {
  applyRuntimeCookies,
  executeSqlViaBatchDoris,
} from "../../helpers/test-setup";

test.use({ storageState: ".auth/session.json" });
test.setTimeout(300_000); // 5 min for setup

const PROJECT = "tongmeng_dev";

const SQLS = [
  `CREATE DATABASE IF NOT EXISTS test_db`,
  `DROP TABLE IF EXISTS test_db.quality_test_num;
CREATE TABLE test_db.quality_test_num (
  id INT NOT NULL, score DOUBLE, category VARCHAR(50)
) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num"="1");
INSERT INTO test_db.quality_test_num VALUES
  (1, 5.0, '2'), (2, 15.0, '4'), (3, 3.0, '1'), (4, -1.0, '3'), (5, 8.0, '5')`,
  `DROP TABLE IF EXISTS test_db.quality_test_str;
CREATE TABLE test_db.quality_test_str (
  id INT NOT NULL, score_str VARCHAR(50), category VARCHAR(50)
) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num"="1");
INSERT INTO test_db.quality_test_str VALUES
  (1, '5', '2'), (2, '5.0', '4'), (3, '15.0', '1'), (4, 'abc', '3'), (5, '-1.0', '5')`,
  `DROP TABLE IF EXISTS test_db.quality_test_sample;
CREATE TABLE test_db.quality_test_sample (
  id INT NOT NULL, score DOUBLE, category VARCHAR(50)
) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num"="1");
INSERT INTO test_db.quality_test_sample VALUES
  (1, 5.0, '2'), (2, 15.0, '4'), (3, 3.0, '1'), (4, -1.0, '3'), (5, 8.0, '5'),
  (6, 7.0, '1'), (7, 9.0, '2'), (8, 2.0, '3'), (9, 6.0, '1'), (10, 4.0, '2')`,
  `DROP TABLE IF EXISTS test_db.quality_test_partition;
CREATE TABLE test_db.quality_test_partition (
  id INT NOT NULL, score DOUBLE, category VARCHAR(50), dt DATE NOT NULL
) PARTITION BY RANGE(dt) (
  PARTITION p20260401 VALUES LESS THAN ('2026-04-02'),
  PARTITION p20260402 VALUES LESS THAN ('2026-04-03')
) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num"="1");
INSERT INTO test_db.quality_test_partition VALUES
  (1, 5.0, '2', '2026-04-01'), (2, 15.0, '4', '2026-04-01'),
  (3, 3.0, '1', '2026-04-02'), (4, -1.0, '3', '2026-04-02')`,
  `DROP TABLE IF EXISTS test_db.quality_test_enum_pass;
CREATE TABLE test_db.quality_test_enum_pass (
  id INT NOT NULL, category VARCHAR(50)
) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num"="1");
INSERT INTO test_db.quality_test_enum_pass VALUES (1, '1'), (2, '2'), (3, '3')`,
];

test("建表：创建 test_db 及全部测试表", async ({ page }) => {
  await applyRuntimeCookies(page, "batch");
  for (let i = 0; i < SQLS.length; i++) {
    const name = `setup_${Date.now().toString(36)}_${i}`;
    await executeSqlViaBatchDoris(page, SQLS[i], name, PROJECT);
  }
});
