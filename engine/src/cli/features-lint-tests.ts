import { Command } from "commander";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { lintFeatureTests } from "../lint/tests-layout.ts";
import { projectDir } from "../lib/paths.ts";

export function registerLintTests(program: Command): void {
  program
    .command("features:lint-tests")
    .description("Lint features/{ym-slug}/tests/ layout against §4.5 L1-L8 rules")
    .requiredOption("--project <name>", "project name")
    .option("--feature <ym-slug>", "lint a single feature; omit to lint all")
    .option("--exit-code", "exit non-zero on any violation", false)
    .action((opts: { project: string; feature?: string; exitCode: boolean }) => {
      const featuresRoot = join(projectDir(opts.project), "features");
      const features = opts.feature
        ? [opts.feature]
        : readdirSync(featuresRoot).filter((f) =>
            statSync(join(featuresRoot, f)).isDirectory()
          );
      let totalViolations = 0;
      const offenders: string[] = [];
      for (const feat of features) {
        const testsDir = join(featuresRoot, feat, "tests");
        if (!existsSync(testsDir)) continue;
        const report = lintFeatureTests(testsDir);
        if (!report.passed) {
          offenders.push(feat);
          totalViolations += report.violations.length;
          console.log(`\n[${feat}] ${report.violations.length} violation(s):`);
          for (const v of report.violations) {
            console.log(`  ${v.rule} ${v.file.replace(testsDir, ".")} - ${v.message}`);
          }
        }
      }
      console.log(`\n[features:lint-tests] features=${features.length} violations=${totalViolations} offenders=${offenders.length}`);
      if (opts.exitCode && totalViolations > 0) process.exit(1);
    });
}
