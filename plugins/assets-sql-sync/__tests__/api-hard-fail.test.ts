import { describe, expect, mock, test } from "bun:test";
import { AssetsApi } from "../src/api/assets";
import { BatchApi } from "../src/api/batch";
import type { DtStackClient } from "../src/client";

describe("assets-sql-sync hard fail rules", () => {
  test("BatchApi.executeDDL throws when INSERT fails", async () => {
    const mockClient = {
      postWithProjectId: mock(() => Promise.reject(new Error("insert denied"))),
    } as unknown as DtStackClient;

    const api = new BatchApi(mockClient);

    await expect(
      api.executeDDL(
        1,
        {
          id: 2,
          dataName: "doris",
          dataSourceType: 1,
          schemaName: "test_db",
        },
        "INSERT INTO test_table VALUES (1)",
      ),
    ).rejects.toThrow("INSERT execution failed: insert denied");
  });

  test("AssetsApi.pollSyncComplete throws on timeout instead of continuing", async () => {
    const mockClient = {
      post: mock(() => Promise.resolve({ code: 1, data: [] })),
    } as unknown as DtStackClient;

    const api = new AssetsApi(mockClient);

    await expect(api.pollSyncComplete(1, ["test_table"], 0)).rejects.toThrow(
      "Metadata sync timed out after 0ms while waiting for test_table.",
    );
  });
});
