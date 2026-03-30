/**
 * normalize-md-content.mjs
 * 仅归一化 table-style archive body；bullet/XMind-style 与 requirement 正文保持不动。
 */
import {
  ARCHIVE_BODY_STRUCTURE_CATEGORIES,
  classifyArchiveBodyStructure,
} from "./front-matter-utils.mjs";

const CASE_TITLE_RE = /^#####\s+(.+)$/;
const TABLE_HEADER_RE = /^\|\s*编号\s*\|\s*步骤\s*\|\s*预期\s*\|?\s*$/;
const TABLE_SEPARATOR_RE = /^\|\s*:?-{3,}\s*\|\s*:?-{3,}\s*\|\s*:?-{3,}\s*\|?\s*$/;
const PRECONDITION_MARKER = "> 前置条件";
const STEP_MARKER = "> 用例步骤";
const FENCE = "```";
const PAGE_HEADING_RE = /(列表页|详情页|新增页|编辑页|配置页|设置页|结果页|页面|弹窗|面板|TAB页|Tab页|TAB|Tab|报告页|报告)$/i;
const ACTION_PREFIX_RE = /^(点击|查看|输入|选择|填写|创建|编辑|删除|测试|校验|导出|导入|搜索|查询|切换|提交|保存)/;
const GENERIC_CONTEXT_RE = /(功能|校验|测试|场景|流程|操作|逻辑)$/;
const DEFAULT_PRIORITY = "P1";

export function normalizeTableStyleArchiveBody(body = "") {
  const source = String(body).replace(/\r\n/g, "\n");
  const structureBefore = classifyArchiveBodyStructure(source);
  if (!looksLikeTableStyleArchiveBody(source)) {
    return buildResult(source, false, structureBefore, createEmptyStats());
  }

  const stats = createEmptyStats();
  const lines = removeTopLevelH1(source.split("\n"), stats);
  const output = [];
  const context = { h2: "", h3: "", h4: "" };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const headingMatch = line.match(/^(#{2,4})\s+(.+)$/);
    if (headingMatch && !line.startsWith("#####")) {
      updateHeadingContext(context, headingMatch[1].length, headingMatch[2]);
      output.push(line);
      index++;
      continue;
    }

    if (CASE_TITLE_RE.test(line)) {
      let end = index + 1;
      while (end < lines.length && !CASE_TITLE_RE.test(lines[end])) end++;
      const normalizedSection = normalizeCaseSection(lines.slice(index, end), context, stats);
      output.push(...normalizedSection.lines);
      index = end;
      continue;
    }

    output.push(line);
    index++;
  }

  const normalizedBody = output.join("\n");
  return buildResult(
    normalizedBody,
    normalizedBody !== source,
    structureBefore,
    stats,
  );
}

function createEmptyStats() {
  return {
    removedTopLevelH1: 0,
    addedPriorityPrefix: 0,
    insertedStepMarker: 0,
    insertedPreconditionMarker: 0,
    normalizedFirstStep: 0,
  };
}

function buildResult(body, changed, structureBefore, stats) {
  return {
    body,
    changed,
    stats,
    structureBefore,
    structureAfter: classifyArchiveBodyStructure(body),
  };
}

function looksLikeTableStyleArchiveBody(body) {
  const structure = classifyArchiveBodyStructure(body);
  if (
    structure === ARCHIVE_BODY_STRUCTURE_CATEGORIES.CANONICAL_TABLE
    || structure === ARCHIVE_BODY_STRUCTURE_CATEGORIES.HYBRID_TABLE
  ) {
    return true;
  }

  return CASE_TITLE_RE.test(body) && TABLE_HEADER_RE.test(body);
}

function removeTopLevelH1(lines, stats) {
  const result = [...lines];
  const firstNonEmptyIndex = result.findIndex((line) => line.trim());
  if (
    firstNonEmptyIndex === -1
    || !result[firstNonEmptyIndex].trim().startsWith("# ")
  ) {
    return result;
  }

  let removeEnd = firstNonEmptyIndex + 1;
  while (removeEnd < result.length && !result[removeEnd].trim()) removeEnd++;
  result.splice(firstNonEmptyIndex, removeEnd - firstNonEmptyIndex);
  stats.removedTopLevelH1++;
  return result;
}

function updateHeadingContext(context, level, rawText) {
  const text = sanitizeHeadingText(rawText);
  if (level === 2) {
    context.h2 = text;
    context.h3 = "";
    context.h4 = "";
    return;
  }
  if (level === 3) {
    context.h3 = text;
    context.h4 = "";
    return;
  }
  if (level === 4) {
    context.h4 = text;
  }
}

function sanitizeHeadingText(text) {
  return String(text ?? "")
    .replace(/\(#\d+\)/g, "")
    .replace(/（#\d+）/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCaseSection(sectionLines, context, stats) {
  if (sectionLines.length === 0) return { lines: sectionLines, changed: false };

  const titleLine = sectionLines[0];
  const tableHeaderIndex = sectionLines.findIndex((line) => TABLE_HEADER_RE.test(line.trim()));
  if (tableHeaderIndex === -1) {
    return { lines: sectionLines, changed: false };
  }

  const normalizedTitleLine = normalizeCaseTitle(titleLine);
  const titleChanged = normalizedTitleLine !== titleLine;
  if (titleChanged) stats.addedPriorityPrefix++;

  const preambleLines = sectionLines.slice(1, tableHeaderIndex);
  const needsStepMarker = findPreviousNonEmpty(preambleLines, preambleLines.length) !== STEP_MARKER;
  const needsPreconditionBlock = !hasCanonicalPreconditionBlock(preambleLines);
  if (needsStepMarker) stats.insertedStepMarker++;
  if (needsPreconditionBlock) stats.insertedPreconditionMarker++;

  const tableLines = sectionLines.slice(tableHeaderIndex);
  const firstStepResult = normalizeFirstDataRow(tableLines, context);
  if (firstStepResult.changed) stats.normalizedFirstStep++;

  if (!titleChanged && !needsStepMarker && !needsPreconditionBlock && !firstStepResult.changed) {
    return { lines: sectionLines, changed: false };
  }

  if (!titleChanged && !needsStepMarker && !needsPreconditionBlock && firstStepResult.changed) {
    const nextLines = [...sectionLines];
    nextLines.splice(tableHeaderIndex, tableLines.length, ...firstStepResult.lines);
    return { lines: nextLines, changed: true };
  }

  const preconditionContent = extractPreconditionContent(preambleLines);
  const trailingBlankCount = countTrailingBlankLines(sectionLines);
  const rebuilt = [
    normalizedTitleLine,
    "",
    PRECONDITION_MARKER,
    FENCE,
    ...preconditionContent,
    FENCE,
    "",
    STEP_MARKER,
    "",
    ...trimTrailingBlankLines(firstStepResult.lines),
  ];

  for (let index = 0; index < trailingBlankCount; index++) {
    rebuilt.push("");
  }

  return { lines: rebuilt, changed: true };
}

function normalizeCaseTitle(titleLine) {
  const match = titleLine.match(CASE_TITLE_RE);
  if (!match) return titleLine;
  const rawTitle = String(match[1] ?? "").trim();
  if (/^【P[012]】/.test(rawTitle)) return titleLine;

  const priorityMatch = rawTitle.match(/[【「\[(（]?\s*P([0-3])\s*[】」\])）]?/i);
  const normalizedPriority = normalizePriority(priorityMatch?.[1]);
  const strippedTitle = rawTitle
    .replace(/[【「\[(（]?\s*P[0-3]\s*[】」\])）]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return `##### 【${normalizedPriority}】${strippedTitle}`;
}

function normalizePriority(value) {
  const upper = String(value ?? DEFAULT_PRIORITY).toUpperCase().replace(/^P/, "");
  if (upper === "0") return "P0";
  if (upper === "1") return "P1";
  if (upper === "2" || upper === "3") return "P2";
  return DEFAULT_PRIORITY;
}

function hasCanonicalPreconditionBlock(lines) {
  const markerIndex = lines.findIndex((line) => line.trim() === PRECONDITION_MARKER);
  if (markerIndex === -1) return false;

  const openingFenceIndex = findNextNonEmptyLineIndex(lines, markerIndex + 1);
  if (openingFenceIndex === -1 || lines[openingFenceIndex].trim() !== FENCE) return false;

  const closingFenceIndex = findClosingFenceIndex(lines, openingFenceIndex + 1);
  return closingFenceIndex !== -1;
}

function extractPreconditionContent(preambleLines) {
  const cleaned = trimBlankLines(
    preambleLines.filter((line) => {
      const trimmed = line.trim();
      return trimmed !== PRECONDITION_MARKER && trimmed !== STEP_MARKER;
    }),
  );

  const openingFenceIndex = cleaned.findIndex((line) => line.trim() === FENCE);
  if (openingFenceIndex !== -1) {
    const closingFenceIndex = findClosingFenceIndex(cleaned, openingFenceIndex + 1);
    if (closingFenceIndex !== -1) {
      return trimBlankLines(cleaned.slice(openingFenceIndex + 1, closingFenceIndex));
    }
  }

  return trimBlankLines(cleaned.filter((line) => line.trim() !== FENCE));
}

function normalizeFirstDataRow(tableLines, context) {
  const nextLines = [...tableLines];
  const firstDataRowIndex = findFirstDataRowIndex(tableLines);
  if (firstDataRowIndex === -1) {
    return { lines: nextLines, changed: false };
  }

  const row = tableLines[firstDataRowIndex];
  const cells = parseTableCells(row);
  const currentStep = cells[1] || "";
  const normalizedStep = normalizeFirstStep(currentStep, context);
  if (normalizedStep === currentStep) {
    return { lines: nextLines, changed: false };
  }

  const expected = cells.length > 2 ? cells.slice(2).join(" | ") : "";
  const indexCell = cells[0] || "1";
  nextLines[firstDataRowIndex] = `| ${indexCell} | ${normalizedStep} | ${expected} |`;
  return { lines: nextLines, changed: true };
}

function normalizeFirstStep(stepText, context) {
  const trimmed = String(stepText ?? "").trim();
  if (!trimmed || trimmed.startsWith("进入【")) return trimmed;

  if (trimmed.startsWith("进入")) {
    const explicitStep = normalizeExplicitEnterStep(trimmed);
    return explicitStep || trimmed;
  }

  const inferredTarget = inferPageTargetFromContext(context);
  if (!inferredTarget) return trimmed;
  return `进入【${inferredTarget}】页面，${trimmed}`;
}

function normalizeExplicitEnterStep(stepText) {
  const match = stepText.match(/^进入\s*(.+?)([，,；;：:].+)?$/);
  if (!match) return "";

  const candidate = normalizePageTarget(match[1]);
  if (!isSafePageTarget(candidate, match[2])) return "";
  return `进入【${candidate}】页面${match[2] || ""}`;
}

function normalizePageTarget(rawTarget) {
  return String(rawTarget ?? "")
    .replace(/^【|】$/g, "")
    .replace(/页面$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSafePageTarget(candidate, tail = "") {
  if (!candidate || candidate.length > 80) return false;
  if (ACTION_PREFIX_RE.test(candidate)) return false;
  if (String(tail).trim()) return true;
  return PAGE_HEADING_RE.test(candidate) || /[-/]/.test(candidate);
}

function inferPageTargetFromContext(context) {
  const heading3 = sanitizeHeadingText(context.h3);
  const heading4 = sanitizeHeadingText(context.h4);

  if (heading4 && PAGE_HEADING_RE.test(heading4)) {
    if (heading3 && shouldCombineHeading(heading3, heading4)) {
      return `${heading3}-${heading4}`;
    }
    return heading4;
  }

  if (heading3 && !ACTION_PREFIX_RE.test(heading3) && !GENERIC_CONTEXT_RE.test(heading3)) {
    return heading3;
  }

  return "";
}

function shouldCombineHeading(heading3, heading4) {
  if (!heading3 || !heading4) return false;
  if (heading4.includes(heading3)) return false;
  return heading4.length <= 12 || /^(列表页|详情页|新增页|编辑页|配置页|设置页|结果页|页面|弹窗|面板|TAB页|Tab页|TAB|Tab)$/i.test(heading4);
}

function parseTableCells(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function findFirstDataRowIndex(lines) {
  let headerFound = false;
  let separatorFound = false;
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed) continue;
    if (!headerFound && TABLE_HEADER_RE.test(trimmed)) {
      headerFound = true;
      continue;
    }
    if (headerFound && !separatorFound && TABLE_SEPARATOR_RE.test(trimmed)) {
      separatorFound = true;
      continue;
    }
    if (headerFound && /^\|/.test(trimmed)) {
      return index;
    }
  }
  return -1;
}

function findPreviousNonEmpty(lines, startIndex) {
  for (let index = startIndex - 1; index >= 0; index--) {
    const trimmed = lines[index].trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function findNextNonEmptyLineIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index++) {
    if (lines[index].trim()) return index;
  }
  return -1;
}

function findClosingFenceIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index++) {
    if (lines[index].trim() === FENCE) return index;
  }
  return -1;
}

function countTrailingBlankLines(lines) {
  let count = 0;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (lines[index].trim()) break;
    count++;
  }
  return count;
}

function trimBlankLines(lines) {
  return trimTrailingBlankLines(trimLeadingBlankLines(lines));
}

function trimLeadingBlankLines(lines) {
  let start = 0;
  while (start < lines.length && !lines[start].trim()) start++;
  return lines.slice(start);
}

function trimTrailingBlankLines(lines) {
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end--;
  return lines.slice(0, end);
}
