import { describe, expect, mock, test } from "bun:test";
import { BatchApi } from "../../../src/core/platform/batch";
import type { DtStackClientLike } from "../../../src/core/http/client";

function makeClient(handler: (path: string, body: unknown) => unknown): DtStackClientLike {
  return {
    post: mock(async (path: string, body?: unknown) => ({ code: 1, data: handler(path, body) })),
    postWithProjectId: mock(async (path: string, body: unknown) => ({ code: 1, data: handler(path, body) })),
  } as unknown as DtStackClientLike;
}

describe("BatchApi.executeDDL", () => {
  test("CREATE statement is sent base64-encoded via ddlCreateTableEncryption", async () => {
    let calledPath = "";
    let calledBody: { sql: string } | undefined;
    const client = {
      post: mock(async () => ({ code: 1, data: null })),
      postWithProjectId: mock(async (path: string, body: unknown) => {
        calledPath = path;
        calledBody = body as { sql: string };
        return { code: 1, data: null };
      }),
    } as unknown as DtStackClientLike;

    const api = new BatchApi(client);
    await api.executeDDL(99, { id: 1, dataName: "doris-x", dataSourceType: 119, schemaName: "s" }, "CREATE TABLE t (id int)");

    expect(calledPath).toBe("/api/rdos/batch/batchTableInfo/ddlCreateTableEncryption");
    expect(Buffer.from(calledBody!.sql, "base64").toString("utf-8")).toBe("CREATE TABLE t (id int)");
  });

  test("INSERT statement goes through startCustomSql", async () => {
    let calledPath = "";
    const client = {
      post: mock(async () => ({ code: 1, data: null })),
      postWithProjectId: mock(async (path: string) => { calledPath = path; return { code: 1, data: null }; }),
    } as unknown as DtStackClientLike;

    const api = new BatchApi(client);
    await api.executeDDL(99, { id: 1, dataName: "doris-x", dataSourceType: 119, schemaName: "s" }, "INSERT INTO t VALUES (1)");
    expect(calledPath).toBe("/api/rdos/batch/batchTableInfo/startCustomSql");
  });

  test("findProject returns matching project", async () => {
    const client = makeClient(() => [{ id: 7, projectName: "pw_test" }]);
    const api = new BatchApi(client);
    expect(await api.findProject("pw_test")).toEqual({ id: 7, projectName: "pw_test" });
  });
});
