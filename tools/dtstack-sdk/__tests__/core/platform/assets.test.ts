import { describe, expect, mock, test } from "bun:test";
import { AssetsApi } from "../../../src/core/platform/assets";
import type { DtStackClientLike } from "../../../src/core/http/client";

describe("AssetsApi", () => {
  test("findImportedDatasource returns matching record", async () => {
    const post = mock(async () => ({
      code: 1,
      data: { records: [{ id: 1, dataSourceName: "doris-test", dtCenterSourceName: "doris-test" }] },
    }));
    const api = new AssetsApi({ post } as unknown as DtStackClientLike);
    const result = await api.findImportedDatasource("doris-test");
    expect(result?.id).toBe(1);
  });

  test("triggerSync throws on non-1 code", async () => {
    const post = mock(async () => ({ code: 0, message: "fail", data: null }));
    const api = new AssetsApi({ post } as unknown as DtStackClientLike);
    expect(api.triggerSync(1, 119)).rejects.toThrow(/Trigger sync failed/);
  });
});
