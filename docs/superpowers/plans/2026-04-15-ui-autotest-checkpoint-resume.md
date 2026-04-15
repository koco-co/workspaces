# UI 自动化测试断点续传 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ui-autotest skill 的步骤 4~6 添加 JSON 状态文件断点续传，跨会话保留执行进度。

**Architecture:** 新建 `ui-autotest-progress.ts` CLI 工具管理状态文件读写，遵循现有 `state.ts` 的 Commander + immutable 模式。SKILL.md 在关键节点插入状态写入指令和恢复检查步骤。

**Tech Stack:** Bun, Commander, node:fs, node:test

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `.claude/scripts/ui-autotest-progress.ts` | Create | 状态文件 CRUD CLI — create/update/read/reset/summary 子命令 |
| `.claude/scripts/__tests__/ui-autotest-progress.test.ts` | Create | 单元测试 — 覆盖所有子命令和边界情况 |
| `.claude/skills/ui-autotest/SKILL.md` | Modify | 插入恢复检查步骤 + 步骤 4/5/6 状态写入指令 |

---

### Task 1: ui-autotest-progress.ts — Types + slugify + file path

**Files:**
- Create: `.claude/scripts/ui-autotest-progress.ts`
- Reference: `.claude/scripts/state.ts` (pattern to follow)
- Reference: `.claude/scripts/lib/paths.ts` (projectPath, tempDir)

- [ ] **Step 1: Write the failing test — slugify function**

Create `.claude/scripts/__tests__/ui-autotest-progress.test.ts`:

```typescript
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";

const TMP_DIR = join(tmpdir(), `qa-flow-uap-test-${process.pid}`);
const SCRIPT = ".claude/scripts/ui-autotest-progress.ts";
const CWD = resolve(import.meta.dirname, "../../..");

function run(
  args: string[],
  extraEnv: Record<string, string> = {},
): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync("bun", ["run", SCRIPT, ...args], {
      cwd: CWD,
      encoding: "utf8",
      env: { ...process.env, WORKSPACE_DIR: join(TMP_DIR, "workspace"), ...extraEnv },
    });
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.status ?? 1 };
  }
}

before(() => {
  mkdirSync(join(TMP_DIR, "workspace", "dataAssets", ".temp"), { recursive: true });
});

after(() => {
  try { rmSync(TMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("ui-autotest-progress.ts --help", () => {
  it("shows help without error", () => {
    const { code } = run(["--help"]);
    assert.equal(code, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: FAIL — script file not found

- [ ] **Step 3: Write the script skeleton with types + slugify + Commander setup**

Create `.claude/scripts/ui-autotest-progress.ts`:

```typescript
#!/usr/bin/env bun
/**
 * ui-autotest-progress.ts — UI 自动化测试断点续传状态管理 CLI
 *
 * Usage:
 *   bun run .claude/scripts/ui-autotest-progress.ts create --project dataAssets --suite "套件名" --archive "archive/path.md" --url "http://..."
 *   bun run .claude/scripts/ui-autotest-progress.ts update --project dataAssets --suite "套件名" --case t1 --field test_status --value passed
 *   bun run .claude/scripts/ui-autotest-progress.ts read --project dataAssets --suite "套件名"
 *   bun run .claude/scripts/ui-autotest-progress.ts summary --project dataAssets --suite "套件名"
 *   bun run .claude/scripts/ui-autotest-progress.ts reset --project dataAssets --suite "套件名"
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Command } from "commander";
import { initEnv } from "./lib/env.ts";
import { tempDir } from "./lib/paths.ts";

// ── Types ────────────────────────────────────────────────────────────────────

type TestStatus = "pending" | "running" | "passed" | "failed";
type MergeStatus = "pending" | "completed";

interface CaseState {
  readonly title: string;
  readonly priority: string;
  readonly generated: boolean;
  readonly script_path: string | null;
  readonly test_status: TestStatus;
  readonly attempts: number;
  readonly last_error: string | null;
}

interface Progress {
  readonly version: 1;
  readonly suite_name: string;
  readonly archive_md: string;
  readonly url: string;
  readonly selected_priorities: readonly string[];
  readonly output_dir: string;
  readonly started_at: string;
  readonly updated_at: string;
  readonly current_step: number;
  readonly preconditions_ready: boolean;
  readonly cases: Readonly<Record<string, CaseState>>;
  readonly merge_status: MergeStatus;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .replace(/[()（）#【】&，。、；：""''《》？！\s]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function progressFilePath(project: string, suiteName: string): string {
  return `${tempDir(project)}/ui-autotest-progress-${slugify(suiteName)}.json`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readProgress(project: string, suiteName: string): Progress | null {
  const filePath = progressFilePath(project, suiteName);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Progress;
  } catch (err) {
    throw new Error(`Failed to parse progress file: ${err}`);
  }
}

function writeProgress(project: string, suiteName: string, progress: Progress): void {
  const filePath = progressFilePath(project, suiteName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

// ── Commander ────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("ui-autotest-progress")
  .description("UI 自动化测试断点续传状态管理")
  .helpOption("-h, --help", "Display help information");

program.parse(process.argv);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/ui-autotest-progress.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
git commit -m "feat: scaffold ui-autotest-progress CLI with types and slugify"
```

---

### Task 2: create subcommand

**Files:**
- Modify: `.claude/scripts/ui-autotest-progress.ts`
- Modify: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`

- [ ] **Step 1: Write the failing tests — create subcommand**

Append to test file:

```typescript
describe("ui-autotest-progress.ts create", () => {
  it("creates progress file and outputs JSON", () => {
    const suite = `test-suite-${Date.now()}`;
    const { stdout, code } = run([
      "create", "--project", "dataAssets",
      "--suite", suite,
      "--archive", "workspace/dataAssets/archive/202604/test.md",
      "--url", "http://localhost:8080",
      "--priorities", "P0,P1",
      "--output-dir", "workspace/dataAssets/tests/202604/test/",
      "--cases", JSON.stringify({ t1: { title: "case1", priority: "P0" }, t2: { title: "case2", priority: "P1" } }),
    ]);
    assert.equal(code, 0, `create should exit 0, got: ${stdout}`);
    const progress = JSON.parse(stdout);
    assert.equal(progress.version, 1);
    assert.equal(progress.suite_name, suite);
    assert.equal(progress.current_step, 4);
    assert.equal(progress.preconditions_ready, false);
    assert.equal(progress.merge_status, "pending");
    assert.equal(progress.cases.t1.generated, false);
    assert.equal(progress.cases.t1.test_status, "pending");
    assert.equal(progress.cases.t2.priority, "P1");
  });

  it("creates file on disk", () => {
    const suite = `disk-check-${Date.now()}`;
    run([
      "create", "--project", "dataAssets",
      "--suite", suite,
      "--archive", "test.md", "--url", "http://localhost",
      "--priorities", "P0",
      "--output-dir", "tests/",
      "--cases", JSON.stringify({ t1: { title: "c1", priority: "P0" } }),
    ]);
    const slugged = suite; // suite is already slug-safe here
    const filePath = join(TMP_DIR, "workspace", "dataAssets", ".temp", `ui-autotest-progress-${slugged}.json`);
    assert.ok(existsSync(filePath), "progress file should exist on disk");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: FAIL — create command not defined

- [ ] **Step 3: Implement create subcommand**

Add before `program.parse(process.argv)` in `ui-autotest-progress.ts`:

```typescript
program
  .command("create")
  .description("Create a new progress file for a test suite")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--suite <name>", "Suite name")
  .requiredOption("--archive <path>", "Archive MD path")
  .requiredOption("--url <url>", "Target URL")
  .option("--priorities <list>", "Comma-separated priorities", "P0")
  .option("--output-dir <dir>", "Output directory for scripts")
  .requiredOption("--cases <json>", "JSON object of {id: {title, priority}}")
  .action((opts: {
    project: string; suite: string; archive: string; url: string;
    priorities: string; outputDir?: string; cases: string;
  }) => {
    initEnv();

    let casesInput: Record<string, { title: string; priority: string }>;
    try {
      casesInput = JSON.parse(opts.cases) as Record<string, { title: string; priority: string }>;
    } catch {
      process.stderr.write(`[ui-autotest-progress:create] invalid --cases JSON\n`);
      process.exit(1);
    }

    const now = nowIso();
    const cases: Record<string, CaseState> = {};
    for (const [id, info] of Object.entries(casesInput)) {
      cases[id] = {
        title: info.title,
        priority: info.priority,
        generated: false,
        script_path: null,
        test_status: "pending",
        attempts: 0,
        last_error: null,
      };
    }

    const progress: Progress = {
      version: 1,
      suite_name: opts.suite,
      archive_md: opts.archive,
      url: opts.url,
      selected_priorities: opts.priorities.split(",").map((s) => s.trim()),
      output_dir: opts.outputDir ?? "",
      started_at: now,
      updated_at: now,
      current_step: 4,
      preconditions_ready: false,
      cases,
      merge_status: "pending",
    };

    try {
      writeProgress(opts.project, opts.suite, progress);
      process.stdout.write(`${JSON.stringify(progress, null, 2)}\n`);
    } catch (err) {
      process.stderr.write(`[ui-autotest-progress:create] error: ${err}\n`);
      process.exit(1);
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/ui-autotest-progress.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
git commit -m "feat: add create subcommand for ui-autotest-progress"
```

---

### Task 3: update subcommand

**Files:**
- Modify: `.claude/scripts/ui-autotest-progress.ts`
- Modify: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`

- [ ] **Step 1: Write the failing tests — update subcommand**

Append to test file:

```typescript
function createTestSuite(suite: string, cases: Record<string, { title: string; priority: string }> = { t1: { title: "c1", priority: "P0" } }): void {
  run([
    "create", "--project", "dataAssets",
    "--suite", suite,
    "--archive", "test.md", "--url", "http://localhost",
    "--priorities", "P0", "--output-dir", "tests/",
    "--cases", JSON.stringify(cases),
  ]);
}

describe("ui-autotest-progress.ts update", () => {
  it("updates case field: test_status to passed", () => {
    const suite = `update-status-${Date.now()}`;
    createTestSuite(suite);
    const { stdout, code } = run([
      "update", "--project", "dataAssets", "--suite", suite,
      "--case", "t1", "--field", "test_status", "--value", "passed",
    ]);
    assert.equal(code, 0);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.test_status, "passed");
  });

  it("updates case field: generated to true", () => {
    const suite = `update-gen-${Date.now()}`;
    createTestSuite(suite);
    const { stdout } = run([
      "update", "--project", "dataAssets", "--suite", suite,
      "--case", "t1", "--field", "generated", "--value", "true",
    ]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.generated, true);
  });

  it("updates case field: script_path", () => {
    const suite = `update-path-${Date.now()}`;
    createTestSuite(suite);
    const { stdout } = run([
      "update", "--project", "dataAssets", "--suite", suite,
      "--case", "t1", "--field", "script_path", "--value", "tests/t1.spec.ts",
    ]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.script_path, "tests/t1.spec.ts");
  });

  it("increments attempts when test_status set to running", () => {
    const suite = `update-attempts-${Date.now()}`;
    createTestSuite(suite);
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "test_status", "--value", "running"]);
    const { stdout } = run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "test_status", "--value", "running"]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.attempts, 2);
  });

  it("updates last_error field", () => {
    const suite = `update-error-${Date.now()}`;
    createTestSuite(suite);
    const { stdout } = run([
      "update", "--project", "dataAssets", "--suite", suite,
      "--case", "t1", "--field", "last_error", "--value", "Timeout 30000ms",
    ]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.last_error, "Timeout 30000ms");
  });

  it("updates top-level field: current_step", () => {
    const suite = `update-step-${Date.now()}`;
    createTestSuite(suite);
    const { stdout } = run([
      "update", "--project", "dataAssets", "--suite", suite,
      "--field", "current_step", "--value", "5",
    ]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.current_step, 5);
  });

  it("updates top-level field: preconditions_ready", () => {
    const suite = `update-precond-${Date.now()}`;
    createTestSuite(suite);
    const { stdout } = run([
      "update", "--project", "dataAssets", "--suite", suite,
      "--field", "preconditions_ready", "--value", "true",
    ]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.preconditions_ready, true);
  });

  it("updates top-level field: merge_status", () => {
    const suite = `update-merge-${Date.now()}`;
    createTestSuite(suite);
    const { stdout } = run([
      "update", "--project", "dataAssets", "--suite", suite,
      "--field", "merge_status", "--value", "completed",
    ]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.merge_status, "completed");
  });

  it("refreshes updated_at on each update", async () => {
    const suite = `update-ts-${Date.now()}`;
    createTestSuite(suite);
    const { stdout: out1 } = run(["read", "--project", "dataAssets", "--suite", suite]);
    const before = JSON.parse(out1).updated_at;
    await new Promise((r) => setTimeout(r, 10));
    const { stdout: out2 } = run(["update", "--project", "dataAssets", "--suite", suite, "--field", "current_step", "--value", "5"]);
    const after = JSON.parse(out2).updated_at;
    assert.notEqual(before, after);
  });

  it("exits 1 when progress file not found", () => {
    const { code } = run(["update", "--project", "dataAssets", "--suite", "nonexistent", "--field", "current_step", "--value", "5"]);
    assert.equal(code, 1);
  });

  it("exits 1 when case not found", () => {
    const suite = `update-nocase-${Date.now()}`;
    createTestSuite(suite);
    const { code } = run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t99", "--field", "test_status", "--value", "passed"]);
    assert.equal(code, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: FAIL — update command not defined

- [ ] **Step 3: Implement update subcommand**

Add before `program.parse(process.argv)`:

```typescript
// ── Typed field coercion ──────────────────────────────────────────────────────

const BOOLEAN_FIELDS = new Set(["generated", "preconditions_ready"]);
const NUMBER_FIELDS = new Set(["current_step", "attempts"]);

function coerceValue(field: string, raw: string): string | number | boolean | null {
  if (raw === "null") return null;
  if (BOOLEAN_FIELDS.has(field)) return raw === "true";
  if (NUMBER_FIELDS.has(field)) return Number(raw);
  return raw;
}

// ── update ────────────────────────────────────────────────────────────────────

program
  .command("update")
  .description("Update a field in the progress file (case-level or top-level)")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--suite <name>", "Suite name")
  .option("--case <id>", "Case ID (omit for top-level field)")
  .requiredOption("--field <name>", "Field name to update")
  .requiredOption("--value <val>", "New value")
  .action((opts: { project: string; suite: string; case?: string; field: string; value: string }) => {
    initEnv();

    const progress = readProgress(opts.project, opts.suite);
    if (!progress) {
      process.stderr.write(`[ui-autotest-progress:update] progress file not found for suite "${opts.suite}"\n`);
      process.exit(1);
    }

    const coerced = coerceValue(opts.field, opts.value);

    if (opts.case) {
      // Case-level update
      const existing = progress.cases[opts.case];
      if (!existing) {
        process.stderr.write(`[ui-autotest-progress:update] case "${opts.case}" not found\n`);
        process.exit(1);
      }

      const shouldIncrementAttempts = opts.field === "test_status" && coerced === "running";
      const updatedCase: CaseState = {
        ...existing,
        [opts.field]: coerced,
        attempts: shouldIncrementAttempts ? existing.attempts + 1 : existing.attempts,
      };

      const updated: Progress = {
        ...progress,
        cases: { ...progress.cases, [opts.case]: updatedCase },
        updated_at: nowIso(),
      };

      writeProgress(opts.project, opts.suite, updated);
      process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    } else {
      // Top-level update
      const updated: Progress = {
        ...progress,
        [opts.field]: coerced,
        updated_at: nowIso(),
      };

      writeProgress(opts.project, opts.suite, updated);
      process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/ui-autotest-progress.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
git commit -m "feat: add update subcommand for ui-autotest-progress"
```

---

### Task 4: read, summary, reset subcommands

**Files:**
- Modify: `.claude/scripts/ui-autotest-progress.ts`
- Modify: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to test file:

```typescript
describe("ui-autotest-progress.ts read", () => {
  it("returns current progress JSON", () => {
    const suite = `read-test-${Date.now()}`;
    createTestSuite(suite);
    const { stdout, code } = run(["read", "--project", "dataAssets", "--suite", suite]);
    assert.equal(code, 0);
    const progress = JSON.parse(stdout);
    assert.equal(progress.suite_name, suite);
  });

  it("exits 1 when not found", () => {
    const { code } = run(["read", "--project", "dataAssets", "--suite", "nonexistent"]);
    assert.equal(code, 1);
  });
});

describe("ui-autotest-progress.ts summary", () => {
  it("returns human-readable summary with counts", () => {
    const suite = `summary-test-${Date.now()}`;
    createTestSuite(suite, {
      t1: { title: "c1", priority: "P0" },
      t2: { title: "c2", priority: "P0" },
      t3: { title: "c3", priority: "P1" },
    });
    // Mark t1 as passed
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "test_status", "--value", "passed"]);
    // Mark t2 as failed
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t2", "--field", "test_status", "--value", "failed"]);

    const { stdout, code } = run(["summary", "--project", "dataAssets", "--suite", suite]);
    assert.equal(code, 0);
    const summary = JSON.parse(stdout);
    assert.equal(summary.total, 3);
    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.pending, 1);
    assert.equal(summary.current_step, 4);
    assert.ok(typeof summary.expired === "boolean");
  });

  it("detects expired progress (> 7 days)", () => {
    const suite = `summary-expired-${Date.now()}`;
    createTestSuite(suite);
    // Manually write an old updated_at
    const { stdout: readOut } = run(["read", "--project", "dataAssets", "--suite", suite]);
    const progress = JSON.parse(readOut);
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const tampered = { ...progress, updated_at: old };
    const filePath = join(TMP_DIR, "workspace", "dataAssets", ".temp", `ui-autotest-progress-${suite}.json`);
    require("node:fs").writeFileSync(filePath, JSON.stringify(tampered, null, 2));

    const { stdout } = run(["summary", "--project", "dataAssets", "--suite", suite]);
    const summary = JSON.parse(stdout);
    assert.equal(summary.expired, true);
  });
});

describe("ui-autotest-progress.ts reset", () => {
  it("deletes progress file", () => {
    const suite = `reset-test-${Date.now()}`;
    createTestSuite(suite);
    const { code } = run(["reset", "--project", "dataAssets", "--suite", suite]);
    assert.equal(code, 0);
    const { code: readCode } = run(["read", "--project", "dataAssets", "--suite", suite]);
    assert.equal(readCode, 1);
  });

  it("succeeds even when file does not exist", () => {
    const { code } = run(["reset", "--project", "dataAssets", "--suite", "nonexistent"]);
    assert.equal(code, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: FAIL — read/summary/reset commands not defined

- [ ] **Step 3: Implement read, summary, reset subcommands**

Add before `program.parse(process.argv)`:

```typescript
// ── read ──────────────────────────────────────────────────────────────────────

program
  .command("read")
  .description("Read and output current progress")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--suite <name>", "Suite name")
  .action((opts: { project: string; suite: string }) => {
    initEnv();
    const progress = readProgress(opts.project, opts.suite);
    if (!progress) {
      process.stderr.write(`[ui-autotest-progress:read] progress not found for "${opts.suite}"\n`);
      process.exit(1);
    }
    process.stdout.write(`${JSON.stringify(progress, null, 2)}\n`);
  });

// ── summary ───────────────────────────────────────────────────────────────────

program
  .command("summary")
  .description("Output a human-readable progress summary as JSON")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--suite <name>", "Suite name")
  .action((opts: { project: string; suite: string }) => {
    initEnv();
    const progress = readProgress(opts.project, opts.suite);
    if (!progress) {
      process.stderr.write(`[ui-autotest-progress:summary] progress not found for "${opts.suite}"\n`);
      process.exit(1);
    }

    const cases = Object.values(progress.cases);
    const passed = cases.filter((c) => c.test_status === "passed").length;
    const failed = cases.filter((c) => c.test_status === "failed").length;
    const running = cases.filter((c) => c.test_status === "running").length;
    const pending = cases.filter((c) => c.test_status === "pending").length;
    const generated = cases.filter((c) => c.generated).length;

    const EXPIRY_DAYS = 7;
    const updatedMs = new Date(progress.updated_at).getTime();
    const expired = Date.now() - updatedMs > EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const summary = {
      suite_name: progress.suite_name,
      current_step: progress.current_step,
      preconditions_ready: progress.preconditions_ready,
      merge_status: progress.merge_status,
      total: cases.length,
      generated,
      passed,
      failed,
      running,
      pending,
      expired,
      updated_at: progress.updated_at,
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  });

// ── reset ─────────────────────────────────────────────────────────────────────

program
  .command("reset")
  .description("Delete progress file for a suite")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--suite <name>", "Suite name")
  .action((opts: { project: string; suite: string }) => {
    initEnv();
    const filePath = progressFilePath(opts.project, opts.suite);
    try {
      if (existsSync(filePath)) rmSync(filePath);
      process.stdout.write(`${JSON.stringify({ reset: true, path: filePath })}\n`);
    } catch (err) {
      process.stderr.write(`[ui-autotest-progress:reset] error: ${err}\n`);
      process.exit(1);
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/ui-autotest-progress.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
git commit -m "feat: add read, summary, reset subcommands for ui-autotest-progress"
```

---

### Task 5: resume subcommand (sanitize running → pending)

**Files:**
- Modify: `.claude/scripts/ui-autotest-progress.ts`
- Modify: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to test file:

```typescript
describe("ui-autotest-progress.ts resume", () => {
  it("resets 'running' cases to 'pending'", () => {
    const suite = `resume-running-${Date.now()}`;
    createTestSuite(suite, { t1: { title: "c1", priority: "P0" }, t2: { title: "c2", priority: "P0" } });
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "test_status", "--value", "running"]);

    const { stdout, code } = run(["resume", "--project", "dataAssets", "--suite", suite]);
    assert.equal(code, 0);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.test_status, "pending");
    assert.equal(progress.cases.t2.test_status, "pending");
  });

  it("with --retry-failed resets failed cases to pending and clears attempts", () => {
    const suite = `resume-retry-${Date.now()}`;
    createTestSuite(suite, { t1: { title: "c1", priority: "P0" }, t2: { title: "c2", priority: "P0" } });
    // t1 passed, t2 failed with 3 attempts
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "test_status", "--value", "passed"]);
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t2", "--field", "test_status", "--value", "failed"]);
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t2", "--field", "attempts", "--value", "3"]);

    const { stdout } = run(["resume", "--project", "dataAssets", "--suite", suite, "--retry-failed"]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.test_status, "passed"); // stays passed
    assert.equal(progress.cases.t2.test_status, "pending"); // reset
    assert.equal(progress.cases.t2.attempts, 0); // cleared
  });

  it("validates script_path existence and resets generated if missing", () => {
    const suite = `resume-validate-${Date.now()}`;
    createTestSuite(suite);
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "generated", "--value", "true"]);
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "script_path", "--value", "/nonexistent/path.ts"]);

    const { stdout } = run(["resume", "--project", "dataAssets", "--suite", suite]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.generated, false);
    assert.equal(progress.cases.t1.script_path, null);
  });

  it("persists sanitized state to disk", () => {
    const suite = `resume-persist-${Date.now()}`;
    createTestSuite(suite);
    run(["update", "--project", "dataAssets", "--suite", suite, "--case", "t1", "--field", "test_status", "--value", "running"]);
    run(["resume", "--project", "dataAssets", "--suite", suite]);

    const { stdout } = run(["read", "--project", "dataAssets", "--suite", suite]);
    const progress = JSON.parse(stdout);
    assert.equal(progress.cases.t1.test_status, "pending");
  });

  it("exits 1 when progress not found", () => {
    const { code } = run(["resume", "--project", "dataAssets", "--suite", "nonexistent"]);
    assert.equal(code, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: FAIL — resume command not defined

- [ ] **Step 3: Implement resume subcommand**

Add before `program.parse(process.argv)`:

```typescript
// ── resume ────────────────────────────────────────────────────────────────────

program
  .command("resume")
  .description("Sanitize progress for resumption: reset running→pending, validate script paths")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--suite <name>", "Suite name")
  .option("--retry-failed", "Also reset failed cases to pending and clear attempts")
  .action((opts: { project: string; suite: string; retryFailed?: boolean }) => {
    initEnv();
    const progress = readProgress(opts.project, opts.suite);
    if (!progress) {
      process.stderr.write(`[ui-autotest-progress:resume] progress not found for "${opts.suite}"\n`);
      process.exit(1);
    }

    const sanitizedCases: Record<string, CaseState> = {};
    for (const [id, c] of Object.entries(progress.cases)) {
      let updated = { ...c };

      // Reset running → pending (interrupted mid-execution)
      if (updated.test_status === "running") {
        updated = { ...updated, test_status: "pending" as TestStatus };
      }

      // Reset failed → pending if --retry-failed
      if (opts.retryFailed && updated.test_status === "failed") {
        updated = { ...updated, test_status: "pending" as TestStatus, attempts: 0, last_error: null };
      }

      // Validate script_path exists
      if (updated.generated && updated.script_path && !existsSync(updated.script_path)) {
        updated = { ...updated, generated: false, script_path: null };
      }

      sanitizedCases[id] = updated;
    }

    const sanitized: Progress = {
      ...progress,
      cases: sanitizedCases,
      updated_at: nowIso(),
    };

    writeProgress(opts.project, opts.suite, sanitized);
    process.stdout.write(`${JSON.stringify(sanitized, null, 2)}\n`);
  });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/ui-autotest-progress.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
git commit -m "feat: add resume subcommand with sanitization and retry-failed"
```

---

### Task 6: Run full test suite + fix any issues

**Files:**
- Reference: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`

- [ ] **Step 1: Run full test suite**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: All tests PASS

- [ ] **Step 2: Run the full project test suite to check no regressions**

```bash
bun test .claude/scripts/__tests__
```

Expected: All tests PASS, no regressions

- [ ] **Step 3: Commit any fixes if needed**

---

### Task 7: SKILL.md — Insert resume check after step 1

**Files:**
- Modify: `.claude/skills/ui-autotest/SKILL.md:185-187` (between step 1 completion and step 2 start)

- [ ] **Step 1: Insert resume check section**

After the line `**✅ Task**：将 **步骤 1** 标记为 **completed**（subject: **步骤 1 — 解析完成，{{total}} 条用例**）。` and before `## 步骤 2：执行范围确认`, insert:

```markdown
## 步骤 1.5：断点续传检查

**⏳ 自动检查**：在步骤 2 之前，检查是否存在未完成的进度：

```bash
bun run .claude/scripts/ui-autotest-progress.ts summary --project {{project}} --suite "{{suite_name}}"
```

**情况 A — 无进度文件**（命令 exit 1）：正常继续步骤 2。

**情况 B — 有进度文件且 `merge_status === "completed"`**：

```
上次执行已全部完成。是否重新开始？
1. 重新开始（清空进度）
2. 取消
```

若选 1，执行 `bun run .claude/scripts/ui-autotest-progress.ts reset --project {{project}} --suite "{{suite_name}}"` 后继续步骤 2。

**情况 C — 有进度文件且未完成**：

先执行 resume 清理中断状态：

```bash
bun run .claude/scripts/ui-autotest-progress.ts resume --project {{project}} --suite "{{suite_name}}"
```

然后读取 summary，向用户展示：

```
检测到上次未完成的执行进度：

套件：{{suite_name}}
中断于：步骤 {{current_step}}
进度：{{passed}} 通过, {{failed}} 失败, {{pending}} 待执行
上次更新：{{updated_at}}
{{#if expired}}⚠️ 上次进度已超过 7 天，环境可能已变化。建议选择「全部重新开始」。{{/if}}

请选择：
1. 继续执行（跳过已通过，从待执行的继续）
2. 重试失败项（重跑失败用例，再继续待执行的）
3. 全部重新开始（清空进度，从头来）
```

- 选 1：直接跳到 `current_step` 对应的步骤（4/5/6），已 passed 的用例自动跳过
- 选 2：执行 `bun run .claude/scripts/ui-autotest-progress.ts resume --project {{project}} --suite "{{suite_name}}" --retry-failed`，然后跳到 `current_step`
- 选 3：执行 `reset`，正常从步骤 2 继续

> **恢复跳转规则**：恢复时直接跳到 `current_step` 对应的步骤。步骤 1~3（解析、范围、登录态）始终重新执行（它们很快且登录态需刷新），但从进度文件中恢复 `url`、`selected_priorities` 等参数，无需重新询问用户。
```

- [ ] **Step 2: Verify SKILL.md syntax is correct**

Read the modified section to confirm markdown formatting and command paths are correct.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/ui-autotest/SKILL.md
git commit -m "feat: add resume check step (1.5) to ui-autotest SKILL.md"
```

---

### Task 8: SKILL.md — Add state writes to step 4 (script generation)

**Files:**
- Modify: `.claude/skills/ui-autotest/SKILL.md` (step 4 section)

- [ ] **Step 1: Add state creation at step 4 start**

After `**⏳ Task**：将 **步骤 4** 标记为 **in_progress**`（line ~251）, add:

```markdown
**💾 进度持久化 — 初始化**：

若不是从断点恢复（即步骤 1.5 未检测到进度文件），创建进度文件：

```bash
bun run .claude/scripts/ui-autotest-progress.ts create \
  --project {{project}} \
  --suite "{{suite_name}}" \
  --archive "{{md_path}}" \
  --url "{{url}}" \
  --priorities "{{selected_priorities | join(',')}}" \
  --output-dir "workspace/{{project}}/tests/{{YYYYMM}}/{{suite_name}}/" \
  --cases '{{tasks_json}}'
```

其中 `tasks_json` 为 `{id: {title, priority}}` 格式的 JSON，从步骤 1 解析结果构造。
```

- [ ] **Step 2: Add per-case write after each generation**

After `**4.3 输出格式**` section, before `**✅ Task**：所有 Sub-Agent 完成后`, add:

```markdown
**💾 进度持久化 — 脚本生成完成**：

每条用例的 sub-agent 完成后，更新进度：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --case {{id}} --field generated --value true
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --case {{id}} --field script_path --value "workspace/{{project}}/.temp/ui-blocks/{{id}}.ts"
```

断点恢复时，跳过 `generated === true` 的用例，只生成剩余的。
```

- [ ] **Step 3: Add step transition write**

After `**✅ Task**：所有 Sub-Agent 完成后，将 **步骤 4** 标记为 **completed**`, add:

```markdown
**💾 进度持久化 — 步骤 4 完成**：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --field current_step --value 5
```
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/ui-autotest/SKILL.md
git commit -m "feat: add state writes to step 4 in ui-autotest SKILL.md"
```

---

### Task 9: SKILL.md — Add state writes to step 5 (self-test)

**Files:**
- Modify: `.claude/skills/ui-autotest/SKILL.md` (step 5 section)

- [ ] **Step 1: Add preconditions_ready write**

After `**5.1 逐条执行验证**` heading, add:

```markdown
**💾 进度持久化 — 前置条件就绪**：

前置条件（建表/引入/同步/质量项目授权）完成后：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --field preconditions_ready --value true
```

断点恢复时，若 `preconditions_ready === true`，跳过前置条件准备。
```

- [ ] **Step 2: Add per-case test status writes**

After the existing `QA_PROJECT={{project}} bunx playwright test` command block, add:

```markdown
**💾 进度持久化 — 自测状态**：

每条用例执行前：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --case {{id}} --field test_status --value running
```

执行结果（通过）：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --case {{id}} --field test_status --value passed
```

执行结果（失败）：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --case {{id}} --field test_status --value failed
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --case {{id}} --field last_error --value "{{error_summary}}"
```

断点恢复时，跳过 `test_status === "passed"` 的用例。对于 `test_status === "failed"` 且 `attempts >= 3` 的用例，也跳过（除非用户选择「重试失败项」）。
```

- [ ] **Step 3: Add step transition write**

After `**✅ Task**：所有用例自测完成后，将 **步骤 5** 标记为 **completed**`, add:

```markdown
**💾 进度持久化 — 步骤 5 完成**：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --field current_step --value 6
```
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/ui-autotest/SKILL.md
git commit -m "feat: add state writes to step 5 in ui-autotest SKILL.md"
```

---

### Task 10: SKILL.md — Add state writes to step 6 (merge)

**Files:**
- Modify: `.claude/skills/ui-autotest/SKILL.md` (step 6 section)

- [ ] **Step 1: Add merge completion write**

After `**✅ Task**：将 **步骤 6** 标记为 **completed**`, add:

```markdown
**💾 进度持久化 — 合并完成**：

```bash
bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite_name}}" --field merge_status --value completed
```
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/ui-autotest/SKILL.md
git commit -m "feat: add state writes to step 6 in ui-autotest SKILL.md"
```

---

### Task 11: Final verification — run all tests

**Files:**
- Reference: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`
- Reference: `.claude/scripts/__tests__/*.test.ts`

- [ ] **Step 1: Run ui-autotest-progress tests**

```bash
bun test .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

Expected: All tests PASS

- [ ] **Step 2: Run full project test suite**

```bash
bun test .claude/scripts/__tests__
```

Expected: All tests PASS, no regressions

- [ ] **Step 3: Verify SKILL.md is valid markdown**

Read the full SKILL.md to confirm no broken markdown formatting.

- [ ] **Step 4: Final commit if any fixes**
