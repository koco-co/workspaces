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

program.parse(process.argv);
