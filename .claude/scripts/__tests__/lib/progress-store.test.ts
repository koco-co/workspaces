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
  addTasks,
  updateTask,
  removeTask,
} from "../../lib/progress-store.ts";
import type { Session } from "../../lib/progress-types.ts";

const TMP = join(tmpdir(), `progress-store-test-${process.pid}`);

before(() => {
  process.env.KATA_ROOT_OVERRIDE = TMP; // progress-store reads this via getEnv (see paths.ts kataRoot JSDoc)
  mkdirSync(TMP, { recursive: true });
});

after(() => {
  delete process.env.KATA_ROOT_OVERRIDE;
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
});

beforeEach(() => {
  process.env.KATA_ROOT_OVERRIDE = TMP;  // reset to canonical value
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

    const lockDir = join(TMP, ".kata", project, "locks");
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, `${base.session_id.replace("/", "__")}.lock`), "99999");

    await assert.rejects(
      withSessionLock(project, base.session_id, async () => {}, { timeoutMs: 200 }),
      /lock/i,
    );
  });
});

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
