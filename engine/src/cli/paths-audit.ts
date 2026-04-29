import { Command } from "commander";
import { lintPaths } from "../lint/path-treatment.ts";
import { repoRoot } from "../../lib/paths.ts";

function isKnownSafe(file: string): boolean {
  return (
    file.includes("engine/src/lint/") || // lint self-references
    file.includes("engine/tests/lint/") || // deliberate lint test fixtures
    // agent templates describing v2 workspace layout (agents still interact with v2 projects)
    file.includes(".claude/agents/") ||
    file.includes(".claude/skills/") ||
    file.includes(".claude/settings.local.json") ||
    file.includes("playwright.config.ts") || // compat globs
    file.includes("/README.md") || // doc describing current (v2) layout
    file.includes("/README-EN.md")
  );
}

export function registerPathsAudit(program: Command): void {
  program
    .command("paths:audit")
    .description("审查过时路径引用")
    .option("--exit-code", "exit non-zero on any violation", false)
    .option("--by-rule", "summarize per-rule counts", false)
    .action((opts: { exitCode: boolean; byRule: boolean }) => {
      const root = repoRoot();
      const r = lintPaths(root);
      // Filter actionable violations (exclude known-safe files)
      const actionable = opts.exitCode
        ? r.violations.filter((v) => !isKnownSafe(v.file))
        : r.violations;
      if (opts.byRule) {
        const counts: Record<string, number> = {};
        for (const v of actionable) counts[v.rule] = (counts[v.rule] || 0) + 1;
        for (const [rule, n] of Object.entries(counts).sort()) {
          console.log(`  ${rule}: ${n}`);
        }
      }
      const byFile = new Map<string, typeof actionable>();
      for (const v of actionable) {
        const list = byFile.get(v.file) || [];
        list.push(v);
        byFile.set(v.file, list);
      }
      for (const [file, list] of [...byFile.entries()].sort()) {
        console.log(`\n${file.replace(root, ".")}:`);
        for (const v of list) console.log(`  L${v.lineNumber} [${v.rule}] ${v.matched}`);
      }
      // Show count diff when exit-code mode
      const skipped = r.violations.length - actionable.length;
      if (skipped > 0) console.log(`\n[paths:audit] total=${r.violations.length} (${skipped} known-safe skipped)`);
      else console.log(`\n[paths:audit] total=${r.violations.length}`);
      if (opts.exitCode && actionable.length > 0) process.exit(1);
    });
}
