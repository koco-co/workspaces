import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  initDoc,
  readDoc,
  writeFrontmatter,
  setStatus,
  setSection,
  addSection,
} from "../lib/enhanced-doc-store.ts";
import { repoRoot } from "../lib/paths.ts";

const TEST_PROJECT = "test-d1-project";
const TEST_YM = "202604";
const TEST_SLUG = "test-slug";

function cleanup() {
  const workspace = join(repoRoot(), "workspace", TEST_PROJECT);
  if (existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
}

describe("enhanced-doc-store: frontmatter", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  test("initDoc creates enhanced.md with default frontmatter", () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const doc = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    expect(doc.frontmatter.schema_version).toBe(1);
    expect(doc.frontmatter.status).toBe("discussing");
    expect(doc.frontmatter.pending_count).toBe(0);
    expect(doc.frontmatter.q_counter).toBe(0);
    expect(doc.frontmatter.migrated_from_plan).toBe(false);
    expect(doc.frontmatter.prd_slug).toBe(TEST_SLUG);
  });

  test("initDoc with migrated_from_plan=true sets flag", () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG, { migratedFromPlan: true });
    const doc = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    expect(doc.frontmatter.migrated_from_plan).toBe(true);
  });

  test("initDoc pre-allocates top-level section anchors", () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const raw = readFileSync(
      join(repoRoot(), "workspace", TEST_PROJECT, "prds", TEST_YM, TEST_SLUG, "enhanced.md"),
      "utf8",
    );
    expect(raw).toContain('<a id="s-1"></a>');
    expect(raw).toContain('<a id="s-2"></a>');
    expect(raw).toContain('<a id="s-3"></a>');
    expect(raw).toContain('<a id="s-4"></a>');
    expect(raw).toContain('<a id="source-facts"></a>');
  });

  test("setStatus updates frontmatter.status only", () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    setStatus(TEST_PROJECT, TEST_YM, TEST_SLUG, "analyzing");
    const doc = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    expect(doc.frontmatter.status).toBe("analyzing");
  });

  test("setStatus persists updated_at", async () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const before = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG).frontmatter.updated_at;
    await Bun.sleep(10);
    setStatus(TEST_PROJECT, TEST_YM, TEST_SLUG, "ready");
    const after = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG).frontmatter.updated_at;
    expect(after).not.toBe(before);
  });

  test("readDoc on non-existent file throws", () => {
    expect(() => readDoc(TEST_PROJECT, TEST_YM, "nonexistent")).toThrow();
  });
});

describe("enhanced-doc-store: set-section", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  test("setSection replaces content by anchor, preserves anchor", () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const doc = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const anchor11 = doc.overview[0].anchor;
    setSection(TEST_PROJECT, TEST_YM, TEST_SLUG, anchor11, "业务侧新需求说明……");
    const doc2 = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const sec = doc2.overview.find(s => s.anchor === anchor11);
    expect(sec?.body.trim()).toBe("业务侧新需求说明……");
    expect(sec?.anchor).toBe(anchor11);
  });

  test("setSection on unknown anchor throws", () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    expect(() =>
      setSection(TEST_PROJECT, TEST_YM, TEST_SLUG, "s-9-9-dead", "..."),
    ).toThrow(/anchor not found/i);
  });

  test("addSection creates new sub-section under §2 with fresh anchor", () => {
    initDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const anchor = addSection(
      TEST_PROJECT, TEST_YM, TEST_SLUG,
      { parentLevel: 2, title: "新功能块", body: "字段 ..." },
    );
    expect(anchor).toMatch(/^s-2-\d+-[0-9a-f]{4}$/);
    const doc = readDoc(TEST_PROJECT, TEST_YM, TEST_SLUG);
    const sec = doc.functional.find(s => s.anchor === anchor);
    expect(sec?.title).toBe("新功能块");
    expect(sec?.body).toContain("字段");
  });
});
