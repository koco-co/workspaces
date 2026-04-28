import { Command } from "commander";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planReorg, applyReorg } from "../migration/reorg-tests.ts";
import { projectDir } from "../lib/paths.ts";

export function registerReorgTests(program: Command): void {
  program
    .command("features:reorg-tests")
    .description("Reshape features/{ym-slug}/tests/ into runners/cases/helpers/... per §4.5")
    .requiredOption("--project <name>", "project name")
    .requiredOption("--feature <ym-slug>", "feature directory name; supports '*' for all")
    .option("--mode <mode>", "dry|real", "dry")
    .action((opts: { project: string; feature: string; mode: "dry" | "real" }) => {
      const featuresRoot = join(projectDir(opts.project), "features");
      const targets =
        opts.feature === "*"
          ? readdirSync(featuresRoot).filter((f) =>
              statSync(join(featuresRoot, f)).isDirectory()
            )
          : [opts.feature];

      const summary: Array<{ feature: string; ops: number; warnings: number }> = [];
      const logEntries: Array<{ feature: string; plan: ReturnType<typeof planReorg> }> = [];

      for (const feat of targets) {
        const testsDir = join(featuresRoot, feat, "tests");
        if (!existsSync(testsDir)) continue;
        const plan = planReorg(testsDir);
        if (plan.ops.length === 0 && plan.warnings.length === 0) continue;
        applyReorg(plan, { mode: opts.mode });
        summary.push({
          feature: feat,
          ops: plan.ops.length,
          warnings: plan.warnings.length,
        });
        logEntries.push({ feature: feat, plan });
      }

      const logFile = `refactor-v3-P3.5-reorg-${opts.project}-${opts.mode}.log.json`;
      writeFileSync(logFile, JSON.stringify({ summary, details: logEntries }, null, 2));

      const totalOps = summary.reduce((a, b) => a + b.ops, 0);
      const totalWarn = summary.reduce((a, b) => a + b.warnings, 0);
      console.log(
        `[features:reorg-tests] mode=${opts.mode} project=${opts.project} features=${summary.length} ops=${totalOps} warnings=${totalWarn}`
      );
      console.log(`[features:reorg-tests] log: ${logFile}`);
    });
}
