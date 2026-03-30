/**
 * normalize-md-content.mjs
 * 归一化 archive body：
 * - table-style：就地补齐 canonical table 结构
 * - bullet/XMind-style：优先基于原始 XMind 重建，否则保守回退解析当前标题树
 */
import { readFileSync } from "fs";
import { basename, extname, resolve } from "path";
import {
  ARCHIVE_BODY_STRUCTURE_CATEGORIES,
  classifyArchiveBodyStructure,
  parseFrontMatter,
} from "./front-matter-utils.mjs";
import { deriveArchiveBaseNameFromXmind } from "./output-naming-contracts.mjs";
import { resolveMdContentSource } from "./md-content-source-resolver.mjs";
import {
  formatArchiveCaseMarkdown,
  normalizeArchivePriority,
  parseXmindToArchiveResults,
} from "../../skills/archive-converter/scripts/json-to-archive-md.mjs";

const CASE_TITLE_RE = /^#####\s+(.+)$/;
const TABLE_HEADER_RE = /^\|\s*编号\s*\|\s*步骤\s*\|\s*预期\s*\|?\s*$/;
const TABLE_SEPARATOR_RE = /^\|\s*:?-{3,}\s*\|\s*:?-{3,}\s*\|\s*:?-{3,}\s*\|?\s*$/;
const PRECONDITION_MARKER = "> 前置条件";
const STEP_MARKER = "> 用例步骤";
const FENCE = "```";
const PAGE_HEADING_RE = /(列表页|详情页|新增页|编辑页|配置页|设置页|结果页|页面|弹窗|面板|TAB页|Tab页|TAB|Tab|报告页|报告)$/i;
const ACTION_PREFIX_RE = /^(点击|查看|输入|选择|填写|创建|编辑|删除|测试|校验|导出|导入|搜索|查询|切换|提交|保存|打开|关闭|前往|返回|同步|加载|展开|收起|勾选|清空|跳转|进入|刷新)/;
const GENERIC_CONTEXT_RE = /(功能|校验|测试|场景|流程|操作|逻辑)$/;
const DEFAULT_PRIORITY = "P1";
const CASE_LIKE_TITLE_RE = /^(?:【P[012]】)?(?:验证|校验|检查|确认|测试)\S*/;
const CASE_TITLE_PREFIX_RE = /^(?:点击|输入|选择|填写|查看|搜索|查询|切换|提交|保存|创建|编辑|删除|导出|导入|上传|下载|打开|关闭|前往|返回|同步|加载|展开|收起|勾选|清空|显示|展示|默认|支持|仅支持|从|按|顶部展示|列表显示|基本信息|详情所有字段及字段值)/;
const IMPLICIT_STEP_TITLE_RE = /^(?:点击|输入|选择|填写|查看|搜索|查询|切换|提交|保存|创建|编辑|删除|导出|导入|上传|下载|打开|关闭|前往|返回|同步|加载|展开|收起|勾选|清空|跳转|进入)/;
const EXPECTED_ENTRY_PREFIX_RE = /^(?:成功|失败|正确|错误|异常|提示|回显|展示|显示|跳转|打开|关闭|加载|保存|删除|新增|查询结果|搜索结果|筛选结果|列表|页面|面板|弹窗|抽屉|字段|默认|为空|非空|支持|不支持|可见|不可见|存在|不存在|命中|拦截|拒绝|阻止|排序|数量|状态|分页|组合搜索结果|数据同步时间)/;
const BULLET_LINE_RE = /^(\s*)(?:[-*+•]|\d+[.)、）])\s+(.+)$/;
const SOURCE_LINE_RE = /^>\s*来源[:：]/;

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
      const end = findCaseSectionEnd(lines, index + 1);
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

export async function normalizeArchiveBody(body = "", options = {}) {
  const source = String(body).replace(/\r\n/g, "\n");
  const structureBefore = classifyArchiveBodyStructure(source);

  if (looksLikeTableStyleArchiveBody(source)) {
    return {
      ...normalizeTableStyleArchiveBody(source),
      strategy: "table-style",
    };
  }

  if (structureBefore !== ARCHIVE_BODY_STRUCTURE_CATEGORIES.BULLET_XMIND_TREE) {
    const narrativeResult = normalizeNarrativeArchiveBody(source);
    return buildResult(
      narrativeResult.body,
      narrativeResult.changed,
      structureBefore,
      narrativeResult.stats,
      "passthrough",
    );
  }

  const frontMatter = options.frontMatter || loadFrontMatterForNormalization(options.markdownPath);
  const sourceInfo = resolveArchiveSourceInfo(options.markdownPath, options.rootDir);
  if (sourceInfo?.originalXmindFound && sourceInfo.originalXmindPath) {
    let rebuiltFromXmind = null;
    try {
      rebuiltFromXmind = await rebuildBulletTreeFromOriginalXmind({
        source,
        frontMatter,
        markdownPath: options.markdownPath,
        rootDir: options.rootDir,
        sourceInfo,
      });
    } catch {
      rebuiltFromXmind = null;
    }
    if (rebuiltFromXmind) {
      return rebuiltFromXmind;
    }
  }

  const fallbackResult = rebuildBulletTreeFromCurrentBody(source);
  if (!fallbackResult.body || fallbackResult.body === source) {
    return buildResult(source, false, structureBefore, createEmptyStats(), "bullet-unchanged");
  }

  const stats = createEmptyStats();
  stats.rebuiltFromBulletTree = 1;
  stats.normalizedFirstStep = fallbackResult.normalizedFirstStepCount;
  return buildResult(
    fallbackResult.body,
    true,
    structureBefore,
    stats,
    "bullet-fallback",
  );
}

function findCaseSectionEnd(lines, startIndex) {
  let inFence = false;
  for (let index = startIndex; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith(FENCE)) {
      inFence = !inFence;
      continue;
    }

    if (!inFence && (CASE_TITLE_RE.test(line) || isHeadingContextBoundary(line))) {
      return index;
    }
  }

  return lines.length;
}

function isHeadingContextBoundary(line) {
  return /^(#{2,4})\s+(.+)$/.test(line);
}

function createEmptyStats() {
  return {
    removedTopLevelH1: 0,
    addedPriorityPrefix: 0,
    insertedStepMarker: 0,
    insertedPreconditionMarker: 0,
    normalizedFirstStep: 0,
    rebuiltFromXmind: 0,
    rebuiltFromBulletTree: 0,
  };
}

function normalizeNarrativeArchiveBody(body = "") {
  const stats = createEmptyStats();
  const lines = removeTopLevelH1(String(body).split("\n"), stats);
  const normalizedBody = lines.join("\n");
  return {
    body: normalizedBody,
    changed: normalizedBody !== body,
    stats,
  };
}

function buildResult(body, changed, structureBefore, stats, strategy = "table-style") {
  return {
    body,
    changed,
    stats,
    strategy,
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

function loadFrontMatterForNormalization(markdownPath) {
  if (!markdownPath) return {};
  try {
    const markdownContent = readFileSync(markdownPath, "utf8");
    return parseFrontMatter(markdownContent).frontMatter || {};
  } catch {
    return {};
  }
}

function resolveArchiveSourceInfo(markdownPath, rootDir) {
  if (!markdownPath) return null;
  try {
    return resolveMdContentSource(markdownPath, { rootDir });
  } catch {
    return null;
  }
}

async function rebuildBulletTreeFromOriginalXmind({
  source,
  frontMatter,
  markdownPath,
  rootDir,
  sourceInfo,
}) {
  const workspaceRoot = resolve(rootDir || process.cwd());
  const xmindPath = resolve(workspaceRoot, sourceInfo.originalXmindPath);
  const results = await parseXmindToArchiveResults(xmindPath);
  const selectedResult = selectXmindResult(results, {
    markdownPath,
    xmindPath,
    frontMatter,
    body: source,
  });

  if (!selectedResult?.body) {
    return null;
  }

  const rebuiltBody = trimTrailingBlankLines(selectedResult.body.split("\n")).join("\n");
  const canonicalizedBodyResult = normalizeTableStyleArchiveBody(rebuiltBody);
  const finalBody = canonicalizedBodyResult.body;
  if (!finalBody || finalBody === source) {
    return buildResult(
      source,
      false,
      classifyArchiveBodyStructure(source),
      createEmptyStats(),
      "xmind-source",
    );
  }

  const stats = createEmptyStats();
  stats.rebuiltFromXmind = 1;
  stats.removedTopLevelH1 = canonicalizedBodyResult.stats.removedTopLevelH1;
  stats.addedPriorityPrefix = canonicalizedBodyResult.stats.addedPriorityPrefix;
  stats.insertedStepMarker = canonicalizedBodyResult.stats.insertedStepMarker;
  stats.insertedPreconditionMarker = canonicalizedBodyResult.stats.insertedPreconditionMarker;
  stats.normalizedFirstStep = canonicalizedBodyResult.stats.normalizedFirstStep;
  return buildResult(
    finalBody,
    true,
    classifyArchiveBodyStructure(source),
    stats,
    "xmind-source",
  );
}

function selectXmindResult(results, { markdownPath, xmindPath, frontMatter, body }) {
  if (!Array.isArray(results) || results.length === 0) return null;
  if (results.length === 1) return results[0];

  const markdownBaseName = markdownPath
    ? basename(markdownPath, extname(markdownPath))
    : "";
  const candidateNames = buildXmindMatchCandidates({
    frontMatter,
    markdownBaseName,
    body,
  });

  const scoredResults = results
    .map((result) => {
      const resultTitle = normalizeComparableName(result.title);
      let score = 0;

      for (const candidate of candidateNames) {
        if (!candidate) continue;
        if (candidate === resultTitle) {
          score = Math.max(score, 100);
        } else if (candidate.includes(resultTitle) || resultTitle.includes(candidate)) {
          score = Math.max(score, 60);
        }
      }

      if (markdownBaseName && xmindPath) {
        const derivedBaseName = deriveArchiveBaseNameFromXmind(
          xmindPath,
          result.title,
          results.length,
        );
        if (normalizeComparableName(derivedBaseName) === normalizeComparableName(markdownBaseName)) {
          score = Math.max(score, 120);
        }
      }

      return { result, score };
    })
    .sort((left, right) => right.score - left.score);

  if (scoredResults[0]?.score > 0) {
    return scoredResults[0].result;
  }

  return null;
}

function buildXmindMatchCandidates({ frontMatter, markdownBaseName, body }) {
  const firstHeading = getFirstHeadingText(body, /^##\s+(.+)$/m);
  const secondHeading = getFirstHeadingText(body, /^###\s+(.+)$/m);
  return [
    frontMatter?.suite_name,
    frontMatter?.description,
    markdownBaseName,
    firstHeading,
    secondHeading,
  ]
    .map(normalizeComparableName)
    .filter(Boolean);
}

function getFirstHeadingText(body, pattern) {
  const match = String(body ?? "").match(pattern);
  return match?.[1] || "";
}

function normalizeComparableName(value) {
  return String(value ?? "")
    .replace(/（XMind）|\(XMind\)/gi, "")
    .replace(/\(#\d+\)|（#\d+）/g, "")
    .replace(/[【】()[\]（）]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase()
    .trim();
}

function rebuildBulletTreeFromCurrentBody(source) {
  const cases = collectBulletTreeCases(source);
  if (cases.length === 0) return { body: "", normalizedFirstStepCount: 0 };
  return renderBulletTreeCases(cases);
}

function collectBulletTreeCases(source) {
  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  const cases = [];
  let sections = [];

  for (let index = 0; index < lines.length;) {
    const token = parseBulletTreeLine(lines[index]);
    if (!token) {
      index++;
      continue;
    }

    if (token.type === "heading") {
      if (shouldUseHeadingAsCaseTitle(lines, index, token)) {
        const headingCase = consumeHeadingCase(lines, index, token, sections);
        if (headingCase.caseData) {
          cases.push(headingCase.caseData);
        }
        index = headingCase.nextIndex;
        continue;
      }

      sections = updateSectionContext(sections, token.level, token.text);
      index++;
      continue;
    }

    if (token.type === "bullet" && token.indent === 0 && shouldUseTopLevelBulletAsCaseTitle(token.text)) {
      const bulletCase = consumeBulletCase(lines, index, sections);
      if (bulletCase.caseData) {
        cases.push(bulletCase.caseData);
      }
      index = bulletCase.nextIndex;
      continue;
    }

    index++;
  }

  return cases.filter((entry) => entry.title);
}

function parseBulletTreeLine(line) {
  const rawLine = String(line ?? "");
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed === "---" || SOURCE_LINE_RE.test(trimmed)) {
    return null;
  }

  const headingMatch = rawLine.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    if (headingMatch[1].length === 1) return null;
    return {
      type: "heading",
      level: headingMatch[1].length,
      text: sanitizeHeadingText(headingMatch[2]),
    };
  }

  const bulletMatch = rawLine.match(BULLET_LINE_RE);
  if (bulletMatch) {
    return {
      type: "bullet",
      indent: Math.floor(bulletMatch[1].replace(/\t/g, "  ").length / 2),
      text: bulletMatch[2].trim(),
    };
  }

  return {
    type: "plain",
    indent: Math.floor(((rawLine.match(/^\s*/) ?? [""])[0].replace(/\t/g, "  ").length) / 2),
    text: trimmed,
  };
}

function updateSectionContext(sections, level, text) {
  const nextSections = sections.filter((entry) => entry.level < level);
  nextSections.push({ level, text: sanitizeHeadingText(text) });
  return nextSections;
}

function shouldUseHeadingAsCaseTitle(lines, startIndex, token) {
  const text = sanitizeHeadingText(token?.text);
  if (!text) return false;

  const nextToken = findNextMeaningfulToken(lines, startIndex + 1);
  if (nextToken && isNestedCaseStart(token, nextToken)) {
    return false;
  }

  if (isProbableCaseTitleText(text)) {
    return true;
  }

  return token.level >= 4 && isInlineCaseContentToken(token, nextToken);
}

function shouldUseTopLevelBulletAsCaseTitle(text) {
  const normalized = sanitizeHeadingText(text);
  if (!normalized || isLikelyExpectedEntry(normalized)) return false;
  return isProbableCaseTitleText(normalized) || normalized.length >= 4;
}

function shouldUseNestedBulletAsCaseTitle(text) {
  return isProbableCaseTitleText(text);
}

function isNestedCaseStart(currentToken, nextToken) {
  if (!nextToken) return false;

  if (nextToken.type === "heading" && nextToken.level > currentToken.level) {
    return nextToken.level >= 5 || isProbableCaseTitleText(nextToken.text);
  }

  return nextToken.type === "bullet"
    && nextToken.indent === 0
    && isProbableCaseTitleText(nextToken.text);
}

function isInlineCaseContentToken(currentToken, nextToken) {
  if (!nextToken) return false;
  if (nextToken.type === "plain") return true;
  if (nextToken.type === "bullet") return nextToken.indent >= 0;
  return nextToken.type === "heading" && nextToken.level > currentToken.level;
}

function findNextMeaningfulToken(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index++) {
    const token = parseBulletTreeLine(lines[index]);
    if (token) return token;
  }
  return null;
}

function isProbableCaseTitleText(text) {
  const normalized = sanitizeHeadingText(text);
  if (!normalized) return false;
  if (isLikelyExpectedEntry(normalized)) return false;
  return CASE_LIKE_TITLE_RE.test(normalized)
    || CASE_TITLE_PREFIX_RE.test(normalized)
    || (normalized.length >= 10 && /[，,:：]/.test(normalized));
}

function deriveImplicitStepFromTitle(title) {
  const normalizedTitle = sanitizeCaseTitle(title);
  if (!normalizedTitle) return "";
  return IMPLICIT_STEP_TITLE_RE.test(normalizedTitle) ? normalizedTitle : "";
}

function isLikelyExpectedEntry(text) {
  const normalized = trimBlankLines(String(text ?? "").split("\n")).join("\n").trim();
  if (!normalized) return false;
  if (/^返回.*(结果|列表|数据|记录)/.test(normalized)) return true;
  if (/^进入【/.test(normalized) || ACTION_PREFIX_RE.test(normalized)) return false;
  return EXPECTED_ENTRY_PREFIX_RE.test(normalized)
    || /(正确|成功|失败|为空|非空|可见|不可见|存在|不存在|回显|提示|展示|显示|加载|跳转|打开|关闭|更新|刷新|排序|分页|数量)([，。,；;]|$)/.test(normalized);
}

function consumeHeadingCase(lines, startIndex, token, sections) {
  const caseData = createFallbackCase(sections, token.text);
  const caseLevel = token.level;
  let currentStep = null;
  let looseEntries = [];
  let index = startIndex + 1;

  function flushCurrentStep() {
    if (!currentStep) return;
    pushFallbackStep(caseData, {
      step: currentStep.stepParts.join("\n"),
      expected: currentStep.expectedParts.join("\n"),
    });
    currentStep = null;
  }

  function flushLooseEntries() {
    if (looseEntries.length === 0) return;
    pushLooseEntriesAsSteps(caseData, looseEntries);
    looseEntries = [];
  }

  for (; index < lines.length; index++) {
    const nextToken = parseBulletTreeLine(lines[index]);
    if (!nextToken) continue;

    if (nextToken.type === "heading") {
      if (nextToken.level <= caseLevel || shouldUseHeadingAsCaseTitle(lines, index, nextToken)) {
        break;
      }

      flushLooseEntries();
      flushCurrentStep();
      currentStep = {
        stepParts: [nextToken.text],
        expectedParts: [],
      };
      continue;
    }

    if (nextToken.type === "bullet" && nextToken.indent === 0 && shouldUseNestedBulletAsCaseTitle(nextToken.text)) {
      break;
    }

    if (currentStep) {
      if (nextToken.type === "plain" && currentStep.expectedParts.length === 0) {
        currentStep.stepParts.push(nextToken.text);
      } else {
        currentStep.expectedParts.push(nextToken.text);
      }
      continue;
    }

    looseEntries.push(nextToken.text);
  }

  flushLooseEntries();
  flushCurrentStep();

  return { caseData, nextIndex: index };
}

function consumeBulletCase(lines, startIndex, sections) {
  const firstToken = parseBulletTreeLine(lines[startIndex]);
  const caseData = createFallbackCase(sections, firstToken?.text);
  const entries = [];
  let index = startIndex + 1;

  for (; index < lines.length; index++) {
    const nextToken = parseBulletTreeLine(lines[index]);
    if (!nextToken) continue;

    if (nextToken.type === "heading") {
      break;
    }

    if (nextToken.type === "bullet" && nextToken.indent === 0 && shouldUseNestedBulletAsCaseTitle(nextToken.text)) {
      break;
    }

    if (nextToken.type === "plain" && entries.length > 0) {
      entries[entries.length - 1] = `${entries[entries.length - 1]}\n${nextToken.text}`;
      continue;
    }

    entries.push(nextToken.text);
  }

  pushLooseEntriesAsSteps(caseData, entries);
  return { caseData, nextIndex: index };
}

function createFallbackCase(sections, rawTitle) {
  return {
    sections: sections.map((entry) => ({ ...entry })),
    priority: extractPriorityFromCaseTitle(rawTitle),
    title: sanitizeCaseTitle(rawTitle),
    precondition: "",
    steps: [],
  };
}

function extractPriorityFromCaseTitle(rawTitle) {
  const priorityMatch = String(rawTitle ?? "").match(/[【「\[(（]?\s*P([0-3])\s*[】」\])）]?/i);
  return normalizeArchivePriority(priorityMatch?.[1], "P2");
}

function sanitizeCaseTitle(rawTitle) {
  return sanitizeHeadingText(rawTitle)
    .replace(/[【「\[(（]?\s*P[0-3]\s*[】」\])）]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushFallbackStep(caseData, { step, expected }) {
  const normalizedStep = trimBlankLines(String(step ?? "").split("\n")).join("\n").trim();
  const normalizedExpected = trimBlankLines(String(expected ?? "").split("\n")).join("\n").trim();
  if (!normalizedStep && !normalizedExpected) return;

  if (/^前置条件[:：]?$/i.test(normalizedStep) && !caseData.precondition) {
    caseData.precondition = normalizedExpected;
    return;
  }

  caseData.steps.push({
    step: normalizedStep,
    expected: normalizedExpected,
  });
}

function pushLooseEntriesAsSteps(caseData, entries) {
  const normalizedEntries = entries
    .map((entry) => trimBlankLines(String(entry ?? "").split("\n")).join("\n").trim())
    .filter(Boolean);

  let implicitStepFromTitle = deriveImplicitStepFromTitle(caseData.title);

  for (let index = 0; index < normalizedEntries.length; index++) {
    const currentEntry = normalizedEntries[index];
    const nextEntry = normalizedEntries[index + 1] || "";

    if (isLikelyExpectedEntry(currentEntry)) {
      pushFallbackStep(caseData, {
        step: caseData.steps.length === 0 ? implicitStepFromTitle : "",
        expected: currentEntry,
      });
      implicitStepFromTitle = "";
      continue;
    }

    if (nextEntry && isLikelyExpectedEntry(nextEntry)) {
      pushFallbackStep(caseData, {
        step: currentEntry,
        expected: nextEntry,
      });
      implicitStepFromTitle = "";
      index++;
      continue;
    }

    pushFallbackStep(caseData, {
      step: currentEntry,
      expected: "",
    });
    implicitStepFromTitle = "";
  }

  if (caseData.steps.length === 0 && implicitStepFromTitle) {
    pushFallbackStep(caseData, {
      step: implicitStepFromTitle,
      expected: "",
    });
  }
}

function renderBulletTreeCases(cases) {
  const lines = [];
  let previousSections = [];
  let normalizedFirstStepCount = 0;

  for (const caseData of cases) {
    const normalizedCase = normalizeFallbackCaseFirstStep(caseData);
    if (normalizedCase.changed) {
      normalizedFirstStepCount++;
    }
    const renderSections = caseData.sections.slice(0, 3).map((entry) => entry.text).filter(Boolean);
    let sharedPrefixLength = 0;
    while (
      sharedPrefixLength < renderSections.length
      && sharedPrefixLength < previousSections.length
      && renderSections[sharedPrefixLength] === previousSections[sharedPrefixLength]
    ) {
      sharedPrefixLength++;
    }

    for (let index = sharedPrefixLength; index < renderSections.length; index++) {
      lines.push(`${"#".repeat(index + 2)} ${renderSections[index]}`);
      lines.push("");
    }

    previousSections = renderSections;
    lines.push(...formatArchiveCaseMarkdown(normalizedCase.caseData).trimEnd().split("\n"));
    lines.push("");
  }

  return {
    body: trimTrailingBlankLines(lines).join("\n"),
    normalizedFirstStepCount,
  };
}

function normalizeFallbackCaseFirstStep(caseData) {
  if (!Array.isArray(caseData.steps) || caseData.steps.length === 0) {
    return { caseData, changed: false };
  }

  const headingTexts = caseData.sections.slice(0, 3).map((entry) => entry.text).filter(Boolean);
  const context = {
    h2: headingTexts[0] || "",
    h3: headingTexts[1] || "",
    h4: headingTexts[2] || "",
  };
  const firstStep = caseData.steps[0];
  const normalizedStep = normalizeFirstStep(firstStep.step, context);
  if (normalizedStep === firstStep.step) {
    return { caseData, changed: false };
  }

  return {
    changed: true,
    caseData: {
      ...caseData,
      steps: [
        { ...firstStep, step: normalizedStep },
        ...caseData.steps.slice(1),
      ],
    },
  };
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
  const caseTitle = sanitizeCaseTitle(normalizedTitleLine.replace(/^#####\s+/, ""));
  const firstStepResult = normalizeFirstDataRow(tableLines, context, caseTitle);
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

function normalizeFirstDataRow(tableLines, context, caseTitle = "") {
  const nextLines = [...tableLines];
  const firstDataRowIndex = findFirstDataRowIndex(tableLines);
  if (firstDataRowIndex === -1) {
    return { lines: nextLines, changed: false };
  }

  const row = tableLines[firstDataRowIndex];
  const cells = parseTableCells(row);
  const promotedRow = promoteActionTitleRow(caseTitle, cells[1] || "", cells.length > 2 ? cells.slice(2).join(" | ") : "");
  const currentStep = promotedRow.step;
  const currentExpected = promotedRow.expected;
  const normalizedStep = normalizeFirstStep(currentStep, context);
  if (!promotedRow.changed && normalizedStep === currentStep) {
    return { lines: nextLines, changed: false };
  }

  const indexCell = cells[0] || "1";
  nextLines[firstDataRowIndex] = `| ${indexCell} | ${normalizedStep} | ${currentExpected} |`;
  return { lines: nextLines, changed: promotedRow.changed || normalizedStep !== currentStep };
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

function promoteActionTitleRow(caseTitle, stepText, expectedText) {
  const normalizedTitleStep = deriveImplicitStepFromTitle(caseTitle);
  const normalizedStepText = String(stepText ?? "").trim();
  const normalizedExpectedText = String(expectedText ?? "").trim();
  if (!normalizedTitleStep || !normalizedStepText || normalizedExpectedText) {
    return {
      step: normalizedStepText,
      expected: normalizedExpectedText,
      changed: false,
    };
  }
  if (!looksLikeExpectedOutcome(normalizedStepText)) {
    return {
      step: normalizedStepText,
      expected: normalizedExpectedText,
      changed: false,
    };
  }
  return {
    step: normalizedTitleStep,
    expected: normalizedStepText,
    changed: normalizedTitleStep !== normalizedStepText,
  };
}

function looksLikeExpectedOutcome(text) {
  const normalized = normalizeExpectedProbe(text);
  if (!normalized) return false;
  const actionLike = /^进入【/.test(normalized) || ACTION_PREFIX_RE.test(normalized);
  if (
    actionLike
    && !/(?:后|之后)\s*[,，].*(弹出|toast提示|可以|可选择|可见|不可见|正常加载|成功|失败|报错|告警|提示|展示|显示|存在|一致|触发)/.test(normalized)
  ) {
    return false;
  }
  return isLikelyExpectedEntry(normalized)
    || /(弹出|toast提示|可以|可选择|可见|不可见|正常加载|成功|失败|报错|告警|提示|展示|显示|存在|一致|触发|删除成功|建表成功|导入成功|约束删除成功|未回滚|回滚)/.test(normalized);
}

function normalizeExpectedProbe(text) {
  return String(text ?? "")
    .replace(/(?:^|<br>|\n)\s*\d+[.)、]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExplicitEnterStep(stepText) {
  const match = stepText.match(/^进入\s*(.+?)([，,；;：:].+)?$/);
  if (!match) return "";

  const rawTarget = String(match[1] ?? "").trim();
  if (!hasSimpleBracketShape(rawTarget)) return "";
  const candidate = normalizePageTarget(rawTarget);
  if (!isExplicitEnterTargetSafe(rawTarget, candidate, match[2])) return "";
  return `进入【${candidate}】页面${match[2] || ""}`;
}

function normalizePageTarget(rawTarget) {
  return String(rawTarget ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^【(.+?)】页面$/, "$1")
    .replace(/^【(.+?)】$/, "$1")
    .replace(/页面$/, "")
    .replace(/^【/, "")
    .replace(/】$/, "")
    .trim();
}

function isSafePageTarget(candidate, tail = "") {
  if (!candidate || candidate.length > 80) return false;
  if (ACTION_PREFIX_RE.test(candidate)) return false;
  if (String(tail).trim()) return true;
  return PAGE_HEADING_RE.test(candidate) || /[-/]/.test(candidate);
}

function isExplicitEnterTargetSafe(rawTarget, candidate, tail = "") {
  if (!candidate || candidate.length > 80) return false;
  if (ACTION_PREFIX_RE.test(candidate)) return false;
  if (String(tail).trim()) return true;
  const normalizedRawTarget = String(rawTarget ?? "").trim();
  return /^【.+】(?:页面)?$/.test(normalizedRawTarget)
    || /(列表页|详情页|新增页|编辑页|配置页|设置页|结果页|页面|弹窗|面板|TAB页|Tab页|TAB|Tab|报告页|报告)$/.test(normalizedRawTarget)
    || /[-/]/.test(candidate);
}

function hasSimpleBracketShape(rawTarget) {
  const text = String(rawTarget ?? "");
  const openCount = (text.match(/【/g) || []).length;
  const closeCount = (text.match(/】/g) || []).length;
  if (openCount !== closeCount) return false;
  return openCount <= 1 && closeCount <= 1;
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
