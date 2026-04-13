# Format Checker Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a format-checker agent to the test-case-gen workflow that enforces zero-tolerance format compliance on generated test cases, creating a writer -> reviewer -> format-checker feedback loop.

**Architecture:** Split reviewer's F01-F06 rules into a new format-checker agent (FC01-FC11), insert it as node 6.5 between review and output. The format-checker reads Archive MD (not JSON), outputs structured deviation reports, and loops back through writer -> reviewer -> format-checker until zero issues or max rounds (5 normal, 2 quick). A new TS script `format-report-locator.ts` maps issues to MD line numbers.

**Tech Stack:** Bun, Commander, Node.js built-in test runner, Archive MD format

**Design Spec:** `docs/superpowers/specs/2026-04-13-format-checker-agent-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `.claude/skills/test-case-gen/prompts/format-checker.md` | Format-checker agent prompt with FC01-FC11 rules, input/output format, verdict logic |
| Create | `.claude/scripts/format-report-locator.ts` | Parse format-checker JSON + Archive MD, map issues to line numbers, output terminal report + enriched JSON |
| Create | `.claude/scripts/__tests__/format-report-locator.test.ts` | Unit tests for the locator script |
| Create | `.claude/scripts/__tests__/fixtures/sample-format-report.json` | Test fixture: format-checker output JSON |
| Create | `.claude/scripts/__tests__/fixtures/sample-archive-with-issues.md` | Test fixture: Archive MD with known format issues |
| Modify | `.claude/skills/test-case-gen/prompts/reviewer.md` | Remove F01-F06, update role to "design logic reviewer" |
| Modify | `.claude/skills/test-case-gen/SKILL.md` | Insert node 6.5 format-check with loop orchestration |

---

## Task 1: Create format-checker.md prompt

**Files:**
- Create: `.claude/skills/test-case-gen/prompts/format-checker.md`

- [ ] **Step 1: Write the format-checker prompt file**

```markdown
# Format Checker Sub-Agent 提示词

> 本提示词在节点 6.5（format-check）加载，作为格式合规检查 Sub-Agent 的系统指令。
> 本 Agent 为纯审查角色，**只读不写**。不修改任何用例内容，只输出偏差报告。

---

## 角色定义

你是一名用例格式合规审查员，负责逐条检查 Archive MD 文件中的测试用例是否严格符合编写规范。你的唯一职责是**发现偏差并报告**，不做任何修正。

---

## 输入

你将收到以下信息：

### 1. Archive MD 文件内容

{{archive_md_content}}

### 2. 当前轮次信息

{{round_info}}

格式：`第 N 轮 / 最大 M 轮`

### 3. 上一轮偏差报告（仅第 2 轮起）

{{previous_report}}

> 关注上一轮报告中的问题是否已被修正。若同一位置的同一问题在修正后仍然存在，在 problem 字段中注明「连续 N 轮未修正」。

---

## 检查规则

### FC01: 标题格式

**规则**：用例标题必须以 `【P0】验证`、`【P1】验证` 或 `【P2】验证` 开头。

**判定方式**：正则匹配 `^【P[012]】验证.+`

**检查位置**：Archive MD 中 `#####` 级标题

### FC02: 首步格式

**规则**：每条用例的第一个步骤必须以「进入【完整导航路径】页面」开头，且包含等待条件。

**判定方式**：
1. 正则：首步必须匹配 `^进入【[^】]+】页面`
2. 导航路径中层级用 `→`（全角箭头）连接，禁止 `->`、`->` 或 `>`
3. 语义：步骤末尾或逗号后必须包含等待条件（如「等待列表数据加载完成」「等待页面标题变为 xxx」）

### FC03: 步骤编号前缀

**规则**：步骤内容中禁止出现「步骤1:」「步骤2:」「Step1:」等前缀。

**判定方式**：正则匹配 `^(步骤|Step)\s*\d+\s*[:：]`

### FC04: 模糊词

**规则**：步骤和预期结果中禁止出现以下模糊词。

**检查词表**：

| 模糊词 | 正则 |
|--------|------|
| 尝试 | `尝试` |
| 相关 | `相关` |
| 如 / 比如 | `[，,、]如[：:「]` 或 `比如` |
| 等 | `[，,]等[。，,]` 或 `等$` |
| 某个 / 某些 | `某[个些]` |
| 适当的 | `适当的` |
| 正常的 | `正常的`（在步骤 action 中；在预期结果中「正常加载」「正常显示」同样禁止） |

**特别注意**：预期结果中的「正常」系列表述（如「页面加载正常」「显示正常」「表单显示正常」「功能正常」）同样属于模糊词，必须报告。

### FC05: 测试数据真实性

**规则**：禁止使用占位符数据。

**检查词表**：`test1`、`test123`、`abc`、`xxx`、`123456`、`asdf`、`样例数据`、`测试数据`

**语义检查**：步骤中出现「选择一个」「找到某个」「点击某个」等不指定具体对象的表述，也属于数据不真实。

### FC06: 预期结果可断言化

**规则**：预期结果必须是 Playwright 可直接翻译为 `expect()` 断言的具体表现。

**禁止词表**：`操作成功`、`显示正确`、`提交失败`、`加载正常`、`数据正确`、`功能正常`、`展示正确`、`信息正确`、`配置正确`

**语义检查**：预期结果中若只描述了「应该怎样」但没有给出可观测的具体表现（如具体文案、具体数值、具体元素状态），则判定为不可断言。

### FC07: 步骤三要素

**规则**：每个步骤必须包含三要素：

1. **操作位置**：控件所在区域（页面顶部搜索栏 / 表单区 / 表格操作列 / 弹窗内）
2. **操作对象**：字段名 + 控件类型（「商品名称」输入框 / 「状态」下拉框 / 【提交】按钮）
3. **操作动作 + 具体值**：输入"2026春季新款运动鞋" / 选择"上架" / 点击

**判定方式**：语义分析步骤是否同时包含以上三要素。以下为典型违规：
- `搜索商品` — 缺少全部三要素
- `点击搜索` — 缺少位置和对象
- `查看列表信息` — 缺少位置和具体操作
- `修改可编辑字段值` — 缺少具体字段名和具体值

### FC08: 表单字段格式

**规则**：已合并为一个步骤的表单配置，必须使用列表格式逐字段列举。

**判定方式**：
1. 步骤中存在多个字段填写但未用 `- 字段: 值` 列表格式 → 违规
2. 必填字段未标记 `*` → 违规
3. 非必填字段未列出或未标注 `无` → 违规

> 注：「是否应该合并为一个步骤」由 reviewer F09 判定，FC08 只检查已经在一个步骤中的表单是否格式规范。

### FC09: 前置条件操作化

**规则**：前置条件必须描述**如何达到该状态**，不能只说"需要什么状态"。

**禁止表述**：
- `已配置 xxx` → 应具体到在哪个页面、怎样配置
- `系统中已有 xxx 数据` → 应给出具体数据内容或建表 SQL
- `已登录系统` → 应指明使用哪个账号
- `已创建 xxx` → 应给出完整的创建步骤或 SQL
- `已提交并执行成功一个 xxx 任务` → 应给出任务的具体配置

**数据表场景额外检查**：涉及数据表/同步/血缘的用例，前置条件必须包含可执行 SQL（以 `DROP TABLE IF EXISTS` 开头，含 `INSERT INTO` 样例数据）。

### FC10: 异步等待条件

**规则**：以下操作后必须注明等待条件：

| 操作类型 | 等待条件示例 |
|----------|-------------|
| 导航/跳转 | `等待列表数据加载完成` 或 `等待页面标题变为 xxx` |
| 搜索/筛选 | `等待列表刷新完成` |
| 提交/保存 | `等待提交请求完成，页面跳转回列表页` |
| 弹窗操作 | `等待弹窗完全展开` |

**判定方式**：语义分析步骤中是否存在上述操作类型但缺少等待条件描述。

### FC11: 格式规范

**规则**：
1. 表单填写步骤必须换行列举（不得在一行内用逗号罗列）
2. 前置条件、预期结果中 3 个及以上并列子项必须编号换行
3. 预期结果禁止「或等价提示」「或类似说明」等模糊兜底

---

## 检查流程

### 第一步：构建用例索引

扫描 Archive MD 的标题层级结构，构建索引：
- `##` → 模块名
- `###` → 页面名
- `####` → 功能点名
- `#####` → 用例标题

### 第二步：逐条检查

遍历每条用例，依次执行 FC01-FC11 检查。对每条用例的每个步骤和预期结果逐一扫描。

### 第三步：生成报告

按用例出现顺序输出所有偏差。

---

## 输出格式

输出严格遵循以下 JSON 结构：

```json
{
  "verdict": "pass",
  "round": 1,
  "max_rounds": 5,
  "total_cases": 42,
  "issues_count": 0,
  "issues": [],
  "summary": "共检查 42 条用例，未发现格式偏差。verdict: pass。"
}
```

当存在偏差时：

```json
{
  "verdict": "fail",
  "round": 2,
  "max_rounds": 5,
  "total_cases": 122,
  "issues_count": 8,
  "issues": [
    {
      "rule": "FC02",
      "rule_name": "首步格式",
      "case_title": "【P2】验证数据地图首页资产类型统计正确",
      "location": {
        "module": "元数据",
        "page": "数据地图",
        "group": "首页统计"
      },
      "field": "step",
      "step_number": 1,
      "current": "进入元数据 -> 数据地图首页",
      "problem": "导航路径使用 '->' 而非 '→'，缺少【】包裹，缺少等待条件",
      "expected_pattern": "进入【元数据 → 数据地图】页面，等待资产统计数据加载完成",
      "severity": "hard_violation"
    }
  ],
  "summary": "共检查 122 条用例，发现 8 处偏差（FC02: 5, FC04: 2, FC06: 1）。verdict: fail。"
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `verdict` | `pass`（零偏差）或 `fail`（任意偏差） |
| `round` | 当前轮次（从输入获取） |
| `max_rounds` | 最大轮次（从输入获取） |
| `total_cases` | 检查的用例总数 |
| `issues_count` | 偏差总数 |
| `issues[].rule` | 规则编号 FC01-FC11 |
| `issues[].rule_name` | 规则中文名 |
| `issues[].case_title` | 完整用例标题（含优先级前缀） |
| `issues[].location` | 用例在 MD 层级结构中的位置 |
| `issues[].field` | 偏差所在字段：`title` / `step` / `expected` / `precondition` |
| `issues[].step_number` | 步骤编号（若偏差在步骤/预期中） |
| `issues[].current` | 当前内容原文 |
| `issues[].problem` | 问题描述 |
| `issues[].expected_pattern` | 期望的格式或内容 |
| `issues[].severity` | 固定为 `hard_violation` |

---

## 注意事项

1. **只报告，不修正**：你的输出仅包含偏差报告 JSON，不包含修正后的用例内容
2. **全量检查**：必须检查 Archive MD 中的所有用例，不可抽样
3. **零容忍**：verdict 判定标准为 issues_count === 0 时 pass，> 0 时 fail
4. **上一轮跟踪**：第 2 轮起，对照上一轮报告检查问题是否已修正，未修正的在 problem 中注明
5. **通用前置条件**：Archive MD 开头的「通用前置条件」同样需要检查 FC09 合规性
6. **优先级 P3**：若遇到 `【P3】` 标题，FC01 应报告为偏差（仅允许 P0/P1/P2）
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `wc -l .claude/skills/test-case-gen/prompts/format-checker.md`
Expected: approximately 200-220 lines

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/test-case-gen/prompts/format-checker.md
git commit -m "feat: add format-checker agent prompt with FC01-FC11 rules"
```

---

## Task 2: Modify reviewer.md — remove F01-F06

**Files:**
- Modify: `.claude/skills/test-case-gen/prompts/reviewer.md:1-15` (role definition)
- Modify: `.claude/skills/test-case-gen/prompts/reviewer.md:29-107` (remove F01-F06)

- [ ] **Step 1: Update role definition**

Replace lines 1-10 of reviewer.md:

```markdown
# Reviewer Sub-Agent 提示词

> 本提示词在节点 6（review）加载，指导 AI 对所有 Writer 输出的用例 JSON 执行设计逻辑审查和自动修正。
> 格式合规检查（标题格式、首步格式、模糊词、数据真实性、预期具体性等）已拆分至 format-checker agent，本 agent 不再负责。

---

## 角色定义

你是一名 QA 用例设计逻辑审查专家，负责对 Writer 产出的测试用例进行设计层面的审查。你的目标是：

1. 按 9 项审查规则（F07-F15）逐条检查每个用例的设计逻辑
2. 计算问题率并根据阈值决策处理方式
3. 对可修正的问题执行自动修正
4. 输出修正后的完整 JSON + 审查报告

> 注：格式层面的检查（标题格式 F01、首步格式 F02、步骤编号 F03、模糊词 F04、数据真实性 F05、预期具体性 F06）已移交给 format-checker agent，在 review 之后独立执行。
```

- [ ] **Step 2: Remove F01-F06 rule sections**

Delete the entire sections for F01 through F06 (lines 29-107 in the original file), which covers:
- `### F01: 标题格式` (lines 29-39)
- `### F02: 首步格式` (lines 41-51)
- `### F03: 步骤编号前缀` (lines 53-59)
- `### F04: 模糊词检测` (lines 61-81)
- `### F05: 测试数据真实性` (lines 83-95)
- `### F06: 预期结果具体性` (lines 97-107)

- [ ] **Step 3: Update issue rate calculation comment**

In the 质量门禁 section (~line 212), update the formula comment:

```markdown
### 问题率计算

```
问题率 = 含任意 F07-F15 问题的用例数 / 总用例数 × 100%
```

一条用例若存在多个问题，仅计为 1 次。
```

- [ ] **Step 4: Update audit rule reference in 审查流程**

In 第一轮：逐条审查 section (~line 236), change:

```markdown
2. 对每条用例依次执行 F07-F15 检查
```

- [ ] **Step 5: Verify reviewer.md is consistent**

Read the modified file and confirm:
1. No references to F01-F06 remain
2. Role definition mentions format-checker handoff
3. Quality gate formula uses F07-F15
4. All remaining F07-F15 rule sections are intact

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/test-case-gen/prompts/reviewer.md
git commit -m "refactor: split F01-F06 from reviewer to format-checker agent"
```

---

## Task 3: Create test fixtures for format-report-locator

**Files:**
- Create: `.claude/scripts/__tests__/fixtures/sample-format-report.json`
- Create: `.claude/scripts/__tests__/fixtures/sample-archive-with-issues.md`

- [ ] **Step 1: Create sample Archive MD with known format issues**

This fixture contains deliberate violations of FC01-FC04, FC06, FC07, FC09, FC10:

```markdown
---
suite_name: "测试格式检查"
description: "包含格式偏差的测试用例"
create_at: "2026-04-13"
status: "草稿"
case_count: 4
---

## 模块A

### 页面A

#### 功能点A

##### 【P2】验证列表页默认加载

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入模块A -> 页面A | 页面加载正常 |
| 2 | 查看列表 | 数据显示正确 |

##### 【P3】验证搜索功能

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【模块A → 页面A】页面 | 页面加载完成 |
| 2 | 搜索商品 | 搜索结果正确显示 |

##### 验证新增功能

> 前置条件
- 已配置数据源

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【模块A → 新增页】页面，等待表单加载完成 | 新增表单展示 |
| 2 | 填写名称、选择类型、输入描述，点击【保存】 | 提示操作成功 |

##### 【P1】验证删除功能

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【模块A → 列表页】页面，等待列表加载完成 | 列表展示数据 |
| 2 | 选择某个记录，点击【删除】 | 弹出确认弹窗 |
| 3 | 点击确认 | 提示删除成功，列表刷新 |
```

- [ ] **Step 2: Create sample format-checker JSON report matching the archive**

```json
{
  "verdict": "fail",
  "round": 1,
  "max_rounds": 5,
  "total_cases": 4,
  "issues_count": 8,
  "issues": [
    {
      "rule": "FC02",
      "rule_name": "首步格式",
      "case_title": "【P2】验证列表页默认加载",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "step",
      "step_number": 1,
      "current": "进入模块A -> 页面A",
      "problem": "导航路径缺少【】包裹，使用 '->' 而非 '→'，缺少等待条件",
      "expected_pattern": "进入【模块A → 页面A】页面，等待列表数据加载完成",
      "severity": "hard_violation"
    },
    {
      "rule": "FC04",
      "rule_name": "模糊词",
      "case_title": "【P2】验证列表页默认加载",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "expected",
      "step_number": 1,
      "current": "页面加载正常",
      "problem": "预期结果包含模糊词「正常」",
      "expected_pattern": "页面加载完成，列表显示 N 条数据",
      "severity": "hard_violation"
    },
    {
      "rule": "FC06",
      "rule_name": "预期可断言",
      "case_title": "【P2】验证列表页默认加载",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "expected",
      "step_number": 2,
      "current": "数据显示正确",
      "problem": "预期结果使用空洞表述「显示正确」，无法转为 expect() 断言",
      "expected_pattern": "列表展示 N 条记录，表头包含「名称」「类型」「创建时间」列",
      "severity": "hard_violation"
    },
    {
      "rule": "FC01",
      "rule_name": "标题格式",
      "case_title": "【P3】验证搜索功能",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "title",
      "step_number": null,
      "current": "【P3】验证搜索功能",
      "problem": "优先级 P3 不在允许范围内（仅允许 P0/P1/P2）",
      "expected_pattern": "【P0】验证... 或 【P1】验证... 或 【P2】验证...",
      "severity": "hard_violation"
    },
    {
      "rule": "FC07",
      "rule_name": "步骤三要素",
      "case_title": "【P3】验证搜索功能",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "step",
      "step_number": 2,
      "current": "搜索商品",
      "problem": "缺少操作位置、操作对象、具体值三要素",
      "expected_pattern": "在页面顶部搜索栏的「商品名称」输入框中输入\"2026春季运动鞋\"，点击【搜索】按钮，等待列表刷新完成",
      "severity": "hard_violation"
    },
    {
      "rule": "FC01",
      "rule_name": "标题格式",
      "case_title": "验证新增功能",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "title",
      "step_number": null,
      "current": "验证新增功能",
      "problem": "标题缺少优先级前缀【Px】",
      "expected_pattern": "【P1】验证新增功能",
      "severity": "hard_violation"
    },
    {
      "rule": "FC09",
      "rule_name": "前置条件操作化",
      "case_title": "验证新增功能",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "precondition",
      "step_number": null,
      "current": "已配置数据源",
      "problem": "前置条件使用「已配置」模糊表述，未说明在哪个页面、如何配置",
      "expected_pattern": "在【系统管理 → 数据源管理】页面已新增 Doris 数据源（host=10.0.0.1, port=9030, database=qa_test）",
      "severity": "hard_violation"
    },
    {
      "rule": "FC05",
      "rule_name": "测试数据真实性",
      "case_title": "【P1】验证删除功能",
      "location": {
        "module": "模块A",
        "page": "页面A",
        "group": "功能点A"
      },
      "field": "step",
      "step_number": 2,
      "current": "选择某个记录，点击【删除】",
      "problem": "「某个记录」未指定具体对象名称",
      "expected_pattern": "在列表中勾选「2026春季新款运动鞋」记录，点击操作列的【删除】按钮",
      "severity": "hard_violation"
    }
  ],
  "summary": "共检查 4 条用例，发现 8 处偏差（FC01: 2, FC02: 1, FC04: 1, FC05: 1, FC06: 1, FC07: 1, FC09: 1）。verdict: fail。"
}
```

- [ ] **Step 3: Commit fixtures**

```bash
git add .claude/scripts/__tests__/fixtures/sample-format-report.json .claude/scripts/__tests__/fixtures/sample-archive-with-issues.md
git commit -m "test: add fixtures for format-report-locator"
```

---

## Task 4: Create format-report-locator.ts (TDD)

**Files:**
- Create: `.claude/scripts/__tests__/format-report-locator.test.ts`
- Create: `.claude/scripts/format-report-locator.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const FIXTURE_REPORT = join(
  import.meta.dirname,
  "fixtures/sample-format-report.json",
);
const FIXTURE_ARCHIVE = join(
  import.meta.dirname,
  "fixtures/sample-archive-with-issues.md",
);
const TMP_DIR = join(tmpdir(), `qa-flow-format-locator-test-${process.pid}`);

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(
      "bun",
      ["run", ".claude/scripts/format-report-locator.ts", ...args],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
      },
    );
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      code: e.status ?? 1,
    };
  }
}

before(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

after(() => {
  try {
    rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// ─── locate subcommand ──────────────────────────────────────────────────────

describe("format-report-locator.ts locate — maps issues to line numbers", () => {
  it("exits with code 0 and outputs enriched JSON", () => {
    const outputPath = join(TMP_DIR, "enriched-report.json");
    const { code, stdout, stderr } = run([
      "locate",
      "--report",
      FIXTURE_REPORT,
      "--archive",
      FIXTURE_ARCHIVE,
      "--output",
      outputPath,
    ]);
    assert.equal(code, 0, `stderr: ${stderr}`);

    const result = JSON.parse(stdout) as {
      total_issues: number;
      located: number;
      unlocated: number;
      output_path: string;
    };
    assert.equal(result.total_issues, 8);
    assert.ok(result.located > 0, "should locate at least some issues");
    assert.ok(
      result.output_path.endsWith("enriched-report.json"),
      "output path should match",
    );
  });

  it("enriched JSON contains line numbers for located issues", () => {
    const outputPath = join(TMP_DIR, "enriched-report-2.json");
    run([
      "locate",
      "--report",
      FIXTURE_REPORT,
      "--archive",
      FIXTURE_ARCHIVE,
      "--output",
      outputPath,
    ]);

    const enriched = JSON.parse(readFileSync(outputPath, "utf8")) as {
      issues: Array<{ rule: string; location: { line: number } }>;
    };

    // The first issue (FC02 on "验证列表页默认加载" step 1) should have a positive line number
    const fc02Issue = enriched.issues.find(
      (i) => i.rule === "FC02" && i.location.line > 0,
    );
    assert.ok(fc02Issue, "FC02 issue should have a located line number");
  });

  it("handles case title matching for title-level issues", () => {
    const outputPath = join(TMP_DIR, "enriched-report-3.json");
    run([
      "locate",
      "--report",
      FIXTURE_REPORT,
      "--archive",
      FIXTURE_ARCHIVE,
      "--output",
      outputPath,
    ]);

    const enriched = JSON.parse(readFileSync(outputPath, "utf8")) as {
      issues: Array<{
        rule: string;
        case_title: string;
        location: { line: number };
      }>;
    };

    // FC01 on "验证新增功能" (missing priority prefix) should locate the ##### heading
    const fc01Issue = enriched.issues.find(
      (i) => i.rule === "FC01" && i.case_title === "验证新增功能",
    );
    assert.ok(fc01Issue, "FC01 issue for missing prefix should exist");
    assert.ok(
      fc01Issue.location.line > 0,
      "should have a positive line number",
    );
  });
});

// ─── error handling ─────────────────────────────────────────────────────────

describe("format-report-locator.ts error handling", () => {
  it("exits with code 1 when report file is missing", () => {
    const { code, stderr } = run([
      "locate",
      "--report",
      "/nonexistent/report.json",
      "--archive",
      FIXTURE_ARCHIVE,
      "--output",
      join(TMP_DIR, "out.json"),
    ]);
    assert.equal(code, 1);
    assert.ok(stderr.includes("Failed to read"), "should report read error");
  });

  it("exits with code 1 when archive file is missing", () => {
    const { code, stderr } = run([
      "locate",
      "--report",
      FIXTURE_REPORT,
      "--archive",
      "/nonexistent/archive.md",
      "--output",
      join(TMP_DIR, "out.json"),
    ]);
    assert.equal(code, 1);
    assert.ok(stderr.includes("Failed to read"), "should report read error");
  });
});

// ─── terminal report ────────────────────────────────────────────────────────

describe("format-report-locator.ts print — terminal-readable report", () => {
  it("outputs formatted terminal report to stdout", () => {
    const { code, stdout } = run([
      "print",
      "--report",
      FIXTURE_REPORT,
      "--archive",
      FIXTURE_ARCHIVE,
    ]);
    assert.equal(code, 0);

    // Should contain the report header
    assert.match(stdout, /Format Check Report/, "should have report header");
    // Should contain rule codes
    assert.match(stdout, /\[FC02\]/, "should reference FC02");
    // Should contain file:line references
    assert.match(stdout, /:\d+/, "should have line number references");
    // Should contain summary section
    assert.match(stdout, /Summary/, "should have summary section");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test .claude/scripts/__tests__/format-report-locator.test.ts`
Expected: FAIL — script file does not exist

- [ ] **Step 3: Implement format-report-locator.ts**

```typescript
#!/usr/bin/env bun
/**
 * format-report-locator.ts — Maps format-checker issues to Archive MD line numbers.
 *
 * Usage:
 *   bun run .claude/scripts/format-report-locator.ts locate --report <json> --archive <md> --output <json>
 *   bun run .claude/scripts/format-report-locator.ts print --report <json> --archive <md>
 *   bun run .claude/scripts/format-report-locator.ts --help
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { Command } from "commander";

// ─── Types ───────────────────────────────────────────────────────────────────

interface IssueLocation {
  module: string;
  page: string;
  group: string;
  line: number;
}

interface FormatIssue {
  rule: string;
  rule_name: string;
  case_title: string;
  location: IssueLocation;
  field: string;
  step_number: number | null;
  current: string;
  problem: string;
  expected_pattern: string;
  severity: string;
}

interface FormatReport {
  verdict: string;
  round: number;
  max_rounds: number;
  total_cases: number;
  issues_count: number;
  issues: FormatIssue[];
  summary: string;
}

interface CaseIndex {
  title: string;
  line: number;
  stepLines: Map<number, number>;
}

interface LocateResult {
  total_issues: number;
  located: number;
  unlocated: number;
  output_path: string;
}

// ─── MD Parser ───────────────────────────────────────────────────────────────

function buildCaseIndex(mdContent: string): Map<string, CaseIndex> {
  const lines = mdContent.split("\n");
  const index = new Map<string, CaseIndex>();

  let currentCase: CaseIndex | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match ##### case titles (with or without priority prefix)
    const caseMatch = line.match(/^#{5}\s+(.+)$/);
    if (caseMatch) {
      const title = caseMatch[1].trim();
      currentCase = {
        title,
        line: lineNum,
        stepLines: new Map(),
      };
      index.set(title, currentCase);
      continue;
    }

    // Match table rows: | 编号 | 步骤 | 预期 |
    if (currentCase && line.match(/^\|\s*\d+\s*\|/)) {
      const stepMatch = line.match(/^\|\s*(\d+)\s*\|/);
      if (stepMatch) {
        const stepNum = parseInt(stepMatch[1], 10);
        currentCase.stepLines.set(stepNum, lineNum);
      }
    }
  }

  return index;
}

function locateLine(
  caseIndex: Map<string, CaseIndex>,
  issue: FormatIssue,
): number {
  const entry = caseIndex.get(issue.case_title);
  if (!entry) return -1;

  // Title-level issues
  if (issue.field === "title" || issue.step_number === null) {
    return entry.line;
  }

  // Step/expected-level issues
  const stepLine = entry.stepLines.get(issue.step_number);
  return stepLine ?? entry.line;
}

// ─── Terminal Report ─────────────────────────────────────────────────────────

function formatTerminalReport(
  report: FormatReport,
  enrichedIssues: FormatIssue[],
  archiveName: string,
): string {
  const lines: string[] = [];
  const verdict = report.verdict.toUpperCase();

  lines.push(
    "+--------------------------------------------------+",
  );
  lines.push(
    `|  Format Check Report -- Round ${report.round}/${report.max_rounds}  ·  ${verdict}`.padEnd(
      51,
    ) + "|",
  );
  lines.push(
    `|  ${report.issues_count} issues in ${report.total_cases} cases`.padEnd(
      51,
    ) + "|",
  );
  lines.push(
    "+--------------------------------------------------+",
  );
  lines.push("");

  for (const issue of enrichedIssues) {
    const lineRef =
      issue.location.line > 0 ? `:${issue.location.line}` : "";
    lines.push(
      `[${issue.rule}] ${issue.rule_name}  -- ${archiveName}${lineRef}`,
    );
    lines.push(`  用例：${issue.case_title}`);

    if (issue.step_number !== null) {
      const fieldLabel = issue.field === "expected" ? "预期" : "";
      lines.push(
        `  步骤 ${issue.step_number} ${fieldLabel}> ${issue.current}`,
      );
    } else if (issue.field === "precondition") {
      lines.push(`  前置条件 > ${issue.current}`);
    } else {
      lines.push(`  标题 > ${issue.current}`);
    }

    lines.push(`  问题：${issue.problem}`);
    lines.push(`  期望：${issue.expected_pattern}`);
    lines.push("");
  }

  // Summary by rule
  const ruleCounts = new Map<string, { name: string; count: number }>();
  for (const issue of enrichedIssues) {
    const existing = ruleCounts.get(issue.rule);
    if (existing) {
      existing.count++;
    } else {
      ruleCounts.set(issue.rule, { name: issue.rule_name, count: 1 });
    }
  }

  lines.push("-- Summary ------------------------------------------------");
  for (const [code, { name, count }] of ruleCounts) {
    lines.push(`${code} ${name.padEnd(14)} x${count}`);
  }

  return lines.join("\n");
}

// ─── Commands ────────────────────────────────────────────────────────────────

function readReport(reportPath: string): FormatReport {
  const absPath = resolve(reportPath);
  try {
    return JSON.parse(readFileSync(absPath, "utf8")) as FormatReport;
  } catch (err) {
    process.stderr.write(
      `[format-report-locator] Failed to read report: ${err}\n`,
    );
    process.exit(1);
  }
}

function readArchive(archivePath: string): string {
  const absPath = resolve(archivePath);
  try {
    return readFileSync(absPath, "utf8");
  } catch (err) {
    process.stderr.write(
      `[format-report-locator] Failed to read archive: ${err}\n`,
    );
    process.exit(1);
  }
}

function enrichIssues(
  report: FormatReport,
  mdContent: string,
): FormatIssue[] {
  const caseIndex = buildCaseIndex(mdContent);
  return report.issues.map((issue) => ({
    ...issue,
    location: {
      ...issue.location,
      line: locateLine(caseIndex, issue),
    },
  }));
}

async function runLocate(opts: {
  report: string;
  archive: string;
  output: string;
}): Promise<void> {
  const report = readReport(opts.report);
  const mdContent = readArchive(opts.archive);
  const enrichedIssues = enrichIssues(report, mdContent);

  const enrichedReport: FormatReport = {
    ...report,
    issues: enrichedIssues,
  };

  const outputPath = resolve(opts.output);
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  writeFileSync(outputPath, JSON.stringify(enrichedReport, null, 2), "utf8");

  const located = enrichedIssues.filter(
    (i) => i.location.line > 0,
  ).length;
  const result: LocateResult = {
    total_issues: report.issues_count,
    located,
    unlocated: report.issues_count - located,
    output_path: outputPath,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function runPrint(opts: {
  report: string;
  archive: string;
}): Promise<void> {
  const report = readReport(opts.report);
  const mdContent = readArchive(opts.archive);
  const enrichedIssues = enrichIssues(report, mdContent);
  const archiveName = basename(opts.archive);

  const output = formatTerminalReport(report, enrichedIssues, archiveName);
  process.stdout.write(`${output}\n`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("format-report-locator")
    .description(
      "Map format-checker issues to Archive MD line numbers",
    );

  program
    .command("locate")
    .description(
      "Enrich format-checker report with line numbers from Archive MD",
    )
    .requiredOption("--report <path>", "Path to format-checker JSON report")
    .requiredOption("--archive <path>", "Path to Archive MD file")
    .requiredOption("--output <path>", "Path to write enriched JSON report")
    .action(
      async (opts: { report: string; archive: string; output: string }) => {
        await runLocate(opts);
      },
    );

  program
    .command("print")
    .description("Print terminal-readable format check report")
    .requiredOption("--report <path>", "Path to format-checker JSON report")
    .requiredOption("--archive <path>", "Path to Archive MD file")
    .action(async (opts: { report: string; archive: string }) => {
      await runPrint(opts);
    });

  program.parse(process.argv);
}

main().catch((err) => {
  process.stderr.write(
    `[format-report-locator] Unexpected error: ${err}\n`,
  );
  process.exit(1);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test .claude/scripts/__tests__/format-report-locator.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite to check no regressions**

Run: `bun test .claude/scripts/__tests__`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add .claude/scripts/format-report-locator.ts .claude/scripts/__tests__/format-report-locator.test.ts
git commit -m "feat: add format-report-locator script with line-number mapping"
```

---

## Task 5: Update SKILL.md — insert node 6.5 format-check

**Files:**
- Modify: `.claude/skills/test-case-gen/SKILL.md:430-470` (between node 6 review and node 7 output)

- [ ] **Step 1: Insert node 6.5 after the review node's 交互点 D**

After the existing 交互点 D section (around line 468) and before `## 节点 7: output`, insert:

```markdown
---

## 节点 6.5: format-check — 格式合规检查闭环

**目标**：确保 Writer 产出的用例在格式层面严格符合 R01-R11 编写规范，零偏差才放行。

### 6.5.1 生成临时 Archive MD

```bash
bun run .claude/scripts/archive-gen.ts convert \
  --input {{review_json}} \
  --output workspace/archive/{{YYYYMM}}/tmp/{{name}}-format-check.md
```

### 6.5.2 格式合规检查（AI 任务）

读取 `${CLAUDE_SKILL_DIR}/prompts/format-checker.md` 作为 Format Checker 提示词。

输入：
- 临时 Archive MD 文件内容
- 当前轮次信息：`第 {{round}} 轮 / 最大 {{max_rounds}} 轮`
- 上一轮偏差报告（第 2 轮起）

Format Checker 输出结构化 JSON 偏差报告。

### 6.5.3 行号定位

```bash
bun run .claude/scripts/format-report-locator.ts locate \
  --report {{format_checker_json}} \
  --archive workspace/archive/{{YYYYMM}}/tmp/{{name}}-format-check.md \
  --output workspace/archive/{{YYYYMM}}/tmp/{{name}}-format-enriched.json
```

可选：终端可读报告

```bash
bun run .claude/scripts/format-report-locator.ts print \
  --report {{format_checker_json}} \
  --archive workspace/archive/{{YYYYMM}}/tmp/{{name}}-format-check.md
```

### 6.5.4 Verdict 判定

- `verdict === "pass"` → 进入节点 7（output）
- `verdict === "fail"` 且 `round < max_rounds` → 进入修正循环（6.5.5）
- `verdict === "fail"` 且 `round >= max_rounds` → 交互点 D2（超限决策）

### 6.5.5 修正循环

1. 将偏差报告转为 `## FORMAT_ISSUES` 块
2. 派发 Writer Sub-Agent 修正报告中列出的用例（仅修正偏差用例，其余原样保留）
3. Writer 输出修正后的 JSON
4. 读取 `${CLAUDE_SKILL_DIR}/prompts/reviewer.md` 对修正后的 JSON 执行 F07-F15 设计逻辑复审
5. 回到 6.5.1 重新生成临时 Archive MD → 6.5.2 再检

### 6.5.6 更新状态

每轮循环后更新状态：

```bash
bun run .claude/scripts/state.ts update --prd-slug {{slug}} --node format-check --data '{{json}}'
```

数据结构：

```json
{
  "format_check": {
    "current_round": 2,
    "max_rounds": 5,
    "issues_history": [8, 3],
    "verdict": "fail"
  }
}
```

### 交互点 D2 — 格式检查超限决策（使用 AskUserQuestion 工具）

当 format-check 循环达到最大轮次但仍有偏差时触发：

使用 AskUserQuestion 工具向用户展示：

- 问题：`格式检查已执行 {{max_rounds}} 轮，仍有 {{n}} 处偏差未修正。如何处理？`
- 选项 1：强制输出（忽略剩余偏差）
- 选项 2：查看未修正项详情
- 选项 3：人工修正后继续
```

- [ ] **Step 2: Update the 运行模式 table to document --quick mode behavior**

In the 运行模式 table (around line 26-33), add a note to the 快速 row:

Change the 快速 row's 行为差异 column from:
```
跳过交互点 B/C，analyze 简化，review 仅 1 轮
```
to:
```
跳过交互点 B/C，analyze 简化，review 仅 1 轮，format-check 最多 2 轮
```

- [ ] **Step 3: Update the state structure in 断点续传说明**

In the 断点续传说明 section (around line 553-567), add `format_check` to the state structure JSON:

After the `"review"` field, add:

```json
"format_check": { "current_round": 0, "max_rounds": 5, "issues_history": [], "verdict": "" },
```

- [ ] **Step 4: Update current_node enum in state structure**

In the state structure comment, update `current_node` to include `format-check`:

```json
"current_node": "transform|enhance|analyze|write|review|format-check|output",
```

- [ ] **Step 5: Verify SKILL.md consistency**

Read the modified file and check:
1. Node 6.5 appears between node 6 (review) and node 7 (output)
2. The flow described references correct script names and paths
3. --quick mode mentions 2-round limit
4. State structure includes format_check
5. No orphaned references to old node numbering

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/test-case-gen/SKILL.md
git commit -m "feat: insert format-check node 6.5 with feedback loop orchestration"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `bun test .claude/scripts/__tests__`
Expected: All tests pass, no regressions

- [ ] **Step 2: Verify all new/modified files exist**

```bash
ls -la .claude/skills/test-case-gen/prompts/format-checker.md
ls -la .claude/scripts/format-report-locator.ts
ls -la .claude/scripts/__tests__/format-report-locator.test.ts
ls -la .claude/scripts/__tests__/fixtures/sample-format-report.json
ls -la .claude/scripts/__tests__/fixtures/sample-archive-with-issues.md
```

Expected: All 5 files exist

- [ ] **Step 3: Spot-check reviewer.md has no F01-F06**

Run: `grep -n "### F0[1-6]" .claude/skills/test-case-gen/prompts/reviewer.md`
Expected: No matches (exit code 1)

- [ ] **Step 4: Spot-check SKILL.md has node 6.5**

Run: `grep -n "format-check" .claude/skills/test-case-gen/SKILL.md`
Expected: Multiple matches in the new node 6.5 section

- [ ] **Step 5: Commit verification**

No commit needed — this is a verification step only.
