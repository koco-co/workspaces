#!/usr/bin/env bun
/**
 * create-project.ts — 项目创建 + 骨架补齐 + 源码仓库克隆。
 * Usage:
 *   bun run .claude/scripts/create-project.ts <action> --project <name> [...]
 * Actions: scan | create | clone-repo
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { initEnv } from "./lib/env.ts";
import {
  configJsonPath,
  diffProjectSkeleton,
  TEMPLATE_ROOT_REL,
  validateProjectName,
} from "./lib/create-project.ts";
import { projectDir } from "./lib/paths.ts";

initEnv();

function repoRoot(): string {
  return resolve(fileURLToPath(import.meta.url), "../../..");
}

function readConfig(): Record<string, unknown> {
  const p = configJsonPath();
  if (!existsSync(p)) return { projects: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return { projects: {} };
  }
}

function isProjectRegistered(name: string): boolean {
  const cfg = readConfig();
  const projects = (cfg.projects as Record<string, unknown> | undefined) ?? {};
  return Object.prototype.hasOwnProperty.call(projects, name);
}

function fail(message: string, code = 1): never {
  process.stderr.write(`[create-project] ${message}\n`);
  process.exit(code);
}

function runScan(project: string): void {
  const nameCheck = validateProjectName(project);
  if (!nameCheck.valid) {
    fail(`Invalid project name: ${nameCheck.error}`);
  }
  const projDir = projectDir(project);
  const tplRoot = resolve(repoRoot(), TEMPLATE_ROOT_REL);
  const diff = diffProjectSkeleton(projDir, tplRoot);
  const out = {
    project,
    valid_name: true,
    name_error: "",
    exists: diff.exists,
    missing_dirs: diff.missing_dirs,
    missing_files: diff.missing_files,
    missing_gitkeeps: diff.missing_gitkeeps,
    config_registered: isProjectRegistered(project),
    repos_configured: 0,
    skeleton_complete: diff.skeleton_complete,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

interface CreatePlan {
  dirs: string[];
  files: string[];
  gitkeeps: string[];
}

function computeCreatePlan(project: string): {
  plan: CreatePlan;
  skeleton_complete: boolean;
  config_registered: boolean;
} {
  const projDir = projectDir(project);
  const tplRoot = resolve(repoRoot(), TEMPLATE_ROOT_REL);
  const diff = diffProjectSkeleton(projDir, tplRoot);
  return {
    plan: {
      dirs: diff.missing_dirs,
      files: diff.missing_files,
      gitkeeps: diff.missing_gitkeeps,
    },
    skeleton_complete: diff.skeleton_complete,
    config_registered: isProjectRegistered(project),
  };
}

function runCreate(project: string, dryRun: boolean, confirmed: boolean): void {
  const nameCheck = validateProjectName(project);
  if (!nameCheck.valid) {
    fail(`Invalid project name: ${nameCheck.error}`);
  }

  const { plan, skeleton_complete, config_registered } = computeCreatePlan(project);

  if (skeleton_complete && config_registered) {
    process.stdout.write(
      JSON.stringify(
        {
          skipped: true,
          project,
          message: "已完整，无需补齐",
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  if (dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          dry_run: true,
          project,
          will_create: plan,
          will_register: !config_registered,
          will_call_index: true,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  if (!confirmed) {
    fail(
      "Add --confirmed to apply. Run with --dry-run to preview.",
      2,
    );
  }

  // Confirmed path: Task 8 implements
  fail("create --confirmed not yet implemented (Task 8)");
}

const program = new Command();
program
  .name("create-project")
  .description("创建新项目或补齐残缺项目骨架")
  .version("1.0.0");

program
  .command("scan")
  .description("扫描项目骨架与目标态的差异")
  .requiredOption("--project <name>", "项目名")
  .action((opts: { project: string }) => {
    runScan(opts.project);
  });

program
  .command("create")
  .description("创建或补齐项目骨架")
  .requiredOption("--project <name>", "项目名")
  .option("--dry-run", "预览将要创建的内容，不落盘")
  .option("--confirmed", "真实执行写入")
  .action((opts: { project: string; dryRun?: boolean; confirmed?: boolean }) => {
    runCreate(opts.project, opts.dryRun === true, opts.confirmed === true);
  });

program.parse(process.argv);
