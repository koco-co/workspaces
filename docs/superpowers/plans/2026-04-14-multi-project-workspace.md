# Multi-Project Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure qa-flow workspace to manage multiple projects (dataAssets, xyzh) under `workspace/{project}/`, with project-scoped paths, config, state, preferences, and skills.

**Architecture:** Add `project` as a required parameter to all path functions in `paths.ts`. Refactor `config.json` to nest settings under `projects.{name}`. Update all scripts and skills to accept and propagate the project context. Playwright tests move from `e2e/` to `workspace/{project}/tests/`.

**Tech Stack:** Bun, TypeScript, node:test, Commander.js, Playwright

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `.claude/scripts/lib/paths.ts` | Add project-scoped path functions |
| `.claude/scripts/lib/env-schema.ts` | Add `PROJECT_NAME` env rule |
| `.claude/scripts/lib/preferences.ts` | Project-level preference loading |
| `.claude/scripts/config.ts` | Read config per project from `projects.{name}` |
| `.claude/scripts/state.ts` | Route state files to `workspace/{project}/.temp/` |
| `.claude/scripts/archive-gen.ts` | Default dir → project-scoped |
| `.claude/scripts/xmind-edit.ts` | Default dir → project-scoped |
| `.claude/scripts/xmind-gen.ts` | Use project-scoped paths |
| `.claude/scripts/repo-sync.ts` | Default base-dir → project-scoped |
| `.claude/scripts/prd-frontmatter.ts` | Validate paths per project |
| `.claude/scripts/report-to-pdf.ts` | Report paths per project |
| `.claude/scripts/history-convert.ts` | History dir per project |
| `config.json` | Restructure to `{ projects: { ... } }` |
| `playwright.config.ts` | Report dir → project-scoped, testMatch → `workspace/{project}/tests/` |
| `plugins/notify/detect-events.ts` | Regex patterns → project-aware |
| `plugins/lanhu/fetch.ts` | Default base-dir → project-scoped |
| `plugins/zentao/fetch.ts` | Default output → project-scoped |
| `.claude/skills/setup/scripts/init-wizard.ts` | Scan per-project dirs |
| `.claude/skills/setup/skill.md` | Add project create/select step |
| `.claude/skills/qa-flow/skill.md` | Show current project, add switch option |
| `.claude/skills/test-case-gen/skill.md` | All paths → project-scoped |
| `.claude/skills/code-analysis/skill.md` | Issues path → project-scoped |
| `.claude/skills/xmind-editor/skill.md` | Xmind path → project-scoped |
| `.claude/skills/ui-autotest/skill.md` | Tests + reports → project-scoped |

### Test Files to Modify

| File | What Changes |
|------|-------------|
| `.claude/scripts/__tests__/lib/paths.test.ts` | All new project-scoped function tests |
| `.claude/scripts/__tests__/config.test.ts` | Config structure tests |
| `.claude/scripts/__tests__/state.test.ts` | State path under project dir |
| `.claude/scripts/__tests__/archive-gen.test.ts` | Default dir assertions |
| `.claude/scripts/__tests__/xmind-edit.test.ts` | Default dir assertions |
| `.claude/scripts/__tests__/xmind-gen.test.ts` | Path assertions |
| `.claude/scripts/__tests__/prd-frontmatter.test.ts` | Path assertions |
| `.claude/scripts/__tests__/init-wizard.test.ts` | Scan per-project assertions |
| `plugins/notify/__tests__/detect-events.test.ts` | Pattern match tests with project prefix |

---

## Task 1: Refactor `paths.ts` — Add Project-Scoped Path Functions

**Files:**
- Modify: `.claude/scripts/lib/paths.ts`
- Test: `.claude/scripts/__tests__/lib/paths.test.ts`

- [ ] **Step 1: Write failing tests for project-scoped functions**

Add to `.claude/scripts/__tests__/lib/paths.test.ts`:

```typescript
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  currentYYYYMM,
  parseGitUrl,
  projectDir,
  projectPath,
  xmindDir,
  xmindPath,
  archiveDir,
  prdsDir,
  issuesDir,
  reportsDir,
  testsDir,
  reposDir,
  tempDir,
  projectPreferencesDir,
  repoRoot,
  scriptsDir,
  skillsDir,
} from "../../lib/paths.ts";

// --- existing tests stay unchanged above ---

describe("projectDir", () => {
  it("returns workspace/{project} under repoRoot", () => {
    const dir = projectDir("dataAssets");
    const root = repoRoot();
    assert.equal(dir, join(root, "workspace", "dataAssets"));
  });

  it("works with different project names", () => {
    const dir = projectDir("xyzh");
    assert.ok(dir.endsWith("workspace/xyzh"));
  });
});

describe("projectPath", () => {
  it("joins segments under project dir", () => {
    const p = projectPath("dataAssets", "prds", "202604");
    assert.ok(p.endsWith("workspace/dataAssets/prds/202604"));
  });
});

describe("xmindDir", () => {
  it("returns workspace/{project}/xmind", () => {
    const dir = xmindDir("dataAssets");
    assert.ok(dir.endsWith("workspace/dataAssets/xmind"));
  });
});

describe("xmindPath", () => {
  it("joins segments under xmind dir", () => {
    const p = xmindPath("dataAssets", "202604", "test.xmind");
    assert.ok(p.endsWith("workspace/dataAssets/xmind/202604/test.xmind"));
  });
});

describe("archiveDir", () => {
  it("returns workspace/{project}/archive", () => {
    const dir = archiveDir("dataAssets");
    assert.ok(dir.endsWith("workspace/dataAssets/archive"));
  });
});

describe("prdsDir", () => {
  it("returns workspace/{project}/prds", () => {
    const dir = prdsDir("xyzh");
    assert.ok(dir.endsWith("workspace/xyzh/prds"));
  });
});

describe("issuesDir", () => {
  it("returns workspace/{project}/issues", () => {
    const dir = issuesDir("dataAssets");
    assert.ok(dir.endsWith("workspace/dataAssets/issues"));
  });
});

describe("reportsDir", () => {
  it("returns workspace/{project}/reports", () => {
    const dir = reportsDir("dataAssets");
    assert.ok(dir.endsWith("workspace/dataAssets/reports"));
  });
});

describe("testsDir", () => {
  it("returns workspace/{project}/tests", () => {
    const dir = testsDir("dataAssets");
    assert.ok(dir.endsWith("workspace/dataAssets/tests"));
  });
});

describe("reposDir", () => {
  it("returns workspace/{project}/.repos", () => {
    const dir = reposDir("dataAssets");
    assert.ok(dir.endsWith("workspace/dataAssets/.repos"));
  });
});

describe("tempDir", () => {
  it("returns workspace/{project}/.temp", () => {
    const dir = tempDir("xyzh");
    assert.ok(dir.endsWith("workspace/xyzh/.temp"));
  });
});

describe("projectPreferencesDir", () => {
  it("returns workspace/{project}/preferences", () => {
    const dir = projectPreferencesDir("dataAssets");
    assert.ok(dir.endsWith("workspace/dataAssets/preferences"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test .claude/scripts/__tests__/lib/paths.test.ts`
Expected: FAIL — `projectDir`, `projectPath`, etc. are not exported from paths.ts

- [ ] **Step 3: Implement project-scoped path functions**

Replace the full content of `.claude/scripts/lib/paths.ts`:

```typescript
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnv } from "./env.ts";

export function repoRoot(): string {
  return resolve(fileURLToPath(import.meta.url), "../../../..");
}

export function workspaceDir(): string {
  const dir = getEnv("WORKSPACE_DIR") ?? "workspace";
  return resolve(repoRoot(), dir);
}

export function projectDir(project: string): string {
  return join(workspaceDir(), project);
}

export function projectPath(project: string, ...segments: string[]): string {
  return join(projectDir(project), ...segments);
}

export function xmindDir(project: string): string {
  return join(projectDir(project), "xmind");
}

export function xmindPath(project: string, ...segments: string[]): string {
  return join(xmindDir(project), ...segments);
}

export function archiveDir(project: string): string {
  return join(projectDir(project), "archive");
}

export function prdsDir(project: string): string {
  return join(projectDir(project), "prds");
}

export function issuesDir(project: string): string {
  return join(projectDir(project), "issues");
}

export function reportsDir(project: string): string {
  return join(projectDir(project), "reports");
}

export function testsDir(project: string): string {
  return join(projectDir(project), "tests");
}

export function reposDir(project: string): string {
  return join(projectDir(project), ".repos");
}

export function tempDir(project: string): string {
  return join(projectDir(project), ".temp");
}

export function projectPreferencesDir(project: string): string {
  return join(projectDir(project), "preferences");
}

export function scriptsDir(): string {
  return resolve(repoRoot(), ".claude/scripts");
}

export function pluginsDir(): string {
  return resolve(repoRoot(), "plugins");
}

export function templatesDir(): string {
  return resolve(repoRoot(), "templates");
}

export function skillsDir(): string {
  return resolve(repoRoot(), ".claude/skills");
}

export function currentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function validateFilePath(filePath: string, allowedRoots: string[]): string {
  const resolved = resolve(filePath);
  const isAbsolute = filePath.startsWith("/");
  if (!isAbsolute) {
    const isAllowed = allowedRoots.some((root) =>
      resolved.startsWith(resolve(root)),
    );
    if (!isAllowed) {
      throw new Error(
        `Relative path "${filePath}" resolves outside allowed directories`,
      );
    }
  }
  return resolved;
}

export function parseGitUrl(url: string): { group: string; repo: string } {
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const parts = cleaned.split("/");
  const repo = parts.pop() ?? "";
  const group = parts.pop() ?? "";
  return { group, repo };
}

/**
 * List project directories under workspace/.
 * Returns directory names (not full paths).
 */
export function listProjects(): string[] {
  const wsDir = workspaceDir();
  try {
    return readdirSync(wsDir)
      .filter((name) => {
        if (name.startsWith(".")) return false;
        try {
          return statSync(join(wsDir, name)).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test .claude/scripts/__tests__/lib/paths.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/lib/paths.ts .claude/scripts/__tests__/lib/paths.test.ts
git commit -m "feat: add project-scoped path functions to paths.ts"
```

---

## Task 2: Refactor `config.ts` + `config.json` — Project-Keyed Config

**Files:**
- Modify: `.claude/scripts/config.ts`
- Modify: `config.json`
- Modify: `.claude/scripts/lib/env-schema.ts`
- Test: `.claude/scripts/__tests__/config.test.ts`

- [ ] **Step 1: Write failing tests for project-keyed config**

Add new describe block to `.claude/scripts/__tests__/config.test.ts`:

```typescript
describe("config.ts — project-keyed structure", () => {
  it("output contains projects top-level key", () => {
    const { stdout } = runConfig();
    const cfg = JSON.parse(stdout) as Record<string, unknown>;
    assert.ok("projects" in cfg, "should have projects key");
  });

  it("projects contains dataAssets key from config.json", () => {
    const { stdout } = runConfig();
    const cfg = JSON.parse(stdout) as { projects: Record<string, unknown> };
    assert.ok("dataAssets" in cfg.projects, "should have dataAssets project");
  });

  it("each project has repo_profiles", () => {
    const { stdout } = runConfig();
    const cfg = JSON.parse(stdout) as {
      projects: Record<string, { repo_profiles: Record<string, unknown> }>;
    };
    for (const [name, proj] of Object.entries(cfg.projects)) {
      assert.ok(
        "repo_profiles" in proj,
        `project ${name} should have repo_profiles`,
      );
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test .claude/scripts/__tests__/config.test.ts`
Expected: FAIL — output doesn't have `projects` key

- [ ] **Step 3: Update `config.json` to project-keyed structure**

Replace `config.json`:

```json
{
  "projects": {
    "dataAssets": {
      "repo_profiles": {
        "岚图": {
          "repos": [
            {
              "path": ".repos/CustomItem/dt-center-assets",
              "branch": "release_6.3.x_ltqc"
            },
            {
              "path": ".repos/CustomItem/dt-insight-studio",
              "branch": "dataAssets/release_6.3.x_ltqc"
            }
          ]
        }
      }
    },
    "xyzh": {
      "repo_profiles": {}
    }
  }
}
```

- [ ] **Step 4: Update `config.ts` to read project-keyed config**

In `config.ts`, replace the `RepoProfiles` related types and functions:

```typescript
interface ProjectConfig {
  repo_profiles: RepoProfiles;
}

interface ConfigOutput {
  workspace_dir: string;
  source_repos: string[];
  plugins: Record<string, PluginEntry>;
  projects: Record<string, ProjectConfig>;
}

function readProjectConfigs(): Record<string, ProjectConfig> {
  const configPath = join(repoRoot(), "config.json");
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    return (raw.projects ?? {}) as Record<string, ProjectConfig>;
  } catch (err) {
    process.stderr.write(`[config] failed to parse config.json: ${err}\n`);
    return {};
  }
}

function buildConfig(): ConfigOutput {
  initEnv();

  const workspaceDir = getEnv("WORKSPACE_DIR") ?? "workspace";
  const sourceReposRaw = getEnv("SOURCE_REPOS") ?? "";
  const sourceRepos = sourceReposRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const plugins = scanPlugins(pluginsDir());
  const projects = readProjectConfigs();

  return {
    workspace_dir: workspaceDir,
    source_repos: sourceRepos,
    plugins,
    projects,
  };
}
```

- [ ] **Step 5: Update `env-schema.ts`**

Add `PROJECT_NAME` to `ENV_SCHEMA` array:

```typescript
const ENV_SCHEMA: EnvRule[] = [
  { key: "WORKSPACE_DIR", required: false, description: "Workspace directory path" },
  { key: "SOURCE_REPOS", required: false, description: "Comma-separated list of source repo URLs" },
  { key: "PROJECT_NAME", required: false, description: "Default project name (e.g. dataAssets)" },
];
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test .claude/scripts/__tests__/config.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add config.json .claude/scripts/config.ts .claude/scripts/lib/env-schema.ts .claude/scripts/__tests__/config.test.ts
git commit -m "feat: restructure config.json to project-keyed format"
```

---

## Task 3: Refactor `state.ts` — Project-Scoped State Files

**Files:**
- Modify: `.claude/scripts/state.ts`
- Test: `.claude/scripts/__tests__/state.test.ts`

- [ ] **Step 1: Write failing tests for project-scoped state**

In `.claude/scripts/__tests__/state.test.ts`, change `TMP_DIR` setup and `runState` helper. The key change: `state.ts init` now requires `--project`:

Update the test helper and add project parameter:

```typescript
const TMP_DIR = join(tmpdir(), `qa-flow-state-test-${process.pid}`);

function workspaceTempForProject(project: string): string {
  return join(TMP_DIR, "workspace", project, ".temp");
}

function stateFilePath(project: string, slug: string): string {
  return join(workspaceTempForProject(project), `.qa-state-${slug}.json`);
}
```

Update `runState` env to use `WORKSPACE_DIR: join(TMP_DIR, "workspace")`.

Update the first test:

```typescript
describe("state.ts init", () => {
  it("creates state file under project .temp and outputs JSON", () => {
    const slug = `init-test-${Date.now()}`;
    const prd = `workspace/dataAssets/prds/202604/${slug}.md`;

    const { stdout, code } = runState([
      "init",
      "--prd", prd,
      "--project", "dataAssets",
      "--mode", "normal",
    ]);

    assert.equal(code, 0, `init should exit 0`);
    const state = JSON.parse(stdout) as QaState & { project: string };
    assert.equal(state.project, "dataAssets");
    assert.equal(state.prd, prd);
    assert.equal(state.current_node, "init");
  });

  it("state file exists on disk under project .temp", () => {
    const slug = `init-disk-${Date.now()}`;
    const prd = `workspace/dataAssets/prds/202604/${slug}.md`;

    runState(["init", "--prd", prd, "--project", "dataAssets"]);

    assert.ok(
      existsSync(stateFilePath("dataAssets", slug)),
      "state file should exist under project .temp",
    );
  });
});
```

Update all remaining `runState` calls to include `--project dataAssets` and update `stateFilePath` calls to `stateFilePath("dataAssets", slug)`. Update the PRD path format from `workspace/prds/202604/` to `workspace/dataAssets/prds/202604/`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test .claude/scripts/__tests__/state.test.ts`
Expected: FAIL — `--project` option not recognized

- [ ] **Step 3: Implement project-scoped state**

In `state.ts`, make these changes:

1. Replace the `workspacePath` import with `projectPath`:

```typescript
import { projectPath } from "./lib/paths.ts";
```

2. Update `stateFilePath` to accept project:

```typescript
function stateFilePath(project: string, prdSlug: string): string {
  return projectPath(project, ".temp", `.qa-state-${prdSlug}.json`);
}
```

3. Update `QaState` interface to include `project`:

```typescript
interface QaState {
  project: string;
  prd: string;
  mode: RunMode;
  current_node: string;
  completed_nodes: string[];
  node_outputs: Record<string, unknown>;
  writers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

4. Update `readState` and `writeState` to accept `project` as first parameter:

```typescript
function readState(project: string, prdSlug: string): QaState | null {
  const filePath = stateFilePath(project, prdSlug);
  // ... rest unchanged
}

function writeState(project: string, prdSlug: string, state: QaState): void {
  const filePath = stateFilePath(project, prdSlug);
  // ... rest unchanged
}
```

5. Update `init` command to add `--project` required option:

```typescript
program
  .command("init")
  .requiredOption("--prd <path>", "PRD file path")
  .requiredOption("--project <name>", "Project name (e.g. dataAssets)")
  .option("--mode <mode>", "Run mode: normal | quick", "normal")
  .action((opts: { prd: string; project: string; mode: string }) => {
    initEnv();
    const prdSlug = slugFromPrd(opts.prd);
    const mode = (opts.mode === "quick" ? "quick" : "normal") satisfies RunMode;
    const now = nowIso();
    const state: QaState = {
      project: opts.project,
      prd: opts.prd,
      mode,
      current_node: "init",
      completed_nodes: [],
      node_outputs: {},
      writers: {},
      created_at: now,
      updated_at: now,
    };
    try {
      writeState(opts.project, prdSlug, state);
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    } catch (err) {
      process.stderr.write(`[state:init] error: ${err}\n`);
      process.exit(1);
    }
  });
```

6. Update `update`, `resume`, `clean` commands similarly — add `--project` required option and pass it through to `readState`/`writeState`/`stateFilePath`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test .claude/scripts/__tests__/state.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/state.ts .claude/scripts/__tests__/state.test.ts
git commit -m "feat: project-scoped state files under workspace/{project}/.temp/"
```

---

## Task 4: Refactor `preferences.ts` — Project-Level Preference Loading

**Files:**
- Modify: `.claude/scripts/lib/preferences.ts`
- Test: `.claude/scripts/__tests__/lib/preferences.test.ts` (create if missing, or add to existing)

- [ ] **Step 1: Write failing tests**

Create or update test file. The key behavior: `loadXmindPreferences(project)` should first read global `preferences/xmind-structure.md`, then overlay with `workspace/{project}/preferences/xmind-structure.md` if it exists.

```typescript
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { loadXmindPreferences, buildRootName } from "../../lib/preferences.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
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

describe("loadXmindPreferences with project", () => {
  it("returns global defaults when no project preferences exist", () => {
    const prefs = loadXmindPreferences("nonexistent-project");
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test .claude/scripts/__tests__/lib/preferences.test.ts`
Expected: FAIL — `loadXmindPreferences` doesn't accept project parameter

- [ ] **Step 3: Implement project-level preference loading**

Update `.claude/scripts/lib/preferences.ts`:

```typescript
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot, projectPreferencesDir } from "./paths.ts";

export interface XmindPreferences {
  root_title_template: string;
  iteration_id: string;
}

const DEFAULTS: XmindPreferences = {
  root_title_template: "数据资产v{{prd_version}}迭代用例(#{{iteration_id}})",
  iteration_id: "23",
};

function parsePrefsFromContent(content: string, result: XmindPreferences): XmindPreferences {
  const updated = { ...result };
  const tmplMatch = content.match(/root_title_template:\s*`([^`]+)`/);
  if (tmplMatch) updated.root_title_template = tmplMatch[1];
  const idMatch = content.match(/iteration_id:\s*(\S+)/);
  if (idMatch) updated.iteration_id = idMatch[1];
  return updated;
}

export function loadXmindPreferences(project?: string): XmindPreferences {
  let result = { ...DEFAULTS };

  // 1. Load global preferences
  try {
    const globalPath = resolve(repoRoot(), "preferences/xmind-structure.md");
    if (existsSync(globalPath)) {
      const content = readFileSync(globalPath, "utf-8");
      result = parsePrefsFromContent(content, result);
    }
  } catch {
    // fallback to defaults
  }

  // 2. Overlay project-level preferences if project is specified
  if (project) {
    try {
      const projectPath = resolve(projectPreferencesDir(project), "xmind-structure.md");
      if (existsSync(projectPath)) {
        const content = readFileSync(projectPath, "utf-8");
        result = parsePrefsFromContent(content, result);
      }
    } catch {
      // fallback to global
    }
  }

  return result;
}

export function buildRootName(version: string | undefined, prefs?: XmindPreferences, project?: string): string {
  if (!version) return "";
  const p = prefs ?? loadXmindPreferences(project);
  const ver = version.replace(/^v/i, "");
  return p.root_title_template
    .replace("{{prd_version}}", ver)
    .replace("{{iteration_id}}", p.iteration_id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test .claude/scripts/__tests__/lib/preferences.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/lib/preferences.ts .claude/scripts/__tests__/lib/preferences.test.ts
git commit -m "feat: project-level preference loading with global fallback"
```

---

## Task 5: Refactor `archive-gen.ts` — Project-Scoped Default Dir

**Files:**
- Modify: `.claude/scripts/archive-gen.ts`
- Test: `.claude/scripts/__tests__/archive-gen.test.ts`

- [ ] **Step 1: Update archive-gen.ts search command default dir**

In `archive-gen.ts`, find the search command's `--dir` option (line ~444):

```typescript
// Old:
.option("--dir <path>", "Archive directory to search", "workspace/archive")

// New:
.requiredOption("--project <name>", "Project name (e.g. dataAssets)")
.option("--dir <path>", "Archive directory to search (overrides project default)")
```

And in the action handler, compute the default dir from project:

```typescript
.action((opts: { query: string; dir?: string; project: string; limit: string }) => {
  const searchDir = opts.dir ?? resolve(repoRoot(), "workspace", opts.project, "archive");
  // ... rest uses searchDir
})
```

Also add `--project` to the `convert` command and inject `project` field into frontmatter output.

- [ ] **Step 2: Update tests to pass --project**

In `.claude/scripts/__tests__/archive-gen.test.ts`, add `--project dataAssets` to all `runArchiveGen` calls.

- [ ] **Step 3: Run tests**

Run: `bun test .claude/scripts/__tests__/archive-gen.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add .claude/scripts/archive-gen.ts .claude/scripts/__tests__/archive-gen.test.ts
git commit -m "feat: archive-gen accepts --project for scoped archive dir"
```

---

## Task 6: Refactor `xmind-edit.ts` — Project-Scoped Default Dir

**Files:**
- Modify: `.claude/scripts/xmind-edit.ts`
- Test: `.claude/scripts/__tests__/xmind-edit.test.ts`

- [ ] **Step 1: Update xmind-edit.ts search command**

In `xmind-edit.ts` line ~497, change the search command:

```typescript
// Old:
.option("--dir <dir>", "Directory to search in", "workspace/xmind")

// New:
.requiredOption("--project <name>", "Project name (e.g. dataAssets)")
.option("--dir <dir>", "Directory to search in (overrides project default)")
```

In the action handler (line ~281 area):

```typescript
// Old:
const dir = resolve(opts.dir ?? "workspace/xmind");

// New:
const dir = resolve(opts.dir ?? join("workspace", opts.project, "xmind"));
```

Add `--project` to other subcommands (`show`, `patch`, `add`, `delete`) that use `validateFilePath` with xmind paths.

- [ ] **Step 2: Update tests to pass --project**

In `.claude/scripts/__tests__/xmind-edit.test.ts`, add `--project dataAssets` to all command invocations.

- [ ] **Step 3: Run tests**

Run: `bun test .claude/scripts/__tests__/xmind-edit.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add .claude/scripts/xmind-edit.ts .claude/scripts/__tests__/xmind-edit.test.ts
git commit -m "feat: xmind-edit accepts --project for scoped xmind dir"
```

---

## Task 7: Refactor `repo-sync.ts` — Project-Scoped Base Dir

**Files:**
- Modify: `.claude/scripts/repo-sync.ts`
- Test: `.claude/scripts/__tests__/repo-sync.test.ts`

- [ ] **Step 1: Update repo-sync.ts default base-dir**

In `repo-sync.ts` line ~57:

```typescript
// Old:
.option("--base-dir <dir>", "Base directory for repos", "workspace/.repos")

// New:
.requiredOption("--project <name>", "Project name")
.option("--base-dir <dir>", "Base directory for repos (overrides project default)")
```

In the action handler, compute default:

```typescript
const baseDir = opts.baseDir ?? join("workspace", opts.project, ".repos");
```

- [ ] **Step 2: Update tests to pass --project**

- [ ] **Step 3: Run tests**

Run: `bun test .claude/scripts/__tests__/repo-sync.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add .claude/scripts/repo-sync.ts .claude/scripts/__tests__/repo-sync.test.ts
git commit -m "feat: repo-sync accepts --project for scoped .repos dir"
```

---

## Task 8: Refactor Remaining Scripts — xmind-gen, prd-frontmatter, report-to-pdf, history-convert

**Files:**
- Modify: `.claude/scripts/xmind-gen.ts`
- Modify: `.claude/scripts/prd-frontmatter.ts`
- Modify: `.claude/scripts/report-to-pdf.ts`
- Modify: `.claude/scripts/history-convert.ts`
- Tests: corresponding test files

- [ ] **Step 1: Update `xmind-gen.ts`**

The script uses `repoRoot()` and `validateFilePath()` but doesn't have hardcoded workspace paths as CLI defaults. It receives `--input` and `--output` paths from the caller (skill). No default path change needed, but update `loadXmindPreferences()` calls to pass `project`:

Where `loadXmindPreferences()` is called, change to accept an optional `--project` option and pass it through:

```typescript
.option("--project <name>", "Project name for preference loading")
```

And in the action:
```typescript
const prefs = loadXmindPreferences(opts.project);
```

- [ ] **Step 2: Update `prd-frontmatter.ts`**

No hardcoded workspace paths. Uses `validateFilePath` with `repoRoot()`. No changes needed beyond ensuring callers pass project-scoped paths.

- [ ] **Step 3: Update `report-to-pdf.ts`**

The comment on line 13 references `workspace/reports/playwright/...` but it's just a doc comment. The script takes a path argument. No code changes needed.

- [ ] **Step 4: Update `history-convert.ts`**

Uses `currentYYYYMM()` and `repoRoot()` but output paths come from CLI args. No hardcoded workspace default. No changes needed.

- [ ] **Step 5: Run full test suite**

Run: `bun test .claude/scripts/__tests__/`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add .claude/scripts/xmind-gen.ts .claude/scripts/__tests__/xmind-gen.test.ts
git commit -m "feat: xmind-gen accepts --project for preference loading"
```

---

## Task 9: Refactor Plugins — notify, lanhu, zentao

**Files:**
- Modify: `plugins/notify/detect-events.ts`
- Modify: `plugins/lanhu/fetch.ts`
- Modify: `plugins/zentao/fetch.ts`
- Test: `plugins/notify/__tests__/detect-events.test.ts`

- [ ] **Step 1: Update `detect-events.ts` regex patterns**

The current patterns match `workspace/xmind/`, `workspace/archive/`, etc. Update to match `workspace/{any-project}/xmind/`, etc.:

```typescript
const PATTERN_RULES: readonly PatternRule[] = [
  {
    pattern: /^workspace\/[^/]+\/xmind\/\d{6}\/.*\.xmind$/,
    event: "case-generated",
    extract: (files) => ({
      count: files.length,
      file: files.join(", "),
    }),
  },
  {
    pattern: /^workspace\/[^/]+\/reports\/bugs\/\d{8}\/.*\.html$/,
    event: "bug-report",
    extract: (files) => ({
      reportFile: files.join(", "),
      summary: `${files.length} report(s)`,
    }),
  },
  {
    pattern: /^workspace\/[^/]+\/reports\/conflicts\/\d{8}\/.*\.html$/,
    event: "conflict-analyzed",
    extract: (files) => ({
      reportFile: files.join(", "),
      conflictCount: files.length,
    }),
  },
  {
    pattern: /^workspace\/[^/]+\/reports\/playwright\/\d{8}\//,
    event: "ui-test-completed",
    extract: (files) => ({
      reportFile: files[0],
    }),
  },
  {
    pattern: /^workspace\/[^/]+\/archive\/\d{6}\/(?!tmp\/).*\.md$/,
    event: "archive-converted",
    extract: (files) => ({
      fileCount: files.length,
      caseCount: files.length,
    }),
  },
];
```

- [ ] **Step 2: Update `detect-events.test.ts` paths**

Replace all test paths to include project name:

```typescript
// Old:
const files = ["workspace/xmind/202604/data-quality.xmind"];
// New:
const files = ["workspace/dataAssets/xmind/202604/data-quality.xmind"];
```

Apply this pattern to all test cases in the file.

- [ ] **Step 3: Update `lanhu/fetch.ts` default base-dir**

Line ~877:
```typescript
// Old:
.option("--base-dir <dir>", "PRD 输出基目录", "workspace/prds")
// New:
.requiredOption("--project <name>", "项目名称")
.option("--base-dir <dir>", "PRD 输出基目录（覆盖项目默认）")
```

In action handler, compute default:
```typescript
const baseDir = opts.baseDir ?? `workspace/${opts.project}/prds`;
```

- [ ] **Step 4: Update `zentao/fetch.ts` default output**

Line ~458:
```typescript
// Old:
.requiredOption("--output <dir>", "输出目录路径，例如 workspace/.temp/zentao")
// New:
.requiredOption("--project <name>", "项目名称")
.requiredOption("--output <dir>", "输出目录路径，例如 workspace/dataAssets/.temp/zentao")
```

- [ ] **Step 5: Run tests**

Run: `bun test plugins/notify/__tests__/detect-events.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add plugins/notify/detect-events.ts plugins/notify/__tests__/detect-events.test.ts plugins/lanhu/fetch.ts plugins/zentao/fetch.ts
git commit -m "feat: plugins use project-scoped workspace paths"
```

---

## Task 10: Update `playwright.config.ts` — Project-Scoped Reports and Tests

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Update report dir and test match pattern**

```typescript
const project = process.env.QA_PROJECT ?? "dataAssets";
const reportDir = `workspace/${project}/reports/playwright/${yyyymm}/${suiteName}`;

export default defineConfig({
  testMatch: `workspace/${project}/tests/**/*.spec.ts`,
  // ... rest unchanged, reportDir already used below
});
```

- [ ] **Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "feat: playwright config uses QA_PROJECT for scoped test/report dirs"
```

---

## Task 11: Update `init-wizard.ts` — Scan Per-Project Dirs

**Files:**
- Modify: `.claude/skills/setup/scripts/init-wizard.ts`
- Test: `.claude/scripts/__tests__/init-wizard.test.ts`

- [ ] **Step 1: Update scan logic to check per-project directories**

In `init-wizard.ts`, the scan checks `workspace/` exists. Update to check for project subdirectories:

In the `runScan` function, change workspace check:
```typescript
const wsDir = join(root, "workspace");
const wsExists = existsSync(wsDir);
const projects = wsExists
  ? readdirSync(wsDir).filter((name) => {
      if (name.startsWith(".")) return false;
      try { return statSync(join(wsDir, name)).isDirectory(); } catch { return false; }
    })
  : [];
```

Add `projects` to `ScanResult` interface and output.

Update `runVerify` repo check message:
```typescript
// Old:
detail: "workspace/.repos/ 下无仓库（可选）",
// New:
detail: "workspace/{project}/.repos/ 下无仓库（可选）",
```

- [ ] **Step 2: Update tests**

- [ ] **Step 3: Run tests**

Run: `bun test .claude/scripts/__tests__/init-wizard.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/setup/scripts/init-wizard.ts .claude/scripts/__tests__/init-wizard.test.ts
git commit -m "feat: init-wizard scans per-project directories"
```

---

## Task 12: Update Skills — setup, qa-flow, test-case-gen

**Files:**
- Modify: `.claude/skills/setup/skill.md`
- Modify: `.claude/skills/qa-flow/skill.md`
- Modify: `.claude/skills/test-case-gen/skill.md`

- [ ] **Step 1: Update `setup/skill.md`**

Add a new Step 1 (project management) before the existing steps. The step should:
- Ask user: create new project or select existing
- If creating: prompt for project name (english short name)
- Run `mkdir -p workspace/{project}/{prds,xmind,archive,issues,historys,reports,tests,preferences,.repos,.temp}`
- Register project in `config.json` under `projects.{name}`

Replace the existing `mkdir` command in Step 2:
```
# Old:
mkdir -p {{workspace_dir}}/{prds,xmind,archive,issues,history,reports,.repos,.temp}

# New (in Step 1):
mkdir -p workspace/{{project}}/{prds,xmind,archive,issues,historys,reports,tests,preferences,.repos,.temp}
```

- [ ] **Step 2: Update `qa-flow/skill.md`**

Add project display to the menu header:
```
当前项目: {{project}}
```

Add option 6 for project switching. Add logic at menu entry:
- Scan `workspace/` for project directories
- If 1 project: auto-select
- If multiple: prompt user to choose
- Store selected project name as `{{project}}` variable for the session

- [ ] **Step 3: Update `test-case-gen/skill.md`**

Replace all hardcoded workspace paths:
```
# Old patterns:
workspace/prds/{{YYYYMM}}/
workspace/xmind/{{YYYYMM}}/
workspace/archive/{{YYYYMM}}/
workspace/.temp/

# New patterns:
workspace/{{project}}/prds/{{YYYYMM}}/
workspace/{{project}}/xmind/{{YYYYMM}}/
workspace/{{project}}/archive/{{YYYYMM}}/
workspace/{{project}}/.temp/
```

Add project selection at flow entry (same logic as qa-flow).

Update all script invocations to include `--project {{project}}`:
```bash
bun run .claude/scripts/state.ts init --prd workspace/{{project}}/prds/{{YYYYMM}}/xxx.md --project {{project}} --mode normal
bun run .claude/scripts/archive-gen.ts search --query "xxx" --project {{project}}
bun run .claude/scripts/xmind-gen.ts --input ... --output workspace/{{project}}/xmind/{{YYYYMM}}/xxx.xmind --project {{project}}
```

Add `project` field to frontmatter in archive output instructions.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/setup/skill.md .claude/skills/qa-flow/skill.md .claude/skills/test-case-gen/skill.md
git commit -m "feat: skills use project-scoped paths and project selection"
```

---

## Task 13: Update Skills — code-analysis, xmind-editor, ui-autotest

**Files:**
- Modify: `.claude/skills/code-analysis/skill.md`
- Modify: `.claude/skills/xmind-editor/skill.md`
- Modify: `.claude/skills/ui-autotest/skill.md`

- [ ] **Step 1: Update `code-analysis/skill.md`**

Replace paths:
```
# Old:
workspace/issues/{{YYYYMM}}/
workspace/reports/bugs/
workspace/.temp/zentao/

# New:
workspace/{{project}}/issues/{{YYYYMM}}/
workspace/{{project}}/reports/bugs/
workspace/{{project}}/.temp/zentao/
```

Add project selection at flow entry.

Update zentao fetch invocation:
```bash
bun run plugins/zentao/fetch.ts --bug-id {{bug_id}} --project {{project}} --output workspace/{{project}}/.temp/zentao
```

- [ ] **Step 2: Update `xmind-editor/skill.md`**

Replace xmind-edit commands:
```bash
# Old:
bun run .claude/scripts/xmind-edit.ts search "{{keyword}}" --dir workspace/xmind
# New:
bun run .claude/scripts/xmind-edit.ts search "{{keyword}}" --project {{project}}
```

Add project selection at flow entry.

- [ ] **Step 3: Update `ui-autotest/skill.md`**

Replace all paths:
```
# Old:
e2e/
workspace/reports/playwright/

# New:
workspace/{{project}}/tests/
workspace/{{project}}/reports/playwright/
```

Update playwright commands:
```bash
QA_PROJECT={{project}} QA_SUITE_NAME={{suite_name}} npx playwright test
```

Add project selection at flow entry.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/code-analysis/skill.md .claude/skills/xmind-editor/skill.md .claude/skills/ui-autotest/skill.md
git commit -m "feat: code-analysis, xmind-editor, ui-autotest skills use project-scoped paths"
```

---

## Task 14: Update CLAUDE.md and Run Full Test Suite

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md directory structure docs**

Update the workspace path references to reflect new project-scoped structure. Add note that `workspace/{project}/` is the standard layout.

- [ ] **Step 2: Run full test suite**

Run: `bun test .claude/scripts/__tests__`
Expected: ALL PASS

- [ ] **Step 3: Run plugin tests**

Run: `bun test plugins/notify/__tests__/detect-events.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for multi-project workspace structure"
```

---

## Task 15: Manual Verification — Create Project and Run Workflow

- [ ] **Step 1: Run `/qa-flow init` and create dataAssets project**

Verify:
- Project directory structure created under `workspace/dataAssets/`
- `config.json` updated with `projects.dataAssets`

- [ ] **Step 2: Test `/test-case-gen` with a sample PRD**

Verify:
- State file created under `workspace/dataAssets/.temp/`
- XMind output goes to `workspace/dataAssets/xmind/`
- Archive output goes to `workspace/dataAssets/archive/`
- Frontmatter contains `project: "dataAssets"`

- [ ] **Step 3: Test `/xmind-editor` search**

```bash
bun run .claude/scripts/xmind-edit.ts search "质量" --project dataAssets
```
Verify: searches under `workspace/dataAssets/xmind/`

- [ ] **Step 4: Test multi-project selection**

Create a second project `xyzh`, then verify skills prompt for project selection when multiple exist.
