/**
 * test-md-frontmatter-audit.mjs
 * 验证 Markdown 全量审计/自动修复脚本对 archive/requirements 的 canonical 化、
 * case_count 修复、body 审计与特殊路径容错行为。
 *
 * 运行: node test-md-frontmatter-audit.mjs
 */
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const scriptPath = resolve(repoRoot, ".claude/shared/scripts/audit-md-frontmatter.mjs");
const runId = `${process.pid}-${Date.now()}`;
const tempRoot = resolve(__dirname, `__test_md_frontmatter_audit_${runId}`);

let passed = 0;
let failed = 0;

function assert(condition, msg, details = []) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
    return;
  }

  console.error(`  ❌ ${msg}`);
  details.forEach((detail) => console.error(`     - ${detail}`));
  failed++;
}

function cleanup() {
  rmSync(tempRoot, { recursive: true, force: true });
}

process.on("exit", cleanup);
cleanup();

function writeFixture(relativePath, content) {
  const fullPath = resolve(tempRoot, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

function readFixture(relativePath) {
  return readFileSync(resolve(tempRoot, relativePath), "utf8");
}

function runAudit(args = []) {
  return spawnSync(
    process.execPath,
    [scriptPath, "--root", tempRoot, ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

const archiveRelativePath = "cases/archive/data-assets/v6.4.9/legacy-archive(#12345).md";
const requirementRelativePath = "cases/requirements/data-assets/v6.4.9/legacy-prd-formalized.md";
const bulletArchiveRelativePath = "cases/archive/data-assets/v6.4.9/tree-style-archive.md";
const nonSemverRelativePath = "cases/archive/data-assets/主流程/flow-archive.md";

const archiveBody = [
  "# Legacy archive(#12345)",
  "",
  "## 数据资产",
  "",
  "### 质量问题台账",
  "",
  "#### 列表页",
  "",
  "##### 验证旧格式用例 「P1」",
  "",
  "1、已登录系统",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 点击查询按钮 | 成功 |",
  "",
].join("\n");

const requirementBody = [
  "# Legacy PRD",
  "",
  "这里是需求正文。",
  "",
].join("\n");

const bulletArchiveBody = [
  "## 数据资产",
  "",
  "### 质量问题台账",
  "",
  "#### 列表页",
  "",
  "- 验证搜索条件组合筛选",
  "  - 输入关键词与状态",
  "  - 返回过滤结果",
  "",
].join("\n");

const canonicalArchiveBody = [
  "## 数据资产",
  "",
  "##### 【P1】验证主流程入口",
  "",
  "> 前置条件",
  "```",
  "已登录系统",
  "```",
  "",
  "> 用例步骤",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 进入【数据资产】页面 | 页面正常加载 |",
  "",
].join("\n");

writeFixture(
  archiveRelativePath,
  [
    "---",
    "name: \"Legacy archive(#12345)\"",
    "description: 旧归档描述",
    "module: data-assets",
    "version: v6.4.9",
    "source: cases/xmind/data-assets/v6.4.9/legacy-archive.xmind",
    "created_at: 2026-03-01",
    "tags:",
    "  - 数据资产",
    "  - 数据质量",
    "  - 邮件通知",
    "---",
    archiveBody,
  ].join("\n"),
);

writeFixture(
  requirementRelativePath,
  [
    "---",
    "name: Legacy PRD",
    "description: 旧需求描述",
    "module: data-assets",
    "version: v6.4.9",
    "source: 内部需求文档",
    "created_at: 2026-03-02",
    "---",
    requirementBody,
  ].join("\n"),
);

writeFixture(
  bulletArchiveRelativePath,
  [
    "---",
    "suite_name: 树形归档样例",
    "description: XMind 标题树样例",
    "prd_version: v6.4.9",
    "prd_path: cases/requirements/data-assets/v6.4.9/tree-style-prd.md",
    "product: data-assets",
    "tags:",
    "  - 数据资产",
    "  - 质量问题",
    "  - 标题树",
    "create_at: 2026-03-03",
    "case_count: 0",
    "origin: xmind",
    "status: \"\"",
    "health_warnings: []",
    "---",
    bulletArchiveBody,
  ].join("\n"),
);

writeFixture(
  nonSemverRelativePath,
  [
    "---",
    "suite_name: 主流程归档",
    "description: 主流程合法样例",
    "product: data-assets",
    "tags:",
    "  - 数据资产",
    "  - 主流程",
    "  - 冒烟",
    "create_at: 2026-03-03",
    "case_count: 1",
    "origin: xmind",
    "status: \"\"",
    "health_warnings: []",
    "---",
    canonicalArchiveBody,
  ].join("\n"),
);

const originalArchive = readFixture(archiveRelativePath);
const originalRequirement = readFixture(requirementRelativePath);
const originalBulletArchive = readFixture(bulletArchiveRelativePath);
const originalCanonicalArchive = readFixture(nonSemverRelativePath);

console.log("\n=== Test: dry-run reports issues but does not modify fixtures ===");
const dryRunResult = runAudit(["--dry-run"]);
assert(dryRunResult.status === 0, "dry-run 执行成功", [
  dryRunResult.stderr.trim(),
  dryRunResult.stdout.trim(),
].filter(Boolean));
assert(dryRunResult.stdout.includes(archiveRelativePath), "dry-run 报告包含 archive 文件路径");
assert(dryRunResult.stdout.includes("H1 标题"), "dry-run 报告包含 H1 标题问题");
assert(dryRunResult.stdout.includes("case_count"), "dry-run 报告包含 case_count 问题");
assert(dryRunResult.stdout.includes("hybrid table"), "dry-run 报告包含 hybrid table 分类");
assert(dryRunResult.stdout.includes("优先级前缀"), "dry-run 报告包含优先级前缀问题");
assert(dryRunResult.stdout.includes("用例步骤"), "dry-run 报告包含用例步骤问题");
assert(dryRunResult.stdout.includes("前置条件"), "dry-run 报告包含前置条件问题");
assert(dryRunResult.stdout.includes("进入【"), "dry-run 报告包含首步格式问题");
assert(dryRunResult.stdout.includes(bulletArchiveRelativePath), "dry-run 报告包含 bullet/XMind archive 文件路径");
assert(dryRunResult.stdout.includes("bullet/XMind tree"), "dry-run 报告包含 bullet/XMind tree 分类");
assert(dryRunResult.stdout.includes(requirementRelativePath), "dry-run 报告包含 requirement 文件路径");
assert(
  !dryRunResult.stdout.includes(`${nonSemverRelativePath}\n- ❌ \`prd_version\``),
  "非语义版本目录不会仅因缺 prd_version 被错误报告",
  [dryRunResult.stdout],
);
assert(
  !dryRunResult.stdout.includes(`${nonSemverRelativePath}\n- ⚠️ Body 结构类型为`),
  "已归一化 archive 不会被错误标记为非 canonical table",
  [dryRunResult.stdout],
);
assert(readFixture(archiveRelativePath) === originalArchive, "dry-run 不修改 archive 文件");
assert(readFixture(requirementRelativePath) === originalRequirement, "dry-run 不修改 requirement 文件");
assert(readFixture(bulletArchiveRelativePath) === originalBulletArchive, "dry-run 不修改 bullet/XMind archive 文件");

console.log("\n=== Test: fix mode canonicalizes archive frontmatter and preserves body ===");
const fixResult = runAudit(["--fix"]);
assert(fixResult.status === 0, "fix 模式执行成功", [
  fixResult.stderr.trim(),
  fixResult.stdout.trim(),
].filter(Boolean));

const fixedArchive = readFixture(archiveRelativePath);
assert(/(^|\n)suite_name:\s*"Legacy archive\(#12345\)"/.test(fixedArchive), "archive 已写入 canonical suite_name");
assert(/(^|\n)prd_id:\s*12345/.test(fixedArchive), "archive 已从文件名推断 prd_id");
assert(/(^|\n)prd_version:\s*v6\.4\.9/.test(fixedArchive), "archive 已写入 prd_version");
assert(/(^|\n)product:\s*data-assets/.test(fixedArchive), "archive 已写入 product");
assert(/(^|\n)create_at:\s*2026-03-01/.test(fixedArchive), "archive 已迁移 create_at");
assert(/(^|\n)case_count:\s*1/.test(fixedArchive), "archive 已写入正确 case_count");
assert(/(^|\n)origin:\s*xmind/.test(fixedArchive), "archive 已推断 origin");
assert(/(^|\n)status:\s*""/.test(fixedArchive), "archive 已补空字符串 status");
assert(/(^|\n)health_warnings:\s*\[\]/.test(fixedArchive), "archive 已补空数组 health_warnings");
assert(!/(^|\n)name:/.test(fixedArchive), "archive 已移除 legacy name 字段");
assert(!/(^|\n)module:/.test(fixedArchive), "archive 已移除 legacy module 字段");
assert(!/(^|\n)version:/.test(fixedArchive), "archive 已移除 legacy version 字段");
assert(!/(^|\n)created_at:/.test(fixedArchive), "archive 已移除 legacy created_at 字段");
assert(
  !fixedArchive.includes("\n# Legacy archive(#12345)\n"),
  "archive body 顶层 H1 已移除",
  [fixedArchive],
);
assert(
  fixedArchive.includes("##### 【P1】验证旧格式用例"),
  "archive body 已补 canonical 标题优先级前缀",
  [fixedArchive],
);
assert(
  fixedArchive.includes("> 前置条件\n```\n1、已登录系统\n```"),
  "archive body 已补前置条件区块",
  [fixedArchive],
);
assert(
  fixedArchive.includes("> 用例步骤\n\n| 编号 | 步骤 | 预期 |"),
  "archive body 已补用例步骤标记",
  [fixedArchive],
);
assert(
  fixedArchive.includes("| 1 | 进入【质量问题台账-列表页】页面，点击查询按钮 | 成功 |"),
  "archive body 已补首步进入页面格式",
  [fixedArchive],
);

console.log("\n=== Test: fix mode canonicalizes requirement frontmatter ===");
const fixedRequirement = readFixture(requirementRelativePath);
assert(/(^|\n)prd_name:\s*Legacy PRD/.test(fixedRequirement), "requirement 已写入 canonical prd_name");
assert(/(^|\n)prd_source:\s*"?内部需求文档"?/.test(fixedRequirement), "requirement 已迁移 prd_source");
assert(/(^|\n)prd_version:\s*v6\.4\.9/.test(fixedRequirement), "requirement 已迁移 prd_version");
assert(/(^|\n)product:\s*data-assets/.test(fixedRequirement), "requirement 已写入 product");
assert(/(^|\n)create_at:\s*2026-03-02/.test(fixedRequirement), "requirement 已迁移 create_at");
assert(/(^|\n)status:\s*formalized/.test(fixedRequirement), "requirement 已根据文件名推断 status");
assert(!/(^|\n)name:/.test(fixedRequirement), "requirement 已移除 legacy name 字段");
assert(!/(^|\n)module:/.test(fixedRequirement), "requirement 已移除 legacy module 字段");
assert(!/(^|\n)version:/.test(fixedRequirement), "requirement 已移除 legacy version 字段");
assert(!/(^|\n)created_at:/.test(fixedRequirement), "requirement 已移除 legacy created_at 字段");
assert(
  fixedRequirement.endsWith(requirementBody),
  "requirement 修复仅修改 frontmatter，不改 body",
  [fixedRequirement],
);
assert(readFixture(bulletArchiveRelativePath).endsWith(bulletArchiveBody), "fix 模式不改写 bullet/XMind body");
assert(readFixture(nonSemverRelativePath).endsWith(canonicalArchiveBody), "fix 模式不改写 canonical body");

console.log("\n=== Test: post-fix dry-run reduces table-style body warnings ===");
const postFixDryRunResult = runAudit(["--dry-run"]);
assert(postFixDryRunResult.status === 0, "post-fix dry-run 执行成功", [
  postFixDryRunResult.stderr.trim(),
  postFixDryRunResult.stdout.trim(),
].filter(Boolean));
assert(
  !postFixDryRunResult.stdout.includes(archiveRelativePath),
  "修复后 table-style archive 样例不再出现在 dry-run body 警告中",
  [postFixDryRunResult.stdout],
);
assert(
  postFixDryRunResult.stdout.includes(bulletArchiveRelativePath),
  "bullet/XMind-style archive 仍保留给后续专门任务处理",
  [postFixDryRunResult.stdout],
);

console.log(`\n══════════════════════════════════════`);
console.log(`总计: ${passed + failed} 测试, ✅ ${passed} 通过, ❌ ${failed} 失败`);
console.log(`══════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
