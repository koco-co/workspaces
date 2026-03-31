# Phase 4: Core Skills Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 04-core-skills-redesign
**Areas discussed:** DTStack 专属步骤处理, 通用示例数据设计, code-analysis-report 前端扩展, Skill 改造策略与顺序

---

## DTStack 专属步骤处理

| Option | Description | Selected |
|--------|-------------|----------|
| 条件保留 | config.repos 非空时启用 source-sync；蓝湖 URL 时启用 req-elicit；prd-formalize 改为可选 | ✓ |
| 精简移除 | 从主流程中删除 source-sync、prd-formalize，req-elicit 简化为通用需求补充 | |
| 插件化架构 | 设计 Skill 插件机制，允许用户通过 config 注册额外步骤 | |

**User's choice:** 条件保留
**Notes:** 保持流程灵活性，有源码的项目自动获得增强能力

---

## 通用示例数据设计 — 场景粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 完整电商场景 | 统一电商平台（商品、订单、用户），所有 Skill 共用，包含具体字段和 UI 元素 | ✓ |
| 轻量占位符 | 抽象占位符（模块A、字段X），用户需自行套用 | |
| 多场景混合 | 每个 Skill 用不同场景，展示通用性但理解成本高 | |

**User's choice:** 完整电商场景

## 通用示例数据设计 — SQL 示例

| Option | Description | Selected |
|--------|-------------|----------|
| 保留通用 SQL | 用 MySQL 电商建表作为示例 | |
| 去除 SQL | 不含 SQL，纯文字说明 | |
| 变量化 SQL 模板 | 保留 SQL 但用 ${datasource_type}/${schema}/${table} 变量，与 Phase 1 风格一致 | ✓ |

**User's choice:** 变量化 SQL 模板

---

## code-analysis-report 前端扩展

| Option | Description | Selected |
|--------|-------------|----------|
| 添加前端模板 | 新增前端报错分析模板，复用 HTML 报告框架 | ✓ |
| 仅通用化现有 | 只做后端模板通用化，前端延后 | |
| 前后端统一分析 | 自动识别前后端报错，路由到不同流程 | |

**User's choice:** 添加前端模板

### 前端输入格式

| Option | Description | Selected |
|--------|-------------|----------|
| 浏览器控制台报错 | console 错误信息 | ✓ |
| 截图 + 文字描述 | 报错截图配合文字 | |
| 网络请求/响应 | curl 或 DevTools Network 信息 | |
| 框架特定报错 | React Error Boundary、Vue warn、Next.js SSR 等 | ✓ |

**User's choice:** 浏览器控制台报错 + 框架特定报错

---

## Skill 改造策略与顺序 — 改造方式

| Option | Description | Selected |
|--------|-------------|----------|
| 就地改造 | 在现有基础上修改，保留验证过的架构 | ✓ |
| 全量重写 | 从空白重写，更彻底但风险高 | |
| 混合策略 | 简单 Skill 就地改造，复杂 Skill 重写 | |

**User's choice:** 就地改造

## Skill 改造策略与顺序 — 改造顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 依赖链顺序 | xmind → archive → prd-enhancer → code-analysis → test-case-generator → using-qa-flow | ✓ |
| 从主编排开始 | test-case-generator 先行 | |
| 并行改造 | 六个同时进行 | |

**User's choice:** 依赖链顺序

---

## Claude's Discretion

- 电商示例的具体字段名和表单结构
- 前端报错模板的 HTML 布局
- 各 Skill prompts 的具体措辞
- 条件步骤跳过时的日志格式

## Deferred Ideas

- 截图 + 文字描述的前端报错输入模式
- 网络请求/响应的分析模板
- init 后自动触发 archive-converter 批量归档
