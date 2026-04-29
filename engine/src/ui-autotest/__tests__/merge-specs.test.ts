import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBlockMeta, readCodeBlocks, buildSpecContent, mergeSpecs } from "../merge-specs.ts";

// ────────────────────────────────────────────────────────────
// parseBlockMeta
// ────────────────────────────────────────────────────────────

describe("parseBlockMeta", () => {
  it("parses valid META line", () => {
    const content = '// META: {"id":"t1","priority":"P0","title":"验证xxx"}\nsome code';
    const meta = parseBlockMeta(content);
    expect(meta).toBeTruthy();
    expect(meta!.id).toBe("t1");
    expect(meta!.priority).toBe("P0");
    expect(meta!.title).toBe("验证xxx");
  });

  it("returns null for missing META", () => {
    const result = parseBlockMeta("// no meta here\ncode");
    expect(result).toBe(null);
  });

  it("returns null for malformed JSON in META", () => {
    const result = parseBlockMeta("// META: {bad json}\ncode");
    expect(result).toBe(null);
  });
});

// ────────────────────────────────────────────────────────────
// readCodeBlocks
// ────────────────────────────────────────────────────────────

describe("readCodeBlocks", () => {
  let tmpIn: string;

  beforeEach(() => {
    tmpIn = join(tmpdir(), `merge-specs-test-read-${Date.now()}`);
    mkdirSync(tmpIn, { recursive: true });
    writeFileSync(
      join(tmpIn, "t1.ts"),
      '// META: {"id":"t1","priority":"P0","title":"test1"}\nexport const a = 1;\n',
      "utf-8",
    );
    writeFileSync(
      join(tmpIn, "t2.ts"),
      '// META: {"id":"t2","priority":"P1","title":"test2"}\nexport const b = 2;\n',
      "utf-8",
    );
    writeFileSync(join(tmpIn, "skip.ts"), "// no meta\nexport const c = 3;\n", "utf-8");
  });

  afterEach(() => {
    rmSync(tmpIn, { recursive: true, force: true });
  });

  it("reads files with valid META and skips those without", () => {
    const blocks = readCodeBlocks(tmpIn);
    expect(blocks.length).toBe(2);
    expect(blocks[0].meta.id).toBe("t1");
    expect(blocks[1].meta.id).toBe("t2");
  });

  it("returns empty array for non-existent directory", () => {
    const blocks = readCodeBlocks("/non/existent/path");
    expect(blocks).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// buildSpecContent
// ────────────────────────────────────────────────────────────

describe("buildSpecContent", () => {
  const blocks = [
    { meta: { id: "t1", priority: "P0" as const, title: "test1" }, code: "", fileName: "t1" },
    { meta: { id: "t2", priority: "P1" as const, title: "test2" }, code: "", fileName: "t2" },
  ];

  it("generates import lines for each block", () => {
    const content = buildSpecContent(blocks, "全量测试");
    expect(content.includes('import "./t1";')).toBeTruthy();
    expect(content.includes('import "./t2";')).toBeTruthy();
  });

  it("returns empty export for zero blocks", () => {
    const content = buildSpecContent([], "冒烟测试");
    expect(content.includes("export {};")).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────
// mergeSpecs — basic
// ────────────────────────────────────────────────────────────

describe("mergeSpecs (basic)", () => {
  let tmpIn: string;
  let tmpOut: string;

  beforeEach(() => {
    tmpIn = join(tmpdir(), `merge-specs-test-basic-in-${Date.now()}`);
    tmpOut = join(tmpdir(), `merge-specs-test-basic-out-${Date.now()}`);
    mkdirSync(tmpIn, { recursive: true });
    writeFileSync(
      join(tmpIn, "t1.ts"),
      '// META: {"id":"t1","priority":"P0","title":"smoke test"}\nexport const x = 1;\n',
      "utf-8",
    );
    writeFileSync(
      join(tmpIn, "t2.ts"),
      '// META: {"id":"t2","priority":"P1","title":"full test"}\nexport const y = 2;\n',
      "utf-8",
    );
  });

  afterEach(() => {
    rmSync(tmpIn, { recursive: true, force: true });
    rmSync(tmpOut, { recursive: true, force: true });
  });

  it("returns correct case counts", () => {
    const result = mergeSpecs(tmpIn, tmpOut);
    expect(result.case_count.smoke).toBe(1);
    expect(result.case_count.full).toBe(2);
  });

  it("smoke_spec path ends with smoke.spec.ts", () => {
    const result = mergeSpecs(tmpIn, tmpOut);
    expect(result.smoke_spec.endsWith("smoke.spec.ts")).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────
// mergeSpecs — compile gate (tsc)
// ────────────────────────────────────────────────────────────

describe("mergeSpecs compileCheck", () => {
  let tmpInBad: string;
  let tmpOutBad: string;
  let tmpInGood: string;
  let tmpOutGood: string;

  beforeEach(() => {
    const ts = Date.now();
    tmpInBad = join(tmpdir(), `merge-specs-bad-in-${ts}`);
    tmpOutBad = join(tmpdir(), `merge-specs-bad-out-${ts}`);
    tmpInGood = join(tmpdir(), `merge-specs-good-in-${ts}`);
    tmpOutGood = join(tmpdir(), `merge-specs-good-out-${ts}`);

    mkdirSync(tmpInBad, { recursive: true });
    mkdirSync(tmpInGood, { recursive: true });

    // Bad block: type error
    writeFileSync(
      join(tmpInBad, "bad.ts"),
      '// META: {"id":"t1","priority":"P0","title":"bad"}\nconst x: number = "oops";\n',
      "utf-8",
    );

    // Good block: clean TypeScript
    writeFileSync(
      join(tmpInGood, "good.ts"),
      '// META: {"id":"t1","priority":"P0","title":"good"}\nexport const x: number = 1;\n',
      "utf-8",
    );
  });

  afterEach(() => {
    rmSync(tmpInBad, { recursive: true, force: true });
    rmSync(tmpOutBad, { recursive: true, force: true });
    rmSync(tmpInGood, { recursive: true, force: true });
    rmSync(tmpOutGood, { recursive: true, force: true });
  });

  it("throws when compileCheck=true and block has type error", () => {
    expect(() => mergeSpecs(tmpInBad, tmpOutBad, { compileCheck: true })).toThrow(/tsc|type/i);
  });

  it("does not throw when compileCheck=true and block is valid TypeScript", () => {
    expect(() => mergeSpecs(tmpInGood, tmpOutGood, { compileCheck: true })).not.toThrow();
  });

  it("does not throw when compileCheck=false even with type errors", () => {
    const tmpIn2 = join(tmpdir(), `merge-specs-no-check-in-${Date.now()}`);
    const tmpOut2 = join(tmpdir(), `merge-specs-no-check-out-${Date.now()}`);
    mkdirSync(tmpIn2, { recursive: true });
    writeFileSync(
      join(tmpIn2, "bad.ts"),
      '// META: {"id":"t1","priority":"P0","title":"bad"}\nconst x: number = "oops";\n',
      "utf-8",
    );
    try {
      expect(() => mergeSpecs(tmpIn2, tmpOut2, { compileCheck: false })).not.toThrow();
    } finally {
      rmSync(tmpIn2, { recursive: true, force: true });
      rmSync(tmpOut2, { recursive: true, force: true });
    }
  });

  it("does not false-positive when block imports @playwright/test", () => {
    const tmpIn = join(tmpdir(), `merge-realistic-${Date.now()}`);
    mkdirSync(tmpIn, { recursive: true });
    writeFileSync(
      join(tmpIn, "t1.ts"),
      '// META: {"id":"t1","priority":"P0","title":"x"}\nimport { test } from "@playwright/test";\ntest("x", async () => {});\n',
      "utf-8",
    );
    const tmpOut = `${tmpIn}-out`;
    try {
      expect(() => mergeSpecs(tmpIn, tmpOut, { compileCheck: true })).not.toThrow();
    } finally {
      rmSync(tmpIn, { recursive: true, force: true });
      rmSync(tmpOut, { recursive: true, force: true });
    }
  });
});
