# Token 消耗优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过提取共享 reference、新增预处理脚本、精简 agent/skill 提示词、优化数据流，将 qa-flow 全部工作流的 token 消耗降低 30-40%。

**Architecture:** 四层实施——先创建 `.claude/references/` 共享文档（单一权威源），再批量更新 14 个 agent 和 3 个核心 skill 的提示词改为引用，然后实现 6 个新脚本替代 LLM 重复工作，最后优化数据流（缓存/分类传递/预过滤）。

**Tech Stack:** TypeScript (Bun runtime), Commander CLI, node:fs/node:path, bun:test

---

## Layer 1: Reference 文档

### Task 1: 创建 test-case-standards.md

**Files:**
- Create: `.claude/references/test-case-standards.md`

- [ ] **Step 1: 创建 references 目录和文件**

```bash
mkdir -p .claude/references
```

- [ ] **Step 2: 编写 test-case-standards.md**

从三个 agent 中提取并合并规则，去重后按统一格式编排。规则来源：
- `writer-agent.md` R01-R11（lines 76-275）
- `reviewer-agent.md` F07-F15（lines 26-103）
- `format-checker-agent.md` FC01-FC11（lines 40-178）

文件结构：

```markdown
# 测试用例编写标准

> 本文件是 FC/R/F 系列规则的单一权威源。所有 agent 通过引用本文件获取规则定义。

## 一、标题与结构规则

### R01 / FC01: 用例标题契约

- 中间 JSON 标题字段：`title=验证xxx`，`priority` 字段独立（`P0`/`P1`/`P2`）
- Archive MD 展示标题：`【P0】验证xxx`
- 正则校验：`^【P[012]】验证.+`
- 标题概括测试目的，不包含具体操作步骤

### R03 / FC03: 步骤编号

- 禁止步骤内容中出现编号前缀
- 正则检测：`^(步骤|Step)\s*\d+\s*[:：]`
- 编号由输出格式的 `step_number` 字段控制

## 二、步骤精度规则

### R02 / FC02: 首步格式 + 步骤精度

**首步要求：**
- 必须以「进入【完整导航路径】页面」开头
- 正则：`^进入【[^】]+】页面`
- 导航路径层级用 `→`（全角）连接，禁止 `->` 或 `>`
- 末尾必须包含等待条件

**每步三要素（R02 / FC07）：**

| 要素 | 说明 | 示例 |
|------|------|------|
| 操作位置 | 控件所在区域 | 页面顶部搜索栏 / 表单区 / 表格操作列 |
| 操作对象 | 字段名 + 控件类型 | 「商品名称」输入框 / 【提交】按钮 |
| 操作动作 + 具体值 | 动作 + 输入内容 | 输入"2026春季新款运动鞋" / 点击 |

**异步等待条件（FC10）：**

| 操作类型 | 等待条件示例 |
|----------|-------------|
| 导航/跳转 | `等待列表数据加载完成` |
| 搜索/筛选 | `等待列表刷新完成` |
| 提交/保存 | `等待提交请求完成，页面跳转回列表页` |
| 弹窗操作 | `等待弹窗完全展开` |

## 三、内容质量规则

### R04 / FC04: 禁止模糊词（语义类）

| 模糊词 | 正则 |
|--------|------|
| 尝试 | `尝试` |
| 相关 | `相关` |
| 如/比如 | `[，,、]如[：:「]` 或 `比如` |
| 等 | `[，,]等[。，,]` 或 `等$` |
| 某个/某些 | `某[个些]` |
| 适当的 | `适当的` |
| 正常的 | `正常的`（含预期结果中的「正常加载」「正常显示」等） |

### FC05: 测试数据真实性

- 禁止占位符：`test1`、`test123`、`abc`、`xxx`、`123456`、`asdf`、`样例数据`、`测试数据`
- 语义检查：「选择一个」「找到某个」等不指定具体对象的表述

### R05 / FC06: 预期结果可断言化（语义类）

- 预期结果必须是 Playwright 可翻译为 `expect()` 的具体表现
- 禁止词：`操作成功`、`显示正确`、`提交失败`、`加载正常`、`数据正确`、`功能正常`、`展示正确`、`信息正确`、`配置正确`
- 须给出可观测表现（具体文案、数值、元素状态）

### FC09: 前置条件操作化

- 前置条件须描述**如何达到该状态**
- 禁止：`已配置xxx`、`系统中已有xxx数据`、`已登录系统`、`已创建xxx`
- 数据表场景须包含可执行 SQL（`DROP TABLE IF EXISTS` + `INSERT INTO`）

## 四、格式规范规则

### FC08 / F11 / F09: 表单字段格式

- 同一表单多字段须用 `\n` + `- 字段: 值` 列表格式
- 必填字段标记 `*`
- 禁止所有字段堆在一行用逗号连接

正确格式：
```
在"节点属性"编辑页中按顺序配置如下：
- *上级节点: 财务治理域
- *L2 主题域名称: 预算执行域
- *排序: 15
```

### FC11 / F12: 多项内容编号换行

- 前置条件、预期结果中 3 个及以上并列子项须用 `1)` `2)` 编号换行
- 预期结果禁止「或等价提示」「或类似说明」等模糊兜底

## 五、审查修正规则

### F07: 正向用例合并

- 同一 sub_group 内，`type: "positive"` 且步骤数 < 4 的用例应合并
- 自动修正：合并为综合用例，步骤按操作流顺序衔接，前置条件取并集

### F08: 逆向用例单一性

- `type: "negative"` 用例仅测试一个逆向条件
- 自动修正：拆分为多条独立用例

### F09: 表单字段合并

- 连续单字段输入步骤应合并为一个字段列表步骤
- 自动修正：按页面渲染顺序排列字段

### F10: 前置条件完整性

- 涉及数据表/同步/血缘的用例须有可执行 SQL
- 无法自动生成 → 标记 `[F10-MANUAL]`

### F13: 预期结果模糊兜底

- 正则：`或等[价效][的]?[提示说明表述]`、`或类似`
- 自动修正：删除模糊兜底部分

### F14: 前置条件笼统概括

- 无法自动修正 → 标记 `[F14-MANUAL]`

### F15: 前置条件多步操作闭合

- 多步表单/向导须描述完整直至最终保存
- 无法自动修正 → 标记 `[F15-MANUAL]`

## 六、跨模块去重

- 标题编辑距离 < 30% 视为疑似重复
- 前置条件/页面不同则不视为重复
- 保留更完整的一条

## 七、规则分类索引

### 纯格式规则（可脚本化）

FC01, FC02, FC03, FC05, FC07(三要素-结构检测), FC08, FC09(关键词匹配), FC10, FC11

### 语义规则（需 LLM）

FC04(模糊词上下文判断), FC06(可断言性语义判断), FC07(三要素-语义完整性)

### 审查修正规则

F07, F08, F09, F10, F11, F12, F13, F14, F15
```

注意：以上为完整内容，从三个 agent 中提取合并去重。`R06-R11` 中 writer-agent 独有的规则（如步骤设计流程指导）保留在 writer-agent 中不提取，因为它们是该 agent 特有的工作流指导而非可共享的检查规则。

- [ ] **Step 3: Commit**

```bash
git add .claude/references/test-case-standards.md
git commit -m "chore: extract unified test-case-standards.md reference"
```

---

### Task 2: 创建 output-schemas.json

**Files:**
- Create: `.claude/references/output-schemas.json`

- [ ] **Step 1: 编写 output-schemas.json**

从各 agent 提取 JSON 输出 schema，集中定义。读取以下 agent 的输出格式段落：
- `analyze-agent.md` — test_points 输出
- `writer-agent.md` — writer_json 输出
- `reviewer-agent.md` — review_json 输出
- `format-checker-agent.md` — format_check_json 输出
- `standardize-agent.md` — standardize_json 输出
- `bug-reporter-agent.md` — bug_report_json 输出
- `script-fixer-agent.md` — script_fixer_json 输出
- `backend-bug-agent.md` — backend_bug_json 输出
- `frontend-bug-agent.md` — frontend_bug_json 输出
- `conflict-agent.md` — conflict_json 输出

文件结构为 JSON，每个 key 对应一个 agent 的输出 schema，值为该 schema 的字段描述（不用 JSON Schema 标准，用简洁的字段名+类型+说明格式，便于 agent 阅读）。

具体操作：逐个读取上述 agent 的输出格式段落，提取字段结构，写入 `output-schemas.json`。

- [ ] **Step 2: Commit**

```bash
git add .claude/references/output-schemas.json
git commit -m "chore: extract centralized output-schemas.json reference"
```

---

### Task 3: 创建 error-handling-patterns.md

**Files:**
- Create: `.claude/references/error-handling-patterns.md`

- [ ] **Step 1: 编写 error-handling-patterns.md**

```markdown
# 错误处理模式

> 所有 agent 共享的标准错误分类与恢复策略。Agent 提示词中引用本文件，不再内联错误处理段落。

## 错误分类

| 类型 | 描述 | 恢复策略 |
|------|------|----------|
| invalid_input | 输入格式不合法（JSON 解析失败、必填字段缺失、类型不匹配） | 输出警告，跳过该条目，继续处理剩余条目 |
| blocking_unknown | 无法推断的关键信息（核心业务逻辑不明、依赖上游未提供的数据） | 生成 blocked_envelope 或标记 `[MANUAL]`，中止当前条目 |
| defaultable_unknown | 可推断或有合理默认值的信息（非必填字段、可从上下文推导的值） | 使用默认值并在输出中标记 `[INFERRED]` warning |
| external_failure | 外部依赖失败（文件不存在、网络超时、脚本执行错误） | 重试 1 次，失败则输出错误详情并中止 |
| partial_result | 处理过程中部分条目成功、部分失败 | 输出已成功部分 + 失败条目清单，不丢弃成功结果 |

## Agent 应用规则

1. 遇到错误时先分类，再按对应策略处理
2. 不要静默吞掉错误——至少在输出 JSON 的 `warnings` 数组中记录
3. 不要因单条数据错误终止整个批次（除非是 blocking_unknown 且影响全局）
4. `blocked_envelope` 格式见各 agent 自身定义（因各 agent 的 envelope 结构不同）
```

- [ ] **Step 2: Commit**

```bash
git add .claude/references/error-handling-patterns.md
git commit -m "chore: extract shared error-handling-patterns.md reference"
```

---

### Task 4: 创建 unicode-symbols.md

**Files:**
- Create: `.claude/references/unicode-symbols.md`

- [ ] **Step 1: 编写 unicode-symbols.md**

从 `code-analysis/SKILL.md`(lines 68-98) 和 `backend-bug-agent.md`(line 152) 提取：

```markdown
# Unicode 符号使用规范

> 报告内容可能被粘贴到禅道等系统的富文本编辑器中，部分 Unicode 符号无法保存。

## 允许使用（U+26xx 范围）

仅限模板固定位置（标题、表头、分隔符）使用：

| 符号 | 用途 |
|------|------|
| ⚠️ | 警告、注意事项 |
| ⚙️ | 配置、环境相关 |
| ☑️ | 已完成、已验证 |
| ♻️ | 重构、可重试 |
| ✅ | 通过、正常 |
| ❌ | 失败、异常 |
| ☐ | 待办、未完成 |
| ⇒ | 指向、导致 |

## 禁止使用（U+1Fxxx 范围）

所有 emoji 符号绝对禁止：🐛📡🚀🔧📦🧪💡🔴🟢📊📁📝🕐📄🏷📍🔀⚡👤🤖 等。

## AI 填充数据约束

AI 分析后填入模板的**动态数据字段**（root_cause、summary、fix_suggestions、title 等）不得包含任何 emoji 符号，仅使用纯文本。
```

- [ ] **Step 2: Commit**

```bash
git add .claude/references/unicode-symbols.md
git commit -m "chore: extract unicode-symbols.md reference"
```

---

### Task 5: 创建 playwright-patterns.md

**Files:**
- Create: `.claude/references/playwright-patterns.md`

- [ ] **Step 1: 编写 playwright-patterns.md**

从 `script-writer-agent.md`(lines 163-227) 和 `ui-autotest/SKILL.md`(lines 112-131) 提取：

```markdown
# Playwright 最佳实践

> script-writer-agent 和 script-fixer-agent 共享的 Playwright 编码规范。

## 定位器优先级

1. `getByRole('button', { name: '提交' })` — 语义定位，首选
2. `getByLabel('商品名称')` — 表单字段
3. `getByTestId('submit-btn')` — data-testid
4. CSS 选择器 — 最后手段，须加注释说明原因

## step() 函数规范

每个测试步骤用 `test.step()` 包裹：

```typescript
await test.step('在搜索栏输入商品名称', async () => {
  await page.getByLabel('商品名称').fill('2026春季运动鞋');
});
```

参数：`name`（步骤描述）、`body`（async 函数）。

## 常见 UI 模式

### 表单填写

```typescript
await test.step('填写商品基本信息', async () => {
  await page.getByLabel('商品名称').fill('2026春季运动鞋');
  await page.getByLabel('商品分类').click();
  await page.getByRole('option', { name: '运动鞋' }).click();
  await page.getByLabel('售价').fill('299.00');
});
```

### 表格验证

```typescript
await test.step('验证列表数据', async () => {
  const rows = page.getByRole('row');
  await expect(rows).toHaveCount(11); // header + 10 data rows
  await expect(rows.nth(1).getByRole('cell').first()).toHaveText('2026春季运动鞋');
});
```

## 等待策略

- 导航后：`await page.waitForLoadState('networkidle')` 或等待特定元素
- 提交后：`await page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200)`
- 弹窗：`await expect(page.getByRole('dialog')).toBeVisible()`

## Meta 注释格式

每个测试文件头部：

```typescript
// @meta case_id: t1
// @meta title: 验证商品列表页默认加载
// @meta priority: P0
// @meta archive: workspace/project/archive/xxx.md
```
```

- [ ] **Step 2: Commit**

```bash
git add .claude/references/playwright-patterns.md
git commit -m "chore: extract playwright-patterns.md reference"
```

---

## Layer 2: Agent / Skill 提示词瘦身

### Task 6: 瘦身 writer-agent.md

**Files:**
- Modify: `.claude/agents/writer-agent.md`

- [ ] **Step 1: 读取当前文件全文**

```bash
cat -n .claude/agents/writer-agent.md | head -520
```

确认规则段落（R01-R11 约 lines 76-275）、JSON schema 段落、错误处理段落的精确行范围。

- [ ] **Step 2: 替换 R01-R11 规则段落**

将 lines 76-275 的完整规则详述替换为引用：

```markdown
## 硬性规则

完整规则定义参见 `.claude/references/test-case-standards.md`，以下仅列出规则 ID 供快速索引：

- **R01/FC01**: 用例标题契约（Contract A）
- **R02/FC02**: 首步格式 + 步骤三要素
- **R03/FC03**: 步骤编号禁止前缀
- **R04/FC04**: 禁止模糊词
- **R05/FC06**: 预期结果可断言化
- **FC05**: 测试数据真实性
- **FC08/F11/F09**: 表单字段格式
- **FC09**: 前置条件操作化
- **FC10**: 异步等待条件
- **FC11/F12**: 多项内容编号换行
```

- [ ] **Step 3: 替换 JSON schema 段落**

将输出格式的完整 JSON 示例替换为：

```markdown
## 输出格式

参见 `.claude/references/output-schemas.json` 中的 `writer_json` schema。
```

- [ ] **Step 4: 替换错误处理段落**

将错误处理段落替换为：

```markdown
## 错误处理

遵循 `.claude/references/error-handling-patterns.md` 标准模式。Writer 特有补充：遇到 `blocking_unknown` 时生成 `blocked_envelope`（格式见下方）。
```

保留 `blocked_envelope` 格式定义（这是 writer 特有的）。

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/writer-agent.md
git commit -m "refactor: slim writer-agent.md, extract rules/schema/errors to references"
```

---

### Task 7: 瘦身 format-checker-agent.md

**Files:**
- Modify: `.claude/agents/format-checker-agent.md`

- [ ] **Step 1: 读取当前文件全文**

确认 FC01-FC11 规则段落（约 lines 40-178）、JSON 输出格式段落、检查流程段落的精确行范围。

- [ ] **Step 2: 重写规则段落**

删除全部 FC01-FC11 内联规则，替换为：

```markdown
## 检查规则

本 agent 仅处理 `format-check-script.ts` 输出的 `suspect_items`（FC04 模糊词、FC06 可断言性）。

纯格式规则（FC01/FC02/FC03/FC05/FC07-FC11）已由脚本确定性检查，不在本 agent 职责范围内。

完整规则定义参见 `.claude/references/test-case-standards.md`。

### 语义判断指导

**FC04 模糊词**：脚本通过正则匹配捕获疑似模糊词。你需要判断该词在上下文中是否确实模糊。例如：
- 「相关配置」→ 模糊（什么配置？）→ 报告违规
- 「相关 API 返回 404」→ 不模糊（"相关"指代明确的上下文 API）→ 忽略

**FC06 可断言性**：脚本捕获含禁止词的预期结果。你需要判断整句是否可断言。例如：
- 「操作成功」→ 不可断言 → 报告违规
- 「页面顶部显示成功提示"商品已上架"」→ 可断言（具体文案）→ 忽略
```

- [ ] **Step 3: 替换 JSON 输出格式和检查流程**

JSON 输出格式引用 `output-schemas.json`。检查流程精简为：

```markdown
## 检查流程

1. 读取 `format-check-script.ts` 的输出 JSON
2. 遍历 `suspect_items` 数组
3. 对每条 suspect_item 执行语义判断
4. 输出最终判定结果

## 输出格式

参见 `.claude/references/output-schemas.json` 中的 `format_check_json` schema。
```

- [ ] **Step 4: 替换错误处理段落**

```markdown
## 错误处理

遵循 `.claude/references/error-handling-patterns.md` 标准模式。
```

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/format-checker-agent.md
git commit -m "refactor: slim format-checker-agent.md, delegate format rules to script"
```

---

### Task 8: 瘦身 reviewer-agent.md

**Files:**
- Modify: `.claude/agents/reviewer-agent.md`

- [ ] **Step 1: 读取当前文件全文**

确认 F07-F15 规则（约 lines 26-103）、阈值决策树（约 lines 115-131）、JSON 输出格式、错误处理的行范围。

- [ ] **Step 2: 替换 F07-F15 规则段落**

```markdown
## 审查规则

完整规则定义参见 `.claude/references/test-case-standards.md` 第五节「审查修正规则」。

规则索引：F07(正向合并), F08(逆向单一), F09(表单合并), F10(前置条件SQL), F11(表单换行), F12(多项编号), F13(模糊兜底), F14(前置条件笼统), F15(多步闭合)

**自动修正规则**：F07/F08/F09/F11/F12/F13 可自动修正。F10/F14/F15 标记 `[MANUAL]`。

审查后调用 `auto-fixer.ts` 执行确定性修正（F07/F08/F09/F11/F12/F13），Reviewer 仅处理需要语义判断的修正和 MANUAL 标记。
```

- [ ] **Step 3: 精简阈值决策树**

保留表格但精简上下文说明：

```markdown
## 质量门禁

问题率 = 含问题用例数 / 总用例数 × 100%

| 问题率 | 处理 | 输出 |
|--------|------|------|
| < 15% | 静默修正 | 修正后 JSON |
| 15-40% | 修正 + 警告 | 修正后 JSON + 警告 |
| > 40% | 阻断 | 问题报告，等待用户决策 |
```

- [ ] **Step 4: JSON 和错误处理引用化**

```markdown
## 输出格式

参见 `.claude/references/output-schemas.json` 中的 `review_json` schema。

## 错误处理

遵循 `.claude/references/error-handling-patterns.md` 标准模式。
```

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/reviewer-agent.md
git commit -m "refactor: slim reviewer-agent.md, extract rules to references"
```

---

### Task 9: 瘦身 transform-agent.md

**Files:**
- Modify: `.claude/agents/transform-agent.md`

- [ ] **Step 1: 读取当前文件全文**

确认源码搜索指令段落（约 lines 89-138）、历史检索逻辑（约 lines 139-156）、错误处理（约 lines 356-372）。

- [ ] **Step 2: 替换源码搜索为脚本调用**

将手动 grep 指令替换为：

```markdown
### 步骤 2: 源码状态检测

使用 `source-analyze.ts` 批量搜索源码仓库：

```bash
bun run .claude/scripts/source-analyze.ts analyze \
  --repo workspace/{{project}}/.repos/{{repo}} \
  --keywords "{{从PRD提取的关键词,逗号分隔}}" \
  --output json
```

脚本返回结构化结果：`a_level`（精确匹配）和 `b_level`（模糊匹配），直接用于模板填充。
```

- [ ] **Step 3: 替换历史检索为脚本调用**

```markdown
### 步骤 3: 历史用例检索

使用 `search-filter.ts` 搜索并过滤归档用例：

```bash
bun run .claude/scripts/archive-gen.ts search --query "{{关键词}}" --project {{project}} --limit 20 \
  | bun run .claude/scripts/search-filter.ts filter --top 5 --output json
```

仅阅读 top-5 结果的摘要。需深入查看时再 Read 具体文件。
```

- [ ] **Step 4: 错误处理引用化**

```markdown
## 错误处理

遵循 `.claude/references/error-handling-patterns.md` 标准模式。
```

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/transform-agent.md
git commit -m "refactor: slim transform-agent.md, delegate search to scripts"
```

---

### Task 10: 瘦身 script-writer-agent.md

**Files:**
- Modify: `.claude/agents/script-writer-agent.md`

- [ ] **Step 1: 读取当前文件全文**

确认 UI 模式示例（约 lines 163-227）、前置条件工作流（约 lines 247-339）。

- [ ] **Step 2: 替换 UI 模式示例为引用**

```markdown
## Playwright 编码规范

参见 `.claude/references/playwright-patterns.md`，包含定位器优先级、step() 函数用法、表单填写和表格验证模式。
```

- [ ] **Step 3: 精简前置条件工作流**

将 93 行前置条件详述精简为约 15 行核心要点：

```markdown
## 前置条件处理

Archive MD 用例的前置条件中若包含 SQL 或数据准备步骤，须在测试执行前完成。

### 处理流程

1. 从 Archive MD 的 preconditions 中提取 SQL 语句
2. 通过 API 建表：`POST {{url}}/api/xxx` + SQL body
3. 引入数据源（若未引入）
4. 触发同步并等待完成
5. 创建质量项目（若用例涉及质量模块）
6. 项目授权

### 关键 API

具体 API 端点和参数从源码 `workspace/{{project}}/.repos/` 中查找。使用 `page.request` 发送 API 请求，不通过 UI 操作。
```

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/script-writer-agent.md
git commit -m "refactor: slim script-writer-agent.md, extract patterns to references"
```

---

### Task 11: 瘦身其余 9 个 agent

**Files:**
- Modify: `.claude/agents/analyze-agent.md`
- Modify: `.claude/agents/standardize-agent.md`
- Modify: `.claude/agents/enhance-agent.md`
- Modify: `.claude/agents/script-fixer-agent.md`
- Modify: `.claude/agents/backend-bug-agent.md`
- Modify: `.claude/agents/frontend-bug-agent.md`
- Modify: `.claude/agents/conflict-agent.md`
- Modify: `.claude/agents/hotfix-case-agent.md`
- Modify: `.claude/agents/bug-reporter-agent.md`

- [ ] **Step 1: analyze-agent.md**

读取全文。变更：
- 7 维度头脑风暴精简为维度名 + 核心要点（每维度 1-2 行，删除详细说明段落）
- JSON schema 引用化：`参见 output-schemas.json 中的 test_points_json`
- 错误处理引用化

- [ ] **Step 2: standardize-agent.md**

读取全文。变更：
- 规则引用化：`参见 .claude/references/test-case-standards.md`（与 writer 共享 R01-R11）
- JSON schema 引用化
- 错误处理引用化

- [ ] **Step 3: enhance-agent.md**

读取全文。变更：
- 错误处理引用化
- 健康度检查表（W001-W008）保留（这是 enhance 特有的，不提取）

- [ ] **Step 4: script-fixer-agent.md**

读取全文。变更：
- Playwright 模式引用：`参见 .claude/references/playwright-patterns.md`
- JSON schema 引用化
- 删除与 script-writer-agent 重复的定位器优先级说明

- [ ] **Step 5: backend-bug-agent.md + frontend-bug-agent.md + conflict-agent.md + hotfix-case-agent.md**

每个文件：
- 符号规则替换为：`符号使用遵循 .claude/references/unicode-symbols.md`
- 错误处理引用化
- JSON schema 引用化

- [ ] **Step 6: bug-reporter-agent.md**

- 错误处理引用化
- JSON schema 引用化
- 严重程度映射表保留（agent 特有，不提取）

- [ ] **Step 7: Commit**

```bash
git add .claude/agents/*.md
git commit -m "refactor: slim remaining 9 agents, extract shared content to references"
```

---

### Task 12: 瘦身 test-case-gen/SKILL.md

**Files:**
- Modify: `.claude/skills/test-case-gen/SKILL.md`

- [ ] **Step 1: 读取当前文件全文**

确认 confirmation_policy（约 lines 59-77）、运行模式表（约 lines 81-101）、Contract A/B 多处重复、JSON 结构示例、偏好加载指令的精确位置。

- [ ] **Step 2: 提取 confirmation_policy**

将 lines 59-77 的规则段落替换为：

```markdown
### 确认策略

参见 `.claude/references/confirmation-policy.json`。核心原则：只在影响产物结构的决策点确认，数据填充类决策自动处理。
```

同时创建 `.claude/references/confirmation-policy.json`，将原规则转为 JSON。

- [ ] **Step 3: 压缩运行模式表**

将 20 行模式表压缩为：

```markdown
### 运行模式

| 模式 | 触发 | 差异 |
|------|------|------|
| normal | 默认 | 完整 7 节点 + 复审 |
| quick | `--quick` | 跳过复审，format-check 仅 1 轮 |
```

- [ ] **Step 4: Contract A/B 去重**

在文件开头保留一次 Contract A/B 定义，后续所有出现处替换为 `（见 Contract A）`。

- [ ] **Step 5: JSON 结构示例引用化**

各节点中的完整 JSON 示例替换为 `参见 output-schemas.json 中的 {key}`。

- [ ] **Step 6: 偏好加载改为脚本调用**

在步骤 0 / init 节点增加：

```markdown
### 偏好预加载

```bash
bun run .claude/scripts/preference-loader.ts load --project {{project}} --output json > workspace/{{project}}/.temp/preferences-merged.json
```

后续节点直接传递此 JSON 给 sub-agent，不再各自读 preferences/ 目录。
```

删除各节点中重复的偏好加载说明。

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/test-case-gen/SKILL.md .claude/references/confirmation-policy.json
git commit -m "refactor: slim test-case-gen SKILL.md, extract shared content"
```

---

### Task 13: 瘦身 ui-autotest/SKILL.md

**Files:**
- Modify: `.claude/skills/ui-autotest/SKILL.md`

- [ ] **Step 1: 读取当前文件全文**

确认 output_contract（约 lines 49-77）、step()示例（约 lines 112-131）、Task 可视化规则（约 lines 63-108）、bun run 命令重复模式。

- [ ] **Step 2: output_contract 和 step() 示例引用化**

```markdown
### 脚本编码规范

参见 `.claude/references/playwright-patterns.md`，包含 step() 函数、Meta 注释、定位器优先级。
```

- [ ] **Step 3: Task 可视化规则提取为统一表**

将分散在各步骤的任务更新规则合并为一张表：

```markdown
### Task Schema

| 时机 | 操作 | subject 格式 |
|------|------|-------------|
| 步骤开始 | `TaskUpdate status=in_progress` | `步骤 N — 开始` |
| 步骤完成 | `TaskUpdate status=completed` | `步骤 N — {{结果摘要}}` |
| 步骤 5 子任务 | 为每条用例创建子任务 | `自测 {{case_id}} — {{title}}` |

各步骤遵循此 schema，不再单独说明。
```

- [ ] **Step 4: 命令别名表**

在文件开头定义：

```markdown
### 命令别名

| 别名 | 完整命令 |
|------|----------|
| `@progress:create` | `bun run .claude/scripts/ui-autotest-progress.ts create --project {{project}} --suite "{{suite}}" ...` |
| `@progress:update` | `bun run .claude/scripts/ui-autotest-progress.ts update --project {{project}} --suite "{{suite}}" ...` |
| `@progress:summary` | `bun run .claude/scripts/ui-autotest-progress.ts summary --project {{project}} --suite "{{suite}}"` |
| `@progress:reset` | `bun run .claude/scripts/ui-autotest-progress.ts reset --project {{project}} --suite "{{suite}}"` |
| `@progress:resume` | `bun run .claude/scripts/ui-autotest-progress.ts resume --project {{project}} --suite "{{suite}}"` |
| `@parse-cases` | `bun run .claude/skills/ui-autotest/scripts/parse-cases.ts --file {{md_path}}` |
| `@merge-specs` | `bun run .claude/skills/ui-autotest/scripts/merge-specs.ts ...` |

步骤中使用别名引用，参数部分按实际值替换。
```

然后在各步骤中用别名替换完整命令。

- [ ] **Step 5: 步骤 5 调试引用精简**

保留核心规则行，删除详细调试流程（已在 script-fixer-agent 中定义）：

```markdown
> **⚠️ 主 agent 上下文保护规则：主 agent 绝不自行调试脚本。** 失败时派发 `script-fixer-agent`，仅传递 `{ error_type, failed_locator, line_number, stderr_last_20_lines }`。详细修复流程见 script-fixer-agent 自身定义。
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/ui-autotest/SKILL.md
git commit -m "refactor: slim ui-autotest SKILL.md, extract patterns and deduplicate"
```

---

### Task 14: 瘦身 code-analysis/SKILL.md

**Files:**
- Modify: `.claude/skills/code-analysis/SKILL.md`

- [ ] **Step 1: 读取当前文件全文**

确认符号使用规则（约 lines 68-98）、确认提示模板（约 lines 131-147）。

- [ ] **Step 2: 符号规则引用化**

将 lines 68-98 替换为：

```markdown
## 符号使用规则

参见 `.claude/references/unicode-symbols.md`。所有报告输出必须遵守。
```

- [ ] **Step 3: 确认提示模板精简**

保留功能但删除完整示例文本，改为格式说明：

```markdown
确认提示格式：`确认 [模式名] 分析 → 目标: [描述] → 来源: [输入来源]`。用户确认后继续。
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/code-analysis/SKILL.md
git commit -m "refactor: slim code-analysis SKILL.md, extract unicode-symbols reference"
```

---

## Layer 3: 新增脚本

### Task 15: 实现 preference-loader.ts

**Files:**
- Create: `.claude/scripts/preference-loader.ts`
- Create: `.claude/scripts/__tests__/preference-loader.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
// .claude/scripts/__tests__/preference-loader.test.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";

const TMP_DIR = join(tmpdir(), `qa-flow-prefloader-test-${process.pid}`);
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

function run(
  args: string[],
  extraEnv: Record<string, string> = {},
): { stdout: string; code: number } {
  try {
    const stdout = execFileSync(
      "bun",
      ["run", ".claude/scripts/preference-loader.ts", ...args],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          WORKSPACE_DIR: join(TMP_DIR, "workspace"),
          QA_PREFERENCES_DIR: join(TMP_DIR, "preferences"),
          ...extraEnv,
        },
      },
    );
    return { stdout, code: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? "", code: e.status ?? 1 };
  }
}

describe("preference-loader", () => {
  before(() => {
    // Global preferences
    const globalDir = join(TMP_DIR, "preferences");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "case-writing.md"),
      "# 用例编写偏好\n\nrule_a: global_value\nrule_b: global_only",
    );
    // Project preferences (override rule_a)
    const projDir = join(TMP_DIR, "workspace", "testProj", "preferences");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(
      join(projDir, "case-writing.md"),
      "# 用例编写偏好\n\nrule_a: project_override",
    );
  });

  after(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("loads and merges preferences with project > global priority", () => {
    const { stdout, code } = run(["load", "--project", "testProj"]);
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result["case-writing"].rule_a, "project_override");
    assert.equal(result["case-writing"].rule_b, "global_only");
  });

  it("loads global-only when project has no preferences", () => {
    const { stdout, code } = run(["load", "--project", "noSuchProj"]);
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result["case-writing"].rule_a, "global_value");
  });

  it("returns empty object when no preferences exist", () => {
    const { stdout, code } = run(["load", "--project", "empty"], {
      QA_PREFERENCES_DIR: join(TMP_DIR, "no-such-dir"),
    });
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.deepEqual(result, {});
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
bun test .claude/scripts/__tests__/preference-loader.test.ts
```

Expected: FAIL（脚本不存在）

- [ ] **Step 3: 实现 preference-loader.ts**

```typescript
#!/usr/bin/env bun
/**
 * preference-loader.ts — 一次性加载并合并多级偏好，输出 JSON。
 *
 * Usage:
 *   bun run .claude/scripts/preference-loader.ts load --project <name>
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Command } from "commander";
import { initEnv, getEnv } from "./lib/env.ts";
import { projectPreferencesDir, repoRoot } from "./lib/paths.ts";

interface PrefEntry {
  readonly [key: string]: string;
}

type MergedPrefs = Record<string, PrefEntry>;

function parsePreferenceFile(content: string): PrefEntry {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(">") || trimmed.startsWith("(")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

function loadPrefsFromDir(dir: string): MergedPrefs {
  if (!existsSync(dir)) return {};
  const result: MergedPrefs = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const name = basename(file, ".md");
    const content = readFileSync(join(dir, file), "utf-8");
    result[name] = parsePreferenceFile(content);
  }
  return result;
}

function mergePrefs(global: MergedPrefs, project: MergedPrefs): MergedPrefs {
  const allKeys = new Set([...Object.keys(global), ...Object.keys(project)]);
  const result: MergedPrefs = {};
  for (const key of allKeys) {
    result[key] = { ...global[key], ...project[key] };
  }
  return result;
}

const program = new Command();
program.name("preference-loader").description("Load and merge multi-level preferences");

program
  .command("load")
  .requiredOption("--project <name>", "Project name")
  .action((opts: { project: string }) => {
    initEnv();
    const globalDir = getEnv("QA_PREFERENCES_DIR")
      ?? resolve(repoRoot(), "preferences");
    const projDir = projectPreferencesDir(opts.project);

    const globalPrefs = loadPrefsFromDir(globalDir);
    const projPrefs = loadPrefsFromDir(projDir);
    const merged = mergePrefs(globalPrefs, projPrefs);

    console.log(JSON.stringify(merged, null, 2));
  });

program.parse();
```

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test .claude/scripts/__tests__/preference-loader.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/preference-loader.ts .claude/scripts/__tests__/preference-loader.test.ts
git commit -m "feat: add preference-loader.ts for centralized preference loading"
```

---

### Task 16: 实现 format-check-script.ts

**Files:**
- Create: `.claude/scripts/format-check-script.ts`
- Create: `.claude/scripts/__tests__/format-check-script.test.ts`

- [ ] **Step 1: 编写测试**

测试覆盖：
1. FC01 标题格式检测（缺少【P0】前缀 → definite_issues）
2. FC02 首步格式检测（首步不以「进入【」开头 → definite_issues）
3. FC03 步骤编号前缀检测
4. FC04 模糊词检测 → suspect_items（非 definite）
5. FC05 占位符数据检测
6. FC06 可断言性检测 → suspect_items
7. FC08 表单字段格式检测
8. 全部通过时返回空 issues
9. 混合场景（既有 definite 又有 suspect）

测试使用临时 Archive MD 文件作为输入，断言 JSON 输出的 `definite_issues` 和 `suspect_items` 数组内容。

```typescript
// .claude/scripts/__tests__/format-check-script.test.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";

const TMP_DIR = join(tmpdir(), `qa-flow-fmtcheck-test-${process.pid}`);
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

function run(archiveContent: string): { stdout: string; code: number } {
  const mdPath = join(TMP_DIR, "test-archive.md");
  writeFileSync(mdPath, archiveContent);
  try {
    const stdout = execFileSync(
      "bun",
      ["run", ".claude/scripts/format-check-script.ts", "check", "--input", mdPath],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    return { stdout, code: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? "", code: e.status ?? 1 };
  }
}

before(() => mkdirSync(TMP_DIR, { recursive: true }));
after(() => rmSync(TMP_DIR, { recursive: true, force: true }));

describe("format-check-script", () => {
  it("detects FC01 title format violation", () => {
    const md = `## 模块A\n### 页面A\n#### 功能A\n##### 验证商品列表\n\n| 步骤 | 操作 | 预期结果 |\n|---|---|---|\n| 1 | 进入【商品列表】页面，等待加载完成 | 列表显示 |`;
    const { stdout, code } = run(md);
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.ok(result.definite_issues.some((i: any) => i.rule === "FC01"));
  });

  it("detects FC04 fuzzy word as suspect (not definite)", () => {
    const md = `## 模块A\n### 页面A\n#### 功能A\n##### 【P0】验证商品搜索\n\n| 步骤 | 操作 | 预期结果 |\n|---|---|---|\n| 1 | 进入【商品列表】页面，等待加载完成 | 相关数据显示正确 |`;
    const { stdout, code } = run(md);
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.ok(result.suspect_items.some((i: any) => i.rule === "FC04"));
  });

  it("returns empty issues for valid archive", () => {
    const md = `## 模块A\n### 页面A\n#### 功能A\n##### 【P0】验证商品列表默认加载\n\n| 步骤 | 操作 | 预期结果 |\n|---|---|---|\n| 1 | 进入【商品管理 → 商品列表】页面，等待列表数据加载完成 | 页面标题显示"商品列表"，表格至少显示 1 行数据 |`;
    const { stdout, code } = run(md);
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result.definite_issues.length, 0);
    assert.equal(result.suspect_items.length, 0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
bun test .claude/scripts/__tests__/format-check-script.test.ts
```

- [ ] **Step 3: 实现 format-check-script.ts**

脚本结构：
1. 解析 Archive MD 为用例列表（按 `#####` 标题分割）
2. 对每条用例逐条执行纯格式规则（FC01/FC02/FC03/FC05/FC08/FC09/FC10/FC11）
3. 对 FC04/FC06 仅做正则预筛，命中的放入 `suspect_items`
4. 输出 JSON `{ definite_issues, suspect_items, stats }`

关键实现：每条规则封装为独立函数 `checkFC01(case) → Issue | null`，便于维护和测试。

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test .claude/scripts/__tests__/format-check-script.test.ts
```

- [ ] **Step 5: 运行全量测试确认无回归**

```bash
bun test .claude/scripts/__tests__/
```

- [ ] **Step 6: Commit**

```bash
git add .claude/scripts/format-check-script.ts .claude/scripts/__tests__/format-check-script.test.ts
git commit -m "feat: add format-check-script.ts for deterministic format checking"
```

---

### Task 17: 实现 source-analyze.ts

**Files:**
- Create: `.claude/scripts/source-analyze.ts`
- Create: `.claude/scripts/__tests__/source-analyze.test.ts`

- [ ] **Step 1: 编写测试**

测试覆盖：
1. 在临时目录创建 mock 源码文件，用关键词搜索返回 a_level/b_level 结果
2. 空关键词返回错误
3. 不存在的 repo 路径返回错误
4. coverage_rate 计算正确

- [ ] **Step 2: 运行测试确认失败**

```bash
bun test .claude/scripts/__tests__/source-analyze.test.ts
```

- [ ] **Step 3: 实现 source-analyze.ts**

```typescript
#!/usr/bin/env bun
/**
 * source-analyze.ts — 批量搜索源码仓库，返回结构化分析结果。
 *
 * Usage:
 *   bun run .claude/scripts/source-analyze.ts analyze --repo <path> --keywords "kw1,kw2" [--output json]
 */
```

核心逻辑：
- 递归扫描 repo 目录下所有 `.ts`/`.tsx`/`.js`/`.jsx`/`.java`/`.vue` 文件
- 对每个文件按行搜索关键词
- A 级：函数名/类名/接口名精确匹配（`function xxx`、`class xxx`、`interface xxx`、`export.*xxx`）
- B 级：注释/字符串/变量名包含关键词
- coverage_rate = matched_files / searched_files
- 输出 JSON

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/source-analyze.ts .claude/scripts/__tests__/source-analyze.test.ts
git commit -m "feat: add source-analyze.ts for batch source code search"
```

---

### Task 18: 实现 search-filter.ts

**Files:**
- Create: `.claude/scripts/search-filter.ts`
- Create: `.claude/scripts/__tests__/search-filter.test.ts`

- [ ] **Step 1: 编写测试**

测试覆盖：
1. 从 stdin 读取 JSON 数组，按相关度排序输出 top-N
2. 去重（相同 suite_name 只保留最新）
3. 输出摘要（标题 + 前 3 行 + 匹配度分数）
4. top 参数为 0 时返回全部

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现 search-filter.ts**

```typescript
#!/usr/bin/env bun
/**
 * search-filter.ts — 对 archive 搜索结果去重、排序、截断。
 *
 * Usage:
 *   echo '<json>' | bun run .claude/scripts/search-filter.ts filter --top 5
 *   bun run .claude/scripts/search-filter.ts filter --input <file.json> --top 5
 */
```

核心逻辑：
- 从 stdin 或 `--input` 文件读取 `SearchResult[]`
- 按 `case_count` 降序 + `suite_name` 去重
- 截断到 `--top N`
- 输出摘要 JSON

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/search-filter.ts .claude/scripts/__tests__/search-filter.test.ts
git commit -m "feat: add search-filter.ts for archive search result filtering"
```

---

### Task 19: 实现 writer-context-builder.ts

**Files:**
- Create: `.claude/scripts/writer-context-builder.ts`
- Create: `.claude/scripts/__tests__/writer-context-builder.test.ts`

- [ ] **Step 1: 编写测试**

测试覆盖：
1. 给定多模块 PRD 和 writer-id，只返回对应模块的 PRD 片段
2. 给定 test-points JSON 和 writer-id，只返回该 writer 负责的测试点
3. 合并偏好到输出
4. PRD 中无匹配模块时返回全文（fallback）

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现 writer-context-builder.ts**

```typescript
#!/usr/bin/env bun
/**
 * writer-context-builder.ts — 按模块切分 PRD，为每个 writer 构建精简上下文。
 *
 * Usage:
 *   bun run .claude/scripts/writer-context-builder.ts build \
 *     --prd <path> --test-points <path> --writer-id <module> --preferences <path>
 */
```

核心逻辑：
- 按 `##` 标题切分 PRD 为模块
- 用 `--writer-id` 匹配模块名
- 从 test-points JSON 过滤出该 writer 的测试点
- 合并偏好
- 输出 `{ module_prd_section, test_points, preferences }`

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/writer-context-builder.ts .claude/scripts/__tests__/writer-context-builder.test.ts
git commit -m "feat: add writer-context-builder.ts for per-writer context slicing"
```

---

### Task 20: 实现 auto-fixer.ts

**Files:**
- Create: `.claude/scripts/auto-fixer.ts`
- Create: `.claude/scripts/__tests__/auto-fixer.test.ts`

- [ ] **Step 1: 编写测试**

测试覆盖：
1. F07 正向用例合并：两条 positive 步骤数 < 4 的用例被合并为一条
2. F09 表单字段合并：连续单字段步骤被合并为列表格式
3. F13 模糊兜底删除：「或等价提示」被移除
4. FC01 标题前缀修正：缺少【P0】的标题被修正
5. 无问题时输入输出一致
6. MANUAL 标记的问题不修改

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 实现 auto-fixer.ts**

```typescript
#!/usr/bin/env bun
/**
 * auto-fixer.ts — 对 reviewer 审查发现的规则性问题执行自动修正。
 *
 * Usage:
 *   bun run .claude/scripts/auto-fixer.ts fix --input <json> --issues <json> --output <path>
 */
```

核心逻辑：
- 读取 writer JSON + issues JSON
- 按规则 ID 分发到对应修正函数
- F07: 找到同 sub_group 中 positive + steps < 4 的用例，合并
- F09: 检测连续单字段步骤，合并为列表
- F13: 正则删除「或等价/或类似」
- FC01: 标题前缀补全
- 跳过 MANUAL 标记
- 输出修正后 JSON

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: 运行全量测试**

```bash
bun test .claude/scripts/__tests__/
```

- [ ] **Step 6: Commit**

```bash
git add .claude/scripts/auto-fixer.ts .claude/scripts/__tests__/auto-fixer.test.ts
git commit -m "feat: add auto-fixer.ts for deterministic review issue correction"
```

---

## Layer 4: 数据流优化

### Task 21: 断点恢复缓存

**Files:**
- Modify: `.claude/scripts/state.ts`
- Modify: `.claude/scripts/ui-autotest-progress.ts`
- Modify: `.claude/scripts/__tests__/state.test.ts`
- Modify: `.claude/scripts/__tests__/ui-autotest-progress.test.ts`

- [ ] **Step 1: 为 state.ts 添加缓存字段测试**

在 `state.test.ts` 新增测试：
- `update` 命令支持 `--field cached_parse_result --value '<json>'`
- `resume` 命令返回的状态中包含 `cached_parse_result`
- 当 `--source-mtime` 参数提供时，比较 mtime 决定缓存有效性

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 修改 state.ts**

在 `QaState` interface 中增加：

```typescript
interface QaState {
  // ... existing fields
  cached_parse_result?: unknown;
  source_mtime?: string;
}
```

`update` 命令支持写入 `cached_parse_result` 和 `source_mtime`。

`resume` 命令增加逻辑：若 `source_mtime` 与当前文件 mtime 不同，清空 `cached_parse_result`。

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: 为 ui-autotest-progress.ts 添加同样的缓存字段**

在 `Progress` interface 中增加 `cached_parse_result` 和 `source_mtime`。同样的 mtime 失效逻辑。

添加对应测试。

- [ ] **Step 6: 运行全量测试**

```bash
bun test .claude/scripts/__tests__/state.test.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add .claude/scripts/state.ts .claude/scripts/ui-autotest-progress.ts \
  .claude/scripts/__tests__/state.test.ts .claude/scripts/__tests__/ui-autotest-progress.test.ts
git commit -m "feat: add cached_parse_result with mtime invalidation to state management"
```

---

### Task 22: 错误分类传递逻辑

**Files:**
- Modify: `.claude/skills/ui-autotest/SKILL.md`

- [ ] **Step 1: 更新步骤 5 的错误传递规范**

在 SKILL.md 步骤 5 的失败处理段落中，明确错误分类提取规则：

```markdown
**5.2 失败处理**

主 agent 从 Playwright stderr 提取分类信息（不读完整错误上下文）：

```bash
# 从 stderr 提取错误类型的正则模式
timeout    → /Timeout \d+ms exceeded/
locator    → /locator\..*resolved to \d+ elements?|waiting for locator/
assertion  → /expect\(.*\)\.(toHave|toBe|toContain|toMatch)/
unknown    → 以上均不匹配
```

派发给 script-fixer-agent 的信息：

```json
{
  "error_type": "timeout | locator | assertion | unknown",
  "script_path": "workspace/{{project}}/.temp/ui-blocks/{{id}}.ts",
  "stderr_last_20_lines": "...",
  "attempt": 1,
  "url": "{{url}}",
  "repos_dir": "workspace/{{project}}/.repos/"
}
```

主 agent **禁止**读取完整 Playwright 输出或 DOM snapshot。
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/ui-autotest/SKILL.md
git commit -m "feat: add error classification protocol to ui-autotest step 5"
```

---

### Task 23: format-check 分层流水线

**Files:**
- Modify: `.claude/skills/test-case-gen/SKILL.md`

- [ ] **Step 1: 更新 format-check 节点流程**

在 SKILL.md 的 format-check 节点中，将原来直接调用 format-checker-agent 改为分层流水线：

```markdown
### 节点 6.5: 格式检查（分层流水线）

**第一层：脚本确定性检查**

```bash
bun run .claude/scripts/format-check-script.ts check \
  --input workspace/{{project}}/.temp/{{prd_slug}}-format-check.md
```

脚本输出 JSON：
- `definite_issues`: 纯格式违规，直接计入偏差报告
- `suspect_items`: FC04/FC06 疑似项

**第二层：语义判断（仅在 suspect_items 非空时）**

若 `suspect_items` 为空 → 跳过 haiku 调用，直接进入修正阶段。

若 `suspect_items` 非空 → 派发 format-checker-agent（haiku），仅传入 suspect_items 数组，不传完整 Archive。Agent 逐条判断后返回最终判定。

**合并结果**

将脚本的 definite_issues + agent 的最终判定合并为完整偏差报告。

**循环**

若存在违规 → 修正后重新执行第一层脚本检查（最多 5 轮）。
每轮的第二层只处理新产生的 suspect_items。
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/test-case-gen/SKILL.md
git commit -m "feat: implement layered format-check pipeline in test-case-gen"
```

---

### Task 24: 接入 preference-loader 和 search-filter

**Files:**
- Modify: `.claude/skills/test-case-gen/SKILL.md`
- Modify: `.claude/skills/ui-autotest/SKILL.md`

- [ ] **Step 1: test-case-gen 接入 preference-loader**

在 init 节点（步骤 0）增加偏好预加载调用。在各 sub-agent 派发指令中，增加 `--preferences` 参数传递预加载结果路径。

- [ ] **Step 2: test-case-gen 接入 search-filter**

在 analyze 节点的历史用例搜索中，改为管道式调用：

```markdown
```bash
bun run .claude/scripts/archive-gen.ts search --query "{{关键词}}" --project {{project}} --limit 20 \
  | bun run .claude/scripts/search-filter.ts filter --top 5
```
```

- [ ] **Step 3: ui-autotest 接入 preference-loader**

在步骤 0/1 增加偏好预加载。

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/test-case-gen/SKILL.md .claude/skills/ui-autotest/SKILL.md
git commit -m "feat: integrate preference-loader and search-filter into workflows"
```

---

### Task 25: 全量测试验证

**Files:** (readonly)

- [ ] **Step 1: 运行全部脚本测试**

```bash
bun test .claude/scripts/__tests__/
```

Expected: ALL PASS

- [ ] **Step 2: 验证 reference 文件完整性**

```bash
ls -la .claude/references/
```

Expected: 6 个文件（test-case-standards.md, output-schemas.json, error-handling-patterns.md, unicode-symbols.md, playwright-patterns.md, confirmation-policy.json）

- [ ] **Step 3: 验证 agent 文件行数缩减**

```bash
wc -l .claude/agents/*.md
```

Expected: 总行数 ~2,200（从 ~3,850 缩减）

- [ ] **Step 4: 验证 skill 文件行数缩减**

```bash
wc -l .claude/skills/test-case-gen/SKILL.md .claude/skills/ui-autotest/SKILL.md .claude/skills/code-analysis/SKILL.md
```

Expected: 总行数 ~1,650（从 ~2,010 缩减）

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "chore: token optimization complete - verify all tests pass"
```
