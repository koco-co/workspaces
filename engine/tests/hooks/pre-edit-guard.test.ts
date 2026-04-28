import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const HOOK = join(import.meta.dirname, "../../hooks/pre-edit-guard.ts");

describe("pre-edit-guard hook (H1)", () => {
  test("blocks Edit on .repos/", () => {
    const input = JSON.stringify({
      tool_name: "Edit",
      tool_input: { file_path: "/Users/poco/Projects/kata/workspace/dataAssets/.repos/foo/bar.ts" },
    });
    const r = spawnSync("bun", ["run", HOOK], { input, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(".repos/");
  });

  test("allows Edit on workspace/{p}/features/", () => {
    const input = JSON.stringify({
      tool_name: "Edit",
      tool_input: { file_path: "/Users/poco/Projects/kata/workspace/dataAssets/features/202604-foo/tests/cases/t1.ts" },
    });
    const r = spawnSync("bun", ["run", HOOK], { input, encoding: "utf8" });
    expect(r.status).toBe(0);
  });
});
