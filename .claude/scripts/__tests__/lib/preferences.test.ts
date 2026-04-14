import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { loadXmindPreferences, buildRootName } from "../../lib/preferences.ts";

const ROOT = resolve(import.meta.dirname, "../../../..");
const PROJECT = "test-prefs-project";
const PROJECT_PREFS_DIR = join(ROOT, "workspace", PROJECT, "preferences");

before(() => {
  mkdirSync(PROJECT_PREFS_DIR, { recursive: true });
});

after(() => {
  try {
    rmSync(join(ROOT, "workspace", PROJECT), { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("loadXmindPreferences without project", () => {
  it("returns defaults with non-empty template", () => {
    const prefs = loadXmindPreferences();
    assert.ok(prefs.root_title_template.length > 0);
    assert.ok(prefs.iteration_id.length > 0);
  });
});

describe("loadXmindPreferences with project", () => {
  it("returns global defaults when no project preferences exist", () => {
    const prefs = loadXmindPreferences("nonexistent-project-xyz");
    assert.ok(prefs.root_title_template.length > 0);
  });

  it("project preferences override global when present", () => {
    writeFileSync(
      join(PROJECT_PREFS_DIR, "xmind-structure.md"),
      "root_title_template: `信永v{{prd_version}}(#{{iteration_id}})`\niteration_id: 99\n",
      "utf-8",
    );
    const prefs = loadXmindPreferences(PROJECT);
    assert.equal(prefs.root_title_template, "信永v{{prd_version}}(#{{iteration_id}})");
    assert.equal(prefs.iteration_id, "99");
  });

  it("project prefs partially override (only what's specified)", () => {
    writeFileSync(
      join(PROJECT_PREFS_DIR, "xmind-structure.md"),
      "iteration_id: 55\n",
      "utf-8",
    );
    const prefs = loadXmindPreferences(PROJECT);
    // iteration_id overridden, root_title_template from global
    assert.equal(prefs.iteration_id, "55");
    assert.ok(prefs.root_title_template.length > 0);
  });
});

describe("buildRootName with project", () => {
  it("uses project-level template when available", () => {
    writeFileSync(
      join(PROJECT_PREFS_DIR, "xmind-structure.md"),
      "root_title_template: `XY-v{{prd_version}}`\niteration_id: 1\n",
      "utf-8",
    );
    const name = buildRootName("v1.0.0", undefined, PROJECT);
    assert.equal(name, "XY-v1.0.0");
  });

  it("works without project (uses global)", () => {
    const name = buildRootName("v6.4.9");
    assert.ok(name.length > 0);
    assert.ok(name.includes("6.4.9"));
  });

  it("returns empty string for undefined version", () => {
    const name = buildRootName(undefined);
    assert.equal(name, "");
  });
});
