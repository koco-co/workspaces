# source_ref 锚点规范

> 供 Phase C 下游节点（analyze / write / review）使用。Phase B 先落规范文档，不强制检查。
> 在 discuss 阶段产出的 clarification 中，推荐填 `context.source` 字段引用 PRD / knowledge / plan 锚点；下游测试点沿用同语法。

## 语法

```
source_ref ::= <scheme>#<anchor>
scheme     ::= plan | prd | knowledge | repo
```

### plan 锚点

指向当前讨论 plan.md 的 §3 条目：

```
plan#q3-数据源
plan#q12-审批状态
```

**渲染规则：**
- `q{id}` 小写，`id` 取自 clarification.id
- `-{slug}` 为 location 最末段的中文 slug（去掉箭头、空格），便于人读

### prd 锚点

指向 PRD 文件小节（GitHub 风格 anchor，小写、空格转 `-`）：

```
prd#section-2.1.3
prd#审批状态字段定义
```

**渲染规则：**
- PRD 文件路径由 frontmatter.prd_path 决定，锚点本身不带文件名
- 子节编号（若 PRD 有）优先使用；否则用小节标题 slug

### knowledge 锚点

指向 `workspace/{project}/knowledge/` 某个条目：

```
knowledge#overview.数据源默认
knowledge#term.审批.中文解释
knowledge#pitfall.前端缓存穿透
```

**渲染规则：**
- 首段为条目类型（overview / term / module / pitfall）
- 第二段为条目名（支持中文）
- 第三段可选，为子字段

### repo 锚点（可选）

指向源码行：

```
repo#studio/src/approval/list.tsx:L123
repo#backend/ApprovalController.java:L45-L60
```

**渲染规则：**
- `{repo_name}/{relative_path}:L{line}` 或 `:L{start}-L{end}`
- repo_name 取自 plan.md.repo_consent.repos[i].path 的最末段

## 在 Clarification 中使用

```json
{
  "id": "Q1",
  "severity": "blocking_unknown",
  "question": "审批状态是否包含\"已驳回\"？",
  "location": "功能层 → 字段定义 → 审批状态",
  "context": {
    "source": "repo#studio/src/approval/list.tsx:L45",
    "archive": "knowledge#module.审批.状态流转"
  },
  "recommended_option": "B",
  "options": [
    { "id": "A", "description": "仅待审批/已通过" },
    { "id": "B", "description": "包含已驳回" }
  ]
}
```

## Phase C 将强制的地方

| 节点 | 强制字段 | 失败行为 |
|---|---|---|
| analyze 产出测试点 | `source_ref` 必填 | 缺失 → 重派 analyze 或降级走 PRD 锚点 |
| write 产出用例 | 继承自测试点的 `source_ref` | 缺失 → reviewer 判定严重问题 |
| review | 校验锚点可解析 | 锚点不可解析 → 标记为严重问题 |

Phase B 不检查，只规范文档。主 agent 与 subagent 在 discuss 阶段已可提前按本规范填 context.source。
