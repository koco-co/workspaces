import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

const REPO_ROOT = resolvePath(import.meta.dirname, "../../..");
const CLI_BIN = "bun";
const CLI_ARGS = [join(REPO_ROOT, ".claude/scripts/kata-cli.ts"), "source-ref"];

describe("kata-cli source-ref resolve (integration)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "kata-sr-cli-"));
  const planPath = join(tmp, "smoke.plan.md");
  writeFileSync(
    planPath,
    `---\nplan_version: 2\n---\n\n## 3. 澄清问答清单\n\n\`\`\`json\n[{"id":"Q1","severity":"blocking_unknown"}]\n\`\`\`\n`,
  );

  it("exits 0 when plan anchor resolves", () => {
    const r = spawnSync(
      CLI_BIN,
      [...CLI_ARGS, "resolve", "--ref", "plan#q1-xxx", "--plan", planPath],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
    assert.match(r.stdout + r.stderr, /"ok":\s*true/);
  });

  it("exits 1 when plan anchor missing", () => {
    const r = spawnSync(
      CLI_BIN,
      [...CLI_ARGS, "resolve", "--ref", "plan#q99-none", "--plan", planPath],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /"ok":\s*false/);
  });

  it("batch exits 2 when any fails", () => {
    const refsJson = join(tmp, "refs.json");
    writeFileSync(
      refsJson,
      JSON.stringify([{ ref: "plan#q1-x" }, { ref: "plan#q99-x" }]),
    );
    const r = spawnSync(
      CLI_BIN,
      [...CLI_ARGS, "batch", "--refs-json", refsJson, "--plan", planPath],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 2);
    assert.match(r.stdout + r.stderr, /"total":\s*2/);
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));
});

describe("kata-cli source-ref resolve --prd-slug + --yyyymm (enhanced scheme)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "kata-sr-enh-cli-"));
  const project = "test-project";
  const ym = "202604";
  const slug = "demo-feature";
  const enhancedPath = join(
    tmp,
    project,
    "prds",
    ym,
    slug,
    "enhanced.md",
  );
  // 创建目录结构
  mkdirSync(join(tmp, project, "prds", ym, slug), { recursive: true });
  writeFileSync(
    enhancedPath,
    [
      "---",
      "version: 2",
      "---",
      "",
      '## 1. 概述 <a id="s-1"></a>',
      "",
      '### Q3 <a id="q3"></a>',
      "",
    ].join("\n"),
  );

  it("resolve --ref enhanced#s-1 OK with --prd-slug/--yyyymm/--workspace-dir", () => {
    const r = spawnSync(
      CLI_BIN,
      [
        ...CLI_ARGS,
        "resolve",
        "--ref",
        "enhanced#s-1",
        "--project",
        project,
        "--yyyymm",
        ym,
        "--prd-slug",
        slug,
        "--workspace-dir",
        tmp,
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
    assert.match(r.stdout + r.stderr, /"ok":\s*true/);
  });

  it("resolve --ref enhanced#q3 OK", () => {
    const r = spawnSync(
      CLI_BIN,
      [
        ...CLI_ARGS,
        "resolve",
        "--ref",
        "enhanced#q3",
        "--project",
        project,
        "--yyyymm",
        ym,
        "--prd-slug",
        slug,
        "--workspace-dir",
        tmp,
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
  });

  it("resolve fails when --prd-slug or --yyyymm omitted (no enhancedDocPath built)", () => {
    const r = spawnSync(
      CLI_BIN,
      [
        ...CLI_ARGS,
        "resolve",
        "--ref",
        "enhanced#s-1",
        "--project",
        project,
        "--workspace-dir",
        tmp,
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /enhancedDocPath/);
  });

  it("batch supports enhanced scheme with --prd-slug/--yyyymm", () => {
    const refsJson = join(tmp, "refs-enh.json");
    writeFileSync(
      refsJson,
      JSON.stringify([{ ref: "enhanced#s-1" }, { ref: "enhanced#s-99" }]),
    );
    const r = spawnSync(
      CLI_BIN,
      [
        ...CLI_ARGS,
        "batch",
        "--refs-json",
        refsJson,
        "--project",
        project,
        "--yyyymm",
        ym,
        "--prd-slug",
        slug,
        "--workspace-dir",
        tmp,
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 2); // 第二个失败
    assert.match(r.stdout + r.stderr, /"total":\s*2/);
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));
});
