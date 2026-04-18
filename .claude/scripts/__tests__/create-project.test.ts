import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

const TMP = join(tmpdir(), `qa-flow-cp-int-${process.pid}`);
const WORKSPACE_DIR = join(TMP, "workspace");
const CONFIG_PATH = join(TMP, "config.json");
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

function runCp(
  args: string[],
): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(
      "bun",
      ["run", ".claude/scripts/create-project.ts", ...args],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          WORKSPACE_DIR,
          CONFIG_JSON_PATH: CONFIG_PATH,
        },
      },
    );
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      code: e.status ?? 1,
    };
  }
}

function resetFixture(): void {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(WORKSPACE_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ projects: {} }, null, 2));
}

describe("create-project scan", () => {
  before(() => resetFixture());
  after(() => rmSync(TMP, { recursive: true, force: true }));
  beforeEach(() => resetFixture());

  it("rejects invalid project name", () => {
    const { stderr, code } = runCp(["scan", "--project", "1invalid"]);
    assert.equal(code, 1);
    assert.match(stderr, /\[create-project\] Invalid project name/);
  });

  it("reports non-existent project with all missing", () => {
    const { stdout, code } = runCp(["scan", "--project", "ghost"]);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.project, "ghost");
    assert.equal(data.valid_name, true);
    assert.equal(data.exists, false);
    assert.equal(data.skeleton_complete, false);
    assert.equal(data.missing_dirs.length, 13);
    assert.equal(data.missing_gitkeeps.length, 11);
    assert.equal(data.missing_files.length, 3);
    assert.equal(data.config_registered, false);
  });

  it("reports config_registered=true when project exists in config.json", () => {
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify(
        { projects: { registered: { repo_profiles: {} } } },
        null,
        2,
      ),
    );
    const { stdout, code } = runCp(["scan", "--project", "registered"]);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.config_registered, true);
  });

  it("reports skeleton_complete=true for fully populated project", () => {
    const projDir = join(WORKSPACE_DIR, "fullProj");
    const tplRoot = join(REPO_ROOT, "templates", "project-skeleton");
    const dirs = [
      "prds",
      "xmind",
      "archive",
      "issues",
      "historys",
      "reports",
      "tests",
      "rules",
      "knowledge",
      "knowledge/modules",
      "knowledge/pitfalls",
      ".repos",
      ".temp",
    ];
    for (const d of dirs) mkdirSync(join(projDir, d), { recursive: true });
    const gks = [
      "prds",
      "xmind",
      "archive",
      "issues",
      "historys",
      "reports",
      "tests",
      "knowledge/modules",
      "knowledge/pitfalls",
      ".repos",
      ".temp",
    ];
    for (const g of gks) writeFileSync(join(projDir, g, ".gitkeep"), "");
    writeFileSync(join(projDir, "rules", "README.md"), "# fullProj rules");
    writeFileSync(
      join(projDir, "knowledge", "overview.md"),
      "# fullProj overview",
    );
    writeFileSync(join(projDir, "knowledge", "terms.md"), "# fullProj terms");

    void tplRoot;

    const { stdout, code } = runCp(["scan", "--project", "fullProj"]);
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.exists, true);
    assert.equal(data.skeleton_complete, true);
    assert.equal(data.missing_dirs.length, 0);
    assert.equal(data.missing_files.length, 0);
    assert.equal(data.missing_gitkeeps.length, 0);
  });
});
