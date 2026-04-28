import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, cpSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "../../..");
const FIXTURE = resolve(import.meta.dir, "../migration/fixtures/mini-workspace");

describe("kata-cli migrate-workspace --mode dry", () => {
  test("returns 0, writes log, leaves fixture untouched", () => {
    const tmp = mkdtempSync(join(tmpdir(), "kata-cli-mig-"));
    const wsDir = join(tmp, "workspace");
    cpSync(FIXTURE, join(wsDir, "myproj"), { recursive: true });
    const logPath = join(tmp, "dryrun.log.json");

    const result = spawnSync(
      "bun",
      [
        "run",
        join(REPO, "engine/bin/kata-cli"),
        "migrate-workspace",
        "--project", "myproj",
        "--mode", "dry",
        "--log", logPath,
      ],
      {
        env: { ...process.env, WORKSPACE_DIR: wsDir },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(existsSync(logPath)).toBe(true);
    expect(existsSync(join(wsDir, "myproj/features"))).toBe(false);
  });
});
