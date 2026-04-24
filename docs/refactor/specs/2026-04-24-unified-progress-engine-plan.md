# 统一任务进度引擎 `progress` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次性把 `kata-state.ts` 和 `ui-autotest-progress.ts` 两套断点续传机制统一为 `kata-cli progress` 通用引擎，存储移至 `.kata/{project}/`，并同步更新所有 skill 提示词。

**Architecture:** 分三层落地：底层 `progress-store.ts`（纯函数库，读写 + 锁 + 依赖判定） → CLI 层 `progress.ts`（commander 包装所有子命令） → 迁移层 `progress-migrator.ts`（一次性读旧写新）。所有 subagent 通过 CLI 协作，禁直接读写 JSON。

**Tech Stack:** Bun + TypeScript + commander@13 + node:test (via `bun test`) + biome

**Spec 参考：** `docs/refactor/specs/2026-04-24-unified-progress-engine-design.md`

---

## 改动范围

| 类别                                         | 数量 / 处理方式                        |
| -------------------------------------------- | -------------------------------------- |
| 新增脚本                                     | 4 个（progress.ts + 3 lib 模块）       |
| 新增单测                                     | 4 个                                   |
| 修改 `.claude/scripts/kata-cli.ts`           | 增 1 个 import + addCommand，删 2 个   |
| 修改 `.claude/scripts/lib/paths.ts`          | 增 4 个路径函数                        |
| 修改 `.gitignore`                            | 增 `.kata/`                            |
| 删除脚本                                     | 2 个（`kata-state.ts` / `ui-autotest-progress.ts`）|
| 删除单测                                     | 2 个                                   |
| 更新 skill 提示词                            | 9 个 markdown 文件                     |
| 手工集成验证                                 | 1 个 checklist                         |

---

## File Structure

### 新增

```
.claude/scripts/
├── progress.ts                      # CLI 入口，createCli + 所有子命令
└── lib/
    ├── progress-types.ts            # 共享类型 + 状态枚举 + 常量
    ├── progress-store.ts            # 读写 + 锁 + 任务 CRUD + 查询 + 依赖
    └── progress-migrator.ts         # 一次性迁移旧状态

.claude/scripts/__tests__/
├── progress.test.ts                 # CLI 端到端子命令测试
└── lib/
    ├── progress-store.test.ts       # 单测（若 lib 内部函数需直测）
    └── progress-migrator.test.ts    # 迁移单测（fixture 驱动）
```

### 修改

- `.claude/scripts/lib/paths.ts` — 新增 `kataDir / sessionsDir / locksDir / blocksDir / legacyBackupDir`
- `.claude/scripts/kata-cli.ts` — import + addCommand `progress`；删 `kataState`、`uiAutotestProgress`
- `.gitignore` — 新增 `.kata/`

### 删除

- `.claude/scripts/kata-state.ts`
- `.claude/scripts/__tests__/kata-state.test.ts`
- `.claude/scripts/ui-autotest-progress.ts`
- `.claude/scripts/__tests__/ui-autotest-progress.test.ts`

### 更新 skill 提示词（9 个）

- `.claude/skills/test-case-gen/SKILL.md`
- `.claude/skills/test-case-gen/workflow/main.md`
- `.claude/skills/ui-autotest/SKILL.md`
- `.claude/skills/ui-autotest/workflow/step-1.5-resume.md`
- `.claude/skills/ui-autotest/workflow/step-4-script-writer.md`
- `.claude/skills/ui-autotest/workflow/step-5-test-fix.md`
- `.claude/skills/ui-autotest/workflow/step-5.5-convergence.md`
- `.claude/skills/ui-autotest/workflow/step-6-merge.md`
- `.claude/skills/kata/references/quickstart.md`

---

## Task 列表

### Task 1: 路径函数 + `.gitignore`

**Files:**
- Modify: `.claude/scripts/lib/paths.ts`
- Modify: `.gitignore`
- Test: `.claude/scripts/__tests__/paths.test.ts`（若已有则修改；若无则新建）

- [ ] **Step 1.1: 写失败的 paths 测试**

在 `.claude/scripts/__tests__/` 下新建或追加 `paths.test.ts`：

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { join } from "node:path";
import {
  kataDir,
  sessionsDir,
  locksDir,
  blocksDir,
  legacyBackupDir,
  repoRoot,
} from "../lib/paths.ts";

describe("kata paths", () => {
  it("kataDir resolves to .kata/{project} under repo root", () => {
    assert.equal(kataDir("dataAssets"), join(repoRoot(), ".kata", "dataAssets"));
  });

  it("sessionsDir returns .kata/{project}/sessions/{workflow}", () => {
    assert.equal(
      sessionsDir("dataAssets", "test-case-gen"),
      join(repoRoot(), ".kata", "dataAssets", "sessions", "test-case-gen"),
    );
  });

  it("locksDir returns .kata/{project}/locks", () => {
    assert.equal(locksDir("dataAssets"), join(repoRoot(), ".kata", "dataAssets", "locks"));
  });

  it("blocksDir returns .kata/{project}/blocks/{workflow}/{slug}", () => {
    assert.equal(
      blocksDir("dataAssets", "ui-autotest", "suite-x"),
      join(repoRoot(), ".kata", "dataAssets", "blocks", "ui-autotest", "suite-x"),
    );
  });

  it("legacyBackupDir returns .kata/{project}/legacy-backup", () => {
    assert.equal(
      legacyBackupDir("dataAssets"),
      join(repoRoot(), ".kata", "dataAssets", "legacy-backup"),
    );
  });
});
```

- [ ] **Step 1.2: 运行测试确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/paths.test.ts
```

预期：`SyntaxError` 或 `undefined`（导出不存在）。

- [ ] **Step 1.3: 实现 `paths.ts` 新函数**

在 `paths.ts` 末尾追加（放在 `listProjects` 之前或之后都可以）。**关键：** 为便于单测隔离，支持 `KATA_ROOT_OVERRIDE` 环境变量（沿用项目中 `WORKSPACE_DIR` 的 override 模式）：

```ts
// ── kata 进度引擎路径 ───────────────────────────────────

function kataRoot(): string {
  const override = getEnv("KATA_ROOT_OVERRIDE");
  return override ? join(override, ".kata") : join(repoRoot(), ".kata");
}

export function kataDir(project: string): string {
  return join(kataRoot(), project);
}

export function sessionsDir(project: string, workflow: string): string {
  return join(kataDir(project), "sessions", workflow);
}

export function sessionFilePath(
  project: string,
  workflow: string,
  sessionSlug: string,
): string {
  return join(sessionsDir(project, workflow), `${sessionSlug}.json`);
}

export function locksDir(project: string): string {
  return join(kataDir(project), "locks");
}

export function blocksDir(
  project: string,
  workflow: string,
  sessionSlug: string,
): string {
  return join(kataDir(project), "blocks", workflow, sessionSlug);
}

export function legacyBackupDir(project: string): string {
  return join(kataDir(project), "legacy-backup");
}
```

- [ ] **Step 1.4: 运行测试确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/paths.test.ts
```

预期：全部通过。

- [ ] **Step 1.5: 更新 `.gitignore`**

在"工作区临时文件"段落下方（`.temp/` 后面）追加：

```gitignore
# ── kata 进度引擎运行时数据 ───────────────────────────
.kata/
```

- [ ] **Step 1.6: 验证 `.kata/` 被忽略**

```bash
mkdir -p .kata/dataAssets/sessions && touch .kata/dataAssets/sessions/probe.json
git status --porcelain .kata/
# 预期输出为空（说明被忽略）
rm -rf .kata
```

- [ ] **Step 1.7: Commit**

```bash
git add .claude/scripts/lib/paths.ts .claude/scripts/__tests__/paths.test.ts .gitignore
git commit -m "feat(progress): add .kata path helpers and gitignore entry"
```

---

### Task 2: 共享类型模块 `progress-types.ts`

**Files:**
- Create: `.claude/scripts/lib/progress-types.ts`

- [ ] **Step 2.1: 新建类型文件**

```ts
/**
 * progress-types.ts — Shared types for the unified progress engine.
 *
 * See spec: docs/refactor/specs/2026-04-24-unified-progress-engine-design.md
 */

export const SCHEMA_VERSION = 1 as const;

/** Maximum size for inline artifact values before spilling to blocks/. */
export const BLOB_OVERFLOW_THRESHOLD_BYTES = 64 * 1024;

/** Lock acquisition retry configuration. */
export const LOCK_TIMEOUT_MS = 5_000;
export const LOCK_RETRY_BASE_MS = 50;
export const LOCK_RETRY_JITTER_MS = 50;
export const STALE_LOCK_MAX_AGE_MS = 10 * 60 * 1000;

export type TaskStatus =
  | "pending"
  | "running"
  | "done"
  | "blocked"
  | "failed"
  | "skipped";

export const TASK_STATUSES: readonly TaskStatus[] = [
  "pending",
  "running",
  "done",
  "blocked",
  "failed",
  "skipped",
] as const;

/** Statuses that satisfy a `depends_on` prerequisite. */
export const DEPENDENCY_SATISFIED_STATUSES: readonly TaskStatus[] = [
  "done",
  "skipped",
] as const;

/** Parent statuses that make children visible in task-query. */
export const PARENT_VISIBLE_STATUSES: readonly TaskStatus[] = [
  "running",
  "done",
] as const;

export interface ErrorEntry {
  readonly at: string;
  readonly message: string;
}

export interface Task {
  readonly id: string;
  readonly parent: string | null;
  readonly depends_on: readonly string[];
  readonly order: number;
  readonly name: string;
  readonly kind: string;
  readonly status: TaskStatus;
  readonly reason: string | null;
  readonly attempts: number;
  readonly payload: Record<string, unknown>;
  readonly errors: readonly ErrorEntry[];
  readonly started_at: string | null;
  readonly completed_at: string | null;
}

export interface BlobRef {
  readonly $ref: string;
}

export type ArtifactValue = unknown | BlobRef;

export interface Source {
  readonly type: string;
  readonly path: string;
  readonly mtime: string | null;
}

export interface Session {
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly session_id: string;
  readonly workflow: string;
  readonly project: string;
  readonly env: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly source: Source;
  readonly meta: Record<string, unknown>;
  readonly tasks: readonly Task[];
  readonly artifacts: Record<string, ArtifactValue>;
}

/** Exit codes used by progress CLI. Keep in sync with spec. */
export const ExitCode = {
  SUCCESS: 0,
  ARG_ERROR: 1,
  NOT_FOUND: 2,
  LOCK_TIMEOUT: 3,
  DEPENDENCY_UNSATISFIED: 4,
  ROLLUP_INCOMPLETE: 5,
} as const;
```

- [ ] **Step 2.2: 类型自检（tsc 编译通过）**

```bash
bun run type-check
```

预期：无新增 error。

- [ ] **Step 2.3: Commit**

```bash
git add .claude/scripts/lib/progress-types.ts
git commit -m "feat(progress): add shared types module for progress engine"
```

---

### Task 3: 底层存储 `progress-store.ts` — 读写 + 锁

**Files:**
- Create: `.claude/scripts/lib/progress-store.ts`
- Create: `.claude/scripts/__tests__/lib/progress-store.test.ts`

本 Task 只覆盖最底层的读写 + 锁。任务 CRUD、查询、依赖、artifacts 放后续 Task。

- [ ] **Step 3.1: 写失败的读写 + 锁测试**

```ts
// .claude/scripts/__tests__/lib/progress-store.test.ts
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  createSession,
  readSession,
  writeSession,
  withSessionLock,
  sessionIdFor,
} from "../../lib/progress-store.ts";
import type { Session } from "../../lib/progress-types.ts";

const TMP = join(tmpdir(), `progress-store-test-${process.pid}`);

before(() => {
  process.env.KATA_ROOT_OVERRIDE = TMP; // used by progress-store for testability
  mkdirSync(TMP, { recursive: true });
});

after(() => {
  delete process.env.KATA_ROOT_OVERRIDE;
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
});

beforeEach(() => {
  try { rmSync(join(TMP, ".kata"), { recursive: true, force: true }); } catch {}
});

describe("sessionIdFor", () => {
  it("composes workflow/slug-env", () => {
    assert.equal(
      sessionIdFor({ workflow: "test-case-gen", slug: "prd-xxx", env: "default" }),
      "test-case-gen/prd-xxx-default",
    );
  });
});

describe("createSession + readSession", () => {
  it("creates an empty session with schema_version=1", () => {
    const session = createSession({
      project: "dataAssets",
      workflow: "test-case-gen",
      slug: "prd-a",
      env: "default",
      source: { type: "prd", path: "workspace/dataAssets/prds/x.md", mtime: null },
      meta: { mode: "normal" },
    });
    writeSession("dataAssets", session);

    const loaded = readSession("dataAssets", "test-case-gen/prd-a-default");
    assert.ok(loaded);
    assert.equal(loaded!.schema_version, 1);
    assert.equal(loaded!.session_id, "test-case-gen/prd-a-default");
    assert.equal(loaded!.tasks.length, 0);
    assert.deepEqual(loaded!.artifacts, {});
  });

  it("readSession returns null when file missing", () => {
    const loaded = readSession("dataAssets", "test-case-gen/missing-default");
    assert.equal(loaded, null);
  });
});

describe("withSessionLock", () => {
  it("serializes concurrent writes (no data loss)", async () => {
    const project = "dataAssets";
    const base = createSession({
      project, workflow: "w", slug: "s", env: "default",
      source: { type: "prd", path: "p", mtime: null }, meta: {},
    });
    writeSession(project, base);

    const runs = Array.from({ length: 5 }, (_, i) => i);
    await Promise.all(runs.map((n) =>
      withSessionLock(project, base.session_id, async () => {
        const cur = readSession(project, base.session_id)!;
        const updated: Session = {
          ...cur,
          meta: { ...cur.meta, [`k${n}`]: n },
          updated_at: new Date().toISOString(),
        };
        writeSession(project, updated);
      }),
    ));

    const final = readSession(project, base.session_id)!;
    // All 5 keys must be present — no one got overwritten.
    for (const n of runs) {
      assert.equal(final.meta[`k${n}`], n);
    }
  });

  it("throws after LOCK_TIMEOUT_MS if lock not released", async () => {
    const project = "dataAssets";
    const base = createSession({
      project, workflow: "w", slug: "lock", env: "default",
      source: { type: "prd", path: "p", mtime: null }, meta: {},
    });
    writeSession(project, base);

    // Manually drop a lock file and never release it
    const lockDir = join(TMP, ".kata", project, "locks");
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, `${base.session_id.replace("/", "__")}.lock`), "99999");

    await assert.rejects(
      withSessionLock(project, base.session_id, async () => {}, { timeoutMs: 200 }),
      /lock/i,
    );
  });
});
```

- [ ] **Step 3.2: 运行测试确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

预期：module 不存在 / 函数未导出。

- [ ] **Step 3.3: 实现 `progress-store.ts` 的读写 + 锁**

```ts
// .claude/scripts/lib/progress-store.ts
import {
  existsSync, mkdirSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  SCHEMA_VERSION, LOCK_TIMEOUT_MS, LOCK_RETRY_BASE_MS, LOCK_RETRY_JITTER_MS,
  STALE_LOCK_MAX_AGE_MS,
} from "./progress-types.ts";
import type { Session, Source } from "./progress-types.ts";
import { kataDir, sessionsDir, locksDir } from "./paths.ts";

function sessionFileFor(project: string, sessionId: string): string {
  // session_id = "{workflow}/{slug}-{env}"
  const [workflow, rest] = splitSessionId(sessionId);
  return join(sessionsDir(project, workflow), `${rest}.json`);
}

function lockFileFor(project: string, sessionId: string): string {
  const safe = sessionId.replace("/", "__");
  return join(locksDir(project), `${safe}.lock`);
}

function splitSessionId(id: string): [string, string] {
  const idx = id.indexOf("/");
  if (idx < 0) throw new Error(`invalid session_id: ${id}`);
  return [id.slice(0, idx), id.slice(idx + 1)];
}

export function sessionIdFor(opts: {
  workflow: string; slug: string; env: string;
}): string {
  return `${opts.workflow}/${opts.slug}-${opts.env}`;
}

export function createSession(opts: {
  project: string;
  workflow: string;
  slug: string;
  env: string;
  source: Source;
  meta: Record<string, unknown>;
}): Session {
  const now = new Date().toISOString();
  const session_id = sessionIdFor(opts);
  return {
    schema_version: SCHEMA_VERSION,
    session_id,
    workflow: opts.workflow,
    project: opts.project,
    env: opts.env,
    created_at: now,
    updated_at: now,
    source: opts.source,
    meta: opts.meta,
    tasks: [],
    artifacts: {},
  };
}

export function readSession(project: string, sessionId: string): Session | null {
  const path = sessionFileFor(project, sessionId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Session;
  } catch (err) {
    throw new Error(`Failed to parse session file ${path}: ${err}`);
  }
}

export function writeSession(project: string, session: Session): void {
  const path = sessionFileFor(project, session.session_id);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export function deleteSession(project: string, sessionId: string): void {
  const path = sessionFileFor(project, sessionId);
  if (existsSync(path)) rmSync(path);
}

interface LockOpts {
  readonly timeoutMs?: number;
}

function acquireLock(lockPath: string, timeoutMs: number): void {
  cleanupStaleLock(lockPath);
  mkdirSync(dirname(lockPath), { recursive: true });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      writeFileSync(lockPath, `${process.pid}`, { flag: "wx" });
      return;
    } catch {
      const wait = LOCK_RETRY_BASE_MS + Math.random() * LOCK_RETRY_JITTER_MS;
      Bun.sleepSync(wait);
    }
  }
  throw new Error(`progress-store: lock acquisition timeout for ${lockPath}`);
}

function releaseLock(lockPath: string): void {
  try { if (existsSync(lockPath)) rmSync(lockPath); } catch { /* ignore */ }
}

function cleanupStaleLock(lockPath: string): void {
  try {
    if (!existsSync(lockPath)) return;
    const st = statSync(lockPath);
    if (Date.now() - st.mtimeMs > STALE_LOCK_MAX_AGE_MS) {
      rmSync(lockPath);
    }
  } catch { /* ignore */ }
}

export async function withSessionLock<T>(
  project: string,
  sessionId: string,
  fn: () => Promise<T> | T,
  opts: LockOpts = {},
): Promise<T> {
  const lockPath = lockFileFor(project, sessionId);
  acquireLock(lockPath, opts.timeoutMs ?? LOCK_TIMEOUT_MS);
  try {
    return await fn();
  } finally {
    releaseLock(lockPath);
  }
}

export function listSessions(opts: {
  project: string; workflow?: string;
}): readonly string[] {
  const root = join(kataDir(opts.project), "sessions");
  if (!existsSync(root)) return [];
  const workflows = opts.workflow ? [opts.workflow] : readdirSync(root);
  const ids: string[] = [];
  for (const wf of workflows) {
    const wfDir = join(root, wf);
    if (!existsSync(wfDir)) continue;
    for (const f of readdirSync(wfDir)) {
      if (f.endsWith(".json")) ids.push(`${wf}/${f.slice(0, -5)}`);
    }
  }
  return ids;
}
```

- [ ] **Step 3.4: 运行测试确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

预期：3 个 `describe` 共 4 个 `it` 全部通过。

- [ ] **Step 3.5: Commit**

```bash
git add .claude/scripts/lib/progress-store.ts .claude/scripts/__tests__/lib/progress-store.test.ts
git commit -m "feat(progress): add progress-store with read/write + session lock"
```

---

### Task 4: Task CRUD（`addTasks / updateTask / removeTask`）

**Files:**
- Modify: `.claude/scripts/lib/progress-store.ts`
- Modify: `.claude/scripts/__tests__/lib/progress-store.test.ts`

- [ ] **Step 4.1: 追加 CRUD 测试**

在 `progress-store.test.ts` 末尾追加：

```ts
import {
  addTasks, updateTask, removeTask,
} from "../../lib/progress-store.ts";

describe("addTasks", () => {
  const project = "dataAssets";
  function seed(): Session {
    const s = createSession({
      project, workflow: "test-case-gen", slug: "p1", env: "default",
      source: { type: "prd", path: "x.md", mtime: null }, meta: {},
    });
    writeSession(project, s);
    return s;
  }

  it("adds batch tasks with defaults for omitted fields", () => {
    const s = seed();
    addTasks(project, s.session_id, [
      { id: "t1", name: "transform", kind: "node", order: 1 },
      { id: "t2", name: "enhance", kind: "node", order: 2, depends_on: ["t1"] },
    ]);
    const cur = readSession(project, s.session_id)!;
    assert.equal(cur.tasks.length, 2);
    assert.equal(cur.tasks[0].status, "pending");
    assert.equal(cur.tasks[0].parent, null);
    assert.equal(cur.tasks[0].attempts, 0);
    assert.deepEqual(cur.tasks[1].depends_on, ["t1"]);
  });

  it("rejects duplicate ids", () => {
    const s = seed();
    addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "node", order: 1 }]);
    assert.throws(
      () => addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "node", order: 2 }]),
      /duplicate/i,
    );
  });
});

describe("updateTask", () => {
  const project = "dataAssets";
  function seedWithTask(): { sessionId: string } {
    const s = createSession({
      project, workflow: "w", slug: "u", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "node", order: 1 }]);
    return { sessionId: s.session_id };
  }

  it("increments attempts when status set to running", () => {
    const { sessionId } = seedWithTask();
    updateTask(project, sessionId, "t1", { status: "running" });
    const cur = readSession(project, sessionId)!;
    assert.equal(cur.tasks[0].status, "running");
    assert.equal(cur.tasks[0].attempts, 1);
    assert.ok(cur.tasks[0].started_at);
  });

  it("appends error entry when status=failed with error message", () => {
    const { sessionId } = seedWithTask();
    updateTask(project, sessionId, "t1", {
      status: "failed", error: "timeout",
    });
    const cur = readSession(project, sessionId)!;
    assert.equal(cur.tasks[0].errors.length, 1);
    assert.equal(cur.tasks[0].errors[0].message, "timeout");
  });

  it("appends error regardless of status (e.g. forced-start on running)", () => {
    const { sessionId } = seedWithTask();
    updateTask(project, sessionId, "t1", {
      status: "running", error: "forced-start",
    });
    const cur = readSession(project, sessionId)!;
    assert.equal(cur.tasks[0].status, "running");
    assert.equal(cur.tasks[0].errors.length, 1);
    assert.match(cur.tasks[0].errors[0].message, /forced-start/);
  });

  it("sets reason when status=blocked", () => {
    const { sessionId } = seedWithTask();
    updateTask(project, sessionId, "t1", {
      status: "blocked", reason: "需确认",
    });
    const cur = readSession(project, sessionId)!;
    assert.equal(cur.tasks[0].status, "blocked");
    assert.equal(cur.tasks[0].reason, "需确认");
  });

  it("merges payload object", () => {
    const { sessionId } = seedWithTask();
    updateTask(project, sessionId, "t1", { payload: { a: 1 } });
    updateTask(project, sessionId, "t1", { payload: { b: 2 } });
    const cur = readSession(project, sessionId)!;
    assert.deepEqual(cur.tasks[0].payload, { a: 1, b: 2 });
  });
});

describe("removeTask", () => {
  it("removes task by id", () => {
    const project = "dataAssets";
    const s = createSession({
      project, workflow: "w", slug: "r", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "node", order: 1 }]);
    removeTask(project, s.session_id, "t1");
    assert.equal(readSession(project, s.session_id)!.tasks.length, 0);
  });
});
```

- [ ] **Step 4.2: 运行测试确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 4.3: 实现 CRUD**

在 `progress-store.ts` 末尾追加：

```ts
import type { Task, TaskStatus, ErrorEntry } from "./progress-types.ts";

export interface TaskInput {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly order: number;
  readonly parent?: string | null;
  readonly depends_on?: readonly string[];
  readonly payload?: Record<string, unknown>;
}

export interface TaskUpdatePatch {
  readonly status?: TaskStatus;
  readonly reason?: string | null;
  readonly payload?: Record<string, unknown>;
  readonly depends_on?: readonly string[];
  readonly error?: string;
  readonly force?: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeTask(input: TaskInput): Task {
  return {
    id: input.id,
    parent: input.parent ?? null,
    depends_on: input.depends_on ?? [],
    order: input.order,
    name: input.name,
    kind: input.kind,
    status: "pending",
    reason: null,
    attempts: 0,
    payload: input.payload ?? {},
    errors: [],
    started_at: null,
    completed_at: null,
  };
}

export function addTasks(
  project: string,
  sessionId: string,
  inputs: readonly TaskInput[],
): void {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const existingIds = new Set(session.tasks.map((t) => t.id));
  const newIds = new Set<string>();
  for (const inp of inputs) {
    if (existingIds.has(inp.id) || newIds.has(inp.id)) {
      throw new Error(`duplicate task id: ${inp.id}`);
    }
    newIds.add(inp.id);
  }

  const tasks = [...session.tasks, ...inputs.map(makeTask)];
  writeSession(project, { ...session, tasks, updated_at: nowIso() });
}

export function removeTask(
  project: string,
  sessionId: string,
  taskId: string,
): void {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const tasks = session.tasks.filter((t) => t.id !== taskId);
  writeSession(project, { ...session, tasks, updated_at: nowIso() });
}

export function updateTask(
  project: string,
  sessionId: string,
  taskId: string,
  patch: TaskUpdatePatch,
): void {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const idx = session.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) throw new Error(`task not found: ${taskId}`);

  const current = session.tasks[idx];
  let next: Task = { ...current };

  if (patch.status !== undefined) {
    next = { ...next, status: patch.status };
    if (patch.status === "running") {
      next = {
        ...next,
        attempts: current.attempts + 1,
        started_at: current.started_at ?? nowIso(),
      };
    }
    if (patch.status === "done") {
      next = { ...next, completed_at: nowIso() };
    }
  }

  // --error appends regardless of status (enables forced-start records,
  // diagnostic traces on running tasks, etc.)
  if (patch.error !== undefined) {
    const entry: ErrorEntry = { at: nowIso(), message: patch.error };
    next = { ...next, errors: [...next.errors, entry] };
  }

  if (patch.reason !== undefined) {
    next = { ...next, reason: patch.reason };
  }

  if (patch.payload !== undefined) {
    next = { ...next, payload: { ...current.payload, ...patch.payload } };
  }

  if (patch.depends_on !== undefined) {
    next = { ...next, depends_on: patch.depends_on };
  }

  const tasks = [...session.tasks.slice(0, idx), next, ...session.tasks.slice(idx + 1)];
  writeSession(project, { ...session, tasks, updated_at: nowIso() });
}
```

- [ ] **Step 4.4: 运行测试确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 4.5: Commit**

```bash
git add .claude/scripts/lib/progress-store.ts .claude/scripts/__tests__/lib/progress-store.test.ts
git commit -m "feat(progress): add task CRUD (addTasks/updateTask/removeTask)"
```

---

### Task 5: Task Query 可见性 + 过滤

**Files:**
- Modify: `.claude/scripts/lib/progress-store.ts`
- Modify: `.claude/scripts/__tests__/lib/progress-store.test.ts`

- [ ] **Step 5.1: 写失败的查询测试**

追加到 `progress-store.test.ts`：

```ts
import { queryTasks } from "../../lib/progress-store.ts";

describe("queryTasks visibility rules", () => {
  const project = "dataAssets";
  function setup(): string {
    const s = createSession({
      project, workflow: "w", slug: "q", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    // Parent t0 pending, child t1 hidden
    // Parent t2 running, child t3 visible (deps ok)
    // Parent t4 running, child t5 hidden (t6 not done)
    addTasks(project, s.session_id, [
      { id: "t0", name: "phase0", kind: "phase", order: 1 },
      { id: "t1", name: "c1", kind: "case", order: 1, parent: "t0" },
      { id: "t2", name: "phase2", kind: "phase", order: 2 },
      { id: "t3", name: "c3", kind: "case", order: 1, parent: "t2" },
      { id: "t4", name: "phase4", kind: "phase", order: 3 },
      { id: "t5", name: "c5", kind: "case", order: 1, parent: "t4", depends_on: ["t6"] },
      { id: "t6", name: "c6", kind: "case", order: 2, parent: "t4" },
    ]);
    updateTask(project, s.session_id, "t2", { status: "running" });
    updateTask(project, s.session_id, "t4", { status: "running" });
    return s.session_id;
  }

  it("hides tasks whose parent is pending", () => {
    const sid = setup();
    const visible = queryTasks(project, sid, {});
    const ids = visible.map((t) => t.id);
    assert.ok(!ids.includes("t1"), "t1 should be hidden (parent pending)");
  });

  it("hides tasks with unsatisfied depends_on", () => {
    const sid = setup();
    const visible = queryTasks(project, sid, {});
    const ids = visible.map((t) => t.id);
    assert.ok(!ids.includes("t5"), "t5 should be hidden (t6 not done)");
    assert.ok(ids.includes("t6"), "t6 visible (parent running, no deps)");
  });

  it("--include-all returns everything", () => {
    const sid = setup();
    const all = queryTasks(project, sid, { includeAll: true });
    assert.equal(all.length, 7);
  });

  it("filters by status + kind + parent", () => {
    const sid = setup();
    const filtered = queryTasks(project, sid, {
      includeAll: true,
      status: ["pending"],
      kind: "case",
      parent: "t4",
    });
    const ids = filtered.map((t) => t.id).sort();
    assert.deepEqual(ids, ["t5", "t6"]);
  });

  it("--include-blocked returns hidden tasks with blocked_by reasons", () => {
    const sid = setup();
    const blocked = queryTasks(project, sid, { includeBlocked: true });
    const byId = Object.fromEntries(blocked.map((r) => [r.task.id, r]));
    assert.ok(byId.t1);
    assert.match(byId.t1.blocked_by!.join(","), /t0/);
    assert.ok(byId.t5);
    assert.match(byId.t5.blocked_by!.join(","), /t6/);
  });
});
```

- [ ] **Step 5.2: 运行测试确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 5.3: 实现 `queryTasks`**

在 `progress-store.ts` 末尾追加：

```ts
import {
  DEPENDENCY_SATISFIED_STATUSES, PARENT_VISIBLE_STATUSES,
} from "./progress-types.ts";

export interface QueryOpts {
  readonly status?: readonly TaskStatus[];
  readonly kind?: string;
  readonly parent?: string | null;
  readonly includeAll?: boolean;
  readonly includeBlocked?: boolean;
}

export interface QueryResult {
  readonly task: Task;
  readonly blocked_by?: readonly string[];
}

function parentStatusOf(
  tasks: readonly Task[],
  parentId: string | null,
): TaskStatus | null {
  if (parentId === null) return null;
  const p = tasks.find((t) => t.id === parentId);
  return p ? p.status : null;
}

function computeBlockedBy(task: Task, tasks: readonly Task[]): string[] {
  const reasons: string[] = [];

  const unsatisfiedDeps = task.depends_on.filter((depId) => {
    const dep = tasks.find((t) => t.id === depId);
    if (!dep) return true;
    return !DEPENDENCY_SATISFIED_STATUSES.includes(dep.status);
  });
  if (unsatisfiedDeps.length) {
    reasons.push(...unsatisfiedDeps.map((id) => `dep:${id}`));
  }

  if (task.parent) {
    const ps = parentStatusOf(tasks, task.parent);
    if (ps && !PARENT_VISIBLE_STATUSES.includes(ps)) {
      reasons.push(`parent:${task.parent}(${ps})`);
    }
  }

  return reasons;
}

export function queryTasks(
  project: string,
  sessionId: string,
  opts: QueryOpts,
): readonly QueryResult[] {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const filtered = session.tasks.filter((t) => {
    if (opts.status && !opts.status.includes(t.status)) return false;
    if (opts.kind !== undefined && t.kind !== opts.kind) return false;
    if (opts.parent !== undefined && t.parent !== opts.parent) return false;
    return true;
  });

  if (opts.includeAll) {
    return filtered.map((task) => ({ task }));
  }

  if (opts.includeBlocked) {
    return filtered
      .map((task) => ({ task, blocked_by: computeBlockedBy(task, session.tasks) }))
      .filter((r) => r.blocked_by!.length > 0);
  }

  // Default: only executable tasks (empty blocked_by).
  return filtered
    .filter((task) => computeBlockedBy(task, session.tasks).length === 0)
    .map((task) => ({ task }));
}

/**
 * Check whether a task's dependencies are satisfied. Used by CLI guard
 * on `task-update --status running`.
 */
export function isExecutable(
  project: string,
  sessionId: string,
  taskId: string,
): { ok: boolean; blocked_by: readonly string[] } {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const task = session.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`task not found: ${taskId}`);
  const blocked_by = computeBlockedBy(task, session.tasks);
  return { ok: blocked_by.length === 0, blocked_by };
}
```

- [ ] **Step 5.4: 运行测试确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 5.5: Commit**

```bash
git add .claude/scripts/lib/progress-store.ts .claude/scripts/__tests__/lib/progress-store.test.ts
git commit -m "feat(progress): add queryTasks with visibility rules and isExecutable guard"
```

---

### Task 6: 循环依赖检测 + Rollup + 启动守卫

**Files:**
- Modify: `.claude/scripts/lib/progress-store.ts`
- Modify: `.claude/scripts/__tests__/lib/progress-store.test.ts`

- [ ] **Step 6.1: 写失败测试**

追加：

```ts
import { rollupTask } from "../../lib/progress-store.ts";

describe("cycle detection", () => {
  const project = "dataAssets";
  it("rejects addTasks that introduces a cycle", () => {
    const s = createSession({
      project, workflow: "w", slug: "c1", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [
      { id: "a", name: "a", kind: "node", order: 1, depends_on: ["b"] },
    ]);
    assert.throws(
      () => addTasks(project, s.session_id, [
        { id: "b", name: "b", kind: "node", order: 2, depends_on: ["a"] },
      ]),
      /cycle/i,
    );
  });

  it("rejects updateTask --depends-on introducing cycle", () => {
    const s = createSession({
      project, workflow: "w", slug: "c2", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [
      { id: "a", name: "a", kind: "node", order: 1 },
      { id: "b", name: "b", kind: "node", order: 2, depends_on: ["a"] },
    ]);
    assert.throws(
      () => updateTask(project, s.session_id, "a", { depends_on: ["b"] }),
      /cycle/i,
    );
  });
});

describe("rollupTask", () => {
  const project = "dataAssets";
  it("sets parent to done when all children done/skipped", () => {
    const s = createSession({
      project, workflow: "w", slug: "r1", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [
      { id: "p", name: "p", kind: "phase", order: 1 },
      { id: "c1", name: "c1", kind: "case", order: 1, parent: "p" },
      { id: "c2", name: "c2", kind: "case", order: 2, parent: "p" },
    ]);
    updateTask(project, s.session_id, "p", { status: "running" });
    updateTask(project, s.session_id, "c1", { status: "done" });
    updateTask(project, s.session_id, "c2", { status: "skipped" });
    rollupTask(project, s.session_id, "p");
    const cur = readSession(project, s.session_id)!;
    assert.equal(cur.tasks.find((t) => t.id === "p")!.status, "done");
  });

  it("throws when any child unfinished", () => {
    const s = createSession({
      project, workflow: "w", slug: "r2", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [
      { id: "p", name: "p", kind: "phase", order: 1 },
      { id: "c1", name: "c1", kind: "case", order: 1, parent: "p" },
    ]);
    updateTask(project, s.session_id, "p", { status: "running" });
    assert.throws(() => rollupTask(project, s.session_id, "p"), /unfinished/i);
  });
});
```

- [ ] **Step 6.2: 运行测试确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 6.3: 实现循环检测 + rollupTask，并把检测注入 addTasks / updateTask**

在 `progress-store.ts` 末尾追加：

```ts
function detectCycle(tasks: readonly Task[]): string[] | null {
  const graph = new Map<string, readonly string[]>();
  for (const t of tasks) graph.set(t.id, t.depends_on);

  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(id: string): string[] | null {
    if (stack.has(id)) {
      const cycleStart = path.indexOf(id);
      return path.slice(cycleStart).concat(id);
    }
    if (visited.has(id)) return null;
    visited.add(id);
    stack.add(id);
    path.push(id);
    for (const dep of graph.get(id) ?? []) {
      const found = dfs(dep);
      if (found) return found;
    }
    stack.delete(id);
    path.pop();
    return null;
  }

  for (const id of graph.keys()) {
    const found = dfs(id);
    if (found) return found;
  }
  return null;
}

export function rollupTask(
  project: string,
  sessionId: string,
  parentId: string,
): void {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const parent = session.tasks.find((t) => t.id === parentId);
  if (!parent) throw new Error(`task not found: ${parentId}`);

  const children = session.tasks.filter((t) => t.parent === parentId);
  const unfinished = children.filter(
    (c) => c.status !== "done" && c.status !== "skipped",
  );
  if (unfinished.length > 0) {
    throw new Error(
      `rollup blocked: unfinished children of ${parentId}: ${unfinished.map((c) => c.id).join(",")}`,
    );
  }

  updateTask(project, sessionId, parentId, { status: "done" });
}
```

**同时修改** `addTasks` 和 `updateTask`，在写回前调用 `detectCycle`。修改方法：在 `addTasks` 里计算 `nextTasks` 之后、`writeSession` 之前插入：

```ts
const cycle = detectCycle(tasks);
if (cycle) throw new Error(`cycle detected: ${cycle.join(" → ")}`);
```

`updateTask` 里同理：在 `const tasks = [...]` 之后、`writeSession` 之前插入相同检测。

- [ ] **Step 6.4: 运行测试确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 6.5: Commit**

```bash
git add .claude/scripts/lib/progress-store.ts .claude/scripts/__tests__/lib/progress-store.test.ts
git commit -m "feat(progress): add cycle detection and rollupTask"
```

---

### Task 7: Artifacts + Blob 外溢

**Files:**
- Modify: `.claude/scripts/lib/progress-store.ts`
- Modify: `.claude/scripts/__tests__/lib/progress-store.test.ts`

- [ ] **Step 7.1: 写失败测试**

```ts
import { setArtifact, getArtifact } from "../../lib/progress-store.ts";

describe("artifacts inline + overflow", () => {
  const project = "dataAssets";

  it("stores small artifact inline", () => {
    const s = createSession({
      project, workflow: "w", slug: "a1", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    setArtifact(project, s.session_id, "k1", { a: 1 });
    const cur = readSession(project, s.session_id)!;
    assert.deepEqual(cur.artifacts.k1, { a: 1 });
    assert.deepEqual(getArtifact(project, s.session_id, "k1"), { a: 1 });
  });

  it("spills large artifact to blocks/ and stores $ref inline", () => {
    const s = createSession({
      project, workflow: "w", slug: "a2", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    const big = { data: "x".repeat(100_000) };
    setArtifact(project, s.session_id, "blob", big);
    const cur = readSession(project, s.session_id)!;
    const ref = cur.artifacts.blob as { $ref?: string };
    assert.ok(ref.$ref, "inline value should be a $ref");
    // Dereferenced via getArtifact
    const loaded = getArtifact(project, s.session_id, "blob");
    assert.deepEqual(loaded, big);
  });
});
```

- [ ] **Step 7.2: 运行确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 7.3: 实现 artifacts**

追加到 `progress-store.ts`：

```ts
import { createHash } from "node:crypto";
import { BLOB_OVERFLOW_THRESHOLD_BYTES } from "./progress-types.ts";
import type { BlobRef } from "./progress-types.ts";
import { blocksDir } from "./paths.ts";

function isBlobRef(v: unknown): v is BlobRef {
  return !!v && typeof v === "object" && "$ref" in (v as Record<string, unknown>);
}

function sessionSlugFromId(sessionId: string): string {
  return splitSessionId(sessionId)[1];
}

export function setArtifact(
  project: string,
  sessionId: string,
  key: string,
  value: unknown,
): void {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const serialized = JSON.stringify(value);

  let stored: unknown;
  if (Buffer.byteLength(serialized, "utf8") > BLOB_OVERFLOW_THRESHOLD_BYTES) {
    const hash = createHash("sha256").update(serialized).digest("hex").slice(0, 16);
    const slug = sessionSlugFromId(session.session_id);
    const dir = blocksDir(project, session.workflow, slug);
    mkdirSync(dir, { recursive: true });
    const blobPath = join(dir, `${key}-${hash}.json`);
    writeFileSync(blobPath, `${serialized}\n`, "utf8");
    // Store absolute path in $ref (simpler; blob files are gitignored anyway)
    stored = { $ref: blobPath } satisfies BlobRef;
  } else {
    stored = value;
  }

  const artifacts = { ...session.artifacts, [key]: stored };
  writeSession(project, { ...session, artifacts, updated_at: nowIso() });
}

export function getArtifact(
  project: string,
  sessionId: string,
  key: string,
): unknown {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const value = session.artifacts[key];
  if (!isBlobRef(value)) return value;
  if (!existsSync(value.$ref)) {
    throw new Error(`blob not found: ${value.$ref}`);
  }
  return JSON.parse(readFileSync(value.$ref, "utf8"));
}
```

- [ ] **Step 7.4: 运行测试确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 7.5: Commit**

```bash
git add .claude/scripts/lib/progress-store.ts .claude/scripts/__tests__/lib/progress-store.test.ts
git commit -m "feat(progress): add artifact storage with blob overflow"
```

---

### Task 8: Session Resume 行为

**Files:**
- Modify: `.claude/scripts/lib/progress-store.ts`
- Modify: `.claude/scripts/__tests__/lib/progress-store.test.ts`

- [ ] **Step 8.1: 写失败测试**

```ts
import { existsSync, writeFileSync as fsWriteFileSync, utimesSync } from "node:fs";
import { resumeSession } from "../../lib/progress-store.ts";

describe("resumeSession", () => {
  const project = "dataAssets";

  it("resets running → pending", () => {
    const s = createSession({
      project, workflow: "w", slug: "res1", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "node", order: 1 }]);
    updateTask(project, s.session_id, "t1", { status: "running" });
    resumeSession(project, s.session_id, {});
    assert.equal(readSession(project, s.session_id)!.tasks[0].status, "pending");
  });

  it("--retry-failed clears errors and resets attempts", () => {
    const s = createSession({
      project, workflow: "w", slug: "res2", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "node", order: 1 }]);
    updateTask(project, s.session_id, "t1", { status: "failed", error: "boom" });
    resumeSession(project, s.session_id, { retryFailed: true });
    const t = readSession(project, s.session_id)!.tasks[0];
    assert.equal(t.status, "pending");
    assert.equal(t.attempts, 0);
    assert.deepEqual(t.errors, []);
  });

  it("--retry-blocked clears reason and resets to pending", () => {
    const s = createSession({
      project, workflow: "w", slug: "res3", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "node", order: 1 }]);
    updateTask(project, s.session_id, "t1", { status: "blocked", reason: "r" });
    resumeSession(project, s.session_id, { retryBlocked: true });
    const t = readSession(project, s.session_id)!.tasks[0];
    assert.equal(t.status, "pending");
    assert.equal(t.reason, null);
  });

  it("clears artifacts.cached_parse_result when source.mtime changed", () => {
    const prdPath = join(TMP, "fake.md");
    fsWriteFileSync(prdPath, "content");
    const originalMtime = new Date(Date.now() - 60_000);
    utimesSync(prdPath, originalMtime, originalMtime);

    const s = createSession({
      project, workflow: "w", slug: "res4", env: "default",
      source: { type: "prd", path: prdPath, mtime: originalMtime.toISOString() },
      meta: {},
    });
    writeSession(project, s);
    setArtifact(project, s.session_id, "cached_parse_result", { cached: true });

    const nowMtime = new Date();
    utimesSync(prdPath, nowMtime, nowMtime);
    resumeSession(project, s.session_id, {});

    const cur = readSession(project, s.session_id)!;
    assert.equal(cur.artifacts.cached_parse_result, undefined);
  });

  it("--payload-path-check: missing file → reset task, set generated=false", () => {
    const s = createSession({
      project, workflow: "w", slug: "res5", env: "default",
      source: { type: "prd", path: "x", mtime: null }, meta: {},
    });
    writeSession(project, s);
    addTasks(project, s.session_id, [{ id: "t1", name: "n", kind: "case", order: 1 }]);
    updateTask(project, s.session_id, "t1", {
      status: "done",
      payload: { script_path: "/nonexistent/path.spec.ts", generated: true },
    });
    resumeSession(project, s.session_id, { payloadPathCheck: "script_path" });
    const t = readSession(project, s.session_id)!.tasks[0];
    assert.equal(t.status, "pending");
    assert.equal(t.payload.generated, false);
  });
});
```

- [ ] **Step 8.2: 运行确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 8.3: 实现 `resumeSession`**

追加到 `progress-store.ts`：

```ts
export interface ResumeOpts {
  readonly retryFailed?: boolean;
  readonly retryBlocked?: boolean;
  readonly payloadPathCheck?: string;
}

export function resumeSession(
  project: string,
  sessionId: string,
  opts: ResumeOpts,
): void {
  const session = readSession(project, sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);

  // 1. running → pending
  // 2. --retry-failed: failed → pending, clear errors/attempts
  // 3. --retry-blocked: blocked → pending, clear reason
  // 4. --payload-path-check: file missing → pending, payload.generated=false
  const tasks = session.tasks.map((t): Task => {
    if (t.status === "running") {
      return { ...t, status: "pending" };
    }
    if (opts.retryFailed && t.status === "failed") {
      return { ...t, status: "pending", attempts: 0, errors: [] };
    }
    if (opts.retryBlocked && t.status === "blocked") {
      return { ...t, status: "pending", reason: null };
    }
    if (opts.payloadPathCheck) {
      const p = t.payload[opts.payloadPathCheck];
      if (typeof p === "string" && !existsSync(p)) {
        return {
          ...t,
          status: "pending",
          payload: { ...t.payload, generated: false },
        };
      }
    }
    return t;
  });

  // 5. Invalidate cached artifacts on source.mtime change
  let artifacts = session.artifacts;
  if (session.source.mtime && session.source.path && existsSync(session.source.path)) {
    const actual = statSync(session.source.path).mtime.toISOString();
    if (actual !== session.source.mtime) {
      artifacts = Object.fromEntries(
        Object.entries(session.artifacts).filter(([k]) => k !== "cached_parse_result"),
      );
    }
  }

  writeSession(project, {
    ...session,
    tasks,
    artifacts,
    updated_at: nowIso(),
  });
}
```

- [ ] **Step 8.4: 运行测试确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
```

- [ ] **Step 8.5: Commit**

```bash
git add .claude/scripts/lib/progress-store.ts .claude/scripts/__tests__/lib/progress-store.test.ts
git commit -m "feat(progress): add resumeSession with retry/path-check behaviors"
```

---

### Task 9: CLI 骨架 + `session-*` 子命令

**Files:**
- Create: `.claude/scripts/progress.ts`
- Create: `.claude/scripts/__tests__/progress.test.ts`

- [ ] **Step 9.1: 写失败的 CLI 测试**

```ts
// .claude/scripts/__tests__/progress.test.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

const TMP = join(tmpdir(), `progress-cli-test-${process.pid}`);
const CWD = resolve(import.meta.dirname, "../..");

function run(args: string[], extra: Record<string, string> = {}) {
  try {
    const stdout = execFileSync("kata-cli", ["progress", ...args], {
      cwd: CWD, encoding: "utf8",
      env: { ...process.env, KATA_ROOT_OVERRIDE: TMP, ...extra },
    });
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.status ?? 1 };
  }
}

before(() => mkdirSync(TMP, { recursive: true }));
after(() => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });
beforeEach(() => {
  try { rmSync(join(TMP, ".kata"), { recursive: true, force: true }); } catch {}
});

describe("session-create + session-read", () => {
  it("creates a session and reads it back", () => {
    const create = run([
      "session-create",
      "--workflow", "test-case-gen",
      "--project", "dataAssets",
      "--source-type", "prd",
      "--source-path", "workspace/dataAssets/prds/x.md",
      "--env", "default",
      "--meta", JSON.stringify({ mode: "normal" }),
    ]);
    assert.equal(create.code, 0);
    const created = JSON.parse(create.stdout);
    assert.equal(created.session_id, "test-case-gen/x-default");

    const read = run(["session-read", "--session", created.session_id, "--project", "dataAssets"]);
    assert.equal(read.code, 0);
    const loaded = JSON.parse(read.stdout);
    assert.equal(loaded.schema_version, 1);
  });
});

describe("session-summary", () => {
  it("aggregates counts by status", () => {
    const create = JSON.parse(run([
      "session-create",
      "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "x.md",
    ]).stdout);
    const sid = create.session_id;
    run(["task-add", "--project", "dataAssets", "--session", sid,
      "--tasks", JSON.stringify([
        { id: "t1", name: "n", kind: "node", order: 1 },
        { id: "t2", name: "n", kind: "node", order: 2 },
      ])]);
    run(["task-update", "--project", "dataAssets", "--session", sid,
      "--task", "t1", "--status", "done"]);
    const out = JSON.parse(
      run(["session-summary", "--project", "dataAssets", "--session", sid]).stdout,
    );
    assert.equal(out.total, 2);
    assert.equal(out.done, 1);
    assert.equal(out.pending, 1);
  });
});

describe("session-resume", () => {
  it("resets running → pending", () => {
    const sid = JSON.parse(run([
      "session-create",
      "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "x.md",
    ]).stdout).session_id;
    run(["task-add", "--project", "dataAssets", "--session", sid,
      "--tasks", JSON.stringify([{ id: "t1", name: "n", kind: "node", order: 1 }])]);
    run(["task-update", "--project", "dataAssets", "--session", sid,
      "--task", "t1", "--status", "running"]);
    run(["session-resume", "--project", "dataAssets", "--session", sid]);
    const loaded = JSON.parse(
      run(["session-read", "--project", "dataAssets", "--session", sid]).stdout,
    );
    assert.equal(loaded.tasks[0].status, "pending");
  });
});

describe("session-list + session-delete", () => {
  it("lists and deletes", () => {
    run(["session-create", "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "a.md"]);
    run(["session-create", "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "b.md"]);
    const list = JSON.parse(
      run(["session-list", "--project", "dataAssets"]).stdout,
    );
    assert.equal(list.length, 2);
    run(["session-delete", "--project", "dataAssets", "--session", "w/a-default"]);
    const after = JSON.parse(
      run(["session-list", "--project", "dataAssets"]).stdout,
    );
    assert.equal(after.length, 1);
  });
});
```

- [ ] **Step 9.2: 运行测试确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/progress.test.ts
```

预期：`kata-cli progress` 不存在（尚未注册）→ Task 12 处理注册。此步允许失败。

- [ ] **Step 9.3: 实现 `progress.ts`（只含 session-* 子命令）**

```ts
// .claude/scripts/progress.ts
/**
 * progress.ts — unified task progress engine CLI.
 *
 * Replaces kata-state.ts and ui-autotest-progress.ts. See spec:
 *   docs/refactor/specs/2026-04-24-unified-progress-engine-design.md
 */
import { basename } from "node:path";
import { createCli } from "./lib/cli-runner.ts";
import {
  createSession, readSession, writeSession, deleteSession,
  listSessions, resumeSession, sessionIdFor,
} from "./lib/progress-store.ts";
import { ExitCode } from "./lib/progress-types.ts";

function slugFromPath(p: string): string {
  return basename(p, ".md").replace(/\.[^.]+$/, "");
}

function emit(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function fail(subcmd: string, message: string, code: number): never {
  process.stderr.write(`[progress:${subcmd}] ${message}\n`);
  process.exit(code);
}

// ── session-create ──────────────────────────────────────

function runSessionCreate(opts: {
  workflow: string;
  project: string;
  sourceType: string;
  sourcePath: string;
  env?: string;
  meta?: string;
}): void {
  const env = opts.env ?? "default";
  let meta: Record<string, unknown> = {};
  if (opts.meta) {
    try { meta = JSON.parse(opts.meta) as Record<string, unknown>; }
    catch { fail("session-create", `invalid --meta JSON`, ExitCode.ARG_ERROR); }
  }
  const slug = slugFromPath(opts.sourcePath);
  const session = createSession({
    project: opts.project,
    workflow: opts.workflow,
    slug, env,
    source: { type: opts.sourceType, path: opts.sourcePath, mtime: null },
    meta,
  });
  writeSession(opts.project, session);
  emit(session);
}

// ── session-read ────────────────────────────────────────

function runSessionRead(opts: { project: string; session: string }): void {
  const s = readSession(opts.project, opts.session);
  if (!s) fail("session-read", `session not found: ${opts.session}`, ExitCode.NOT_FOUND);
  emit(s);
}

// ── session-delete ──────────────────────────────────────

function runSessionDelete(opts: { project: string; session: string }): void {
  deleteSession(opts.project, opts.session);
  emit({ deleted: true, session: opts.session });
}

// ── session-list ────────────────────────────────────────

function runSessionList(opts: { project: string; workflow?: string }): void {
  emit(listSessions({ project: opts.project, workflow: opts.workflow }));
}

// ── session-summary ─────────────────────────────────────

function runSessionSummary(opts: { project: string; session: string }): void {
  const s = readSession(opts.project, opts.session);
  if (!s) fail("session-summary", `session not found: ${opts.session}`, ExitCode.NOT_FOUND);
  const count = (status: string) => s!.tasks.filter((t) => t.status === status).length;
  emit({
    session_id: s!.session_id,
    workflow: s!.workflow,
    project: s!.project,
    env: s!.env,
    total: s!.tasks.length,
    pending: count("pending"),
    running: count("running"),
    done: count("done"),
    blocked: count("blocked"),
    failed: count("failed"),
    skipped: count("skipped"),
    updated_at: s!.updated_at,
  });
}

// ── session-resume ──────────────────────────────────────

function runSessionResume(opts: {
  project: string; session: string;
  retryFailed?: boolean; retryBlocked?: boolean; payloadPathCheck?: string;
}): void {
  resumeSession(opts.project, opts.session, {
    retryFailed: opts.retryFailed,
    retryBlocked: opts.retryBlocked,
    payloadPathCheck: opts.payloadPathCheck,
  });
  const s = readSession(opts.project, opts.session);
  emit(s);
}

// ── registration ────────────────────────────────────────

export const program = createCli({
  name: "progress",
  description: "Unified task progress engine for kata workflows",
  commands: [
    {
      name: "session-create",
      description: "Create a new progress session",
      options: [
        { flag: "--workflow <name>", description: "Workflow name (e.g. test-case-gen)", required: true },
        { flag: "--project <name>", description: "Project name", required: true },
        { flag: "--source-type <type>", description: "Source type (prd/archive/bug)", required: true },
        { flag: "--source-path <path>", description: "Source file path", required: true },
        { flag: "--env <name>", description: "Environment tag", defaultValue: "default" },
        { flag: "--meta <json>", description: "Arbitrary metadata JSON" },
      ],
      action: runSessionCreate,
    },
    {
      name: "session-read",
      description: "Read full session JSON",
      options: [
        { flag: "--project <name>", description: "Project name", required: true },
        { flag: "--session <id>", description: "Session id", required: true },
      ],
      action: runSessionRead,
    },
    {
      name: "session-delete",
      description: "Delete a session",
      options: [
        { flag: "--project <name>", description: "Project name", required: true },
        { flag: "--session <id>", description: "Session id", required: true },
      ],
      action: runSessionDelete,
    },
    {
      name: "session-list",
      description: "List sessions under a project",
      options: [
        { flag: "--project <name>", description: "Project name", required: true },
        { flag: "--workflow <name>", description: "Filter by workflow" },
      ],
      action: runSessionList,
    },
    {
      name: "session-summary",
      description: "Aggregate counts by task status",
      options: [
        { flag: "--project <name>", description: "Project name", required: true },
        { flag: "--session <id>", description: "Session id", required: true },
      ],
      action: runSessionSummary,
    },
    {
      name: "session-resume",
      description: "Resume session: running → pending, optional retry flags",
      options: [
        { flag: "--project <name>", description: "Project name", required: true },
        { flag: "--session <id>", description: "Session id", required: true },
        { flag: "--retry-failed", description: "Reset failed tasks to pending", defaultValue: false },
        { flag: "--retry-blocked", description: "Reset blocked tasks to pending", defaultValue: false },
        { flag: "--payload-path-check <key>", description: "Reset task if payload[key] file is missing" },
      ],
      action: runSessionResume,
    },
  ],
});
```

- [ ] **Step 9.4: Commit（尚不能 run 测试，留到 Task 12 注册后再跑）**

```bash
git add .claude/scripts/progress.ts .claude/scripts/__tests__/progress.test.ts
git commit -m "feat(progress): add progress CLI with session-* subcommands"
```

---

### Task 10: CLI — `task-*` 子命令

**Files:**
- Modify: `.claude/scripts/progress.ts`
- Modify: `.claude/scripts/__tests__/progress.test.ts`

- [ ] **Step 10.1: 追加 task-* 测试到 progress.test.ts**

```ts
describe("task-add + task-query + task-update", () => {
  function seed() {
    const sid = JSON.parse(run([
      "session-create", "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "t.md",
    ]).stdout).session_id;
    run(["task-add", "--project", "dataAssets", "--session", sid,
      "--tasks", JSON.stringify([
        { id: "t1", name: "n", kind: "node", order: 1 },
        { id: "t2", name: "n", kind: "node", order: 2, depends_on: ["t1"] },
      ])]);
    return sid;
  }

  it("task-add adds tasks", () => {
    const sid = seed();
    const s = JSON.parse(run(["session-read", "--project", "dataAssets", "--session", sid]).stdout);
    assert.equal(s.tasks.length, 2);
  });

  it("task-update --status running auto-increments attempts", () => {
    const sid = seed();
    run(["task-update", "--project", "dataAssets", "--session", sid,
      "--task", "t1", "--status", "running"]);
    const s = JSON.parse(run(["session-read", "--project", "dataAssets", "--session", sid]).stdout);
    assert.equal(s.tasks[0].status, "running");
    assert.equal(s.tasks[0].attempts, 1);
  });

  it("task-update --status running fails with exit 4 when deps unsatisfied", () => {
    const sid = seed();
    const res = run(["task-update", "--project", "dataAssets", "--session", sid,
      "--task", "t2", "--status", "running"]);
    assert.equal(res.code, 4);
    assert.match(res.stderr, /dep/);
  });

  it("task-update --force bypasses dep check and records forced-start", () => {
    const sid = seed();
    const res = run(["task-update", "--project", "dataAssets", "--session", sid,
      "--task", "t2", "--status", "running", "--force"]);
    assert.equal(res.code, 0);
    const s = JSON.parse(run(["session-read", "--project", "dataAssets", "--session", sid]).stdout);
    const t2 = s.tasks.find((t: { id: string }) => t.id === "t2");
    assert.equal(t2.attempts, 1);
    assert.ok(t2.errors.some((e: { message: string }) => /forced-start/.test(e.message)));
  });

  it("task-query default hides tasks with unsatisfied deps", () => {
    const sid = seed();
    const out = JSON.parse(run([
      "task-query", "--project", "dataAssets", "--session", sid, "--format", "json",
    ]).stdout);
    const ids = out.map((r: { task: { id: string } }) => r.task.id);
    assert.deepEqual(ids, ["t1"]);
  });

  it("task-query --include-blocked shows blocked_by reasons", () => {
    const sid = seed();
    const out = JSON.parse(run([
      "task-query", "--project", "dataAssets", "--session", sid,
      "--include-blocked", "--format", "json",
    ]).stdout);
    assert.equal(out.length, 1);
    assert.equal(out[0].task.id, "t2");
    assert.match(out[0].blocked_by.join(","), /t1/);
  });
});

describe("task-block / task-unblock / task-rollup", () => {
  function seedRollup() {
    const sid = JSON.parse(run([
      "session-create", "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "r.md",
    ]).stdout).session_id;
    run(["task-add", "--project", "dataAssets", "--session", sid,
      "--tasks", JSON.stringify([
        { id: "p", name: "p", kind: "phase", order: 1 },
        { id: "c1", name: "c", kind: "case", order: 1, parent: "p" },
        { id: "c2", name: "c", kind: "case", order: 2, parent: "p" },
      ])]);
    run(["task-update", "--project", "dataAssets", "--session", sid,
      "--task", "p", "--status", "running"]);
    return sid;
  }

  it("task-block sets status=blocked with reason", () => {
    const sid = seedRollup();
    run(["task-block", "--project", "dataAssets", "--session", sid,
      "--task", "c1", "--reason", "需人工"]);
    const s = JSON.parse(run(["session-read", "--project", "dataAssets", "--session", sid]).stdout);
    const c1 = s.tasks.find((t: { id: string }) => t.id === "c1");
    assert.equal(c1.status, "blocked");
    assert.equal(c1.reason, "需人工");
  });

  it("task-rollup fails with exit 5 when children unfinished", () => {
    const sid = seedRollup();
    const res = run(["task-rollup", "--project", "dataAssets", "--session", sid, "--task", "p"]);
    assert.equal(res.code, 5);
  });

  it("task-rollup succeeds when all children done", () => {
    const sid = seedRollup();
    run(["task-update", "--project", "dataAssets", "--session", sid, "--task", "c1", "--status", "done"]);
    run(["task-update", "--project", "dataAssets", "--session", sid, "--task", "c2", "--status", "done"]);
    const res = run(["task-rollup", "--project", "dataAssets", "--session", sid, "--task", "p"]);
    assert.equal(res.code, 0);
    const s = JSON.parse(run(["session-read", "--project", "dataAssets", "--session", sid]).stdout);
    assert.equal(s.tasks.find((t: { id: string }) => t.id === "p").status, "done");
  });
});
```

- [ ] **Step 10.2: 在 `progress.ts` 实现 task-* 子命令**

在 `progress.ts` 的 imports 里追加：

```ts
import {
  addTasks, updateTask, removeTask,
  queryTasks, isExecutable, rollupTask,
  withSessionLock,
} from "./lib/progress-store.ts";
import type { TaskInput, TaskUpdatePatch } from "./lib/progress-store.ts";
import type { TaskStatus } from "./lib/progress-types.ts";
```

追加处理器（全部 `async` + `await withSessionLock(...)`；`createCli` 支持 async action，见 `cli-runner.ts:35`）：

```ts
// ── task-add ────────────────────────────────────────────

async function runTaskAdd(opts: {
  project: string; session: string; tasks: string;
}): Promise<void> {
  let inputs: TaskInput[];
  try {
    inputs = JSON.parse(opts.tasks) as TaskInput[];
    if (!Array.isArray(inputs)) throw new Error("--tasks must be a JSON array");
  } catch (err) {
    fail("task-add", `invalid --tasks JSON: ${(err as Error).message}`, ExitCode.ARG_ERROR);
  }
  try {
    await withSessionLock(opts.project, opts.session, () =>
      addTasks(opts.project, opts.session, inputs));
  } catch (err) {
    fail("task-add", (err as Error).message, ExitCode.ARG_ERROR);
  }
  emit(readSession(opts.project, opts.session));
}

// ── task-update ─────────────────────────────────────────

async function runTaskUpdate(opts: {
  project: string; session: string; task: string;
  status?: string; reason?: string; payload?: string;
  dependsOn?: string; error?: string; force?: boolean;
}): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (opts.status) {
    if (!["pending","running","done","blocked","failed","skipped"].includes(opts.status)) {
      fail("task-update", `invalid --status ${opts.status}`, ExitCode.ARG_ERROR);
    }
    patch.status = opts.status;
  }
  if (opts.reason !== undefined) patch.reason = opts.reason;
  if (opts.error !== undefined) patch.error = opts.error;
  if (opts.payload) {
    try { patch.payload = JSON.parse(opts.payload); }
    catch { fail("task-update", `invalid --payload JSON`, ExitCode.ARG_ERROR); }
  }
  if (opts.dependsOn !== undefined) {
    patch.depends_on = opts.dependsOn
      ? opts.dependsOn.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  }

  // Guard: when transitioning to running, check deps (unless --force)
  if (patch.status === "running") {
    const gate = isExecutable(opts.project, opts.session, opts.task);
    if (!gate.ok) {
      if (!opts.force) {
        fail("task-update",
          `cannot start ${opts.task}: blocked_by ${gate.blocked_by.join(",")}`,
          ExitCode.DEPENDENCY_UNSATISFIED);
      }
      // --force: record forced-start in errors
      patch.error = `forced-start: blocked_by ${gate.blocked_by.join(",")}`;
      patch.status = "running";  // still running, but error attached via patch (see store)
    }
  }

  try {
    await withSessionLock(opts.project, opts.session, () =>
      updateTask(opts.project, opts.session, opts.task, patch as TaskUpdatePatch));
  } catch (err) {
    fail("task-update", (err as Error).message, ExitCode.ARG_ERROR);
  }
  emit(readSession(opts.project, opts.session));
}
```

（`updateTask` 已在 Task 4 里实现为"`--error` 任意状态下都 append"，此处无需再改 store。）

继续 progress.ts 的其他 handler：

```ts
// ── task-remove ─────────────────────────────────────────

async function runTaskRemove(opts: {
  project: string; session: string; task: string;
}): Promise<void> {
  await withSessionLock(opts.project, opts.session, () =>
    removeTask(opts.project, opts.session, opts.task));
  emit(readSession(opts.project, opts.session));
}

// ── task-query ──────────────────────────────────────────

function runTaskQuery(opts: {
  project: string; session: string;
  status?: string; kind?: string; parent?: string;
  includeAll?: boolean; includeBlocked?: boolean; format?: string;
}): void {
  const results = queryTasks(opts.project, opts.session, {
    status: opts.status
      ? (opts.status.split(",").map((s) => s.trim()) as TaskStatus[])
      : undefined,
    kind: opts.kind,
    parent: opts.parent,
    includeAll: opts.includeAll,
    includeBlocked: opts.includeBlocked,
  });

  if (opts.format === "table") {
    const lines = [
      ["id", "name", "status", "kind", "parent", "blocked_by"].join("\t"),
      ...results.map((r) => [
        r.task.id, r.task.name, r.task.status, r.task.kind,
        r.task.parent ?? "-", (r.blocked_by ?? []).join(",") || "-",
      ].join("\t")),
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
    return;
  }
  emit(results);
}

// ── task-block / task-unblock ───────────────────────────

async function runTaskBlock(opts: {
  project: string; session: string; task: string; reason: string;
}): Promise<void> {
  await withSessionLock(opts.project, opts.session, () =>
    updateTask(opts.project, opts.session, opts.task, {
      status: "blocked", reason: opts.reason,
    }));
  emit(readSession(opts.project, opts.session));
}

async function runTaskUnblock(opts: {
  project: string; session: string; task: string;
}): Promise<void> {
  await withSessionLock(opts.project, opts.session, () =>
    updateTask(opts.project, opts.session, opts.task, {
      status: "pending", reason: null,
    }));
  emit(readSession(opts.project, opts.session));
}

// ── task-rollup ─────────────────────────────────────────

async function runTaskRollup(opts: {
  project: string; session: string; task: string;
}): Promise<void> {
  try {
    await withSessionLock(opts.project, opts.session, () =>
      rollupTask(opts.project, opts.session, opts.task));
  } catch (err) {
    const msg = (err as Error).message;
    if (/unfinished/i.test(msg)) {
      fail("task-rollup", msg, ExitCode.ROLLUP_INCOMPLETE);
    }
    fail("task-rollup", msg, ExitCode.ARG_ERROR);
  }
  emit(readSession(opts.project, opts.session));
}
```

然后在 `createCli` 的 commands 数组里追加：

```ts
{
  name: "task-add",
  description: "Add tasks (batch via --tasks JSON array)",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--tasks <json>", description: "JSON array of TaskInput", required: true },
  ],
  action: runTaskAdd,
},
{
  name: "task-update",
  description: "Update task fields",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--task <id>", description: "Task id", required: true },
    { flag: "--status <s>", description: "pending|running|done|blocked|failed|skipped" },
    { flag: "--reason <msg>", description: "Block / skip reason" },
    { flag: "--payload <json>", description: "Merge into task payload" },
    { flag: "--depends-on <csv>", description: "Replace depends_on list (comma-separated)" },
    { flag: "--error <msg>", description: "Append to errors (with failed/blocked status)" },
    { flag: "--force", description: "Bypass dependency check when starting", defaultValue: false },
  ],
  action: runTaskUpdate,
},
{
  name: "task-remove",
  description: "Remove a task by id",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--task <id>", description: "Task id", required: true },
  ],
  action: runTaskRemove,
},
{
  name: "task-query",
  description: "Query tasks with visibility rules",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--status <csv>", description: "Comma-separated statuses" },
    { flag: "--kind <k>", description: "Filter by kind" },
    { flag: "--parent <id>", description: "Filter by parent id" },
    { flag: "--include-all", description: "Bypass all visibility filters", defaultValue: false },
    { flag: "--include-blocked", description: "Show hidden (blocked) tasks with reasons", defaultValue: false },
    { flag: "--format <fmt>", description: "json | table", defaultValue: "json" },
  ],
  action: runTaskQuery,
},
{
  name: "task-block",
  description: "Shortcut: set status=blocked with reason",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--task <id>", description: "Task id", required: true },
    { flag: "--reason <msg>", description: "Block reason", required: true },
  ],
  action: runTaskBlock,
},
{
  name: "task-unblock",
  description: "Shortcut: clear blocked, return to pending",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--task <id>", description: "Task id", required: true },
  ],
  action: runTaskUnblock,
},
{
  name: "task-rollup",
  description: "Mark parent done if all children done/skipped",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--task <id>", description: "Parent task id", required: true },
  ],
  action: runTaskRollup,
},
```

- [ ] **Step 10.3: Commit**

```bash
git add .claude/scripts/progress.ts .claude/scripts/__tests__/progress.test.ts
git commit -m "feat(progress): add task-* subcommands (add/update/remove/query/block/rollup)"
```

---

### Task 11: CLI — `artifact-*` 子命令

**Files:**
- Modify: `.claude/scripts/progress.ts`
- Modify: `.claude/scripts/__tests__/progress.test.ts`

- [ ] **Step 11.1: 追加 artifact 测试**

```ts
describe("artifact-set + artifact-get", () => {
  it("round-trips small value", () => {
    const sid = JSON.parse(run([
      "session-create", "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "a.md",
    ]).stdout).session_id;
    run(["artifact-set", "--project", "dataAssets", "--session", sid,
      "--key", "k1", "--value", JSON.stringify({ x: 1 })]);
    const got = JSON.parse(run([
      "artifact-get", "--project", "dataAssets", "--session", sid, "--key", "k1",
    ]).stdout);
    assert.deepEqual(got, { x: 1 });
  });

  it("spills and reads back large value", () => {
    const sid = JSON.parse(run([
      "session-create", "--workflow", "w", "--project", "dataAssets",
      "--source-type", "prd", "--source-path", "a2.md",
    ]).stdout).session_id;
    const big = { data: "y".repeat(100_000) };
    run(["artifact-set", "--project", "dataAssets", "--session", sid,
      "--key", "blob", "--value", JSON.stringify(big)]);
    const got = JSON.parse(run([
      "artifact-get", "--project", "dataAssets", "--session", sid, "--key", "blob",
    ]).stdout);
    assert.equal(got.data.length, 100_000);
  });
});
```

- [ ] **Step 11.2: 实现 artifact-* 子命令**

在 progress.ts imports 追加：

```ts
import { setArtifact, getArtifact } from "./lib/progress-store.ts";
```

追加 handlers：

```ts
async function runArtifactSet(opts: {
  project: string; session: string; key: string; value: string;
}): Promise<void> {
  let parsed: unknown;
  try { parsed = JSON.parse(opts.value); }
  catch { fail("artifact-set", `invalid --value JSON`, ExitCode.ARG_ERROR); }
  await withSessionLock(opts.project, opts.session, () =>
    setArtifact(opts.project, opts.session, opts.key, parsed));
  emit(readSession(opts.project, opts.session));
}

function runArtifactGet(opts: { project: string; session: string; key: string }): void {
  const v = getArtifact(opts.project, opts.session, opts.key);
  emit(v);
}
```

在 commands 数组追加：

```ts
{
  name: "artifact-set",
  description: "Set session-level artifact (auto-spill > 64KB)",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--key <k>", description: "Artifact key", required: true },
    { flag: "--value <json>", description: "Value JSON", required: true },
  ],
  action: runArtifactSet,
},
{
  name: "artifact-get",
  description: "Read artifact (dereferences blob $ref automatically)",
  options: [
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--session <id>", description: "Session id", required: true },
    { flag: "--key <k>", description: "Artifact key", required: true },
  ],
  action: runArtifactGet,
},
```

- [ ] **Step 11.3: Commit**

```bash
git add .claude/scripts/progress.ts .claude/scripts/__tests__/progress.test.ts
git commit -m "feat(progress): add artifact-set / artifact-get subcommands"
```

---

### Task 12: 注册到 `kata-cli.ts` 并验证所有 progress 单测

**Files:**
- Modify: `.claude/scripts/kata-cli.ts`

- [ ] **Step 12.1: 注册 progress 子命令**

在 `kata-cli.ts` 的 import 区块（按字母顺序插入）：

```ts
import { program as progress } from "./progress.ts";
```

在 `addCommand` 区块（按字母顺序插入）：

```ts
kata.addCommand(progress);
```

- [ ] **Step 12.2: 运行全部 progress 相关单测**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-store.test.ts
bun test ./.claude/scripts/__tests__/progress.test.ts
```

预期：两套都全绿。

- [ ] **Step 12.3: 运行全量单测确保无回归**

```bash
bun run ci
```

预期：lint + type-check + test 全绿。

- [ ] **Step 12.4: Commit**

```bash
git add .claude/scripts/kata-cli.ts
git commit -m "feat(progress): wire progress subcommand into kata-cli"
```

---

### Task 13: 迁移器（`kata-state` → progress）

**Files:**
- Create: `.claude/scripts/lib/progress-migrator.ts`
- Create: `.claude/scripts/__tests__/lib/progress-migrator.test.ts`

- [ ] **Step 13.1: 写失败的迁移测试**

```ts
// .claude/scripts/__tests__/lib/progress-migrator.test.ts
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { migrateKataState } from "../../lib/progress-migrator.ts";
import { readSession } from "../../lib/progress-store.ts";

const TMP = join(tmpdir(), `migrator-test-${process.pid}`);

before(() => {
  process.env.KATA_ROOT_OVERRIDE = TMP;
  mkdirSync(TMP, { recursive: true });
});
after(() => {
  delete process.env.KATA_ROOT_OVERRIDE;
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
});
beforeEach(() => {
  try { rmSync(join(TMP, ".kata"), { recursive: true, force: true }); } catch {}
  try { rmSync(join(TMP, ".temp"), { recursive: true, force: true }); } catch {}
});

function writeLegacyKataState(fileName: string, data: object): string {
  const dir = join(TMP, "workspace", "dataAssets", ".temp");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileName);
  writeFileSync(path, JSON.stringify(data));
  return path;
}

describe("migrateKataState", () => {
  it("converts completed_nodes + current_node to done/running tasks", async () => {
    const legacyPath = writeLegacyKataState(".kata-state-prd-xxx-default.json", {
      project: "dataAssets",
      prd: "workspace/dataAssets/prds/202604/prd-xxx.md",
      mode: "normal",
      current_node: "write",
      completed_nodes: ["transform", "enhance", "analyze"],
      node_outputs: {
        transform: { confidence: 0.9 },
        enhance: { notes: "ok" },
      },
      writers: { w1: "data" },
      strategy_resolution: { strategy: "cautious" },
      created_at: "2026-04-24T10:00:00Z",
      updated_at: "2026-04-24T11:00:00Z",
    });

    const { sessionId } = await migrateKataState({
      legacyPath, project: "dataAssets", env: "default", dryRun: false,
    });

    const s = readSession("dataAssets", sessionId)!;
    assert.equal(s.workflow, "test-case-gen");
    assert.equal(s.tasks.length, 7);

    const byId: Record<string, { status: string; depends_on: readonly string[]; payload: Record<string, unknown> }> =
      Object.fromEntries(s.tasks.map((t) => [t.id, t]));
    assert.equal(byId.transform.status, "done");
    assert.equal(byId.enhance.status, "done");
    assert.equal(byId.analyze.status, "done");
    assert.equal(byId.write.status, "running");
    assert.equal(byId.review.status, "pending");
    assert.deepEqual(byId.enhance.depends_on, ["transform"]);
    assert.deepEqual(byId.analyze.depends_on, ["enhance"]);
    assert.equal(byId.transform.payload.confidence, 0.9);

    assert.deepEqual(s.artifacts.writers, { w1: "data" });
    assert.deepEqual(s.artifacts.strategy_resolution, { strategy: "cautious" });
    assert.equal(s.source.path, "workspace/dataAssets/prds/202604/prd-xxx.md");
    assert.equal(s.meta.mode, "normal");
  });

  it("dry-run does not create any file", async () => {
    const legacyPath = writeLegacyKataState(".kata-state-prd-yyy-default.json", {
      project: "dataAssets", prd: "y.md", mode: "normal",
      current_node: "init", completed_nodes: [], node_outputs: {},
      writers: {}, created_at: "now", updated_at: "now",
    });
    await migrateKataState({
      legacyPath, project: "dataAssets", env: "default", dryRun: true,
    });
    // No .kata dir should exist
    assert.equal(existsSync(join(TMP, ".kata")), false);
  });

  it("refuses to overwrite existing session", async () => {
    const legacyPath = writeLegacyKataState(".kata-state-prd-zzz-default.json", {
      project: "dataAssets", prd: "z.md", mode: "normal",
      current_node: "init", completed_nodes: [], node_outputs: {},
      writers: {}, created_at: "now", updated_at: "now",
    });
    await migrateKataState({ legacyPath, project: "dataAssets", env: "default", dryRun: false });
    await assert.rejects(
      () => migrateKataState({ legacyPath, project: "dataAssets", env: "default", dryRun: false }),
      /already exists/i,
    );
  });
});
```

- [ ] **Step 13.2: 运行确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-migrator.test.ts
```

- [ ] **Step 13.3: 实现 `progress-migrator.ts` 的 `migrateKataState`**

```ts
// .claude/scripts/lib/progress-migrator.ts
import {
  existsSync, mkdirSync, readFileSync, renameSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  createSession, writeSession, readSession, addTasks,
  updateTask, setArtifact,
} from "./progress-store.ts";
import type { TaskInput } from "./progress-store.ts";
import { legacyBackupDir } from "./paths.ts";

const PIPELINE_NODES = [
  "init", "transform", "enhance", "analyze", "write", "review", "output",
] as const;

export interface MigrateOpts {
  readonly legacyPath: string;
  readonly project: string;
  readonly env?: string;
  readonly dryRun: boolean;
}

function moveToBackup(project: string, legacyPath: string): void {
  const dest = join(legacyBackupDir(project), basename(legacyPath));
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(legacyPath, dest);
}

export async function migrateKataState(opts: MigrateOpts): Promise<{ sessionId: string }> {
  const raw = JSON.parse(readFileSync(opts.legacyPath, "utf8")) as {
    project: string;
    prd: string;
    mode: string;
    current_node: string;
    completed_nodes: string[];
    node_outputs: Record<string, Record<string, unknown>>;
    writers?: Record<string, unknown>;
    strategy_resolution?: unknown;
    cached_parse_result?: unknown;
    source_mtime?: string;
    created_at: string;
    updated_at: string;
  };

  const env = opts.env ?? "default";
  const slug = basename(raw.prd, ".md");
  const sessionId = `test-case-gen/${slug}-${env}`;

  if (opts.dryRun) {
    return { sessionId };
  }

  if (readSession(opts.project, sessionId)) {
    throw new Error(`session already exists: ${sessionId}`);
  }

  const session = createSession({
    project: opts.project,
    workflow: "test-case-gen",
    slug, env,
    source: { type: "prd", path: raw.prd, mtime: raw.source_mtime ?? null },
    meta: { mode: raw.mode },
  });
  writeSession(opts.project, session);

  // Build 7 node tasks with sequential dependencies
  const inputs: TaskInput[] = PIPELINE_NODES.map((name, i) => ({
    id: name,
    name,
    kind: "node",
    order: i + 1,
    depends_on: i === 0 ? [] : [PIPELINE_NODES[i - 1]],
    payload: raw.node_outputs[name] ?? {},
  }));
  addTasks(opts.project, sessionId, inputs);

  for (const name of raw.completed_nodes) {
    if ((PIPELINE_NODES as readonly string[]).includes(name)) {
      updateTask(opts.project, sessionId, name, { status: "done" });
    }
  }
  if ((PIPELINE_NODES as readonly string[]).includes(raw.current_node) &&
      !raw.completed_nodes.includes(raw.current_node)) {
    updateTask(opts.project, sessionId, raw.current_node, { status: "running" });
  }

  if (raw.writers) setArtifact(opts.project, sessionId, "writers", raw.writers);
  if (raw.strategy_resolution !== undefined) {
    setArtifact(opts.project, sessionId, "strategy_resolution", raw.strategy_resolution);
  }
  if (raw.cached_parse_result !== undefined) {
    setArtifact(opts.project, sessionId, "cached_parse_result", raw.cached_parse_result);
  }

  moveToBackup(opts.project, opts.legacyPath);
  return { sessionId };
}
```

- [ ] **Step 13.4: 运行确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-migrator.test.ts
```

- [ ] **Step 13.5: Commit**

```bash
git add .claude/scripts/lib/progress-migrator.ts .claude/scripts/__tests__/lib/progress-migrator.test.ts
git commit -m "feat(progress): add kata-state legacy migrator"
```

---

### Task 14: 迁移器（`ui-autotest-progress` → progress）

**Files:**
- Modify: `.claude/scripts/lib/progress-migrator.ts`
- Modify: `.claude/scripts/__tests__/lib/progress-migrator.test.ts`

- [ ] **Step 14.1: 追加 ui-autotest 迁移测试**

```ts
import { migrateUiAutotest } from "../../lib/progress-migrator.ts";

function writeLegacyUiAutotest(fileName: string, data: object): string {
  const dir = join(TMP, "workspace", "dataAssets", ".temp");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileName);
  writeFileSync(path, JSON.stringify(data));
  return path;
}

describe("migrateUiAutotest", () => {
  it("converts cases to tasks under a virtual suite phase", async () => {
    const legacyPath = writeLegacyUiAutotest("ui-autotest-progress-my-suite-ci63.json", {
      version: 1,
      suite_name: "my-suite",
      env: "ci63",
      archive_md: "workspace/dataAssets/archive/foo.md",
      url: "http://localhost",
      selected_priorities: ["P0"],
      output_dir: "tests/",
      started_at: "2026-04-24T10:00:00Z",
      updated_at: "2026-04-24T11:00:00Z",
      current_step: 5,
      preconditions_ready: true,
      merge_status: "pending",
      cases: {
        t1: {
          title: "login", priority: "P0",
          generated: true, script_path: "tests/login.spec.ts",
          test_status: "passed", attempts: 1,
          error_history: [],
        },
        t2: {
          title: "logout", priority: "P0",
          generated: true, script_path: "tests/logout.spec.ts",
          test_status: "failed", attempts: 2,
          error_history: [{ at: "2026-04-24T10:30:00Z", message: "timeout" }],
        },
      },
    });

    const { sessionId } = await migrateUiAutotest({
      legacyPath, project: "dataAssets", env: "ci63", dryRun: false,
    });
    const s = readSession("dataAssets", sessionId)!;
    assert.equal(s.workflow, "ui-autotest");
    assert.equal(s.session_id, "ui-autotest/my-suite-ci63");
    // 1 phase (suite) + 2 cases
    assert.equal(s.tasks.length, 3);
    const suite = s.tasks.find((t) => t.kind === "phase")!;
    assert.equal(suite.status, "running");
    const cases = s.tasks.filter((t) => t.kind === "case");
    const t1 = cases.find((c) => c.id === "t1")!;
    const t2 = cases.find((c) => c.id === "t2")!;
    assert.equal(t1.status, "done"); // passed → done
    assert.equal(t1.payload.script_path, "tests/login.spec.ts");
    assert.equal(t2.status, "failed");
    assert.equal(t2.errors.length, 1);
    assert.equal(t2.errors[0].message, "timeout");
    assert.equal(s.meta.url, "http://localhost");
    assert.equal(s.meta.suite_name, "my-suite");
  });
});
```

- [ ] **Step 14.2: 运行确认 FAIL**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-migrator.test.ts
```

- [ ] **Step 14.3: 实现 `migrateUiAutotest`**

在 `progress-migrator.ts` 追加：

```ts
export async function migrateUiAutotest(opts: MigrateOpts): Promise<{ sessionId: string }> {
  const raw = JSON.parse(readFileSync(opts.legacyPath, "utf8")) as {
    version: number;
    suite_name: string;
    env?: string;
    archive_md: string;
    url: string;
    selected_priorities: string[];
    output_dir: string;
    started_at: string;
    updated_at: string;
    current_step: number;
    preconditions_ready: boolean;
    merge_status: string;
    cases: Record<string, {
      title: string; priority: string;
      generated: boolean; script_path: string | null;
      test_status: "pending" | "running" | "passed" | "failed";
      attempts: number;
      error_history: readonly { at: string; message: string }[];
    }>;
    convergence?: unknown;
    convergence_status?: string;
    cached_parse_result?: unknown;
  };

  const env = opts.env ?? raw.env ?? "default";
  const slug = raw.suite_name.replace(/[^A-Za-z0-9_-]+/g, "-");
  const sessionId = `ui-autotest/${slug}-${env}`;

  if (opts.dryRun) return { sessionId };

  if (readSession(opts.project, sessionId)) {
    throw new Error(`session already exists: ${sessionId}`);
  }

  const session = createSession({
    project: opts.project,
    workflow: "ui-autotest",
    slug, env,
    source: { type: "archive", path: raw.archive_md, mtime: null },
    meta: {
      suite_name: raw.suite_name,
      url: raw.url,
      selected_priorities: raw.selected_priorities,
      output_dir: raw.output_dir,
    },
  });
  writeSession(opts.project, session);

  // Virtual suite phase
  const suiteInput: TaskInput = {
    id: "suite", name: raw.suite_name, kind: "phase", order: 1,
  };
  const caseInputs: TaskInput[] = Object.entries(raw.cases).map(([id, c], i) => ({
    id,
    name: c.title,
    kind: "case",
    order: i + 1,
    parent: "suite",
    payload: {
      priority: c.priority,
      generated: c.generated,
      script_path: c.script_path,
    },
  }));
  addTasks(opts.project, sessionId, [suiteInput, ...caseInputs]);

  // Suite always running (since cases are being driven)
  updateTask(opts.project, sessionId, "suite", { status: "running" });

  // Map legacy test_status → new status enum.
  // NOTE: attempts count cannot be perfectly replayed via the public API
  //       (it is set internally by status=running). We accept this; skills
  //       should not rely on post-migration attempts being exact.
  const statusMap: Record<string, "done" | "running" | "failed" | "pending"> = {
    passed: "done", failed: "failed", running: "running", pending: "pending",
  };
  for (const [id, c] of Object.entries(raw.cases)) {
    const mapped = statusMap[c.test_status] ?? "pending";
    if (mapped === "pending") continue;
    if (mapped === "failed") {
      // Replay each recorded error to preserve error_history
      for (const e of c.error_history) {
        updateTask(opts.project, sessionId, id, {
          status: "failed", error: e.message,
        });
      }
      // If no errors recorded but case was failed, still mark failed
      if (c.error_history.length === 0) {
        updateTask(opts.project, sessionId, id, { status: "failed" });
      }
    } else {
      updateTask(opts.project, sessionId, id, { status: mapped });
    }
  }

  if (raw.convergence !== undefined) {
    setArtifact(opts.project, sessionId, "convergence", raw.convergence);
  }
  if (raw.convergence_status !== undefined) {
    setArtifact(opts.project, sessionId, "convergence_status", raw.convergence_status);
  }
  if (raw.cached_parse_result !== undefined) {
    setArtifact(opts.project, sessionId, "cached_parse_result", raw.cached_parse_result);
  }
  setArtifact(opts.project, sessionId, "ui_autotest_flow", {
    current_step: raw.current_step,
    preconditions_ready: raw.preconditions_ready,
    merge_status: raw.merge_status,
  });

  moveToBackup(opts.project, opts.legacyPath);
  return { sessionId };
}
```

- [ ] **Step 14.4: 运行确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/lib/progress-migrator.test.ts
```

- [ ] **Step 14.5: Commit**

```bash
git add .claude/scripts/lib/progress-migrator.ts .claude/scripts/__tests__/lib/progress-migrator.test.ts
git commit -m "feat(progress): add ui-autotest-progress legacy migrator"
```

---

### Task 15: CLI `migrate` 子命令

**Files:**
- Modify: `.claude/scripts/progress.ts`
- Modify: `.claude/scripts/__tests__/progress.test.ts`

- [ ] **Step 15.1: 追加 migrate 测试**

```ts
describe("progress migrate --from legacy", () => {
  it("scans workspace .temp and migrates all legacy files", () => {
    // Seed two legacy files under the temp workspace
    const wsTemp = join(TMP, "workspace", "dataAssets", ".temp");
    mkdirSync(wsTemp, { recursive: true });
    writeFileSync(join(wsTemp, ".kata-state-prd-a-default.json"), JSON.stringify({
      project: "dataAssets", prd: "prd-a.md", mode: "normal",
      current_node: "init", completed_nodes: [], node_outputs: {}, writers: {},
      created_at: "x", updated_at: "x",
    }));
    writeFileSync(join(wsTemp, "ui-autotest-progress-my-suite.json"), JSON.stringify({
      version: 1, suite_name: "my-suite",
      archive_md: "x.md", url: "u", selected_priorities: ["P0"],
      output_dir: "t/", started_at: "x", updated_at: "x",
      current_step: 4, preconditions_ready: false, merge_status: "pending",
      cases: {},
    }));

    const dry = JSON.parse(run(["migrate", "--from", "legacy", "--project", "dataAssets",
      "--dry-run"], { WORKSPACE_DIR: join(TMP, "workspace") }).stdout);
    assert.equal(dry.plan.length, 2);

    const real = JSON.parse(run(["migrate", "--from", "legacy", "--project", "dataAssets"],
      { WORKSPACE_DIR: join(TMP, "workspace") }).stdout);
    assert.equal(real.migrated, 2);

    // Idempotency: re-running finds nothing left
    const again = JSON.parse(run(["migrate", "--from", "legacy", "--project", "dataAssets"],
      { WORKSPACE_DIR: join(TMP, "workspace") }).stdout);
    assert.equal(again.migrated, 0);
  });
});
```

需要引入：

```ts
import { writeFileSync } from "node:fs";
```

- [ ] **Step 15.2: 实现 migrate 子命令 + discovery 函数**

在 `progress-migrator.ts` 末尾追加：

```ts
import { readdirSync } from "node:fs";
import { tempDir } from "./paths.ts";

export interface LegacyEntry {
  readonly path: string;
  readonly kind: "kata-state" | "ui-autotest";
  readonly env: string;
}

export function discoverLegacyFiles(project: string): LegacyEntry[] {
  const dir = tempDir(project);
  if (!existsSync(dir)) return [];
  const out: LegacyEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (/^\.kata-state-.+\.json$/.test(f)) {
      const m = f.match(/^\.kata-state-(.+)-([^-]+)\.json$/);
      out.push({
        path: join(dir, f),
        kind: "kata-state",
        env: m?.[2] ?? "default",
      });
    } else if (/^ui-autotest-progress-(?!alias-).+\.json$/.test(f)) {
      out.push({
        path: join(dir, f),
        kind: "ui-autotest",
        env: "default",
      });
    }
  }
  return out;
}
```

别忘记补 `import { existsSync } from "node:fs";`（若未导入）。

在 `progress.ts` 的 imports 追加：

```ts
import {
  migrateKataState, migrateUiAutotest, discoverLegacyFiles,
} from "./lib/progress-migrator.ts";
```

追加 handler：

```ts
async function runMigrate(opts: {
  from: string; project: string; dryRun?: boolean;
}): Promise<void> {
  if (opts.from !== "legacy") {
    fail("migrate", `unsupported --from value: ${opts.from}`, ExitCode.ARG_ERROR);
  }
  const entries = discoverLegacyFiles(opts.project);

  if (opts.dryRun) {
    emit({ plan: entries });
    return;
  }

  let migrated = 0;
  const results: Array<{ path: string; sessionId: string; kind: string }> = [];
  for (const entry of entries) {
    const result = entry.kind === "kata-state"
      ? await migrateKataState({
          legacyPath: entry.path, project: opts.project, env: entry.env, dryRun: false,
        })
      : await migrateUiAutotest({
          legacyPath: entry.path, project: opts.project, env: entry.env, dryRun: false,
        });
    migrated++;
    results.push({ path: entry.path, sessionId: result.sessionId, kind: entry.kind });
  }
  emit({ migrated, results });
}
```

在 commands 数组追加：

```ts
{
  name: "migrate",
  description: "Migrate legacy kata-state / ui-autotest-progress files",
  options: [
    { flag: "--from <source>", description: "Migration source (only 'legacy' supported)", required: true },
    { flag: "--project <name>", description: "Project name", required: true },
    { flag: "--dry-run", description: "Show plan without writing anything", defaultValue: false },
  ],
  action: runMigrate,
},
```

- [ ] **Step 15.3: 运行确认 PASS**

```bash
bun test ./.claude/scripts/__tests__/progress.test.ts
```

- [ ] **Step 15.4: Commit**

```bash
git add .claude/scripts/progress.ts .claude/scripts/lib/progress-migrator.ts .claude/scripts/__tests__/progress.test.ts
git commit -m "feat(progress): add progress migrate --from legacy subcommand"
```

---

### Task 16: 更新 `test-case-gen` skill 提示词

**Files:**
- Modify: `.claude/skills/test-case-gen/SKILL.md`
- Modify: `.claude/skills/test-case-gen/workflow/main.md`

- [ ] **Step 16.1: 定位旧命令**

```bash
grep -n "kata-state" .claude/skills/test-case-gen/SKILL.md .claude/skills/test-case-gen/workflow/main.md
```

记录所有出现位置。

- [ ] **Step 16.2: 按命令映射替换**

对每个出现位置，按如下规则替换（逐一 Edit）：

| 旧命令 | 新命令 |
|---|---|
| `kata-cli kata-state init --project X --prd Y --mode M` | `SESSION_ID=$(kata-cli progress session-create --workflow test-case-gen --project X --source-type prd --source-path Y --meta '{"mode":"M"}' \| jq -r .session_id)` |
| `kata-cli kata-state update --project X --prd-slug S --node N --data D` | `kata-cli progress task-update --project X --session $SESSION_ID --task N --status done --payload D`（若 N 是进入态，用 `--status running`） |
| `kata-cli kata-state resume --project X --prd-slug S` | `kata-cli progress session-resume --project X --session $SESSION_ID && kata-cli progress session-read --project X --session $SESSION_ID` |
| `kata-cli kata-state clean --project X --prd-slug S` | `kata-cli progress session-delete --project X --session $SESSION_ID` |

同时在每个 workflow 首步（如 step-0 或 step-1）**新增一段"导出 SESSION_ID"的 bash**：

```bash
# 根据 PRD 文件名推导 session_id（新会话用 session-create 创建）
PRD_SLUG=$(basename "$PRD_PATH" .md)
SESSION_ID="test-case-gen/${PRD_SLUG}-${ACTIVE_ENV:-default}"

# 若 session 不存在则创建，否则复用
kata-cli progress session-read --project "$PROJECT" --session "$SESSION_ID" 2>/dev/null \
  || kata-cli progress session-create --workflow test-case-gen --project "$PROJECT" \
       --source-type prd --source-path "$PRD_PATH" --meta '{"mode":"normal"}' > /dev/null
```

- [ ] **Step 16.3: 人工 grep 核验无残留**

```bash
grep -n "kata-state" .claude/skills/test-case-gen/ -r
```

预期：无输出。

- [ ] **Step 16.4: Commit**

```bash
git add .claude/skills/test-case-gen/
git commit -m "refactor(test-case-gen): migrate from kata-state to progress CLI"
```

---

### Task 17: 更新 `ui-autotest` skill 提示词

**Files:**
- Modify: `.claude/skills/ui-autotest/SKILL.md`
- Modify: `.claude/skills/ui-autotest/workflow/step-1.5-resume.md`
- Modify: `.claude/skills/ui-autotest/workflow/step-4-script-writer.md`
- Modify: `.claude/skills/ui-autotest/workflow/step-5-test-fix.md`
- Modify: `.claude/skills/ui-autotest/workflow/step-5.5-convergence.md`
- Modify: `.claude/skills/ui-autotest/workflow/step-6-merge.md`

- [ ] **Step 17.1: 定位旧命令**

```bash
grep -rn "ui-autotest-progress" .claude/skills/ui-autotest/
```

- [ ] **Step 17.2: 按命令映射替换**

| 旧命令 | 新命令 |
|---|---|
| `kata-cli ui-autotest-progress create --project X --suite S --archive A --url U --priorities P --output-dir D --cases C` | `kata-cli progress session-create --workflow ui-autotest --project X --source-type archive --source-path A --env $ENV --meta '{"suite_name":"S","url":"U","selected_priorities":["P"],"output_dir":"D"}'` + 之后用 `kata-cli progress task-add ... --tasks` 传入 cases |
| `kata-cli ui-autotest-progress update --project X --suite S --case T --field F --value V` | `kata-cli progress task-update --project X --session $SESSION_ID --task T --status V`（若 F=test_status）<br>`kata-cli progress task-update ... --payload '{"F":V}'`（其他 field） |
| `kata-cli ui-autotest-progress read --project X --suite S` | `kata-cli progress session-read --project X --session $SESSION_ID` |
| `kata-cli ui-autotest-progress summary --project X --suite S` | `kata-cli progress session-summary --project X --session $SESSION_ID` |
| `kata-cli ui-autotest-progress reset --project X --suite S` | `kata-cli progress session-delete --project X --session $SESSION_ID` |
| `kata-cli ui-autotest-progress resume --project X --suite S [--retry-failed]` | `kata-cli progress session-resume --project X --session $SESSION_ID [--retry-failed] --payload-path-check script_path` |
| `kata-cli ui-autotest-progress suite-slug --suite S` | 改为 bash：`echo "$S" \| sed 's/[^A-Za-z0-9_-]/-/g'` 或直接在 skill 中写 SESSION_ID 模板 |

在 step-1 或 SKILL.md 入口新增 SESSION_ID 导出段：

```bash
SUITE_SLUG=$(echo "$SUITE_NAME" | sed 's/[^A-Za-z0-9_-]/-/g' | sed 's/--*/-/g; s/^-//;s/-$//')
SESSION_ID="ui-autotest/${SUITE_SLUG}-${ACTIVE_ENV:-default}"
```

`test_status` 值映射注意：旧 `passed` → 新 `done`；旧 `running/failed/pending` 不变。

- [ ] **Step 17.3: 核验无残留**

```bash
grep -rn "ui-autotest-progress" .claude/skills/ui-autotest/
```

预期：无输出。

- [ ] **Step 17.4: Commit**

```bash
git add .claude/skills/ui-autotest/
git commit -m "refactor(ui-autotest): migrate from ui-autotest-progress to progress CLI"
```

---

### Task 18: 更新 `kata` quickstart 引用

**Files:**
- Modify: `.claude/skills/kata/references/quickstart.md`

- [ ] **Step 18.1: 替换所有 `kata-state` / `ui-autotest-progress` 提及**

```bash
grep -n "kata-state\|ui-autotest-progress" .claude/skills/kata/references/quickstart.md
```

按 Task 16 / 17 的映射规则替换。典型场景是 quickstart 会展示"断点续传示例"的命令——改为 `kata-cli progress session-resume` + `kata-cli progress task-query --status blocked` 的示例。

- [ ] **Step 18.2: 核验无残留 + Commit**

```bash
grep -rn "kata-state\|ui-autotest-progress" .claude/skills/
# 预期：无输出

git add .claude/skills/kata/references/quickstart.md
git commit -m "docs(kata): update quickstart to reference progress CLI"
```

---

### Task 19: 执行真实迁移

**Files:**（只修改数据，不改代码）

- [ ] **Step 19.1: 为每个项目运行 dry-run**

```bash
for project in $(ls workspace/); do
  echo "=== $project ==="
  kata-cli progress migrate --from legacy --project "$project" --dry-run
done
```

预期：列出每个 project 下将要迁移的 legacy 文件。**人工核对输出**，确认：
- 文件数与预期一致
- 没有本不应该迁移的文件（例如错误名称的副本）

- [ ] **Step 19.2: 执行真实迁移**

```bash
for project in $(ls workspace/); do
  echo "=== $project ==="
  kata-cli progress migrate --from legacy --project "$project"
done
```

- [ ] **Step 19.3: 验证迁移结果**

```bash
# 每个项目的 session 文件
find .kata -name "*.json" -type f | head

# legacy-backup 应包含所有旧文件
find .kata -path "*/legacy-backup/*" -type f | wc -l

# 原 .temp 目录下的相关文件应已被移走
find workspace -path "*/.temp/.kata-state-*" -o -path "*/.temp/ui-autotest-progress-*"
# 预期：无输出（只剩 alias 等非迁移目标文件，或完全为空）
```

- [ ] **Step 19.4: 抽查一个迁移后的 session**

```bash
# 挑一个存在的 session_id
SESSION=$(kata-cli progress session-list --project dataAssets | jq -r '.[0]')
kata-cli progress session-summary --project dataAssets --session "$SESSION"
kata-cli progress task-query --project dataAssets --session "$SESSION" --include-all --format table
```

预期：字段完整、状态合理。

- [ ] **Step 19.5: 不 commit**（迁移产物在 `.kata/` 下已 gitignored）

---

### Task 20: 删除旧脚本 `kata-state.ts` + 单测

**Files:**
- Delete: `.claude/scripts/kata-state.ts`
- Delete: `.claude/scripts/__tests__/kata-state.test.ts`
- Modify: `.claude/scripts/kata-cli.ts`

- [ ] **Step 20.1: 删除文件**

```bash
git rm .claude/scripts/kata-state.ts .claude/scripts/__tests__/kata-state.test.ts
```

- [ ] **Step 20.2: 从 `kata-cli.ts` 移除注册**

删除 `import { program as kataState } from "./kata-state.ts";` 与对应 `addCommand(kataState)`。

- [ ] **Step 20.3: 运行全量 ci**

```bash
bun run ci
```

预期：lint + type-check + test 全绿，没有 import error。

- [ ] **Step 20.4: Commit**

```bash
git add -u .claude/scripts/
git commit -m "refactor(progress): remove legacy kata-state.ts"
```

---

### Task 21: 删除旧脚本 `ui-autotest-progress.ts` + 单测

**Files:**
- Delete: `.claude/scripts/ui-autotest-progress.ts`
- Delete: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`
- Modify: `.claude/scripts/kata-cli.ts`

- [ ] **Step 21.1: 删除文件**

```bash
git rm .claude/scripts/ui-autotest-progress.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

- [ ] **Step 21.2: 从 `kata-cli.ts` 移除注册**

删除 `import { program as uiAutotestProgress } from "./ui-autotest-progress.ts";` 与对应 `addCommand(uiAutotestProgress)`。

- [ ] **Step 21.3: 检查还有没有其他地方 import 这两个模块**

```bash
grep -rn "from.*kata-state\|from.*ui-autotest-progress" .claude/
```

预期：无输出。

- [ ] **Step 21.4: 运行全量 ci**

```bash
bun run ci
```

- [ ] **Step 21.5: Commit**

```bash
git add -u .claude/scripts/
git commit -m "refactor(progress): remove legacy ui-autotest-progress.ts"
```

---

### Task 22: 最终零检查 + 手工集成验证

**Files:**（只读）

- [ ] **Step 22.1: grep 零检查**

```bash
# 旧脚本名在 .claude/ 下应完全无痕
grep -rn "kata-state\|ui-autotest-progress" .claude/ | grep -v ":#" | grep -v "legacy"
# 预期：无输出（若有，补修）
```

- [ ] **Step 22.2: 手工集成 checklist（逐条人工执行）**

选择一个真实项目（例如 `dataAssets`），按以下顺序操作并确认：

1. **test-case-gen 恢复**
   - 随便挑一个已迁移的 test-case-gen session，跑 `kata-cli progress session-summary`
   - 确认 `done + running + pending` 总和 = 7
   - 跑 `kata-cli progress task-query --status blocked`，确认无阻塞或能看到阻塞原因

2. **ui-autotest 恢复**
   - 跑 `kata-cli progress session-resume --session <ui-autotest/...> --payload-path-check script_path`
   - 确认 running → pending
   - 如果有 failed case，跑 `--retry-failed`，确认 errors 已清空、attempts=0

3. **阻塞查询**
   - 挑一个 session，人工把某个 task 置为 blocked：
     `kata-cli progress task-block --session <id> --task <t> --reason "手工测试"`
   - 跑 `kata-cli progress task-query --status blocked --format table`
   - 确认阻塞原因和任务名显示正确
   - 恢复：`kata-cli progress task-unblock --session <id> --task <t>`

4. **依赖守卫**
   - 人工 add 一个 task B 依赖 task A（A 状态 pending）
   - 尝试把 B 置为 running：`kata-cli progress task-update --task B --status running`
   - 确认 exit 4 + stderr 提示 `blocked_by`
   - 带 `--force` 重试：确认成功 + `errors` 里记录 `forced-start`

5. **rollup**
   - 找一个有子任务的 parent，子任务部分 done、部分未 done
   - 跑 `kata-cli progress task-rollup --task <parent>`
   - 确认 exit 5 + stderr 列出未完成子任务
   - 把剩余子任务置 done 后重试：确认 parent 变 done

- [ ] **Step 22.3: 若发现任何 checklist 失败，回溯修复相应 Task，并 commit 修复**

- [ ] **Step 22.4: 最终 Commit 归档（若 checklist 修改了文档/脚本）**

```bash
# 若没有其他修改，此步可跳过
git status
```

---

## Self-Review

**1. Spec coverage**

| Spec 要求 | 实现 Task |
|---|---|
| 数据模型 + 字段定义 | Task 2（types）, Task 3-8（store） |
| 目录 `.kata/{project}/` | Task 1 |
| 扁平任务 + parent + depends_on | Task 2（types）, Task 4（CRUD） |
| 状态枚举 6 个 | Task 2 |
| 查询可见性规则 | Task 5 |
| 循环依赖检测 | Task 6 |
| Rollup | Task 6 |
| Artifacts + blob 外溢 | Task 7 |
| session-resume（含 mtime / path-check） | Task 8 |
| CLI session-* / task-* / artifact-* / migrate | Task 9-11, 15 |
| 锁策略 | Task 3 |
| 6 个 exit code | Task 9-11（分散实现）+ Task 2（枚举） |
| 迁移器 | Task 13, 14 |
| Subagent 协议（禁直接读写） | 由 Task 16-18 的 skill 提示词传达 |
| 一次性切换 | Task 16-21 |
| 测试覆盖（4 层） | Task 3-14（单测） + Task 22（手工集成） |

**2. Placeholder 扫描**

已审视：无 TODO / TBD / "implement later" / "similar to Task N"。

**3. 类型一致性**

- `Task / Session / TaskInput / TaskUpdatePatch / QueryOpts / QueryResult / ResumeOpts` 全部在 Task 2-8 中定义，后续 Task 引用保持一致
- `ExitCode` 命名一致（Task 2 定义，Task 9+ 使用）
- `TASK_STATUSES` / `DEPENDENCY_SATISFIED_STATUSES` / `PARENT_VISIBLE_STATUSES` 常量引用一致

---

## 关联文档

- Spec: `docs/refactor/specs/2026-04-24-unified-progress-engine-design.md`
- 参考风格: `docs/refactor/specs/2026-04-24-rename-to-kata-and-unified-cli.md`
- 代码约束: `CLAUDE.md`（禁硬编码绝对路径、脚本改动需同步测试、全量 `bun test`）
