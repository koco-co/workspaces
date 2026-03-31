# Phase 4: Core Skills Redesign - Research

**Researched:** 2026-03-31
**Domain:** Claude Skill 文件改造（Markdown 编排 + Node.js 脚本 + AI 提示词）
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** DTStack 专属步骤采用**条件保留**策略 — `source-sync` 在 `config.repos` 非空时自动启用；蓝湖 URL 输入时启用 `req-elicit`；`prd-formalize` 改为可选条件步骤
- **D-02:** 主流程保持完整 11 步架构，条件步骤在不满足触发条件时自动跳过（`last_completed_step` 直接跳到下一步），不影响断点续传逻辑
- **D-03:** 采用**统一完整电商场景** — 所有六个 Skill 使用同一套电商平台示例（商品管理、订单处理、用户中心），包含具体字段名、表单结构、列表页元素
- **D-04:** Writer/Reviewer sub-agent prompts 中的示例必须包含具体的步骤、预期结果、表单字段，让新用户能照猫画虎
- **D-05:** SQL 前置条件采用**变量化模板**风格 — 保留 SQL 示例但用 `${datasource_type}`、`${schema}`、`${table}` 等变量，与 Phase 1 rules 层风格一致
- **D-06:** 在现有后端报错分析基础上，**新增前端报错分析模板**，复用现有 HTML 报告框架
- **D-07:** 前端模板支持两种输入格式：浏览器控制台报错、框架特定报错（React Error Boundary、Vue warn、Next.js SSR 等）
- **D-08:** 分析流程自动识别输入是前端还是后端报错，路由到对应模板；config.stackTrace 映射扩展支持前端包名/组件路径
- **D-09:** 采用**就地改造** — 在现有 SKILL.md、prompts、scripts 基础上修改，保留经过验证的工作流架构，替换 DTStack 内容为通用内容，增加 config 驱动逻辑
- **D-10:** 改造顺序按**依赖链**推进：xmind-converter → archive-converter → prd-enhancer → code-analysis-report → test-case-generator（主编排）→ using-qa-flow（菜单更新）

### Claude's Discretion

- 电商示例的具体字段名和表单结构设计
- 前端报错模板的 HTML 布局细节
- 各 Skill 内部 prompts 的具体措辞调整
- 条件步骤跳过时的日志记录格式

### Deferred Ideas (OUT OF SCOPE)

- init 完成后自动触发 archive-converter 批量归档历史文件（Phase 3 CONTEXT.md 已记录）
- 截图 + 文字描述的前端报错分析输入模式
- 网络请求/响应的分析模板
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKIL-01 | test-case-generator 重新设计 — 通用化编排流程，去除业务耦合 | 条件步骤跳过逻辑、电商示例数据、Writer/Reviewer prompt 更新 |
| SKIL-02 | prd-enhancer 重新设计 — 通用化图片解析和健康度检查逻辑 | 移除 Step 0.5 DTStack 专属检查、通用化健康度报告措辞 |
| SKIL-03 | code-analysis-report 重新设计 — 支持前端代码分析模板 | 模式 C（前端）自动识别、HTML 模板扩展、config.stackTrace 前端映射 |
| SKIL-04 | xmind-converter 重新设计 — 通用化 Root 节点格式和路径逻辑 | buildRootTitle/buildL1Title 改造、isDtstackMeta 删除、路径表改为 config 驱动 |
| SKIL-05 | archive-converter 重新设计 — 通用化转换规则和目录映射 | 模块名称映射表改为 config.modules 驱动、移除硬编码路径 |
| SKIL-06 | using-qa-flow 重新设计 — 整合初始化流程 + 功能菜单 | 菜单示例去 DTStack 化、快速示例改为通用 + 条件 DTStack 部分 |
</phase_requirements>

---

## Summary

Phase 4 的核心任务是对现有六个 Skills 执行就地改造（in-place refactor），去除所有 DTStack 业务耦合，使其在任意项目中开箱即用。改造并非重写，而是精准手术：识别每个 Skill 中的 DTStack 专属内容，用 config 驱动逻辑和通用示例替换，同时保留已验证的工作流架构。

六个 Skill 之间存在明确的依赖链：xmind-converter 和 archive-converter 是基础输出层，prd-enhancer 是 PRD 预处理层，code-analysis-report 完全独立，test-case-generator 是主编排层（调用前四者），using-qa-flow 是入口菜单层（反映所有 Skill 的最新状态）。改造顺序必须沿依赖链从底向上，确保每层改造完成后上层依赖的接口不变。

每个 Skill 的 DTStack 耦合点集中在三类：(1) 硬编码的产品名称、模块路径、禅道 ID；(2) DTStack 专属的分支/仓库管理步骤；(3) 示例数据中的业务字段（Doris/Hive 数据源、具体菜单路径）。Phase 1-3 已完成了 config schema 泛化和 rules 层通用化，Phase 4 要完成 prompts 层和 scripts 层的对齐。

**Primary recommendation:** 按依赖链顺序逐 Skill 改造，每个 Skill 改造后立即验证 config 驱动路径正确性，最后通过电商场景端到端测试验证整体联动。

---

## Standard Stack

### Core

| 组件 | 版本/位置 | 用途 | 说明 |
|------|-----------|------|------|
| SKILL.md | 每个 Skill 的根文件 | 触发词、步骤表、执行协议 | 改造主要目标之一 |
| prompts/step-*.md | 每个步骤的详细指令 | Claude 逐步执行的具体行为 | DTStack 示例数据在此集中 |
| prompts/writer-subagent.md | test-case-generator | Writer Agent 提示词模板 | 最多 DTStack 示例的文件 |
| json-to-xmind.mjs | xmind-converter/scripts | JSON → .xmind 转换 | buildRootTitle/buildL1Title 需改造 |
| convert-history-cases.mjs | archive-converter/scripts | CSV/XMind → MD 转换 | 模块名称映射表需改造 |
| load-config.mjs | shared/scripts | 配置加载 + resolveModulePath | 已通用化，本 Phase 只读不改 |
| config.json | .claude/ | 所有路径和模块的 source of truth | 无需改造，已通用 |

### Supporting

| 组件 | 版本/位置 | 用途 | 何时使用 |
|------|-----------|------|----------|
| references/intermediate-format.md | test-case-generator | 中间 JSON schema | Writer 输出格式定义，meta 字段需核查 |
| xmind-structure-spec.md | xmind-converter/references | XMind 层级规范 | 验证 Root/L1 格式 |
| bug-report-template.md | code-analysis-report/references | HTML 报告模板 | 前端模板扩展基础 |
| env-vs-code-checklist.md | code-analysis-report/references | 环境问题判断清单 | 前端版本需扩展 |

---

## Architecture Patterns

### 现有 Skill 结构（保持不变）

```
.claude/skills/{skill-name}/
├── SKILL.md              # 触发词 + 步骤表 + 执行协议
├── prompts/              # 逐步指令（step-*.md）+ subagent 模板
├── references/           # Schema、模板、规范文档
├── rules/                # 本地规则（可选）
└── scripts/              # Node.js 脚本（确定性 I/O）
```

### Pattern 1: 条件步骤跳过模式（D-01/D-02）

**What:** 步骤开头声明触发条件，不满足时记录日志并跳到下一步

**When to use:** `source-sync`、`prd-formalize`、`req-elicit`（蓝湖 URL 触发）

**Example:**
```markdown
<!-- step-id: source-sync | delegate: testCaseOrchestrator -->
# Step source-sync：源码分支同步

> 本步骤仅在 config.json 中 `repos` 字段为非空对象时执行。
> 若 `repos: {}` 则跳过此步骤，直接更新 last_completed_step 为 "source-sync"，继续下一步。
```

跳过时的状态更新格式：
```json
{"step": "source-sync", "status": "skipped", "at": "<ISO8601>", "reason": "config.repos is empty"}
```

### Pattern 2: Config 驱动路径替换模式（SKIL-04/SKIL-05）

**What:** 脚本中所有硬编码产品名称/路径改为从 `loadConfig()` 读取

**Before（xmind-converter/scripts/json-to-xmind.mjs）:**
```javascript
// 现有：isDtstackMeta() 函数和 buildRootTitle() 函数耦合 DTStack 判断逻辑
function isDtstackMeta(meta = {}) {
  if (meta.source_standard === 'dtstack') return true
  // ... DTStack 特定逻辑
}

function buildRootTitle(meta = {}) {
  if (isDtstackMeta(meta) && meta.version) {
    const config = loadConfig()
    const moduleKey = meta.module_key || meta.product
    const mod = moduleKey ? config.modules?.[moduleKey] : null
    const zhName = mod?.zh || meta.project_name || ''
    const trackerId = mod?.trackerId
    const idSuffix = trackerId ? `(#${trackerId})` : ''
    return `${zhName}${meta.version}迭代用例${idSuffix}`
  }
  return meta.project_name
}
```

**After（改造目标）:**
```javascript
// 改造：统一用 config 驱动，不再区分 isDtstack 分支
function buildRootTitle(meta = {}) {
  const config = loadConfig()
  const moduleKey = meta.module_key || meta.product
  const mod = moduleKey ? config.modules?.[moduleKey] : null
  const displayName = mod?.zh || config.project?.displayName || meta.project_name || ''
  const trackerId = mod?.trackerId
  const versionPart = meta.version ? meta.version : ''
  const idSuffix = trackerId ? `(#${trackerId})` : ''
  // 有 trackerId 或 version 时构造完整格式，否则只用 displayName
  if (trackerId || versionPart) {
    return `${displayName}${versionPart}迭代用例${idSuffix}`
  }
  return displayName || meta.project_name || meta.requirement_name || ''
}
```

### Pattern 3: 通用电商示例替换模式（D-03/D-04）

**What:** 将所有 DTStack 具体业务示例替换为电商平台统一示例

**统一电商场景定义：**
- **商品管理**（列表页、新增页、编辑页、详情页）
  - 字段：商品名称、商品分类（下拉）、SKU编号、价格（数值）、库存数量、状态（上架/下架/待审核）、创建时间
  - 按钮：【新增商品】【编辑】【下架】【删除】【批量导出】
- **订单处理**（订单列表、订单详情、退款审批）
  - 字段：订单号（自动生成）、客户姓名、商品列表、总金额、支付方式（微信/支付宝/余额）、订单状态、创建时间
  - 按钮：【查看详情】【处理退款】【导出订单】
- **用户中心**（个人信息、收货地址、订单历史）
  - 字段：用户名、手机号、邮箱、注册时间、最近登录时间

**Writer subagent 示例替换方向：**

```
// 旧示例（DTStack 质量问题台账）
在「问题名称」输入框输入"2026年3月产线温度异常"
在「处理状态」下拉框选择"已完成"

// 新示例（通用电商商品管理）
在「商品名称」输入框输入"2026春季新款运动鞋"
在「状态」下拉框选择"上架"
在「价格」输入框输入"299.00"
```

**SQL 前置条件模板（D-05，延续 Phase 1 风格）：**
```
1、${datasource_type} 测试数据准备:
DROP TABLE IF EXISTS ${schema}.${table};
CREATE TABLE ${schema}.${table} (
  id INT,
  product_name VARCHAR(100),
  category VARCHAR(50),
  price DECIMAL(10,2),
  stock_qty INT,
  status VARCHAR(20),
  create_time DATETIME
);
INSERT INTO ${schema}.${table} VALUES
  (1, '2026春季新款运动鞋', '运动鞋', 299.00, 100, '上架', '2026-01-01 10:00:00'),
  (2, '经典白色帆布鞋', '帆布鞋', 199.00, 50, '下架', '2026-01-02 10:00:00');
```

### Pattern 4: 前端报错新增模式（D-06/D-07/D-08）

**What:** 在 code-analysis-report SKILL.md 中新增模式 C（前端报错），复用现有 HTML 报告框架

**自动识别关键词（D-08）：**

| 报错特征关键词 | 判定 |
|--------------|------|
| `TypeError: Cannot read` / `ReferenceError` / `Uncaught Error` | 前端 JavaScript 运行时错误 |
| `Warning: ` / `React.createElement` / `React Hook` / `at Object.<anonymous>` | React 报错 |
| `[Vue warn]` / `VueComponent` | Vue 报错 |
| `Error: Hydration failed` / `getServerSideProps` / `getStaticProps` | Next.js SSR 错误 |
| `error TS` / `Cannot find module` (无 Java 包名) | TypeScript 编译错误 |
| `Exception` / `Caused by` / `at com.` / `java.lang` | 后端 Java 错误（现有逻辑） |

**config.stackTrace 前端扩展：**
```json
{
  "stackTrace": {
    "react-app": ".repos/frontend/",
    "vue-app": ".repos/frontend/",
    "@/components": ".repos/frontend/src/components/"
  }
}
```

### Anti-Patterns to Avoid

- **不要删除条件步骤**：`source-sync`、`prd-formalize` 保留，只改为条件触发，不删除——删除会破坏有源码仓库配置的项目的工作流
- **不要修改中间 JSON schema**：`intermediate-format.md` 中的 schema 已通用化，`meta.source_standard` 字段本已可选，不强制删除
- **不要拆分 SKILL.md**：保持每个 Skill 单文件，不引入额外的 include 机制
- **不要破坏 using-qa-flow 快捷示例中的 DTStack 示例**：示例改为「通用示例 + 可选 DTStack 注释」，不能完全删除，因为 DTStack 用户仍依赖这些示例

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XMind 文件生成 | 自行处理 ZIP 结构 | `xmind-generator` npm 包（已安装） | 二进制格式复杂，已有可用库 |
| 前端/后端报错分类 | 训练分类器 | 关键词规则匹配（SKILL.md 描述） | Claude 的 NL 理解能力足够，无需代码分类器 |
| 路径解析 | 字符串拼接 | `resolveModulePath()` from load-config.mjs | Phase 2 已实现完整路径解析逻辑 |
| 中文产品名映射 | 硬编码 if/else | `config.modules[key].zh` | config 层已有此字段 |
| Symlink 管理 | 手写 fs.symlink | `refresh-latest-link.mjs` | 已有统一工具 |

**Key insight:** 本 Phase 的核心工作量在 Markdown 文件（SKILL.md + prompts）的内容替换，而非 Node.js 脚本重写。脚本层只有 `json-to-xmind.mjs`（删除 isDtstackMeta 分支）和 `convert-history-cases.mjs`（模块映射改为 config 驱动）需要改动。

---

## Common Pitfalls

### Pitfall 1: 漏改 SKILL.md 中的输出目录表格

**What goes wrong:** xmind-converter SKILL.md 的「三、输出文件规则」里有一张 DTStack 产品名硬编码表，改了脚本但没改 SKILL.md，Claude 读取 SKILL.md 时仍然按旧表路由
**Why it happens:** Skill 的行为由 Claude 读取 SKILL.md 决定，脚本只是执行工具
**How to avoid:** 先改 SKILL.md 的表格，再改脚本，最后验证
**Warning signs:** 生成的 XMind 文件路径仍含 `batch-works/` 或 `data-assets/`

### Pitfall 2: writer-subagent.md 示例改了但 writer-subagent-reference.md 没改

**What goes wrong:** 两个文件的示例不一致，Reviewer 仍然输出 DTStack 业务字段
**Why it happens:** reference 文件通常按需加载，容易遗漏
**How to avoid:** 改 writer-subagent.md 时同步检查 writer-subagent-reference.md
**Warning signs:** Reviewer subagent 输出的示例包含"质量问题台账"或"问题分类"等字段名

### Pitfall 3: 条件步骤跳过时未正确更新 last_completed_step

**What goes wrong:** `source-sync` 被跳过但 `last_completed_step` 未更新，导致续传时死循环
**Why it happens:** 跳过逻辑容易只写 "跳过" 而忘记更新状态
**How to avoid:** 在每个条件步骤的跳过路径中明确写出 `last_completed_step` 更新指令
**Warning signs:** 续传时反复执行同一个被跳过的步骤

### Pitfall 4: code-analysis-report 前端路由与现有步骤编号冲突

**What goes wrong:** 新增模式 C 插入后，原有 Step 2（定位仓库）的逻辑对前端报错不适用（Java 包名匹配前端路径）
**Why it happens:** 模式 A/B 的 Step 2 假设是后端 Java 仓库
**How to avoid:** 前端模式的仓库定位改为：优先 config.stackTrace 前端键 → fallback 到 `.repos/` 下任意 frontend/ 目录
**Warning signs:** 前端报错分析时因无法找到 Java 包名而卡在等待用户确认步骤

### Pitfall 5: using-qa-flow 功能菜单编号与实际 Skill 触发词不同步

**What goes wrong:** 菜单显示「5. XMind 转换」但 Skill 的实际触发词已变更，用户按编号选择后路由失败
**Why it happens:** SKILL.md 的 description（触发词）改了，但 using-qa-flow 的菜单没同步
**How to avoid:** 改造最后一步必须以 SKILL.md 的最新触发词更新 using-qa-flow 菜单表
**Warning signs:** 用户选功能编号后，Claude 提示"未识别的功能"或跳转到错误的 Skill

### Pitfall 6: 电商示例 SQL 建表语句过于简单，与 rules 层要求不一致

**What goes wrong:** Writer 生成的前置条件包含 `test1`、`abc` 等占位符，违反 test-case-writing.md 中"必须使用真实业务数据"的要求
**Why it happens:** 示例中的 INSERT 数据不够具体
**How to avoid:** 电商示例的 INSERT 语句使用有意义的中文数据（如商品名称、订单号格式）
**Warning signs:** Reviewer 报告 F 类问题（数据禁止词）比率超过 15%

---

## Code Examples

### SKILL.md 条件步骤跳过写法（Pattern 1）

```markdown
<!-- step-id: source-sync | delegate: testCaseOrchestrator -->
# Step source-sync：源码分支同步

> 本步骤仅在 config.json 中 `repos` 字段为非空对象时执行。
> **若 `repos: {}` 则跳过**：
> 1. 向 execution_log 追加 `{"step": "source-sync", "status": "skipped", "reason": "config.repos is empty"}`
> 2. 更新 `last_completed_step` 为 `"source-sync"`
> 3. 继续下一步（prd-formalize）
```

### json-to-xmind.mjs buildRootTitle 改造方向

```javascript
// 改造后：不再有 isDtstackMeta 分支，统一 config 驱动
function buildRootTitle(meta = {}) {
  const config = loadConfig()
  const moduleKey = meta.module_key || meta.product
  const mod = moduleKey ? config.modules?.[moduleKey] : null
  const displayName = mod?.zh || config.project?.displayName || meta.project_name || ''
  const trackerId = mod?.trackerId
  const versionPart = meta.version ? meta.version : ''
  const idSuffix = trackerId ? `(#${trackerId})` : ''
  if (versionPart || trackerId) {
    return `${displayName}${versionPart}迭代用例${idSuffix}`
  }
  return displayName || meta.requirement_name || ''
}

// buildL1Title 同样去除 isDtstackMeta 判断
function buildL1Title(meta = {}) {
  const ticketSuffix = meta.requirement_ticket ? `(#${meta.requirement_ticket})` : ''
  const versionPrefix = meta.version ? `【${meta.version}】` : ''
  return `${versionPrefix}${meta.requirement_name || ''}${ticketSuffix}`
}
```

### convert-history-cases.mjs 模块映射 config 驱动方向

```javascript
// 改造前：硬编码 DTStack 模块名映射
const MODULE_MAP = {
  '离线开发': 'batch-works',
  '数据资产': 'data-assets',
  // ...
}

// 改造后：从 config.modules 动态构建（支持任意项目）
import { loadConfig } from '../../../shared/scripts/load-config.mjs'

function buildModuleMap() {
  const config = loadConfig()
  const map = {}
  for (const [key, mod] of Object.entries(config.modules || {})) {
    if (mod.zh) map[mod.zh] = key       // 中文名 → key
    map[key] = key                       // key → key (直通)
    if (mod.aliases) {
      for (const alias of mod.aliases) map[alias] = key  // 别名 → key
    }
  }
  return map
}
```

### prd-enhancer Step 0.5 条件化（SKIL-02）

```markdown
## 二点五、Step 0.5: 正式需求文档检查（条件步骤）

> 仅在 config.repos 非空且输入明显来自外部平台原始文本（如蓝湖 URL 提取内容）时执行。
> 若 config.repos 为空，跳过本步骤直接进入 Step 1。

若 config.repos 非空且内容为原始平台文本：
1. 检查是否已有 prd-formalizer 整理结果
2. 若没有，先回退到 formalizer 流程（结合 source_context 源码）
3. 本 Skill 只对正式需求文档执行后续增强
```

### code-analysis-report 模式识别扩展（SKIL-03）

```markdown
## 一、模式识别（收到输入后首先执行）

| 模式 | 触发信号 | 执行路径 |
|------|---------|----------|
| **模式A：后端 Bug 分析** | 含 `Exception`/`Caused by`/`at com.`/`java.lang` | → 执行第二章 |
| **模式B：合并冲突** | 含 `<<<<<<< HEAD`/`=======`/`>>>>>>>` | → 执行第三章 |
| **模式C：前端报错分析** | 含 `TypeError`/`ReferenceError`/`[Vue warn]`/`React`/`Uncaught Error`/`error TS` | → 执行第四章（新增） |
| **模式D：信息不足** | 描述模糊，缺少日志或冲突内容 | → 告知用户需补充的材料 |
```

### using-qa-flow 通用化菜单写法

```markdown
## 功能菜单

| 编号 | 功能 | 说明 |
|------|------|------|
| **1** | 生成测试用例 | 根据 PRD 文档自动生成 XMind 测试用例（支持普通/快速/续传模式） |
| **2** | 增强 PRD 文档 | 为 PRD 补充图片描述、格式规范化、健康度预检 |
| **3** | 分析代码报错 | 粘贴报错日志，定位问题根因并生成 HTML 报告（支持前端/后端/冲突分析） |
| **4** | 转换历史用例 | 将 CSV/XMind 历史用例转为 Markdown 归档格式 |
| **5** | XMind 转换 | 将 JSON 数据转换为 XMind 文件 |
| **0** | 项目配置 + 环境初始化 | 首次使用时执行：项目结构推断、config.json 生成、CLAUDE.md 创建 |
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 硬编码 DTStack 产品名在脚本中 | config.modules[key].zh 动态读取 | Phase 1 | xmind/archive 脚本需对齐 |
| `repoBranchMapping` / `zentaoId` 字段 | `branchMapping` / `trackerId` | Phase 1 | 脚本中旧字段引用需清理 |
| config/ 目录存放路径配置 | .claude/config.json 统一入口 | Phase 2 | 已完成，本 Phase 无需关注 |
| loadConfig 无 schema 验证 | loadConfigFromPath + 手写验证 | Phase 1 | 本 Phase 无需关注 |
| using-qa-flow 无 init 向导 | Step 0 交互式配置向导 | Phase 3 | using-qa-flow 改造时需保留 init 向导 |

**Deprecated/outdated:**
- `isDtstackMeta()` 函数：在 json-to-xmind.mjs 中，由纯 config 驱动替代
- `source_standard: 'dtstack'` 的特殊分支：中间 JSON meta 字段仍可携带但不再驱动行为差异
- prd-enhancer Step 0.5 的 DTStack 专属措辞：改为通用的"原始平台文本检查"

---

## Skill 改造清单（逐文件）

### SKIL-04: xmind-converter

**需改文件：**
1. `SKILL.md` — 三、输出文件规则的 DTStack 产品名表格 → 改为 config 驱动说明
2. `SKILL.md` — 六、验证步骤中 `rootTopic.title` 格式说明 → 改为通用格式
3. `SKILL.md` — 八、完成通知的输出模板 → 去掉禅道产品 ID 说明
4. `scripts/json-to-xmind.mjs` — 删除 `isDtstackMeta()` 函数，改造 `buildRootTitle()` 和 `buildL1Title()`

**不需改文件：**
- `scripts/` 其他脚本（patch-xmind-roots.mjs 已通用）
- `references/xmind-structure-spec.md`（已通用）

### SKIL-05: archive-converter

**需改文件：**
1. `SKILL.md` — 二、输出目标表格的 DTStack/信永中和 硬编码路径 → config 驱动说明
2. `SKILL.md` — 六、模块名称映射表 → 改为"从 config.modules 读取"说明
3. `scripts/convert-history-cases.mjs` — MODULE_MAP 硬编码 → buildModuleMap() 动态构建

**注意：** 需保留对 `cases/history/${module}/*.csv` 的扫描逻辑，路径仍通过 resolveModulePath 解析。

### SKIL-02: prd-enhancer

**需改文件：**
1. `SKILL.md` — frontmatter 示例中的 DTStack 产品字段引用（Step 8.1 提取表格、Step 8.2 示例 front-matter）
2. `SKILL.md` — Step 0.5 标题和措辞（"DTStack 正式需求文档检查" → "原始平台文本检查（条件步骤）"）
3. `SKILL.md` — description YAML（去除"DTStack 特殊说明"段落）
4. `prompts/prd-formalizer.md` — 检查是否有 DTStack 特定指令（需读取确认）

**不需改文件：**
- Step 1-9 的核心图片处理逻辑（完全通用）
- `references/prd-template.md`（已通用）

### SKIL-03: code-analysis-report

**需改文件：**
1. `SKILL.md` — 一、模式识别表：新增模式 C（前端报错）
2. `SKILL.md` — 二、Step 2a 仓库定位表：改为 config.stackTrace 驱动 + 前端路径支持
3. `SKILL.md` — 新增第四章：前端报错分析模式完整流程
4. `references/bug-report-template.md` — 新增前端报错 HTML 模板（复用现有样式）
5. `references/env-vs-code-checklist.md` — 新增前端报错判断规则（需读取确认内容）

**现有后端逻辑保留不变。**

### SKIL-01: test-case-generator

**需改文件（按影响大小排序）：**
1. `prompts/writer-subagent.md` — 所有示例数据替换为电商场景（最大改动）
2. `prompts/writer-subagent-reference.md` — 示例数据同步替换
3. `SKILL.md` — Writer 参考文件注释中的 "DTStack 额外要求" 引用
4. `prompts/step-brainstorm.md` — 检查是否有 DTStack 特定示例（需读取确认）
5. `prompts/step-checklist.md` — 检查是否有 DTStack 特定示例（需读取确认）
6. `prompts/reviewer-subagent.md` — 检查示例数据（需读取确认）
7. `prompts/step-source-sync.md` — 已通用，验证条件跳过写法正确
8. `prompts/step-prd-formalize.md` — 已通用，验证条件跳过写法正确
9. `references/elicitation-dimensions.md` — 检查是否有 DTStack 示例

**不需改文件：**
- `references/intermediate-format.md`（schema 已通用）
- `references/decoupling-heuristics.md`（需读取确认）

### SKIL-06: using-qa-flow

**需改文件：**
1. `SKILL.md` — 功能菜单说明（去掉"支持直接输入蓝湖 URL"等 DTStack 专属说明）
2. `SKILL.md` — 功能 1 的路由引导示例（"data-assets v6.4.10"改为通用示例 + 条件 DTStack）
3. `SKILL.md` — 快速示例区块（保留通用格式 + 条件保留 DTStack 示例）

**不需改文件：**
- Step 0（init wizard）完整保留
- Step 1-5（环境初始化）已通用

---

## Open Questions

1. **convert-history-cases.mjs 中 MODULE_MAP 的 aliases 字段**
   - What we know: config.modules 目前结构无 `aliases` 字段
   - What's unclear: 是否需要在 config schema 中新增 `aliases` 字段，还是简单地只支持 `zh` 名称匹配
   - Recommendation: 优先使用 `zh` 字段匹配（足够），不引入新 schema 字段，避免 Phase 4 范围扩大

2. **prd-enhancer/prompts/prd-formalizer.md 内容**
   - What we know: 文件路径在 SKILL.md 中被引用，但本次研究未读取内容
   - What's unclear: 是否包含 DTStack 特定指令需要通用化
   - Recommendation: 计划任务中明确包含"读取并评估 prd-formalizer.md"步骤

3. **code-analysis-report 前端 HTML 模板与现有模板的共用程度**
   - What we know: 现有后端模板有完整内联样式，前端模板可复用相同样式
   - What's unclear: 前端报错的关键信息字段（组件堆栈 vs Java 堆栈）差异有多大
   - Recommendation: 新增独立的前端报告模板区块，共用样式但独立字段结构

4. **writer-subagent 快速模式中的 "DTStack 额外要求" 章节引用**
   - What we know: SKILL.md 快速模式表中有"加载「源码分析」和「DTStack 额外要求」章节"的描述
   - What's unclear: "DTStack 额外要求"是否是 writer-subagent-reference.md 中的一个章节标题
   - Recommendation: 读取 writer-subagent-reference.md 完整内容，确认章节名后更新为通用名称

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) + 已有测试套件 |
| Config file | `.claude/tests/` 目录下现有测试文件 |
| Quick run command | `node --test .claude/tests/` |
| Full suite command | `node --test .claude/tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-04 | buildRootTitle 在无 trackerId 时返回 displayName | unit | `node --test .claude/tests/test_json-to-xmind_root-title.mjs` | ❌ Wave 0 |
| SKIL-04 | buildRootTitle 在有 trackerId 时返回带 (#id) 后缀 | unit | `node --test .claude/tests/test_json-to-xmind_root-title.mjs` | ❌ Wave 0 |
| SKIL-05 | buildModuleMap 从 config.modules 动态生成映射 | unit | `node --test .claude/tests/test_convert-history-cases_module-map.mjs` | ❌ Wave 0 |
| SKIL-01 | source-sync 跳过时 last_completed_step 正确更新 | 手动验证（Claude 行为，不可自动化） | N/A | manual-only |
| SKIL-02 | prd-enhancer Step 0.5 在 repos 为空时跳过 | 手动验证 | N/A | manual-only |
| SKIL-03 | 前端报错关键词被正确路由到模式 C | 手动验证（Claude 行为） | N/A | manual-only |
| SKIL-06 | using-qa-flow 菜单显示所有 Skill 触发词 | 手动验证 | N/A | manual-only |
| E2E | 电商 PRD 端到端生成 XMind + Archive | smoke | 手动执行验收场景 | manual-only |

### Sampling Rate

- **Per task commit:** `node --test .claude/tests/` (快速运行现有套件)
- **Per wave merge:** `node --test .claude/tests/` (全套)
- **Phase gate:** 全套绿 + 手动电商场景验收通过

### Wave 0 Gaps

- [ ] `.claude/tests/test_json-to-xmind_root-title.mjs` — 覆盖 SKIL-04 buildRootTitle 改造
- [ ] `.claude/tests/test_convert-history-cases_module-map.mjs` — 覆盖 SKIL-05 模块映射改造

*(现有测试套件覆盖 load-config、output-naming-contracts 等，但不覆盖本 Phase 改造的两个脚本函数)*

---

## Sources

### Primary (HIGH confidence)

- 直接读取源码：`.claude/skills/xmind-converter/scripts/json-to-xmind.mjs` — `isDtstackMeta`、`buildRootTitle`、`buildL1Title` 函数实现
- 直接读取源码：`.claude/skills/*/SKILL.md` — 所有六个 Skill 的完整结构和 DTStack 耦合点
- 直接读取源码：`.claude/config.json` — config schema 当前结构
- 直接读取文档：`.planning/phases/04-core-skills-redesign/04-CONTEXT.md` — 用户决策

### Secondary (MEDIUM confidence)

- `.planning/codebase/ARCHITECTURE.md` — 系统分层架构描述（由之前分析生成）
- `.planning/STATE.md` — Phase 1-3 决策记录

### Tertiary (LOW confidence)

- 未读取的文件（需在计划任务中明确读取）：
  - `prompts/prd-formalizer.md`（prd-enhancer）
  - `prompts/step-brainstorm.md`、`step-checklist.md`、`reviewer-subagent.md`（test-case-generator）
  - `references/env-vs-code-checklist.md`（code-analysis-report）
  - `references/elicitation-dimensions.md`、`decoupling-heuristics.md`（test-case-generator）
  - `writer-subagent-reference.md` 完整内容（已读前 60 行）
  - `convert-history-cases.mjs`（archive-converter）

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 直接读取了所有 Skill 文件和核心脚本
- Architecture: HIGH — 改造模式基于实际代码结构分析
- Pitfalls: HIGH — 基于实际代码耦合点分析，非推断
- 待读文件中可能存在的额外耦合点: MEDIUM — 已在 Open Questions 中标记

**Research date:** 2026-03-31
**Valid until:** 2026-04-30（Skill 文件稳定，30 天内有效）
