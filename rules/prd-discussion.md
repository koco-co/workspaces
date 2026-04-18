# PRD 需求讨论规则

> 适用于 test-case-gen 工作流的 discuss 节点（参见 `.claude/skills/test-case-gen/references/discuss-protocol.md`）。

## 主持权

- discuss 节点禁派 transform-agent / writer-agent 等承担"需求讨论"职责的 subagent
- 仅允许派 Explore subagent 执行只读源码考古或归档检索；Explore 返回的事实摘要由主 agent 整理后再向用户提问
- AskUserQuestion 由主 agent 直接发起；subagent 不得对用户发问

## 提问粒度

- 每次 AskUserQuestion 单条最多 4 个候选项
- 自动默认项必须在 plan.md §4 留下依据（source 文件路径、归档需求 ID、PRD 引用之一）
- defaultable_unknown 一律自动落地，不向用户发问；记录为 `severity=defaultable_unknown` + `default_policy`

## 沉淀知识

- 用户在讨论中提到的新术语 / 业务规则 / 踩坑必须经 `knowledge-keeper write` API 落地
- 严禁主 agent 直接写 `workspace/{project}/knowledge/` 下任何文件
- 沉淀完成后由 `discuss complete --knowledge-summary '<json>'` 同步写入 plan.md frontmatter 的 `knowledge_dropped` 字段

## plan.md 关键字段保护

- `plan_version` / `status` / `resume_anchor` / `*_count` / `created_at` / `updated_at` 字段由 discuss CLI 维护，主 agent 与人工不得手工编辑
- §1 摘要 / §3 用户答案文本可由主 agent 在讨论中追加修订，但应优先通过 `append-clarify` API
- §6 下游 hints 仅由 `discuss complete` 阶段写入

## 重启检测

- init 节点必须先调 `discuss read` 检查 plan 状态：
  - `不存在` 或 `status=obsolete` → 进入 discuss 节点 init 模式
  - `status=discussing` → 进入 discuss 节点恢复模式（从未答 Q* 续问）
  - `status=ready` → 跳过 discuss 节点，直接进入 transform

## clarify_envelope 协议已弃用

- transform-agent 不再产出 `<clarify_envelope>` XML 块
- 旧 `references/clarify-protocol.md` 仅供历史 PRD 兼容回退使用
- 所有澄清都通过 plan.md §3 持久化
