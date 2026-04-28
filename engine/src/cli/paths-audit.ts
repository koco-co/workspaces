import { Command } from "commander";
import { lintPaths } from "../lint/path-treatment.ts";
import { repoRoot } from "../lib/paths.ts";

export function registerPathsAudit(program: Command): void {
  program
    .command("paths:audit")
    .description("Audit stale-path references (P-S1..P-S4 per spec §10.3)")
    .option("--exit-code", "exit non-zero on any violation", false)
    .option("--by-rule", "summarize per-rule counts", false)
    .action((opts: { exitCode: boolean; byRule: boolean }) => {
      const root = repoRoot();
      const r = lintPaths(root);
      if (opts.byRule) {
        const counts: Record<string, number> = {};
        for (const v of r.violations) counts[v.rule] = (counts[v.rule] || 0) + 1;
        for (const [rule, n] of Object.entries(counts).sort()) {
          console.log(`  ${rule}: ${n}`);
        }
      }
      const byFile = new Map<string, typeof r.violations>();
      for (const v of r.violations) {
        const list = byFile.get(v.file) || [];
        list.push(v);
        byFile.set(v.file, list);
      }
      for (const [file, list] of [...byFile.entries()].sort()) {
        console.log(`\n${file.replace(root, ".")}:`);
        for (const v of list) console.log(`  L${v.lineNumber} [${v.rule}] ${v.matched}`);
      }
      console.log(`\n[paths:audit] total=${r.violations.length}`);
      if (opts.exitCode && r.violations.length > 0) process.exit(1);
    });
}
