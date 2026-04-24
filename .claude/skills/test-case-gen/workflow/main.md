# test-case-gen · primary workflow

> 由 SKILL.md 路由后加载。适用场景：PRD 路径 / 蓝湖 URL / 模块重跑指令。
> 共享的契约、断点续传、Writer 阻断协议、异常处理定义见本文件末尾；节点正文拆入 `workflow/0N-<name>.md`。

## 节点映射表

| #   | 名称         | 文件                        | 默认超时 | 可跳过条件        |
| --- | ------------ | --------------------------- | -------- | ----------------- |
| 1   | init         | workflow/01-init.md         | 30s      | —                 |
| 2   | probe        | workflow/02-probe.md        | 2min     | 断点恢复          |
| 3   | discuss      | workflow/03-discuss.md      | 15min    | plan.status=ready |
| 4   | transform    | workflow/04-transform.md    | 5min     | —                 |
| 5   | enhance      | workflow/05-enhance.md      | 3min     | --quick           |
| 6   | analyze      | workflow/06-analyze.md      | 5min     | —                 |
| 7   | write        | workflow/07-write.md        | 10min    | —                 |
| 8   | review       | workflow/08-review.md       | 3min     | --quick           |
| 9   | format-check | workflow/09-format-check.md | 5min     | —                 |
| 10  | output       | workflow/10-output.md       | 1min     | —                 |

**加载规则**：主 agent 按映射表 `文件` 字段动态 Read；同会话已读无需重复读。

---

## 任务可视化（TaskCreate 10 任务）

> 全流程使用 `TaskCreate` / `TaskUpdate` 工具展示实时进度，让用户在终端看到全局视图。

workflow 启动时（节点 1 开始前），使用 `TaskCreate` 一次性创建 10 个任务（含 discuss 与 format-check），按顺序设置 `addBlockedBy` 依赖：

| 任务 subject                        | activeForm                       |
| ----------------------------------- | -------------------------------- |
| `init — 输入解析与环境准备`         | `解析输入与检测断点`             |
| `probe — 4 维信号探针与策略派发`    | `采集 4 维信号并路由策略`        |
| `discuss — 主 agent 主持需求讨论`   | `主持需求讨论与 plan.md 落地`    |
| `transform — 源码分析与 PRD 结构化` | `分析源码与结构化 PRD`           |
| `enhance — PRD 增强`                | `增强 PRD（图片识别、要点提取）` |
| `analyze — 测试点规划`              | `生成测试点清单`                 |
| `write — 并行生成用例`              | `派发 Writer 生成用例`           |
| `review — 质量审查`                 | `执行质量审查与修正`             |
| `format-check — 格式合规检查`       | `检查格式合规性`                 |
| `output — 产物生成`                 | `生成 XMind + Archive MD`        |

**状态推进规则**：

- 进入节点时 → `TaskUpdate status: in_progress`
- 节点完成时 → `TaskUpdate status: completed`，在 `subject` 末尾追加关键指标（如 `init — 已识别 PRD，普通模式`）
- 节点失败时 → 保持 `in_progress`，不标记 `completed`

### write 节点子任务

进入 write 节点后，为每个模块额外创建子任务：

- subject: `[write] {{模块名}}`
- activeForm: `生成「{{模块名}}」用例`
- 设置 `addBlockedBy` 指向 write 主任务

Writer Sub-Agent 完成时更新：`[write] {{模块名}} — {{n}} 条用例`

### format-check 循环子任务

进入节点 9 format-check 后，为第 1 轮创建子任务：

- subject: `[format-check] 第 1 轮`
- activeForm: `执行第 1 轮格式检查`

每轮完成时更新 subject 为 `[format-check] 第 {{n}} 轮 — {{偏差数}} 处偏差`，若需下一轮则创建新子任务。

---

## 共享协议

### Writer 阻断中转协议（Phase C：回射到 discuss）

当 Writer Sub-Agent 返回 `<blocked_envelope>` 时，表示需求信息不足以继续编写，或输入无效。

**核心变更**：Phase C 起不再"现场 AskUserQuestion"，而是把阻断条目回射到 discuss 节点沉淀为 plan.md §3 的持久记录。目的是让同类需求在下一次讨论阶段就能提前识别漏掉的维度。

#### 处理流程

1. **解析 envelope**：从 `<blocked_envelope>` 提取 `items[]`

2. **分流 invalid_input**：
   - 若 `status = "invalid_input"` → 停止该模块并要求修正输入（PRD / 测试点 / writer_id 本身损坏），不走本协议剩余步骤

3. **逐条回射到 discuss append-clarify**（仅 `status = "needs_confirmation"` 的分支）：

   每个 item 映射为：

   ```json
   {
     "id": "{{item.id}}",
     "severity": "blocking_unknown",
     "question": "{{item.question}}",
     "location": "writer-回射：{{item.location}}（writer_id={{writer_id}}）",
     "recommended_option": "{{item.recommended_option}}",
     "options": "{{item.options}}",
     "context": {
       "writer_id": "{{writer_id}}",
       "type": "{{item.type}}",
       "source": "{{item.context}}"
     }
   }
   ```

   调 CLI 逐条落盘：

   ```bash
   kata-cli discuss append-clarify \
     --project {{project}} --prd {{prd_path}} \
     --content '<json 上表>'
   ```

   注意：`kata-cli discuss append-clarify` 会自动把 plan.md.status 从 `ready` 重置为 `discussing`，`resume_anchor` 会被顺带清零——这正是 Phase C 期望的行为（写作已中断，需要重走 discuss 闭环）。

4. **回到 discuss 3.6 → 3.8 → 3.9**：主 agent 按 `workflow/03-discuss.md` 3.6 节逐条向用户确认（仍是 3 选项格式），用户回答后再次自审（3.8）+ complete（3.9）。

5. **重入 writer**：discuss complete 成功返回 `status=ready` 后，主 agent 回到节点 7 write 派发该模块 Writer。重派前构建 `<confirmed_context>`：

   ```xml
   <confirmed_context>
   {
     "writer_id": "{{writer_id}}",
     "items": [
       {
         "id": "B1",
         "resolution": "plan_answered",
         "plan_ref": "plan#q{{new_q_id}}-{{slug}}",
         "value": "{{plan §3 的 user_answer 字段}}"
       }
     ]
   }
   </confirmed_context>
   ```

   - 所有 item 的 `resolution` 固定为 `"plan_answered"`（不再区分 `user_selected` / `auto_defaulted`，因为值都来自 plan.md）
   - `plan_ref` 必填，指向 discuss 回射后的新 Q 条目

6. **Writer 必须优先采纳 plan_answered**：writer-agent 的 `<confirmed_context>` 优先级规则不变；但主 agent 不得再以"auto_defaulted"重注入回射条目——Phase C 要求全部沉淀到 plan.md。

### 断点续传说明

- **状态文件位置**：`.kata/{project}/sessions/test-case-gen/{prd-slug}-{env}.json`
- **自动检测**：节点 1 的 `progress session-resume` 命令自动发现并恢复
- **节点更新**：每个节点完成时通过 `progress task-update` 写入进度
- **最终清理**：节点 10 output 成功后执行 `progress session-delete` 删除状态文件
- **状态结构**：参见 `.claude/references/output-schemas.json` 中的 `qa_state_file`。

### 异常处理

任意节点执行失败时：

1. 更新状态文件记录失败节点
2. 发送 `workflow-failed` 通知：

```bash
kata-cli plugin-loader notify --event workflow-failed --data '{"step":"{{node}}","reason":"{{error_msg}}"}'
```

3. 向用户报告错误，提供重试选项
