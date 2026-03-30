/**
 * test-md-body-normalization.mjs
 * 验证 table-style archive body 的就地归一化规则。
 *
 * 运行: node test-md-body-normalization.mjs
 */
import {
  ARCHIVE_BODY_STRUCTURE_CATEGORIES,
  buildCanonicalArchiveCaseBlock,
  classifyArchiveBodyStructure,
} from "../shared/scripts/front-matter-utils.mjs";
import { normalizeTableStyleArchiveBody } from "../shared/scripts/normalize-md-content.mjs";

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

const inferableTableBody = [
  "# 质量问题台账归档",
  "",
  "## 数据资产",
  "",
  "### 质量问题台账",
  "",
  "#### 列表页",
  "",
  "##### 验证查询功能 「P1」",
  "",
  "1、已登录系统",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 点击查询按钮 | 返回查询结果 |",
  "| 2 | 输入关键词并提交 | 列表过滤成功 |",
  "",
].join("\n");

const nonInferableTableBody = [
  "## 数据资产",
  "",
  "##### 验证导出功能",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 点击导出按钮 | 导出成功 |",
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
  buildCanonicalArchiveCaseBlock({
    priority: "P1",
    title: "验证主流程入口",
    precondition: "已登录系统",
    steps: [{ step: "进入【质量问题台账】页面", expected: "页面正常加载" }],
  }).trimEnd(),
  "",
].join("\n");

console.log("\n=== Test: normalize inferable table-style archive body ===");
const inferableResult = normalizeTableStyleArchiveBody(inferableTableBody);
assert(inferableResult.changed, "可推断的 table-style body 会被归一化");
assert(
  classifyArchiveBodyStructure(inferableResult.body) === ARCHIVE_BODY_STRUCTURE_CATEGORIES.CANONICAL_TABLE,
  "归一化后结构升级为 canonical table",
  [`actual: ${classifyArchiveBodyStructure(inferableResult.body)}`],
);
assert(!inferableResult.body.startsWith("# "), "会移除 body 顶层 H1", [inferableResult.body]);
assert(
  inferableResult.body.includes("##### 【P1】验证查询功能"),
  "缺失的优先级前缀会补到标题前",
  [inferableResult.body],
);
assert(
  inferableResult.body.includes("> 前置条件\n```\n1、已登录系统\n```"),
  "缺失的前置条件标记会补齐并包裹原始内容",
  [inferableResult.body],
);
assert(
  inferableResult.body.includes("> 用例步骤\n\n| 编号 | 步骤 | 预期 |"),
  "缺失的用例步骤标记会补齐",
  [inferableResult.body],
);
assert(
  inferableResult.body.includes("| 1 | 进入【质量问题台账-列表页】页面，点击查询按钮 | 返回查询结果 |"),
  "首步可安全推断时会补齐进入页面动作",
  [inferableResult.body],
);
assert(
  inferableResult.stats.removedTopLevelH1 === 1
    && inferableResult.stats.addedPriorityPrefix === 1
    && inferableResult.stats.insertedStepMarker === 1
    && inferableResult.stats.insertedPreconditionMarker === 1
    && inferableResult.stats.normalizedFirstStep === 1,
  "归一化统计覆盖本次目标修复项",
  [JSON.stringify(inferableResult.stats)],
);

console.log("\n=== Test: preserve non-inferable first step explicitly ===");
const nonInferableResult = normalizeTableStyleArchiveBody(nonInferableTableBody);
assert(nonInferableResult.changed, "非可推断样例仍会补齐结构缺项");
assert(
  nonInferableResult.body.includes("##### 【P1】验证导出功能"),
  "未显式提供优先级时回退为默认前缀",
  [nonInferableResult.body],
);
assert(
  nonInferableResult.body.includes("| 1 | 点击导出按钮 | 导出成功 |"),
  "无法安全推断页面时保留原始首步内容",
  [nonInferableResult.body],
);
assert(
  nonInferableResult.stats.normalizedFirstStep === 0,
  "无法安全推断页面时不会强行改写首步",
  [JSON.stringify(nonInferableResult.stats)],
);

console.log("\n=== Test: bullet/XMind-style body stays untouched ===");
const bulletResult = normalizeTableStyleArchiveBody(bulletArchiveBody);
assert(!bulletResult.changed, "bullet/XMind-style body 不在本任务归一化范围内");
assert(bulletResult.body === bulletArchiveBody, "bullet/XMind-style body 保持原样");

console.log("\n=== Test: canonical table body stays stable ===");
const canonicalResult = normalizeTableStyleArchiveBody(canonicalArchiveBody);
assert(!canonicalResult.changed, "已经 canonical 的 table body 不应产生额外 diff");
assert(canonicalResult.body === canonicalArchiveBody, "canonical table body 保持稳定");

console.log(`\n══════════════════════════════════════`);
console.log(`总计: ${passed + failed} 测试, ✅ ${passed} 通过, ❌ ${failed} 失败`);
console.log(`══════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
