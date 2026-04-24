import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import matter from "gray-matter";
import { prdDir, enhancedMd } from "./paths.ts";
import { generateSectionAnchor } from "./enhanced-doc-anchors.ts";
import type {
  EnhancedDoc,
  EnhancedFrontmatter,
  EnhancedStatus,
  SectionContent,
  PendingItem,
} from "./enhanced-doc-types.ts";

// ---- Block markers ----
const OVERVIEW_BEGIN = "<!-- overview-begin -->";
const OVERVIEW_END = "<!-- overview-end -->";
const FUNCTIONAL_BEGIN = "<!-- functional-begin -->";
const FUNCTIONAL_END = "<!-- functional-end -->";
const IMAGES_BEGIN = "<!-- images-summary-begin -->";
const IMAGES_END = "<!-- images-summary-end -->";

function extractBlock(body: string, begin: string, end: string): string {
  const i = body.indexOf(begin);
  const j = body.indexOf(end);
  if (i < 0 || j < 0) return "";
  return body.slice(i + begin.length, j);
}

function parseSections(block: string): SectionContent[] {
  const sections: SectionContent[] = [];
  // Anchor form: s-{level}-{index}-{4hex}
  const re = /^### (.+?) <a id="(s-\d+-\d+-[0-9a-f]{4})"><\/a>\s*$([\s\S]*?)(?=^### |$(?![\r\n]))/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    sections.push({ anchor: m[2], title: m[1].trim(), body: m[3].trim() });
  }
  return sections;
}

const SKELETON_BODY = (slug: string) => `
# ${slug}

## 1. 概述 <a id="s-1"></a>

<!-- overview-begin -->
### 1.1 背景 <a id="${generateSectionAnchor(1, 1)}"></a>

_TODO_

### 1.2 痛点 <a id="${generateSectionAnchor(1, 2)}"></a>

_TODO_

### 1.3 目标 <a id="${generateSectionAnchor(1, 3)}"></a>

_TODO_

### 1.4 成功标准 <a id="${generateSectionAnchor(1, 4)}"></a>

_TODO_
<!-- overview-end -->

## 2. 功能细节 <a id="s-2"></a>

<!-- functional-begin -->
<!-- functional-end -->

## 3. 图像与页面要点 <a id="s-3"></a>

<!-- images-summary-begin -->
_TODO_
<!-- images-summary-end -->

## 4. 待确认项 <a id="s-4"></a>

<!-- pending-begin -->
<!-- pending-end -->

## Appendix A: 源码事实表 <a id="source-facts"></a>

<!-- source-facts-begin -->
_TODO_
<!-- source-facts-end -->
`;

export interface InitDocOptions {
  migratedFromPlan?: boolean;
  strategyId?: string;
}

export function initDoc(
  project: string,
  yyyymm: string,
  slug: string,
  opts: InitDocOptions = {},
): void {
  const docPath = enhancedMd(project, yyyymm, slug);
  if (existsSync(docPath)) {
    throw new Error(`enhanced.md already exists: ${docPath}`);
  }
  mkdirSync(dirname(docPath), { recursive: true });
  const now = new Date().toISOString();
  const fm: EnhancedFrontmatter = {
    schema_version: 1,
    status: "discussing",
    project,
    prd_slug: slug,
    prd_dir: prdDir(project, yyyymm, slug),
    pending_count: 0,
    resolved_count: 0,
    defaulted_count: 0,
    handoff_mode: null,
    reentry_from: null,
    source_consent: null,
    source_reference: "full",
    migrated_from_plan: opts.migratedFromPlan ?? false,
    q_counter: 0,
    created_at: now,
    updated_at: now,
    strategy_id: opts.strategyId ?? "S1",
    knowledge_dropped: [],
  };
  const content = matter.stringify(SKELETON_BODY(slug), fm);
  writeFileSync(docPath, content, "utf8");
}

export function readDoc(project: string, yyyymm: string, slug: string): EnhancedDoc {
  const docPath = enhancedMd(project, yyyymm, slug);
  if (!existsSync(docPath)) {
    throw new Error(`enhanced.md not found: ${docPath}`);
  }
  const raw = readFileSync(docPath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as EnhancedFrontmatter,
    overview: parseOverview(parsed.content),
    functional: parseFunctional(parsed.content),
    images_summary: parseImagesSummary(parsed.content),
    pending: parsePending(parsed.content),
    source_facts: null,
    source_facts_ref: null,
  };
}

export function writeFrontmatter(
  project: string,
  yyyymm: string,
  slug: string,
  updates: Partial<EnhancedFrontmatter>,
): void {
  const docPath = enhancedMd(project, yyyymm, slug);
  const raw = readFileSync(docPath, "utf8");
  const parsed = matter(raw);
  const fm = {
    ...(parsed.data as EnhancedFrontmatter),
    ...updates,
    updated_at: new Date().toISOString(),
  };
  writeFileSync(docPath, matter.stringify(parsed.content, fm), "utf8");
}

export function setStatus(
  project: string,
  yyyymm: string,
  slug: string,
  status: EnhancedStatus,
): void {
  writeFrontmatter(project, yyyymm, slug, { status });
}

// ---- Section parsers ----
function parseOverview(body: string): SectionContent[] {
  return parseSections(extractBlock(body, OVERVIEW_BEGIN, OVERVIEW_END));
}

function parseFunctional(body: string): SectionContent[] {
  return parseSections(extractBlock(body, FUNCTIONAL_BEGIN, FUNCTIONAL_END));
}

function parseImagesSummary(body: string): string {
  return extractBlock(body, IMAGES_BEGIN, IMAGES_END).trim();
}

function parsePending(_body: string): PendingItem[] { return []; }

// ---- Section mutation exports ----

export function setSection(
  project: string,
  yyyymm: string,
  slug: string,
  anchor: string,
  content: string,
): void {
  const docPath = enhancedMd(project, yyyymm, slug);
  const raw = readFileSync(docPath, "utf8");
  const parsed = matter(raw);
  const body = parsed.content;
  const headingRegex = new RegExp(`^### .+? <a id="${anchor}"><\\/a>\\s*$`, "m");
  const match = headingRegex.exec(body);
  if (!match) throw new Error(`anchor not found: ${anchor}`);

  const headingEndIdx = match.index + match[0].length;
  const rest = body.slice(headingEndIdx);

  // End of this section: next `\n### ` OR next `\n<!-- {block}-end -->`
  const nextHeadingOffset = rest.search(/\n### /);
  const nextBlockEndOffset = rest.search(/\n<!--\s*\w[\w-]*-end\s*-->/);
  let endOffset = rest.length;
  for (const c of [nextHeadingOffset, nextBlockEndOffset]) {
    if (c >= 0 && c < endOffset) endOffset = c;
  }

  const before = body.slice(0, headingEndIdx);
  const after = body.slice(headingEndIdx + endOffset);
  const newBody = `${before}\n\n${content.trim()}\n${after}`;
  const fm = { ...(parsed.data as EnhancedFrontmatter), updated_at: new Date().toISOString() };
  writeFileSync(docPath, matter.stringify(newBody, fm), "utf8");
}

export interface AddSectionOpts {
  parentLevel: 2 | 3;
  title: string;
  body: string;
}

export function addSection(
  project: string,
  yyyymm: string,
  slug: string,
  opts: AddSectionOpts,
): string {
  const docPath = enhancedMd(project, yyyymm, slug);
  const raw = readFileSync(docPath, "utf8");
  const parsed = matter(raw);
  const existing = opts.parentLevel === 2
    ? parseFunctional(parsed.content)
    : parseOverview(parsed.content);
  const newIndex = existing.length + 1;
  const anchor = generateSectionAnchor(opts.parentLevel, newIndex);
  const snippet = `### ${opts.title} <a id="${anchor}"></a>\n\n${opts.body}\n\n`;
  const block = opts.parentLevel === 2 ? FUNCTIONAL_END : OVERVIEW_END;
  const newBody = parsed.content.replace(block, snippet + block);
  const fm = { ...(parsed.data as EnhancedFrontmatter), updated_at: new Date().toISOString() };
  writeFileSync(docPath, matter.stringify(newBody, fm), "utf8");
  return anchor;
}
