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
import {
  normalizeArchiveBody,
  normalizeTableStyleArchiveBody,
} from "../shared/scripts/normalize-md-content.mjs";

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

console.log("\n=== Test: explicit enter step with brackets stays well-formed ===");
const explicitBracketStepBody = [
  "## 数据资产",
  "",
  "##### 验证显式进入页面",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 进入  【数据资产】页面，点击按钮 | 页面正常加载 |",
  "",
].join("\n");
const explicitBracketResult = normalizeTableStyleArchiveBody(explicitBracketStepBody);
assert(
  explicitBracketResult.body.includes("| 1 | 进入【数据资产】页面，点击按钮 | 页面正常加载 |"),
  "显式进入页面步骤归一化后不应产生重复右括号",
  [explicitBracketResult.body],
);

console.log("\n=== Test: malformed nested bracket step is preserved ===");
const nestedBracketStepBody = [
  "## 数据资产",
  "",
  "##### 验证异常括号输入",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 进入  【数据【资产】】页面，点击按钮 | 页面正常加载 |",
  "",
].join("\n");
const nestedBracketResult = normalizeTableStyleArchiveBody(nestedBracketStepBody);
assert(
  nestedBracketResult.body.includes("| 1 | 进入  【数据【资产】】页面，点击按钮 | 页面正常加载 |"),
  "嵌套括号等异常输入无法安全规范化时应保留原文",
  [nestedBracketResult.body],
);

console.log("\n=== Test: heading transitions refresh case context ===");
const headingTransitionBody = [
  "## 数据资产",
  "",
  "### 页面甲",
  "",
  "#### 列表页",
  "",
  "##### 验证页面甲主流程",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 点击新增按钮 | 打开新增页 |",
  "",
  "### 页面乙",
  "",
  "#### 详情页",
  "",
  "##### 验证页面乙主流程",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 点击编辑按钮 | 打开编辑态 |",
  "",
].join("\n");
const headingTransitionResult = normalizeTableStyleArchiveBody(headingTransitionBody);
assert(
  headingTransitionResult.body.includes("| 1 | 进入【页面乙-详情页】页面，点击编辑按钮 | 打开编辑态 |"),
  "H3/H4 标题切换后，后续 case 会使用新的页面上下文",
  [headingTransitionResult.body],
);
assert(
  !headingTransitionResult.body.includes("| 1 | 进入【页面甲-列表页】页面，点击编辑按钮 | 打开编辑态 |"),
  "后续 case 不应沿用上一个 case 的页面上下文",
  [headingTransitionResult.body],
);

console.log("\n=== Test: h2 transition clears stale page context ===");
const h2TransitionBody = [
  "## 模块甲",
  "",
  "### 页面甲",
  "",
  "##### 验证模块甲功能",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 点击查询按钮 | 查询成功 |",
  "",
  "## 模块乙",
  "",
  "##### 验证模块乙功能",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 点击保存按钮 | 保存成功 |",
  "",
].join("\n");
const h2TransitionResult = normalizeTableStyleArchiveBody(h2TransitionBody);
assert(
  h2TransitionResult.body.includes("| 1 | 点击保存按钮 | 保存成功 |"),
  "H2 切换后若没有新的页面标题，应保守保留原始首步",
  [h2TransitionResult.body],
);
assert(
  !h2TransitionResult.body.includes("| 1 | 进入【页面甲】页面，点击保存按钮 | 保存成功 |"),
  "H2 切换会清空陈旧的页面上下文",
  [h2TransitionResult.body],
);

console.log("\n=== Test: action-like case title can be promoted into first step ===");
const actionTitlePromotionBody = [
  "## 数据导入",
  "",
  "##### 【P2】进入数据开发-周期任务页面, 选中任一任务后, 点击导入, 选择csv文件后, 点击下一步",
  "",
  "| 编号 | 步骤 | 预期 |",
  "| --- | --- | --- |",
  "| 1 | 1) 导入csv文件后, 弹出本地数据导入页面, 并将csv文件内容自动解析<br>2) 点击下一步后, 可以选择表类型和表 |  |",
  "",
].join("\n");
const actionTitlePromotionResult = normalizeTableStyleArchiveBody(actionTitlePromotionBody);
assert(
  actionTitlePromotionResult.body.includes("| 1 | 进入【数据开发-周期任务】页面, 选中任一任务后, 点击导入, 选择csv文件后, 点击下一步 | 1) 导入csv文件后, 弹出本地数据导入页面, 并将csv文件内容自动解析<br>2) 点击下一步后, 可以选择表类型和表 |"),
  "当 case 标题本身是动作、首行更像预期时，会把标题下沉到首步并保留原内容为预期",
  [actionTitlePromotionResult.body],
);

console.log("\n=== Test: narrative archive still strips top-level H1 safely ===");
const narrativeArchiveBody = [
  "# 负载测试说明",
  "> 来源：cases/xmind/batch-works/demo.xmind",
  "",
  "---",
  "",
  "### 属性能测试范围",
  "",
  "暂无测试用例，详见报告。",
  "",
].join("\n");
const narrativeResult = await normalizeArchiveBody(narrativeArchiveBody);
assert(narrativeResult.changed, "narrative-only archive 至少会移除顶层 H1");
assert(!narrativeResult.body.startsWith("# "), "narrative-only archive 修复后不再保留顶层 H1", [
  narrativeResult.body,
]);
assert(
  narrativeResult.stats.removedTopLevelH1 === 1,
  "narrative-only archive 的 H1 修复会计入统计",
  [JSON.stringify(narrativeResult.stats)],
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
