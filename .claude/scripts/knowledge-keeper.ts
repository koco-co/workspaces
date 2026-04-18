#!/usr/bin/env bun
/**
 * knowledge-keeper.ts — 业务知识库 CRUD + lint/index。
 * Usage:
 *   bun run .claude/scripts/knowledge-keeper.ts <action> --project <name> [...]
 * Actions: read-core | read-module | read-pitfall | write | update | index | lint
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { initEnv } from "./lib/env.ts";
import {
  autoFixFrontmatter,
  parseFrontmatter,
  renderIndex,
  searchPitfalls,
  todayIso,
  type IndexData,
  type IndexEntry,
  type TermRow,
} from "./lib/knowledge.ts";
import { knowledgeDir, knowledgePath } from "./lib/paths.ts";

initEnv();

// ── helpers ──────────────────────────────────────────────────────────────────

function scanEntries(dir: string): IndexEntry[] {
  if (!existsSync(dir)) return [];
  const entries: IndexEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const raw = readFileSync(join(dir, f), "utf8");
    const parsed = parseFrontmatter(raw);
    if (!parsed.frontmatter) continue;
    entries.push({
      name: f.replace(/\.md$/, ""),
      title: parsed.frontmatter.title,
      tags: parsed.frontmatter.tags,
      updated: parsed.frontmatter.updated,
      confidence: parsed.frontmatter.confidence,
    });
  }
  return entries;
}

function parseTermsTable(body: string): TermRow[] {
  const rows: TermRow[] = [];
  const lines = body.split("\n");
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.some((c) => /^-+$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;
      if (cells[0] === "术语" || cells[0] === "Term") continue;
      if (cells.length >= 4) {
        rows.push({ term: cells[0], zh: cells[1], desc: cells[2], alias: cells[3] });
      }
    }
  }
  return rows;
}

function gatherIndexData(
  projectName: string,
): { data: IndexData; fixedFiles: string[] } {
  const kdir = knowledgeDir(projectName);
  const today = todayIso();
  const fixedFiles: string[] = [];

  const scanAndFix = (subdir: "modules" | "pitfalls"): IndexEntry[] => {
    const dir = join(kdir, subdir);
    if (!existsSync(dir)) return [];
    const entries: IndexEntry[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const full = join(dir, f);
      let raw = readFileSync(full, "utf8");
      const fix = autoFixFrontmatter(raw, full, today);
      if (fix.fixed) {
        writeFileSync(full, fix.content);
        fixedFiles.push(`${subdir}/${f}`);
        raw = fix.content;
      }
      const parsed = parseFrontmatter(raw);
      if (!parsed.frontmatter) continue;
      entries.push({
        name: f.replace(/\.md$/, ""),
        title: parsed.frontmatter.title,
        tags: parsed.frontmatter.tags,
        updated: parsed.frontmatter.updated,
        confidence: parsed.frontmatter.confidence,
      });
    }
    return entries;
  };

  for (const single of ["overview.md", "terms.md"]) {
    const full = join(kdir, single);
    if (!existsSync(full)) continue;
    const raw = readFileSync(full, "utf8");
    const fix = autoFixFrontmatter(raw, full, today);
    if (fix.fixed) {
      writeFileSync(full, fix.content);
      fixedFiles.push(single);
    }
  }

  const modules = scanAndFix("modules");
  const pitfalls = scanAndFix("pitfalls");

  const readUpdated = (name: string): string => {
    const path = join(kdir, name);
    if (!existsSync(path)) return "";
    const parsed = parseFrontmatter(readFileSync(path, "utf8"));
    return parsed.frontmatter?.updated ?? "";
  };

  const termsPath = join(kdir, "terms.md");
  let terms_count = 0;
  if (existsSync(termsPath)) {
    const parsed = parseFrontmatter(readFileSync(termsPath, "utf8"));
    terms_count = parsed.body.split("\n").filter((l) => {
      const t = l.trim();
      return (
        t.startsWith("|") &&
        t.endsWith("|") &&
        !t.includes("---") &&
        !t.startsWith("| 术语") &&
        !t.startsWith("| Term")
      );
    }).length;
  }

  return {
    data: {
      modules,
      pitfalls,
      overview_updated: readUpdated("overview.md"),
      terms_updated: readUpdated("terms.md"),
      terms_count,
    },
    fixedFiles,
  };
}

function writeIndexFile(projectName: string): {
  modules_count: number;
  pitfalls_count: number;
  fixed_frontmatter: string[];
  written: string;
} {
  const { data, fixedFiles } = gatherIndexData(projectName);
  const out = renderIndex(projectName, data);
  const indexPath = join(knowledgeDir(projectName), "_index.md");
  writeFileSync(indexPath, out);
  return {
    modules_count: data.modules.length,
    pitfalls_count: data.pitfalls.length,
    fixed_frontmatter: fixedFiles,
    written: indexPath,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("knowledge-keeper")
  .description(
    "Knowledge base CRUD + lint/index for workspace/{project}/knowledge/",
  );

program
  .command("read-core")
  .description("Load core knowledge (overview + terms + index)")
  .requiredOption("--project <name>", "Project name")
  .action((opts: { project: string }) => {
    const kdir = knowledgeDir(opts.project);

    const ovPath = knowledgePath(opts.project, "overview.md");
    let overview = { title: "", content: "", updated: "" };
    if (existsSync(ovPath)) {
      const raw = readFileSync(ovPath, "utf8");
      const parsed = parseFrontmatter(raw);
      overview = {
        title: parsed.frontmatter?.title ?? "",
        content: parsed.body,
        updated: parsed.frontmatter?.updated ?? "",
      };
    }

    const termsPath = knowledgePath(opts.project, "terms.md");
    let terms: TermRow[] = [];
    let terms_updated = "";
    if (existsSync(termsPath)) {
      const raw = readFileSync(termsPath, "utf8");
      const parsed = parseFrontmatter(raw);
      terms = parseTermsTable(parsed.body);
      terms_updated = parsed.frontmatter?.updated ?? "";
    }

    const modules = scanEntries(join(kdir, "modules"));
    const pitfalls = scanEntries(join(kdir, "pitfalls"));

    const result = {
      project: opts.project,
      overview,
      terms,
      index: {
        modules,
        pitfalls,
        overview_updated: overview.updated,
        terms_updated,
        terms_count: terms.length,
      },
    };

    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  });

program
  .command("read-module")
  .description("Load a single module by name")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--module <name>", "Module name (without .md)")
  .action((opts: { project: string; module: string }) => {
    const path = knowledgePath(opts.project, "modules", `${opts.module}.md`);
    if (!existsSync(path)) {
      process.stderr.write(
        `[knowledge-keeper] Module not found: ${opts.module}\n`,
      );
      process.exit(1);
    }
    const raw = readFileSync(path, "utf8");
    const parsed = parseFrontmatter(raw);
    const result = {
      project: opts.project,
      module: opts.module,
      frontmatter: parsed.frontmatter,
      content: parsed.body,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  });

program
  .command("read-pitfall")
  .description("Search pitfalls by query (filename + tags)")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--query <keyword>", "Search keyword")
  .action((opts: { project: string; query: string }) => {
    const pdir = knowledgePath(opts.project, "pitfalls");
    const files: { name: string; tags: string[]; title: string; path: string }[] =
      [];
    if (existsSync(pdir)) {
      for (const f of readdirSync(pdir)) {
        if (!f.endsWith(".md")) continue;
        const raw = readFileSync(join(pdir, f), "utf8");
        const parsed = parseFrontmatter(raw);
        if (!parsed.frontmatter) continue;
        files.push({
          name: f.replace(/\.md$/, ""),
          tags: parsed.frontmatter.tags,
          title: parsed.frontmatter.title,
          path: join(pdir, f),
        });
      }
    }

    const hits = searchPitfalls(opts.query, files);
    const matches = hits.map((h) => {
      const f = files.find((x) => x.name === h.name)!;
      return {
        name: f.name,
        title: f.title,
        tags: f.tags,
        match_by: h.match_by,
        path: f.path,
      };
    });

    process.stdout.write(
      JSON.stringify(
        { project: opts.project, query: opts.query, matches },
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("index")
  .description("Rebuild _index.md (and auto-fix phase-0 templates)")
  .requiredOption("--project <name>", "Project name")
  .action((opts: { project: string }) => {
    const result = writeIndexFile(opts.project);
    process.stdout.write(
      JSON.stringify({ project: opts.project, ...result }, null, 2) + "\n",
    );
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`[knowledge-keeper] Unexpected error: ${err}\n`);
  process.exit(1);
});
