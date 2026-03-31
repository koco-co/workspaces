# Phase 4: Core Skills Redesign - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

将全部六个 Skills（test-case-generator、prd-enhancer、xmind-converter、archive-converter、code-analysis-report、using-qa-flow）改造为 config 驱动 + 通用示例，消除所有 DTStack 业务耦合。改造后任何项目用 init 向导生成 config 即可直接使用全部 Skill，无需手动修改 Skill 内部文件。

</domain>

<decisions>
## Implementation Decisions

### DTStack 专属步骤处理
- **D-01:** 采用**条件保留**策略 — `source-sync` 在 `config.repos` 非空时自动启用；蓝湖 URL 输入时启用 `req-elicit`；`prd-formalize` 改为可选条件步骤
- **D-02:** 主流程保持完整 11 步架构，条件步骤在不满足触发条件时自动跳过（`last_completed_step` 直接跳到下一步），不影响断点续传逻辑

### 通用示例数据设计
- **D-03:** 采用**统一完整电商场景** — 所有六个 Skill 使用同一套电商平台示例（商品管理、订单处理、用户中心），包含具体字段名、表单结构、列表页元素
- **D-04:** Writer/Reviewer sub-agent prompts 中的示例必须包含具体的步骤、预期结果、表单字段，让新用户能照猫画虎
- **D-05:** SQL 前置条件采用**变量化模板**风格 — 保留 SQL 示例但用 `${datasource_type}`、`${schema}`、`${table}` 等变量，与 Phase 1 rules 层风格一致

### code-analysis-report 前端扩展
- **D-06:** 在现有后端报错分析基础上，**新增前端报错分析模板**，复用现有 HTML 报告框架
- **D-07:** 前端模板支持两种输入格式：浏览器控制台报错、框架特定报错（React Error Boundary、Vue warn、Next.js SSR 等）
- **D-08:** 分析流程自动识别输入是前端还是后端报错，路由到对应模板；config.stackTrace 映射扩展支持前端包名/组件路径

### Skill 改造策略
- **D-09:** 采用**就地改造** — 在现有 SKILL.md、prompts、scripts 基础上修改，保留经过验证的工作流架构，替换 DTStack 内容为通用内容，增加 config 驱动逻辑
- **D-10:** 改造顺序按**依赖链**推进：xmind-converter → archive-converter → prd-enhancer → code-analysis-report → test-case-generator（主编排）→ using-qa-flow（菜单更新）

### Claude's Discretion
- 电商示例的具体字段名和表单结构设计
- 前端报错模板的 HTML 布局细节
- 各 Skill 内部 prompts 的具体措辞调整
- 条件步骤跳过时的日志记录格式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目定义
- `.planning/PROJECT.md` — 项目愿景、核心价值、技术栈约束（Node.js ESM，无额外运行时）
- `.planning/REQUIREMENTS.md` — SKIL-01 至 SKIL-06 需求定义和验收标准
- `.planning/ROADMAP.md` — Phase 4 成功标准（4 条 must-be-TRUE 条件）

### 前序阶段上下文
- `.planning/phases/01-generalization-refactor/01-CONTEXT.md` — Config schema 泛化决策、变量化模板风格、条件化规则模式
- `.planning/phases/02-project-structure-shared-scripts/02-CONTEXT.md` — resolveModulePath 约定路径、config/ 退役、零硬编码路径
- `.planning/phases/03-init-wizard/03-CONTEXT.md` — Init 向导生成 config.json + CLAUDE.md，re-init 增量更新

### 代码库分析
- `.planning/codebase/ARCHITECTURE.md` — 分层架构、数据流、Skill 抽象定义
- `.planning/codebase/STRUCTURE.md` — 目录布局、文件位置、命名约定
- `.planning/codebase/CONVENTIONS.md` — 编码约定（ESM、命名、JSDoc）

### 需要改造的 Skill 文件（按依赖链顺序）
- `.claude/skills/xmind-converter/SKILL.md` — XMind 转换编排 + `scripts/json-to-xmind.mjs`
- `.claude/skills/archive-converter/SKILL.md` — 归档转换编排 + `scripts/json-to-archive-md.mjs`
- `.claude/skills/prd-enhancer/SKILL.md` — PRD 增强编排 + `prompts/`
- `.claude/skills/code-analysis-report/SKILL.md` — 代码分析编排 + `prompts/code-analyzer.md`
- `.claude/skills/test-case-generator/SKILL.md` — 主编排 + `prompts/step-*.md` + `references/`
- `.claude/skills/using-qa-flow/SKILL.md` — 功能菜单 + init 流程

### 共享依赖
- `.claude/config.json` — 当前 config schema（所有 Skill 的路径来源）
- `.claude/shared/scripts/load-config.mjs` — loadConfig()、resolveModulePath() 实现
- `.claude/shared/scripts/output-naming-contracts.mjs` — 文件命名规则
- `.claude/rules/test-case-writing.md` — 用例编写规范（已通用化）
- `.claude/rules/archive-format.md` — 归档格式规范（已通用化）
- `.claude/rules/xmind-output.md` — XMind 输出规范（已通用化）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `json-to-xmind.mjs` — XMind 转换脚本，核心逻辑通用，Root 节点格式需改为 config 驱动
- `json-to-archive-md.mjs` — 归档 MD 生成脚本，frontmatter 生成逻辑可复用
- `patch-xmind-roots.mjs` — Root 节点修补脚本，需适配通用命名
- `output-naming-contracts.mjs` — 文件命名规则引擎，Phase 2 已 config 驱动化
- `load-config.mjs` — 配置加载 + `resolveModulePath()`，所有 Skill 脚本的配置入口
- `front-matter-utils.mjs` — frontmatter 解析完全通用

### Established Patterns
- Skill 结构：SKILL.md（触发 + 步骤表）+ prompts/（逐步指令）+ references/（Schema）+ rules/（本地规则）+ scripts/（Node.js）
- 子代理模式：Writer/Reviewer 通过 prompts 定义，Claude 运行时派发并行执行
- 状态持久化：`.qa-state-*.json` 记录 `last_completed_step`，支持断点续传
- 质量阈值：15%/40% 三档自动决策（< 15% 自动修正、15-40% 警告、> 40% 阻断）

### Integration Points
- test-case-generator 是主编排，调用 prd-enhancer（步骤 4-6）、xmind-converter（步骤 9）、archive-converter（步骤 10）
- using-qa-flow 的功能菜单需反映所有 Skill 的最新触发词和描述
- CLAUDE.md 的 Skill 索引表需与改造后的触发词同步

</code_context>

<specifics>
## Specific Ideas

- 电商示例统一使用：商品管理（列表页、新增页、编辑页、详情页）、订单处理（订单列表、订单详情、退款审批）、用户中心（个人信息、收货地址、订单历史）
- SQL 示例风格延续 Phase 1：`DROP TABLE IF EXISTS ${schema}.${table}; CREATE TABLE ${schema}.${table} (...); INSERT INTO ${schema}.${table} VALUES (...);`
- 条件步骤跳过逻辑：检查 config 字段 → 条件不满足 → 记录日志 → 直接更新 `last_completed_step` 跳到下一步
- 前端报错模板：自动检测输入中的 `at Object.` / `TypeError` / `React` / `Vue warn` 等关键词区分前后端

</specifics>

<deferred>
## Deferred Ideas

- init 完成后自动触发 archive-converter 批量归档历史文件（Phase 3 CONTEXT.md 已记录）
- 截图 + 文字描述的前端报错分析输入模式 — 可在后续迭代中添加
- 网络请求/响应的分析模板 — 可在后续迭代中添加

</deferred>

---

*Phase: 04-core-skills-redesign*
*Context gathered: 2026-03-31*
