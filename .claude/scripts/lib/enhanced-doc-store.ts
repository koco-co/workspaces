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

// ---- Placeholder parsers (filled in Tasks 5-10) ----
function parseOverview(_body: string): SectionContent[] { return []; }
function parseFunctional(_body: string): SectionContent[] { return []; }
function parseImagesSummary(_body: string): string { return ""; }
function parsePending(_body: string): PendingItem[] { return []; }
