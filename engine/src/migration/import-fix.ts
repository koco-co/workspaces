import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface RewriteResult {
  filesScanned: number;
  rewriteCount: number;
  rewrittenFiles: string[];
}

const PATTERNS: Array<{ regex: RegExp; replace: string }> = [
  // import X from "../../fixtures/..."  ->  ".../../../shared/fixtures/..."
  { regex: /(['"])\.\.\/\.\.\/fixtures\//g, replace: "$1../../../shared/fixtures/" },
  // import X from "../../helpers/..."   ->  ".../../../shared/helpers/..."
  { regex: /(['"])\.\.\/\.\.\/helpers\//g, replace: "$1../../../shared/helpers/" },
  // bare helpers index: from "../../helpers"  ->  from "../../../shared/helpers"
  { regex: /(['"])\.\.\/\.\.\/helpers(\1)/g, replace: "$1../../../shared/helpers$2" },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function countReplacements(before: string, after: string): number {
  const newCount = (after.match(/\.\.\/\.\.\/\.\.\/shared\//g) || []).length;
  const oldCount = (before.match(/\.\.\/\.\.\/\.\.\/shared\//g) || []).length;
  return newCount - oldCount;
}

export function rewriteSharedImports(testsDir: string): RewriteResult {
  const files = walk(testsDir);
  let rewriteCount = 0;
  const rewrittenFiles: string[] = [];

  for (const file of files) {
    const original = readFileSync(file, "utf8");
    let updated = original;
    for (const { regex, replace } of PATTERNS) {
      updated = updated.replace(regex, replace);
    }
    if (updated !== original) {
      const fileReplacements = countReplacements(original, updated);
      rewriteCount += fileReplacements;
      writeFileSync(file, updated, "utf8");
      rewrittenFiles.push(file);
    }
  }

  return { filesScanned: files.length, rewriteCount, rewrittenFiles };
}
