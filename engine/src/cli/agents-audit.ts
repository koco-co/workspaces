import { Command } from "commander";
import { lintAgentShape } from "../lint/agent-shape.ts";
import { lintAgentNaming } from "../lint/agent-naming.ts";
import { repoRoot } from "../lib/paths.ts";
import { join } from "node:path";

export function registerAgentsAudit(program: Command): void {
  program
    .command("agents:audit")
    .description("Audit .claude/agents/ shape (A1 line count) + naming (N1 subagent-* ban) per spec §10.2/§10.4")
    .option("--exit-code", "exit non-zero on any violation", false)
    .action((opts: { exitCode: boolean }) => {
      const agentsDir = join(repoRoot(), ".claude", "agents");
      const shape = lintAgentShape(agentsDir);
      const naming = lintAgentNaming(agentsDir);
      const all = [...shape.violations, ...naming.violations];
      for (const v of all) {
        const rel = v.file.replace(repoRoot(), ".");
        const detail = v.lineCount ? `(${v.lineCount} lines)` : v.matched ? `[${v.matched}]` : "";
        console.log(`${rel}: [${v.rule}] ${detail} ${v.message}`);
      }
      console.log(`\n[agents:audit] scanned=${shape.agents} violations=${all.length}`);
      if (opts.exitCode && all.length > 0) process.exit(1);
    });
}
