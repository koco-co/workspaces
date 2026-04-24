# 节点 6: analyze — 历史检索与测试点规划

> 由 workflow/main.md 路由后加载。上游：节点 5 enhance；下游：节点 7 write。

**目标**：检索历史用例、QA 头脑风暴、生成测试点清单 JSON。

**⏳ Task**：将 `analyze` 任务标记为 `in_progress`。

### 6.0 下游入口门禁（Phase C 新增）

进入本节点**前必须**执行 discuss 门禁（与 4.0 同口径）：

```bash
kata-cli discuss validate \
  --project {{project}} --prd {{prd_path}} \
  --require-zero-blocking --require-zero-pending
```

退出码处理同 4.0。退出 3（pending > 0）→ 回 discuss 节点 3.6 把产品回写的 §6 条目转 blocking+answer，再跑 3.9 complete 后重入本节点。

> **为什么在 analyze 也要拦一道**：用户可能直接跳过 transform（例如测试点重做）。保守冗余一次门禁比事后修补便宜。

### 6.1 历史用例检索

```bash
kata-cli archive-gen search --query "{{keywords}}" --project {{project}} --limit 20 \
  | kata-cli search-filter filter --top 5
```

> 注：`workspace/{{project}}/archive` 中的 `workspace` 对应 `.env` 中 `WORKSPACE_DIR` 的值（默认 `workspace`），`{{project}}` 为当前选中的项目名称。`search-filter.ts` 对结果做相关性排序并截取 top-5，减少传入 analyze-agent 的上下文体积。

> **Phase C 变化**：历史用例仅用于本节点 analyze-agent 自身的"覆盖分析"（避免重复产出同类测试点），**不再**作为 writer 的参考输入（见 07-write.md 7.1）。`historical_coverage` 输出字段保留，用于审计和日志回放，writer-agent 在 Phase C 不再读取它。

### 6.2 测试点清单生成（AI 任务）

派发 `analyze-agent`（model: opus），结合增强后 PRD + 历史用例，生成结构化测试点清单。

--quick 模式下简化分析：跳过历史检索，直接从 PRD 提取测试点。

### 6.3 更新状态

```bash
kata-cli progress task-update --project {{project}} --session "$SESSION_ID" --task analyze --status done --payload '{{json}}'
```

**✅ Task**：将 `analyze` 任务标记为 `completed`（subject 更新为 `analyze — {{n}} 个模块，{{m}} 条测试点`）。

### 交互点 C — 测试点摘要（默认直接进入 write）

先在普通文本中展示测试点清单概览：

```
测试点清单（共 {{n}} 个模块，{{m}} 条测试点）：

┌─ {{module_a}}（{{count_a}} 条）
│  ├─ {{page_1}}: {{points}}...
│  └─ {{page_2}}: {{points}}...
└─ {{module_b}}（{{count_b}} 条）
```

默认行为：若测试点清单无 `blocking_unknown` / `invalid_input`，直接进入 write 节点。

仅当 analyze-agent 标记需要人工裁决，或用户明确要求修改范围时，才使用 AskUserQuestion：

- 问题：`测试点清单存在待裁决项，是否需要调整后再生成？`
- 选项 1：直接开始生成（推荐）
- 选项 2：调整测试点清单
- 选项 3：增加/删除测试点
