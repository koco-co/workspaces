import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const scriptPath = resolve(
  repoRoot,
  ".claude/skills/setup/scripts/init-wizard.ts",
);

test("init-wizard source references /qa-flow init (not /using-qa-flow init)", () => {
  const src = readFileSync(scriptPath, "utf8");
  assert.doesNotMatch(
    src,
    /\/using-qa-flow init/,
    "init-wizard.ts must not contain stale /using-qa-flow init hint",
  );
  assert.match(
    src,
    /\/qa-flow init/,
    "init-wizard.ts should hint users to run /qa-flow init",
  );
});
