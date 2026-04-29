import { Command } from "commander";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { lintSkillShape } from "../lint/skill-shape.ts";
import { lintAgentFrontmatter } from "../lint/skill-frontmatter.ts";
import { repoRoot, skillsDir } from "../../lib/paths.ts";

export function registerSkillAudit(program: Command): void {
  program
    .command("skill:audit")
    .description("审查 .claude/skills/ 四文件契约与 agents frontmatter")
    .option("--exit-code", "exit non-zero on any violation", false)
    .action((opts: { exitCode: boolean }) => {
      const root = repoRoot();
      const skillsRoot = skillsDir();
      const agentsRoot = join(root, ".claude/agents");

      const skills = readdirSync(skillsRoot).filter((f) =>
        statSync(join(skillsRoot, f)).isDirectory()
      );
      const knownSkillSet = new Set(skills);

      let totalViolations = 0;
      console.log("\n== Skill shape (S1-S7) ==");
      for (const sk of skills) {
        const r = lintSkillShape(join(skillsRoot, sk));
        if (!r.passed) {
          console.log(`\n[${sk}] ${r.violations.length} violation(s):`);
          for (const v of r.violations) console.log(`  ${v.rule} ${(v.path || "").replace(root, ".")} — ${v.message}`);
          totalViolations += r.violations.length;
        }
      }

      console.log("\n== Agent frontmatter (A1-A4) ==");
      const agentFiles = readdirSync(agentsRoot).filter((f) => f.endsWith(".md"));
      for (const af of agentFiles) {
        const r = lintAgentFrontmatter(join(agentsRoot, af), knownSkillSet);
        if (!r.passed) {
          console.log(`\n[${af}] ${r.violations.length} violation(s):`);
          for (const v of r.violations) console.log(`  ${v.rule} — ${v.message}`);
          totalViolations += r.violations.length;
        }
      }

      console.log(`\n[skill:audit] total violations=${totalViolations}`);
      if (opts.exitCode && totalViolations > 0) process.exit(1);
    });
}
