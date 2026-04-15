#!/usr/bin/env bun
/**
 * preference-loader.ts — 一次性加载并合并多级偏好，输出 JSON。
 * Usage:
 *   bun run .claude/scripts/preference-loader.ts load --project <name>
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Command } from "commander";
import { initEnv } from "./lib/env.ts";
import { getEnv } from "./lib/env.ts";
import { repoRoot, projectPreferencesDir } from "./lib/paths.ts";

type PreferenceMap = Record<string, Record<string, string>>;

function globalPreferencesDir(): string {
  const override = getEnv("QA_PREFERENCES_DIR");
  if (override) return override;
  return resolve(repoRoot(), "preferences");
}

/**
 * Parse key/value pairs from a .md preference file.
 * Skips lines starting with #, >, ( and blank lines.
 * Splits on first : to get key/value.
 */
function parsePreferenceFile(content: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith(">") || line.startsWith("(")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!key) continue;
    entries[key] = value;
  }
  return entries;
}

/**
 * Load all .md files from a directory and parse them into a preference map.
 * Returns an object keyed by filename without the .md extension.
 */
function loadPreferencesFromDir(dir: string): PreferenceMap {
  if (!existsSync(dir)) return {};
  const result: PreferenceMap = {};
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const key = basename(file, ".md");
      try {
        const content = readFileSync(join(dir, file), "utf8");
        result[key] = parsePreferenceFile(content);
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // skip unreadable directory
  }
  return result;
}

/**
 * Deep merge two preference maps. Project-level values override global values.
 */
function mergePreferenceMaps(global: PreferenceMap, project: PreferenceMap): PreferenceMap {
  const merged: PreferenceMap = {};
  const allKeys = new Set([...Object.keys(global), ...Object.keys(project)]);
  for (const key of allKeys) {
    merged[key] = {
      ...(global[key] ?? {}),
      ...(project[key] ?? {}),
    };
  }
  return merged;
}

function loadPreferences(projectName: string): PreferenceMap {
  const globalDir = globalPreferencesDir();
  const projectDir = projectPreferencesDir(projectName);

  const globalPrefs = loadPreferencesFromDir(globalDir);
  const projectPrefs = loadPreferencesFromDir(projectDir);

  return mergePreferenceMaps(globalPrefs, projectPrefs);
}

initEnv();

const program = new Command();

program
  .name("preference-loader")
  .description("Load and merge multi-level preferences, output JSON");

program
  .command("load")
  .description("Load preferences for a project and output merged JSON to stdout")
  .requiredOption("--project <name>", "Project name")
  .action((opts: { project: string }) => {
    const merged = loadPreferences(opts.project);
    process.stdout.write(JSON.stringify(merged, null, 2) + "\n");
  });

program.parse(process.argv);
