# 节点 3: discuss — 主 agent 主持需求讨论（10 维度 / 3 选项 / 自审闭环）

> 由 workflow/main.md 路由后加载。上游：节点 2 probe；下游：节点 4 transform。
> 硬约束：`rules/prd-discussion.md`。引用资源：`references/10-dimensions-checklist.md` / `references/ambiguity-patterns.md` / `references/source-refs-schema.md`。

**目标**：在 transform 之前由主 agent 亲自主持需求讨论，落地 10 维度自检 + 3 选项提问 + 5 项自审 + 交接弹窗，产出带 pending 清单的 plan.md。

**⏳ Task**：将 `discuss` 任务标记为 `in_progress`。

> **⚠️ 主持原则**：
>
> - 本节点禁派 transform-agent / writer-agent 等承担需求讨论职责的 subagent
> - 仅允许派 Explore subagent 执行只读源码考古或归档检索
> - AskUserQuestion 由主 agent 直接发起；subagent 不得对用户发问
> - 3.3 起所有写入 plan.md 的动作必须经 `kata-cli discuss ...` CLI，禁止手改 frontmatter

---

## 3.1 plan.md 初始化或恢复

按节点 1.2 的检测结果：

- 全新讨论 → `kata-cli discuss init --project {{project}} --prd {{prd_path}}`
- 恢复 → `kata-cli discuss read --project {{project}} --prd {{prd_path}}` 拿到已答清单 + 未答 Q\* + pending_count

> `status=ready` 的 plan 已在节点 1.2 触发跳过，不会进入本节点。

## 3.2 源码引用许可（原 transform 2.2 前移）

### 3.2.1 profile 匹配

```bash
kata-cli repo-profile match --text "{{prd_title_or_path}}"
```

返回 profile_name + repos 列表。

### 3.2.2 AskUserQuestion 许可确认

展示以下（3 选项严格对齐）：

```
📋 源码引用许可（命中 profile：{{profile_name}}）

仓库预览：
  - {{path_1}} @ {{branch_1}}
  - {{path_2}} @ {{branch_2}}

选项：
  - AI 推荐：允许同步并引用以上仓库
  - 暂定 — 留给产品确认：仅本次引用现有本地副本（下一次讨论时再决定同步）
  - Other：调整仓库 / 不使用源码参考 / 自行输入
```

### 3.2.3 落盘 + 可选同步

**允许同步** → 先执行：

```bash
kata-cli repo-sync sync-profile --name "{{profile_name}}"
```

取返回的 SHA。然后写入 plan.md：

```bash
kata-cli discuss set-repo-consent \
  --project {{project}} --prd {{prd_path}} \
  --content '{"repos":[{"path":"workspace/{{project}}/.repos/studio","branch":"master","sha":"{{sha_1}}"}],"granted_at":"{{iso_now}}"}'
```

**仅引用本地副本** → 不做同步；直接 set-repo-consent 但 sha 省略。

**拒绝 / 不使用源码** → `kata-cli discuss set-repo-consent --project {{project}} --prd {{prd_path}} --clear`。

> **切换仓库 / 重启讨论** → 强制 `set-repo-consent --clear`，下一轮重新询问。

### 3.2.4 后续节点不再重复问

frontmatter.repo_consent 非空即表示同意已落地。节点 4 transform 的原 2.2 源码许可段降级为"仅写回 profile 二道确认"（如用户提出保存新 profile 映射），同步许可不再重复问。

## 3.3 需求摘要（plan §1 — 4 子节）

主 agent 综合 PRD + `workspace/{{project}}/knowledge/overview.md` + 已同步源码（若有）推导初稿，结构：

- **背景**：为什么要做这个需求（业务 / 历史 / 用户反馈）
- **痛点**：现状有什么问题
- **目标**：做完后达成什么（功能 / 性能 / 合规）
- **成功标准**：可衡量的验收指标

AskUserQuestion 逐子节确认或修正。确认后由主 agent 直接编辑 plan.md `<!-- summary:begin --> ... <!-- summary:end -->` 块（仅 §1 段；frontmatter 与 §3 JSON fence 不动）。

## 3.4 全局层扫描（新增 4 维度）

> quick 模式跳过本节（直接进入 3.5）。

对每个维度逐一检测（完整清单见 `references/10-dimensions-checklist.md`）：

### 3.4.1 数据源

- 先读 `workspace/{{project}}/knowledge/overview.md` 的项目默认假设（例如"仅 spark thrift 2.x"）
- PRD 未提 → 若与默认假设一致，可 `append-clarify` with `severity=defaultable_unknown`
- PRD 与默认假设冲突 / PRD 未说且默认假设不覆盖 → `blocking_unknown` 或 `pending_for_pm`

### 3.4.2 历史数据影响

- 存量数据迁移 / 兼容策略？
- 默认假设：非破坏性变更

### 3.4.3 测试范围

- 前端 / 后端 / 全链路？
- 跨模块联动？
- 默认假设：只测需求本身 + 直接上下游

### 3.4.4 PRD 合理性审查

- 逻辑悖论（互斥状态同存）
- 常识性缺失（导出无权限校验等）

> 每检测到一条 → 立刻 `kata-cli discuss append-clarify --content '<json>'` 落盘。

## 3.5 功能层扫描（原 6 维度，保留）

对 PRD 每个功能点逐一检查：

- 字段定义 / 交互逻辑 / 导航路径 / 状态流转 / 权限控制 / 异常处理
- 结合 `references/ambiguity-patterns.md` 10 模式做模糊语扫描
- 可派 Explore subagent 做源码考古（只读），事实摘要返回后由主 agent 整理问题

每条 clarification 的 `location` 建议格式：`功能层 → {维度关键字} → {具体位置}`，便于 §2 自检表自动统计。

## 3.6 逐条澄清（plan §3 + §4 + §6）

对每条 `blocking_unknown`：

```
AskUserQuestion(
  question: "{{Q.question}}",
  options: [
    "AI 推荐：{{Q.recommended_option.description}}（依据：{{rationale}}）",
    "暂定 — 留给产品确认（会进入 §6 待定清单）",
    "Other"（AskUserQuestion 自动提供）
  ]
)
```

用户答案 → 立刻 `append-clarify` 落盘：

| 用户选择 | severity | 写入位置 |
|---|---|---|
| AI 推荐 | `blocking_unknown` + `user_answer` | §3（自动更新 clarify_count） |
| 暂定 — 留给产品确认 | `pending_for_pm` | §3 + §6（自动更新 pending_count） |
| Other + 自由文本 | `blocking_unknown` + `user_answer` | §3 |

`defaultable_unknown` 直接 `append-clarify` with `default_policy`，不向用户发问。

示例 payload：

```bash
kata-cli discuss append-clarify \
  --project {{project}} --prd {{prd_path}} \
  --content '{
    "id": "Q1",
    "severity": "pending_for_pm",
    "question": "是否支持 Kafka 数据源？",
    "location": "全局层 → 数据源 → Kafka 支持",
    "recommended_option": "否（基于 knowledge/overview.md 默认仅 spark thrift 2.x）",
    "options": []
  }'
```

## 3.7 知识沉淀（plan §5，不变）

用户在讨论中提到的新术语 / 业务规则 / 踩坑 → 显式调：

```bash
kata-cli knowledge-keeper write \
  --project {{project}} --type term|module|pitfall \
  --content '{...}' --confidence high --confirmed
```

收集所有沉淀条目 → 待 3.9 一并传入 `complete --knowledge-summary`。

## 3.8 自审闭环（新增）

主 agent 在 complete 之前，按 `rules/prd-discussion.md` 5 项自审清单逐条自查：

1. 摘要四子节完整（无 _TODO 占位）
2. 10 维度都过一遍（quick 模式仅 6 维度）
3. 模糊语 10 模式全扫
4. blocking 全答
5. pending 已入 §6

完成后调 CLI 自审：

```bash
kata-cli discuss validate \
  --project {{project}} --prd {{prd_path}} \
  --require-zero-blocking
```

- 退出码 0 → 进入 3.9
- 退出码 2（blocking_unanswered > 0）→ 回 3.6 续问
- 退出码 1（schema error）→ 检查 plan.md 是否被误改

> **注意**：本节点不加 `--require-zero-pending`；出口允许带 pending（下游 Phase C 入口才拦截）。

## 3.9 complete + 交接模式弹窗（新增）

### 3.9.1 AskUserQuestion 选交接模式

若 pending_count > 0，展示时标红警告：

```
⚠️ 当前有 {{pending_count}} 条 pending_for_pm 待产品确认（详见 plan.md §6）。
下游门禁（Phase C）会拦截，必须先把 §6 打勾回写后才能跑 transform。

如何继续？

- Current-Session-Driven（同会话继续）
- New-Session-Driven（输出交接 prompt，结束当前会话，由用户新开会话接力）
```

### 3.9.2 调 complete

```bash
kata-cli discuss complete \
  --project {{project}} --prd {{prd_path}} \
  --handoff-mode current|new \
  --knowledge-summary '[{"type":"term","name":"..."},...]'
```

- 成功 → status=ready / resume_anchor=discuss-completed / handoff_mode 落盘
- 退出 1（仍有未答 blocking）→ 回 3.6

### 3.9.3 交接分支

**Current-Session-Driven** → 进入节点 4 transform。若 pending_count > 0，**本 phase 暂不拦截**（Phase C 才启用）；但在下一次执行 transform 前应先在 plan.md §6 打勾 + `append-clarify` 转 `blocking_unknown` + `user_answer`。

**New-Session-Driven** → 输出交接 prompt 并结束当前会话：

```
📋 Handoff to new session

项目：{{project}}
PRD：{{prd_path}}
plan.md：workspace/{{project}}/prds/{{YYYYMM}}/{{prd_slug}}.plan.md
pending_count：{{n}}
下一步建议：
  1. 产品在 plan.md §6 打勾回写
  2. 在新会话中：/test-case-gen {{prd_path}} —— 主 agent 会自动从 discuss-completed 恢复
  3. 跑 transform 前主 agent 会再调 discuss validate
```

**⚠️ 临时横幅**（Phase B/C 间隔期提示）：

```
⚠️ Phase B 已上线，但下游门禁（Phase C）未启用。
若 pending_count > 0 且你选择继续 transform，plan.md §6 的未打勾项不会被自动拦截。
建议：pending_count > 0 时，先请产品回写 §6，再手动触发 transform。
```

**✅ Task**：将 `discuss` 任务标记为 `completed`（subject 更新为 `discuss — {{clarify_count}} 条澄清 / {{auto_defaulted_count}} 条默认 / {{pending_count}} 条待定`）。

## 3.10 strategy_id 传递（不变，原 3.7）

从本节点起，派发下游 subagent（transform / analyze / writer）时，task prompt 必须包含：

```
strategy_id: {{resolution.strategy_id}}
```

（若 probe 节点返回空 resolution，默认 S1）

subagent 按 `.claude/references/strategy-templates.md` 对应 section 调整行为。

---

## 异常分支

| 情况 | 处理 |
|---|---|
| `discuss read` 返回 schema 错误 | `discuss reset` → 重新 init |
| `set-repo-consent` 失败（plan 不存在） | 先走 3.1 init |
| 源码同步失败 | 提示用户；降级为"仅引用本地副本"走 3.2.3 分支 2 |
| validate 返回 exit 2 | 回 3.6 |
| 用户中途切换 PRD | 禁止当前 plan 复用；走 `discuss reset` + 重新 init |
