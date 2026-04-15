#!/usr/bin/env bun
/**
 * state.ts — Breakpoint resume state management CLI.
 *
 * Node lifecycle: init → transform → enhance → analyze → write → review → output
 *
 * Usage:
 *   bun run .claude/scripts/state.ts init --project dataAssets --prd workspace/dataAssets/prds/202604/xxx.md --mode normal
 *   bun run .claude/scripts/state.ts update --project dataAssets --prd-slug xxx --node transform --data '{"confidence":0.85}'
 *   bun run .claude/scripts/state.ts resume --project dataAssets --prd-slug xxx
 *   bun run .claude/scripts/state.ts clean --project dataAssets --prd-slug xxx
 *   bun run .claude/scripts/state.ts --help
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname } from "node:path";
import { Command } from "commander";
import { initEnv } from "./lib/env.ts";
import { projectPath } from "./lib/paths.ts";

type RunMode = "normal" | "quick";

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
  cached_parse_result?: unknown;
  source_mtime?: string;
}

function stateFilePath(project: string, prdSlug: string): string {
  return projectPath(project, ".temp", `.qa-state-${prdSlug}.json`);
}

function slugFromPrd(prdPath: string): string {
  return basename(prdPath, ".md");
}

function readState(project: string, prdSlug: string): QaState | null {
  const filePath = stateFilePath(project, prdSlug);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as QaState;
  } catch (err) {
    throw new Error(`Failed to parse state file: ${err}`);
  }
}

function writeState(project: string, prdSlug: string, state: QaState): void {
  const filePath = stateFilePath(project, prdSlug);
  const lockPath = `${filePath}.lock`;

  if (!acquireLock(lockPath)) {
    throw new Error(`Failed to acquire lock for ${filePath}`);
  }

  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } finally {
    releaseLock(lockPath);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function acquireLock(lockPath: string, timeoutMs = 5000): boolean {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      writeFileSync(lockPath, `${process.pid}`, { flag: "wx" });
      return true;
    } catch {
      // lock file exists, wait
      const waitMs = 50 + Math.random() * 50;
      Bun.sleepSync(waitMs);
    }
  }
  return false;
}

function releaseLock(lockPath: string): void {
  try {
    if (existsSync(lockPath)) rmSync(lockPath);
  } catch {
    // ignore
  }
}

const program = new Command();

program
  .name("state")
  .description(
    "Breakpoint resume state management for qa-flow test case generation",
  )
  .helpOption("-h, --help", "Display help information");

// ── init ──────────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Create a new state file for a PRD")
  .requiredOption(
    "--prd <path>",
    "PRD file path (e.g. workspace/dataAssets/prds/202604/xxx.md)",
  )
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

// ── update ────────────────────────────────────────────────────────────────────

program
  .command("update")
  .description("Advance state to a new node and optionally merge output data")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--prd-slug <slug>", "PRD slug (filename without .md)")
  .requiredOption("--node <node>", "Node name to set as current_node")
  .option("--data <json>", "JSON object to merge into node_outputs[node]", "{}")
  .action((opts: { project: string; prdSlug: string; node: string; data: string }) => {
    initEnv();

    const state = readState(opts.project, opts.prdSlug);
    if (!state) {
      process.stderr.write(
        `[state:update] state file not found for slug "${opts.prdSlug}"\n`,
      );
      process.exit(1);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(opts.data) as Record<string, unknown>;
    } catch {
      process.stderr.write(
        `[state:update] invalid --data JSON: ${opts.data}\n`,
      );
      process.exit(1);
    }

    const existingOutput = (state.node_outputs[opts.node] ?? {}) as Record<
      string,
      unknown
    >;
    const updated: QaState = {
      ...state,
      current_node: opts.node,
      completed_nodes: state.completed_nodes.includes(opts.node)
        ? state.completed_nodes
        : [...state.completed_nodes, opts.node],
      node_outputs: {
        ...state.node_outputs,
        [opts.node]: { ...existingOutput, ...data },
      },
      updated_at: nowIso(),
    };

    try {
      writeState(opts.project, opts.prdSlug, updated);
      process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    } catch (err) {
      process.stderr.write(`[state:update] error: ${err}\n`);
      process.exit(1);
    }
  });

// ── resume ────────────────────────────────────────────────────────────────────

program
  .command("resume")
  .description("Read and output current state for a PRD slug")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--prd-slug <slug>", "PRD slug (filename without .md)")
  .action((opts: { project: string; prdSlug: string }) => {
    initEnv();

    const state = readState(opts.project, opts.prdSlug);
    if (!state) {
      process.stdout.write(
        `${JSON.stringify({ error: "State file not found" }, null, 2)}\n`,
      );
      process.exit(1);
    }

    // If source_mtime is set, compare with actual PRD file mtime.
    // If different, the PRD has changed — clear cached_parse_result.
    let resolved: QaState = state;
    if (state.source_mtime && state.prd) {
      try {
        const actualMtime = statSync(state.prd).mtime.toISOString();
        if (actualMtime !== state.source_mtime) {
          resolved = { ...state, cached_parse_result: undefined };
          writeState(opts.project, opts.prdSlug, resolved);
        }
      } catch {
        // PRD file not accessible — leave cache as-is
      }
    }

    process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
  });

// ── clean ─────────────────────────────────────────────────────────────────────

program
  .command("clean")
  .description("Delete state file for a PRD slug")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--prd-slug <slug>", "PRD slug (filename without .md)")
  .action((opts: { project: string; prdSlug: string }) => {
    initEnv();

    const filePath = stateFilePath(opts.project, opts.prdSlug);

    try {
      if (existsSync(filePath)) {
        rmSync(filePath);
      }
      process.stdout.write(
        `${JSON.stringify({ cleaned: true, path: filePath }, null, 2)}\n`,
      );
    } catch (err) {
      process.stderr.write(`[state:clean] error: ${err}\n`);
      process.exit(1);
    }
  });

program.parse(process.argv);
