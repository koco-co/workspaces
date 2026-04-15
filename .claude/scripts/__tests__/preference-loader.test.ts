import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";

const TMP_DIR = join(tmpdir(), `qa-flow-pref-loader-test-${process.pid}`);
const GLOBAL_PREFS_DIR = join(TMP_DIR, "global-prefs");
const WORKSPACE_DIR = join(TMP_DIR, "workspace");

function runLoader(
  args: string[],
  extraEnv: Record<string, string> = {},
): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(
      "bun",
      ["run", ".claude/scripts/preference-loader.ts", ...args],
      {
        cwd: resolve(import.meta.dirname, "../../.."),
        encoding: "utf8",
        env: {
          ...process.env,
          WORKSPACE_DIR,
          QA_PREFERENCES_DIR: GLOBAL_PREFS_DIR,
          ...extraEnv,
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

function writeGlobalPref(filename: string, content: string): void {
  mkdirSync(GLOBAL_PREFS_DIR, { recursive: true });
  writeFileSync(join(GLOBAL_PREFS_DIR, filename), content, "utf8");
}

function writeProjectPref(project: string, filename: string, content: string): void {
  const dir = join(WORKSPACE_DIR, project, "preferences");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf8");
}

after(() => {
  try {
    rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("preference-loader.ts load — project overrides global", () => {
  it("project-level value overrides global value for same key", () => {
    writeGlobalPref(
      "case-writing.md",
      "# 用例编写偏好\n> 优先级说明\nrule_a: global_value\nrule_b: global_only\n",
    );
    writeProjectPref(
      "myProject",
      "case-writing.md",
      "# 用例编写偏好\nrule_a: project_value\n",
    );

    const { stdout, code } = runLoader(["load", "--project", "myProject"]);
    assert.equal(code, 0, `expected exit 0, got stderr: ${stdout}`);

    const result = JSON.parse(stdout) as Record<string, Record<string, string>>;
    assert.ok("case-writing" in result, "should have case-writing key");
    assert.equal(result["case-writing"]["rule_a"], "project_value", "project should override global");
    assert.equal(result["case-writing"]["rule_b"], "global_only", "global-only key should remain");
  });
});

describe("preference-loader.ts load — falls back to global when no project prefs", () => {
  it("uses global preferences when project has no preference files", () => {
    writeGlobalPref(
      "xmind-structure.md",
      "# XMind 结构偏好\n> 优先级说明\niteration_id: 42\nroot_title_template: test-template\n",
    );
    // no project prefs for this project

    const { stdout, code } = runLoader(["load", "--project", "emptyProject"]);
    assert.equal(code, 0, `expected exit 0`);

    const result = JSON.parse(stdout) as Record<string, Record<string, string>>;
    assert.ok("xmind-structure" in result, "should have xmind-structure key");
    assert.equal(result["xmind-structure"]["iteration_id"], "42");
    assert.equal(result["xmind-structure"]["root_title_template"], "test-template");
  });
});

describe("preference-loader.ts load — empty when no preference files exist", () => {
  it("returns empty object when no global and no project preferences exist", () => {
    const { stdout, code } = runLoader(["load", "--project", "ghostProject"], {
      QA_PREFERENCES_DIR: join(TMP_DIR, "nonexistent-global"),
    });
    assert.equal(code, 0, `expected exit 0`);

    const result = JSON.parse(stdout) as Record<string, unknown>;
    assert.deepEqual(result, {}, "should return empty object when no prefs found");
  });
});

describe("preference-loader.ts load — parse rules", () => {
  it("skips lines starting with #, >, (, and blank lines", () => {
    writeGlobalPref(
      "test-rules.md",
      [
        "# heading line",
        "> priority explanation",
        "(some parenthetical)",
        "",
        "valid_key: valid_value",
        "another_key: another_value",
      ].join("\n"),
    );

    const { stdout, code } = runLoader(["load", "--project", "parseProject"]);
    assert.equal(code, 0);

    const result = JSON.parse(stdout) as Record<string, Record<string, string>>;
    assert.ok("test-rules" in result, "should have test-rules key");
    assert.equal(result["test-rules"]["valid_key"], "valid_value");
    assert.equal(result["test-rules"]["another_key"], "another_value");
    assert.ok(!("#" in result["test-rules"]), "# lines should be skipped");
    assert.ok(!(">" in result["test-rules"]), "> lines should be skipped");
  });

  it("uses filename without .md as the output key", () => {
    writeGlobalPref("my-pref-file.md", "some_key: some_value\n");

    const { stdout, code } = runLoader(["load", "--project", "keyProject"]);
    assert.equal(code, 0);

    const result = JSON.parse(stdout) as Record<string, unknown>;
    assert.ok("my-pref-file" in result, "key should be filename without .md");
  });
});

describe("preference-loader.ts load — multiple preference files merged", () => {
  it("output contains keys for all preference files found", () => {
    writeGlobalPref("alpha.md", "key1: val1\n");
    writeGlobalPref("beta.md", "key2: val2\n");

    const { stdout, code } = runLoader(["load", "--project", "multiProject"]);
    assert.equal(code, 0);

    const result = JSON.parse(stdout) as Record<string, unknown>;
    assert.ok("alpha" in result, "should have alpha");
    assert.ok("beta" in result, "should have beta");
  });
});
