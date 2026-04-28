import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  statSync,
} from "node:fs";
import { join, basename, dirname, relative } from "node:path";

export type OpKind =
  | "case"
  | "runner-clean"
  | "runner-inline"
  | "unit"
  | "debug"
  | "helper"
  | "data";

export interface ReorgOp {
  kind: OpKind;
  src: string;
  dst?: string;
  meta?: { id: string; title: string };
}

export interface ReorgPlan {
  testsDir: string;
  ops: ReorgOp[];
  warnings: string[];
}

const RUNNER_INLINE_LINE_THRESHOLD = 200;

const META_REGEX = /^\/\/\s*META:\s*(\{.*?\})\s*$/m;
const DEBUG_PATTERNS = [/.*-repro\.spec\.ts$/, /^diag_.*\.spec\.ts$/];

function slugify(title: string): string {
  const stripped = title.replace(/【[^】]*】/g, "").trim();
  const ascii = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "";
}

function parseMeta(filePath: string): { id: string; title: string } | null {
  try {
    const content = readFileSync(filePath, "utf8");
    const m = content.match(META_REGEX);
    if (!m) return null;
    const json = JSON.parse(m[1]!);
    if (typeof json.id === "string" && typeof json.title === "string") {
      return { id: json.id, title: json.title };
    }
  } catch {
    // ignore
  }
  return null;
}

function isCleanRunner(filePath: string): boolean {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n").length;
  if (lines >= RUNNER_INLINE_LINE_THRESHOLD) return false;
  if (/^\s*(test|describe)\s*\(/m.test(content)) return false;
  return true;
}

export function planReorg(testsDir: string): ReorgPlan {
  if (!existsSync(testsDir)) {
    return { testsDir, ops: [], warnings: ["tests/ directory does not exist"] };
  }

  const ops: ReorgOp[] = [];
  const warnings: string[] = [];
  const caseEntries: { src: string; idNum: number; slug: string }[] = [];

  for (const name of readdirSync(testsDir)) {
    const src = join(testsDir, name);
    const st = statSync(src);
    if (st.isDirectory()) continue;
    if (!st.isFile()) continue;

    // 1. Debug specs
    if (DEBUG_PATTERNS.some((re) => re.test(name))) {
      ops.push({ kind: "debug", src, dst: join(testsDir, ".debug", name) });
      continue;
    }

    // 2. Numbered case t<N>.ts
    const caseMatch = name.match(/^t(\d+)\.ts$/);
    if (caseMatch) {
      const idNum = parseInt(caseMatch[1]!, 10);
      const meta = parseMeta(src);
      let slug = meta ? slugify(meta.title) : "";
      if (!slug) slug = `case-${String(idNum).padStart(2, "0")}`;
      const padded = String(idNum).padStart(2, "0");
      caseEntries.push({ src, idNum, slug });
      ops.push({
        kind: "case",
        src,
        dst: join(testsDir, "cases", `t${padded}-${slug}.ts`),
        meta: meta ?? undefined,
      });
      continue;
    }

    // 3. Unit tests
    if (name.endsWith(".test.ts")) {
      ops.push({ kind: "unit", src, dst: join(testsDir, "unit", name) });
      continue;
    }

    // 4. Spec runners
    if (name.endsWith(".spec.ts")) {
      if (isCleanRunner(src)) {
        ops.push({ kind: "runner-clean", src, dst: join(testsDir, "runners", name) });
      } else {
        ops.push({ kind: "runner-inline", src });
        warnings.push(`${name} appears to embed test bodies inline — flagged for MANUAL TRIAGE`);
      }
      continue;
    }

    // 5. Static data heuristics
    if (
      name.endsWith(".json") ||
      name.endsWith(".sql") ||
      /(?:^|[-_])(?:data|fixture|seed)[-_.]/i.test(name) ||
      /test-data\.ts$/i.test(name)
    ) {
      ops.push({ kind: "data", src, dst: join(testsDir, "data", name) });
      continue;
    }

    // 6. Default: helper
    ops.push({ kind: "helper", src, dst: join(testsDir, "helpers", name) });
  }

  return { testsDir, ops, warnings };
}

export interface ApplyOptions {
  mode: "dry" | "real";
}

/** Post-reorg: fix shared/ import depth and local helper refs in case files */
export function fixCaseImports(plan: ReorgPlan): void {
  const caseOps = plan.ops.filter((o) => o.kind === "case" && o.dst);
  if (caseOps.length === 0) return;

  // Determine how many nesting levels case files are relative to tests/
  // e.g., cases/p0/ = 2 levels deep (cases/ + p0/), cases/ = 1 level
  // The shared/ depth adjustment is (nestingLevel - 1) extra levels
  for (const op of caseOps) {
    if (!op.dst) continue;
    const content = readFileSync(op.dst, "utf8");
    const relDir = relative(plan.testsDir, dirname(op.dst));
    const nestingLevel = relDir === "" ? 0 : relDir.split("/").length;

    // Fix 1: adjust shared/ import depth
    // Base after import-fix: ../../../shared/ (from tests/, 3 up to dataAssets/)
    // From cases/ (1 level deeper): need ../../../../shared/ (4 up)
    // From cases/p0/ (2 levels deeper): need ../../../../../shared/ (5 up)
    const expectedSharedLevels = 3 + nestingLevel;
    let updated = content.replace(
      /((?:\.\.\/)+)shared\//g,
      (match, up: string) => {
        const currentLevels = up.split("/").length - 1; // count ".." segments
        if (currentLevels >= expectedSharedLevels) return match; // already deep enough
        const extra = expectedSharedLevels - currentLevels;
        return "../".repeat(extra) + match;
      }
    );

    // Fix 2: local helper imports ./helper-name -> ../helpers/helper-name
    // or -> ../../helpers/helper-name for deeper nesting
    // Handles both `import "./helper"` and `import { x } from "./helper"`
    if (nestingLevel >= 1) {
      const helperPrefix = "../".repeat(nestingLevel) + "helpers/";
      updated = updated.replace(
        /(?:from|import)\s+["']\.\/((?:[^"'/]+\/)*[^"'.]+(?:\.[a-z]+)?)["']/g,
        (m, path: string) => {
          const quote = m.includes('"') ? '"' : "'";
          return `${m.slice(0, m.indexOf(quote))}${quote}${helperPrefix}${path}${quote}`;
        }
      );
    }

    if (updated !== content) {
      writeFileSync(op.dst, updated, "utf8");
    }
  }
}

export function applyReorg(plan: ReorgPlan, opts: ApplyOptions): void {
  if (opts.mode === "dry") return;

  const caseBasenameMap = new Map<string, string>();
  for (const op of plan.ops.filter((o) => o.kind === "case")) {
    if (!op.dst) continue;
    mkdirSync(dirname(op.dst), { recursive: true });
    renameSync(op.src, op.dst);
    caseBasenameMap.set(basename(op.src), basename(op.dst));
  }

  for (const op of plan.ops.filter((o) => o.kind === "runner-clean")) {
    if (!op.dst) continue;
    mkdirSync(dirname(op.dst), { recursive: true });
    renameSync(op.src, op.dst);
    let content = readFileSync(op.dst, "utf8");
    for (const [oldName, newName] of caseBasenameMap) {
      content = content.replace(
        new RegExp(`(['"])\\./${oldName.replace(".", "\\.")}\\1`, "g"),
        `$1../cases/${newName}$1`
      );
    }
    writeFileSync(op.dst, content, "utf8");
  }

  for (const op of plan.ops) {
    if (!op.dst) continue;
    if (op.kind === "case" || op.kind === "runner-clean") continue;
    mkdirSync(dirname(op.dst), { recursive: true });
    renameSync(op.src, op.dst);
  }

  // 6. Fix case imports: shared/ depth and local helper refs
  fixCaseImports(plan);

  const inline = plan.ops.filter((o) => o.kind === "runner-inline");
  if (inline.length > 0) {
    const lines = [
      "# MANUAL TRIAGE — features tests/ reorg",
      "",
      "The following spec files embed test bodies inline (not just imports).",
      "Automated reorg cannot safely split them. A human needs to:",
      "",
      "1. Extract each `test(...)` block into a new `cases/t{nn}-{slug}.ts` file",
      "2. Replace the inline body in this runner with `import \"../cases/t{nn}-{slug}.ts\"`",
      "3. Verify Playwright still loads the runner",
      "",
      "## Files",
      "",
      ...inline.map((o) => `- \`${basename(o.src)}\``),
    ];
    writeFileSync(join(plan.testsDir, "MANUAL-TRIAGE.md"), lines.join("\n"), "utf8");
  }
}
