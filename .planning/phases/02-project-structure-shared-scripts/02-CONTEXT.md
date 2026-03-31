# Phase 2: Project Structure + Shared Scripts - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

重新设计项目目录布局使其支持任意项目，所有共享 Node.js 脚本适配新 config schema，通过 config 值解析路径而非硬编码。Init 向导属于 Phase 3，本阶段只确保结构和脚本就绪。

</domain>

<decisions>
## Implementation Decisions

### 目录布局设计
- 保留 cases/ 下四分法：requirements/xmind/archive/history，职责清晰
- 顶层 cases/requirements、cases/xmind、cases/archive 通过 .gitkeep 预建，新用户 clone 后即可看到结构
- 版本目录为可选层：模块配置中指定 versioned: true/false，启用时自动创建 v{version}/ 子目录，否则扁平存放
- 根目录 latest-*.xmind 等快捷链接保留，名称通过 config.shortcuts 配置
- config/ 顶层目录移入 .claude/（repo-branch-mapping.yaml 等配置文件与 config.json 就近存放）

### Config 驱动路径解析
- 空模块处理：modules 为空时脚本抛出明确错误并引导用户运行 /using-qa-flow init，不做默认推断
- 路径策略：约定优先 + 覆写。默认从 moduleKey 推导 cases/{type}/{moduleKey}/，允许在 config 中显式覆写特殊路径（如 custom/xyzh）
- 命名契约：output-naming-contracts 的命名模板可配置，默认使用需求名称作为文件名
- config/ 目录内容迁移至 .claude/ 下

### 脚本迁移与兼容
- load-config.mjs API 允许重新设计，不需要保持旧 API 签名向下兼容
- output-naming-contracts.mjs 全量 config 驱动：所有路径段、文件名规则从 config 读取，脚本中零字符串常量路径
- unify-directory-structure.mjs 和 build-archive-index.mjs 在本阶段同步改造适配新结构

### 测试策略
- 脚本级单元测试验证空白项目初始化场景（loadConfig、resolveModulePath 等函数在空 config 下的行为）
- 现有 test fixtures 重建以匹配新约定式路径和 config schema
- 新增硬编码检测测试：grep 所有 .mjs 文件确认无 cases/xmind/ 等硬编码路径段

### Claude's Discretion
- 新增 API 的具体签名设计（如 resolveModulePath 的参数和返回值）
- fixtures 的具体数据结构
- .gitkeep 文件的具体放置位置
- config 中覆写路径的 schema 设计细节

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目定义
- `.planning/PROJECT.md` -- 项目愿景、核心价值、技术栈、约束条件
- `.planning/REQUIREMENTS.md` -- STRU-01、STRU-02、STRU-03 需求定义
- `.planning/ROADMAP.md` -- Phase 2 成功标准（3 条 must-be-TRUE 条件）

### Phase 1 上下文
- `.planning/phases/01-generalization-refactor/01-CONTEXT.md` -- Config schema 泛化决策、变量化模板风格、条件化规则模式

### 代码库分析
- `.planning/codebase/STRUCTURE.md` -- 当前目录布局和文件位置
- `.planning/codebase/CONVENTIONS.md` -- 编码约定（ESM、命名、JSDoc）
- `.planning/codebase/ARCHITECTURE.md` -- 分层架构和数据流

### 需要改造的核心脚本
- `.claude/shared/scripts/load-config.mjs` -- 配置加载入口，所有脚本依赖
- `.claude/shared/scripts/output-naming-contracts.mjs` -- 文件命名规则
- `.claude/shared/scripts/unify-directory-structure.mjs` -- 目录结构统一脚本
- `.claude/shared/scripts/build-archive-index.mjs` -- 归档索引构建
- `.claude/shared/scripts/latest-link-utils.mjs` -- 快捷链接管理
- `.claude/shared/scripts/refresh-latest-link.mjs` -- 快捷链接刷新
- `.claude/config.json` -- 当前 config schema

### 现有测试
- `.claude/tests/run-all.mjs` -- 测试运行器
- `.claude/tests/test-load-config.mjs` -- loadConfig 测试
- `.claude/shared/scripts/load-config.test.mjs` -- loadConfig 内联测试

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `front-matter-utils.mjs` -- 完全通用，无需修改
- `audit-md-frontmatter.mjs` -- 审计框架可复用，路径解析需适配
- `normalize-md-content.mjs` -- MD 规范化逻辑通用
- `md-content-source-resolver.mjs` -- 内容来源解析，可能需适配路径

### Established Patterns
- 配置集中化：所有路径通过 config.json 解析（Phase 1 已泛化 schema）
- ESM 模块：所有 shared scripts 使用 ES Module，named exports only
- 零外部依赖偏好：仅 jszip 为必要依赖，验证逻辑手写
- 测试模式：test-*.mjs 命名，run-all.mjs 自动发现，__test_* 临时目录

### Integration Points
- `load-config.mjs` 是所有脚本的配置入口 -- 改动影响全部下游
- `output-naming-contracts.mjs` 被 xmind-converter 和 archive-converter 的脚本引用
- `.claude/rules/*.md` 中的路径引用需与新结构同步
- `CLAUDE.md` 中的目录结构说明需更新

</code_context>

<specifics>
## Specific Ideas

- 命名模板默认使用需求名称作为文件名（用户明确要求）
- config/ 目录内容移入 .claude/ 让根目录更干净
- 约定式路径：cases/{type}/{moduleKey}/ 是默认规则，特殊布局通过 config 覆写

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-project-structure-shared-scripts*
*Context gathered: 2026-03-31*
