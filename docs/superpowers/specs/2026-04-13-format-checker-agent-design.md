# Format Checker Agent 设计文档

> 在 test-case-gen 工作流中新增 format-checker agent，形成 writer → reviewer → format-checker 闭环循环，确保输出的测试用例严格符合编写规范。

## 1. 背景与动机

### 问题现状

以岚图-主流程用例为例，writer 提示词（R01-R11）明确定义了用例编写规范，但实际输出严重违规：

| 规则 | 要求 | 实际偏差 |
|------|------|----------|
| R02 首步格式 | `进入【完整路径】页面，等待...` | `进入元数据 -> 数据地图首页` — 路径格式错误，无等待条件 |
| R04 模糊词 | 禁止"正常"、"相关"、"等" | `表单显示正常` `数据正确` 遍布全文 |
| R05 数据真实性 | 具体值 | `选择一个业务属性` `点击某个实例` — 无具体值 |
| R06 预期可断言 | 可转 expect() | `统计数据包含 SparkThrift2.x 类型数据源` — 不可断言 |
| R09 表单合并 | 列表格式、`*` 标记 | 一行逗号罗列所有字段 |
| R10 前置条件 | 操作化 + SQL | `已配置 SparkThrift2.x 类型数据源` — 典型反面教材 |

### 根因分析

现有 reviewer（F01-F15）虽覆盖了格式检查，但它同时承担设计逻辑审查，且执行后直接进入 output。没有独立的"格式合规守门人"来确保产物达标后才放行。

### 设计目标

新增 format-checker agent 作为**零容忍格式守门人**：任何一处偏差都打回修正，直到零偏差才允许进入 output 节点。

## 2. 工作流架构变更

### 变更前（7 节点）

```
init → transform → enhance → analyze → write → review → output
```

### 变更后（8 节点，review 后插入 format-check 闭环）

```
init → transform → enhance → analyze → write → review → format-check ─┐
                                                  ↑                     │
                                                  └── (有偏差) ─────────┘
                                                       writer → review → format-check
                                                       最多 5 轮（--quick 模式 2 轮）
                                                  │
                                                  ↓ (无偏差)
                                                output
```

### 闭环循环流程

```
节点 6 (review) 完成
    ↓
节点 6.5 (format-check) — 第 N 轮
    ↓
生成临时 Archive MD（tmp/ 目录）
    ↓
format-checker agent 检查 Archive MD
    ↓
format-report-locator.ts 生成行号报告
    ↓
verdict === "pass"? ──── yes → 进入节点 7 (output)
    │ no
    ↓
round < max? ─────────── no → 向用户报告，交互点决策
    │ yes
    ↓
偏差报告注入 writer 上下文（FORMAT_ISSUES 块）
    ↓
writer agent 修正（仅修正报告中指出的用例）
    ↓
reviewer agent 复审修正后的 JSON
    ↓
重新生成临时 Archive MD
    ↓
format-checker agent 再检 → 回到判定
```

## 3. Reviewer 职责拆分

### 从 reviewer 移除的规则（交给 format-checker）

| 规则 | 内容 |
|------|------|
| F01 | 标题格式 |
| F02 | 首步格式 |
| F03 | 步骤编号前缀 |
| F04 | 模糊词检测 |
| F05 | 测试数据真实性 |
| F06 | 预期结果具体性 |

### Reviewer 保留的规则（设计逻辑审查）

| 规则 | 内容 | 类型 |
|------|------|------|
| F07 | 正向用例合并 | 设计逻辑 |
| F08 | 逆向用例单一性 | 设计逻辑 |
| F09 | 表单字段合并 | 设计逻辑 |
| F10 | 前置条件完整性（SQL） | 设计逻辑 |
| F11 | 跨模块去重 | 设计逻辑 |
| F12 | 多项内容编号换行 | 结构拆分 |
| F13 | 预期结果模糊兜底 | 内容精度 |
| F14 | 前置条件笼统概括 | 内容精度 |
| F15 | 前置条件多步操作闭合 | 设计逻辑 |

### 拆分理由

F12/F13 留在 reviewer 而非 format-checker，因为：
- F12 涉及前置条件和预期结果的结构化拆分，需理解用例上下文
- F13 删除模糊兜底后需确保剩余预期仍完整，需设计层面判断

Reviewer 质量门禁（<15% / 15-40% / >40%）不变，计算范围仅针对 F07-F15。

## 4. Format Checker Agent 设计

### 角色定义

纯审查角色，**只读不写**。不修改任何用例内容，只输出偏差报告。

### 检查规则（FC01-FC11）

| 规则 | 检查内容 | 对应 Writer 规则 | 判定方式 |
|------|----------|-----------------|----------|
| FC01 | 标题格式：`【P0/P1/P2】验证` 开头 | R01 | 正则 |
| FC02 | 首步格式：`进入【完整路径】页面` + 等待条件 | R02 | 正则 + 语义 |
| FC03 | 步骤编号前缀：禁止 `步骤1:` `Step1:` | R03 | 正则 |
| FC04 | 模糊词：7 个禁止词逐一扫描（尝试、相关、如/比如、等、某个/某些、适当的、正常的） | R04 | 正则 |
| FC05 | 测试数据真实性：禁止占位符（test1、abc、xxx、123456 等） | R05 | 正则 + 语义 |
| FC06 | 预期结果可断言化：禁止空洞表述（操作成功、显示正确、加载正常、数据正确、功能正常） | R06 | 语义 |
| FC07 | 步骤三要素：操作位置 + 操作对象 + 操作动作+具体值 | R02 | 语义 |
| FC08 | 表单字段格式：已合并的表单步骤是否用 `- *字段: 值` 列表格式、含 `*` 必填标记（注：是否应该合并由 reviewer F09 判定，FC08 只检查已合并步骤的格式是否规范） | R09 | 语义 |
| FC09 | 前置条件操作化：具体到操作路径/SQL，禁止"已配置""已准备"等模糊表述 | R10 | 语义 |
| FC10 | 异步等待条件：导航/搜索/提交后必须注明等待条件 | R02 | 语义 |
| FC11 | 格式规范：表单换行列举、多项编号换行 | R11 | 正则 + 语义 |

FC07 和 FC10 是 reviewer 原本未覆盖但 writer 规则明确要求的——这解释了岚图用例中步骤三要素和等待条件严重缺失的根因。

### 输入

format-checker 接收 **Archive MD 文件**（而非中间 JSON），理由：
1. Archive MD 是最终交付物，也是 ui-autotest 的直接消费对象
2. MD 层面检查能发现 JSON→MD 转换过程中引入的格式问题
3. 行号定位在 MD 文件上才有意义

### 输出格式

```json
{
  "verdict": "pass | fail",
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
        "group": "首页统计",
        "line": 39
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

### Verdict 判定

- `pass`：issues_count === 0，零偏差放行
- `fail`：issues_count > 0，任何一处偏差打回

## 5. format-report-locator.ts 脚本设计

### 职责

接收 format-checker 的 JSON 报告，反查 Archive MD 文件，为每个 issue 精确定位行号，输出带行号的可读报告。

### 接口

```bash
bun run .claude/scripts/format-report-locator.ts \
  --report {{format_checker_json_path}} \
  --archive {{archive_md_path}}
```

### 定位逻辑

1. 解析 Archive MD，构建索引：`用例标题 → 起始行号`（按 `#####` 匹配），`步骤编号 → 行号`（按表格行匹配）
2. 遍历 issues，按 `case_title` + `step_number` 匹配行号
3. 容错：匹配失败时回退到模块+页面级定位，附带 `line: -1`

### 输出格式（终端可读）

```
+--------------------------------------------------+
|  Format Check Report -- Round 2/5  ·  FAIL       |
|  8 issues in 122 cases                            |
+--------------------------------------------------+

[FC02] 首步格式  -- 岚图-主流程用例.md:39
  用例：【P2】验证数据地图首页资产类型统计正确
  步骤 1 > 进入元数据 -> 数据地图首页
  问题：导航路径使用 '->' 而非 '→'，缺少【】包裹，缺少等待条件
  期望：进入【元数据 → 数据地图】页面，等待资产统计数据加载完成

[FC04] 模糊词  -- 岚图-主流程用例.md:41
  用例：【P2】验证数据地图首页资产类型统计正确
  步骤 2 预期 > 统计数据包含 SparkThrift2.x 类型数据源的表数量、视图数量
  问题：预期结果不可断言，"包含"表述模糊
  期望：明确具体的统计数值或数值变化

-- Summary ------------------------------------------------
FC02 首步格式      x5
FC04 模糊词        x2
FC06 预期可断言    x1
```

同时输出结构化 JSON（与输入格式一致，补充了 line 字段），供主 agent 消费。

## 6. Writer 修正机制

### 偏差报告注入格式

format-checker 的偏差报告以 `## FORMAT_ISSUES` 块注入 writer 上下文：

```markdown
## FORMAT_ISSUES

以下用例存在格式偏差，请严格按期望格式修正，不得改变用例的测试目的和核心逻辑：

### Issue 1 [FC02]
- 用例：【P2】验证数据地图首页资产类型统计正确
- 步骤 1
- 当前：进入元数据 -> 数据地图首页
- 问题：导航路径使用 '->' 而非 '→'，缺少【】包裹，缺少等待条件
- 期望格式：进入【元数据 → 数据地图】页面，等待资产统计数据加载完成

### Issue 2 [FC06]
...
```

### 修正范围

Writer 仅修正报告中列出的用例，不重写全部。未被列出的用例原样保留。

## 7. 循环控制与交互

### 最大轮数

| 模式 | 最大轮数 |
|------|----------|
| 普通模式 | 5 轮 |
| --quick 模式 | 2 轮 |

### 超出最大轮数的交互点

```
使用 AskUserQuestion：
- 问题：格式检查已执行 {{max}} 轮，仍有 {{n}} 处偏差未修正。如何处理？
- 选项 1：强制输出（忽略剩余偏差）
- 选项 2：查看未修正项详情
- 选项 3：人工修正后继续
```

### 状态持久化

每轮循环后更新 state.ts，支持断点续传：

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

## 8. 文件改动清单

### 修改文件

| 文件 | 改动内容 |
|------|----------|
| `.claude/skills/test-case-gen/SKILL.md` | 节点 6-7 间插入节点 6.5 编排逻辑；状态结构新增 `format_check` 字段；--quick 模式补充说明 |
| `.claude/skills/test-case-gen/prompts/reviewer.md` | 移除 F01-F06 规则；角色定义更新为"设计逻辑审查" |

### 新增文件

| 文件 | 内容 |
|------|------|
| `.claude/skills/test-case-gen/prompts/format-checker.md` | format-checker agent 提示词，含 FC01-FC11 规则、输入输出格式、verdict 判定逻辑（~200 行） |
| `.claude/scripts/format-report-locator.ts` | 行号定位脚本（~150 行） |
| `.claude/scripts/__tests__/format-report-locator.test.ts` | 对应单元测试（~100 行） |

### 无需改动的文件

| 文件 | 原因 |
|------|------|
| `prompts/writer.md` | R01-R11 不变 |
| `prompts/analyze.md` / `transform.md` / `enhance.md` | 不涉及 |
| `scripts/archive-gen.ts` | 复用已有 `convert` 命令 |
| `scripts/state.ts` | 已支持任意字段 `update` |

### 改动量

- 新增：~500 行
- 修改：~85 行
- 删除：~80 行
- 总计：~600 行
