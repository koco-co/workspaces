# 统一任务进度引擎 `progress` 设计

> **状态：** Design（待 writing-plans 拆解为实施计划）
> **日期：** 2026-04-24
> **作者：** Claude（brainstorming session）

## Goal

把 `test-case-gen` 的 `kata-state.ts` 和 `ui-autotest` 的 `ui-autotest-progress.ts` 两套断点续传机制**一次性统一**为通用任务进度引擎 `kata-cli progress`。所有工作流（现有与未来）共用同一套任务模型、CLI、锁、查询语义，subagent 通过 CLI 协作，不直接操作状态文件。

## 背景：现状与痛点

### 现状

| 维度 | `kata-state.ts`（test-case-gen） | `ui-autotest-progress.ts`（ui-autotest） |
|---|---|---|
| 粒度 | PRD 为单位，固定 7 节点流水线 | 套件为单位，动态 case 列表 |
| 状态枚举 | 通过 `completed_nodes[]` 推进 | `pending / running / passed / failed` |
| 阻塞语义 | 无 | 无（只有 failed） |
| 动态增减任务 | 不支持（节点固定） | 不支持（create 时一次性生成） |
| 查询接口 | 无（只能 read 全文件） | 有 `summary` |
| 文件位置 | `workspace/{project}/.temp/` | `workspace/{project}/.temp/` |

### 已踩到的坑

1. Subagent 卡住/失败时无处标记"阻塞中 + 原因"，主 agent 恢复时无法定位
2. 运行中才发现需要拆更细的子任务，schema 不支持动态添加
3. 查"还剩什么 / 为什么停了"没有统一命令，每个 skill 自己读 JSON
4. 两套状态文件散落 `.temp/`，生命周期难统一管理

## Architecture

- **统一 CLI 入口：** `kata-cli progress <subcmd>`，替代 `kata-state` 和 `ui-autotest-progress`
- **统一存储：** 仓库根级 `.kata/{project}/sessions/{workflow}/{slug}-{env}.json`，跟 `workspace/` 同级，gitignored
- **统一任务模型：** 扁平任务列表 + `parent` 结构关系 + `depends_on` 执行依赖，单一 schema 覆盖所有工作流
- **统一状态枚举：** `pending | running | done | blocked | failed | skipped`
- **统一锁：** 文件级排他锁（PID + 抖动重试），复用 `kata-state.ts` 现有实现
- **统一查询语义：** 默认只返回"可执行任务"（父已 running/done + 依赖已满足），保证 subagent 不会看到未解锁的任务
- **Subagent 协议：** 禁止直接读写 JSON 文件，所有操作走 CLI

## 目录布局

```
.kata/                                    # 仓库根级，gitignored
└── {project}/                            # dataAssets / xyzh / ...
    ├── sessions/
    │   ├── test-case-gen/
    │   │   └── {prdSlug}-{env}.json
    │   ├── ui-autotest/
    │   │   └── {suiteSlug}-{env}.json
    │   └── hotfix-case-gen/
    │       └── {bugId}-{env}.json
    ├── locks/
    │   └── {session_id}.lock
    ├── blocks/                           # session artifact 大 blob 外溢
    │   └── {workflow}/
    │       └── {slug}/
    │           └── {hash}.json
    └── legacy-backup/                    # 迁移后旧文件归档
```

**关键约定：**
- `.kata/` 绝对不进 git（`.gitignore` 显式包含）
- Session ID 格式：`{workflow}/{slug}-{env}`（例：`test-case-gen/prd-xxx-default`）
- `env` 缺省为 `default`，多环境切换靠 `ACTIVE_ENV` 环境变量驱动

## 数据模型（Schema v1）

### Session 文件

```json
{
  "schema_version": 1,
  "session_id": "test-case-gen/prd-xxx-default",
  "workflow": "test-case-gen",
  "project": "dataAssets",
  "env": "default",
  "created_at": "2026-04-24T12:00:00Z",
  "updated_at": "2026-04-24T12:30:00Z",
  "source": {
    "type": "prd",
    "path": "workspace/dataAssets/prds/202604/xxx.md",
    "mtime": "2026-04-24T11:55:00Z"
  },
  "meta": {
    "mode": "normal"
  },
  "tasks": [
    {
      "id": "t1",
      "parent": null,
      "depends_on": [],
      "order": 1,
      "name": "transform",
      "kind": "node",
      "status": "done",
      "reason": null,
      "attempts": 1,
      "payload": { "confidence": 0.85 },
      "errors": [],
      "started_at": "2026-04-24T12:00:00Z",
      "completed_at": "2026-04-24T12:10:00Z"
    },
    {
      "id": "t5",
      "parent": "t3",
      "depends_on": ["t2", "t4"],
      "order": 2,
      "name": "写用例#2",
      "kind": "case",
      "status": "blocked",
      "reason": "LLM 超时，需人工介入",
      "attempts": 2,
      "payload": { "case_id": "c2", "priority": "P0" },
      "errors": [
        { "at": "2026-04-24T12:20:00Z", "message": "Timeout after 300s" }
      ]
    }
  ],
  "artifacts": {
    "strategy_resolution": { "…": "原 kata-state 共享字段" },
    "cached_parse_result": { "$ref": "blocks/test-case-gen/prd-xxx/abc123.json" }
  }
}
```

### 字段语义

| 字段 | 类型 | 说明 |
|---|---|---|
| `schema_version` | int | 当前 = 1，未来演进走显式 migrate |
| `session_id` | string | `{workflow}/{slug}-{env}`，subagent 通过环境变量或参数获取 |
| `source` | object | 数据源指针（PRD / archive / bug id），含 mtime 用于失效检测 |
| `meta` | object | workflow 私有元数据（mode 等），schema 不约束 |
| `tasks[]` | array | 扁平任务列表，通过 `parent` + `depends_on` 建 DAG |
| `artifacts` | object | session 级共享产物；value 超阈值时替换为 `{ "$ref": "blocks/..." }` |

### Task 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一，workflow 自行决定命名 |
| `parent` | string\|null | 结构归属（阶段 → 步骤 → 子步骤） |
| `depends_on` | string[] | 执行依赖；所有依赖为 `done` 或 `skipped` 才可启动 |
| `order` | int | 兄弟任务间排序 |
| `name` | string | 人读标识 |
| `kind` | string | 标签（`node / case / phase / ...`），查询过滤用 |
| `status` | enum | `pending / running / done / blocked / failed / skipped` |
| `reason` | string\|null | 仅 `blocked` / `skipped` 用；`failed` 详细信息在 `errors` |
| `attempts` | int | 进入 `running` 时自动 +1 |
| `payload` | object | workflow 私有字段（自由结构） |
| `errors[]` | array | `{ at, message }`，`failed` / `blocked --error` 时 append |

### 状态机

```
pending ──start──▶ running ──done──▶ done
   ▲                 │
   │                 ├──block──▶ blocked ──unblock──▶ pending
   │                 ├──fail───▶ failed  ──retry────▶ pending
   │                 └─skip────▶ skipped
   └── (resume 时 running → pending 重置)
```

## 任务依赖模型

### 两个维度

- **`parent`（结构）**：任务归属于哪个阶段/节点；决定 UI 层级、阶段性 roll-up
- **`depends_on`（执行）**：任务可启动的前置条件；决定 `task-query` 可见性和 `task-update --status running` 的守卫

### 查询可见性规则

`task-query` 默认只返回"可执行任务"，判定：

1. **依赖检查：** 所有 `depends_on` 中任务 status ∈ `{done, skipped}`
2. **父级检查：** 若有 `parent`
   - parent.status ∈ `{pending, blocked, failed}` → 子任务不可见（阶段未解锁或阶段有问题）
   - parent.status ∈ `{running, done}` → 子任务可见

**语义：** 主 agent 把父任务置为 `running`（"进入这个阶段"）后，子任务才对 subagent 可见，避免 subagent 看到未解锁阶段的任务。

### 查询 flag

- 默认：隐藏依赖/父级未满足的任务
- `--include-all`：忽略所有可见性过滤（调试用）
- `--include-blocked`：返回所有因依赖未满足而隐藏的任务，附 `blocked_by` 解释

### 状态转换守卫

`task-update --status running` 自动校验：
- 依赖未满足 → exit 4，stderr 给出未 done 的依赖 id
- `--force` 跳过检查，但会在 `errors[]` 里记录 `{at, message: "forced-start"}`

### Roll-up

`task-rollup --task <parentId>`：
- 所有子任务 status ∈ `{done, skipped}` → 把父置为 `done`
- 任一子未完成 → exit 5 + stderr 列出未完成子任务

**显式调用，不做自动 roll-up**，保持操作可控。

### 循环依赖检测

所有写入路径（`task-add` / `task-update --depends-on`）在持锁后做 DFS + visited set 检测，发现环则 exit 1 拒绝。

## CLI 接口

### 动词分组

- `session-*`：创建/读取/删除/列出/恢复/汇总 session
- `task-*`：增/删/改/查任务；`task-block` / `task-unblock` / `task-rollup` 是便捷封装
- `artifact-*`：session 级共享产物读写，大 blob 自动外溢
- `migrate`：一次性迁移命令

### Session 级

```bash
kata-cli progress session-create --workflow <w> --project <p> \
  --source-type <type> --source-path <path> [--env <e>] [--meta <json>]

kata-cli progress session-read    --session <id>
kata-cli progress session-delete  --session <id>
kata-cli progress session-list    --project <p> [--workflow <w>]
kata-cli progress session-summary --session <id>
kata-cli progress session-resume  --session <id> \
  [--retry-failed] [--retry-blocked] \
  [--payload-path-check <key>]
```

**`session-resume` 行为（通用 + 可选 workflow 钩子）：**
1. 所有 `status=running` 的任务 → `pending`（进程死前未完成）
2. `--retry-failed`：`failed` → `pending`，清空 `attempts` 和 `errors`
3. `--retry-blocked`：`blocked` → `pending`，清空 `reason`
4. 若 `source.mtime` 变化（文件被外部改过）→ 清空 `artifacts.cached_parse_result`
5. **可选 workflow 钩子：** `--payload-path-check <key>` 声明 payload 中哪个字段是文件路径；对每个 task，若该路径不存在则 `payload.generated=false` 且任务重置为 `pending`。ui-autotest 用 `--payload-path-check script_path` 表达"生成的脚本丢失则重跑"的原有语义。

### Task 级

```bash
kata-cli progress task-add    --session <id> --tasks '<json-array>'
kata-cli progress task-update --session <id> --task <id> \
  [--status <s>] [--reason <msg>] [--payload <json>] \
  [--depends-on <csv>] [--error <msg>] [--force]
kata-cli progress task-query  --session <id> \
  [--status <csv>] [--kind <k>] [--parent <id>] \
  [--include-all] [--include-blocked] [--format json|table]
kata-cli progress task-remove --session <id> --task <id>

kata-cli progress task-block   --session <id> --task <id> --reason <msg>
kata-cli progress task-unblock --session <id> --task <id>
kata-cli progress task-rollup  --session <id> --task <id>
```

### Artifact 级

```bash
kata-cli progress artifact-set --session <id> --key <k> --value <json>
kata-cli progress artifact-get --session <id> --key <k>
# value > 64KB 时自动写到 blocks/ 目录，artifact 存 { "$ref": "..." }
```

### 迁移

```bash
kata-cli progress migrate --from legacy [--project <p>] [--dry-run]
# 扫描 .temp/.kata-state-* 和 .temp/ui-autotest-progress-*
# 写 .kata/{project}/sessions/
# 旧文件移入 .kata/{project}/legacy-backup/
```

## 并发与锁

- **粒度：** session 文件级排他锁，锁文件 `.kata/{project}/locks/{session_id}.lock`（PID 文件）
- **获取：** 50ms 抖动重试，5s 超时
- **释放：** 写完即删；进程崩溃留下的 lock 文件，下次进程启动时清理 `mtime > 10min` 的 stale lock
- **读不加锁：** `session-read` / `task-query` / `session-summary` 接受最终一致性
- **写加锁：** `session-*`（除 read/summary/list）/ `task-*`（除 query）/ `artifact-set`

## Exit code 约定

| code | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 参数/JSON 错误 |
| 2 | session 或 task 不存在 |
| 3 | 锁获取超时 |
| 4 | task 依赖未满足（仅 `task-update --status running` 触发，不加 `--force`） |
| 5 | `task-rollup` 时存在未完成子任务 |

**输出约定：**
- stdout 总是 JSON（最新状态或查询结果）
- stderr 以 `[progress:<subcmd>]` 开头，只写日志，不写业务数据

## Subagent 协作协议

### 硬约束

Subagent **不得**直接读写 `.kata/` 下的 JSON 文件。所有交互走 `kata-cli progress`。

理由：
- 统一锁保护
- Schema 演进（v1 → v2）时只改 CLI，subagent 无感知
- 所有操作可审计（日志经 stderr 输出，可采集）

### 标准交互模式

**Subagent 开始任务 / 标记阻塞 / 结束：**
```bash
kata-cli progress task-update --session "$SESSION_ID" --task "$TASK_ID" --status running
kata-cli progress task-update --session "$SESSION_ID" --task "$TASK_ID" --status blocked --reason "..."
kata-cli progress task-update --session "$SESSION_ID" --task "$TASK_ID" --status done --payload '<json>'
```

**主 agent 查阻塞/恢复：**
```bash
kata-cli progress task-query --session "$SESSION_ID" --status blocked --format table
kata-cli progress session-summary --session "$SESSION_ID"
```

### SESSION_ID 传递

主 agent 在 dispatch subagent 时把 `SESSION_ID` 作为环境变量/参数传入。每个 skill workflow 首步显式导出：
- `test-case-gen`：`SESSION_ID=test-case-gen/{prdSlug}-${ACTIVE_ENV:-default}`
- `ui-autotest`：`SESSION_ID=ui-autotest/{suiteSlug}-${ACTIVE_ENV:-default}`

## 迁移策略

### 字段映射

**`kata-state.ts` → progress session**

| 旧字段 | 新位置 |
|---|---|
| `project / prd / mode` | `project / source.path / meta.mode` |
| `current_node / completed_nodes` | 推导为 7 条 `kind=node` 任务，前者 status=running，后者 status=done |
| `node_outputs[node]` | 对应任务的 `payload` |
| `writers` | `artifacts.writers` |
| `strategy_resolution` | `artifacts.strategy_resolution` |
| `cached_parse_result` | `artifacts.cached_parse_result`（超 64KB 外溢 blocks/） |
| `source_mtime` | `source.mtime` |
| `created_at / updated_at` | 同名 |

节点间依赖按固定顺序生成：`transform → enhance → analyze → write → review → output`，每个节点 `depends_on = [前一节点]`。

**`ui-autotest-progress.ts` → progress session**

| 旧字段 | 新位置 |
|---|---|
| `suite_name / env / archive_md / url` | `source.path=archive_md` + `meta.{suite_name, url}` |
| `cases{}` | `tasks[]`（`kind=case`，挂在虚拟父任务 `suite` 下，`suite` 为 `kind=phase` 的顶层任务） |
| `cases[].test_status` | task `status`（`passed` → `done`；`failed` 保留） |
| `cases[].attempts / error_history` | 同名字段 |
| `cases[].script_path / generated` | `payload.{script_path, generated}` |
| `current_step / preconditions_ready / merge_status` | `artifacts.ui_autotest_flow` |
| `convergence / convergence_status` | `artifacts.convergence` |
| `cached_parse_result` | `artifacts.cached_parse_result`（超阈值外溢） |

### 切换顺序（一次性）

1. 落地新 CLI + 库 + 单测全绿
2. 跑 `kata-cli progress migrate --from legacy --dry-run`，人工核对
3. 真实迁移：旧文件入 `legacy-backup/`
4. 同步更新 skill 提示词（下述 9 个文件）
5. 删除 `kata-state.ts` / `ui-autotest-progress.ts` 及其单测
6. 手工验证：`/test-case-gen` 和 `/ui-autotest` 主流程、resume、失败重试
7. grep 零检查：`grep -r "kata-state\|ui-autotest-progress" .claude/` 应无结果
8. commit

### 影响范围

**代码：**
- 新增 `.claude/scripts/progress.ts`
- 新增 `.claude/scripts/lib/progress-store.ts`（读写、锁、blob 外溢）
- 新增 `.claude/scripts/lib/progress-migrator.ts`
- 新增 `.claude/scripts/lib/progress-types.ts`（共享类型）
- `.claude/scripts/kata-cli.ts` 注册 `progress` 子命令
- `.claude/scripts/lib/paths.ts` 新增 `kataDir / sessionsDir / locksDir / blocksDir`
- 删除 `.claude/scripts/kata-state.ts` + 其单测
- 删除 `.claude/scripts/ui-autotest-progress.ts` + 其单测
- `.gitignore` 新增 `.kata/`

**Skill 提示词同步更新（9 个文件）：**
- `.claude/skills/test-case-gen/SKILL.md`
- `.claude/skills/test-case-gen/workflow/main.md`
- `.claude/skills/ui-autotest/SKILL.md`
- `.claude/skills/ui-autotest/workflow/step-1.5-resume.md`
- `.claude/skills/ui-autotest/workflow/step-4-script-writer.md`
- `.claude/skills/ui-autotest/workflow/step-5-test-fix.md`
- `.claude/skills/ui-autotest/workflow/step-5.5-convergence.md`
- `.claude/skills/ui-autotest/workflow/step-6-merge.md`
- `.claude/skills/kata/references/quickstart.md`

### 回滚

- `legacy-backup/` 保留 30 天
- 新机制挂掉：`git revert` 代码 + 手动把 `legacy-backup/*` 移回 `.temp/`

## 测试策略

### Layer 1：`lib/progress-store.ts` 单测

- `readSession / writeSession` 幂等性
- 锁竞争：两进程并发写，断言最终一致，无脏写
- 锁超时：持锁方不释放，第二进程 5s 后 exit 3
- Stale lock：10 分钟前的 PID 文件可被覆盖
- Blob 外溢：payload > 64KB 时外溢，读回 dereference 正确
- Env 后缀：不同 env 互不干扰
- `source.mtime` 变化 → `artifacts.cached_parse_result` 清空
- 循环依赖检测

### Layer 2：`progress.ts` CLI 单测

- 所有子命令的正常路径（exit 0 + stdout JSON 合规）
- 错误路径：参数错误 / 不存在 / 锁超时 / 依赖未满足 / rollup 失败
- `task-update` 派生字段：`status=running` → `attempts+1`；`status=blocked/failed --error` → `errors` append
- `task-add` 批量 + 重复 id 拒绝
- `task-query` 过滤组合：status × kind × parent × include-all × include-blocked
- `task-query --format table` 输出稳定（skill 提示词里的 shell 断言依赖此）
- `session-resume`：running → pending；`--retry-failed` 清空 attempts/errors；`--retry-blocked` 清空 reason；`source.mtime` 变化 → `artifacts.cached_parse_result` 被清空；`--payload-path-check <key>` 指向的文件丢失时该任务重置为 pending 且 `payload.generated=false`
- `session-list` 按 project / workflow 筛选

### Layer 3：`progress-migrator.ts` 单测

- 从真实旧 fixture 迁出，字段一一对应（选取 `.temp/` 目录当前在用的代表性文件）
- `--dry-run` 不修改任何文件
- 目标已存在 → 拒绝覆盖
- 迁移成功后旧文件入 `legacy-backup/`

### Layer 4：手工集成验证 checklist

- 对真实 PRD 跑 `/test-case-gen`，中途 Ctrl-C，再跑可从断点继续
- 对真实套件跑 `/ui-autotest`，中途失败，`--retry-failed` 只重试失败 case
- 两种 workflow 上跑 `kata-cli progress task-query --status blocked` 能返回阻塞任务和原因
- 跑 migrate 时检查 `legacy-backup/` 内容与原文件一致（hash 比对）

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 迁移脚本漏字段，旧任务信息丢失 | 中 | 高 | `--dry-run` 人工核对；`legacy-backup/` 保留 30 天；真实 fixture 单测 |
| 提示词更新遗漏 → subagent 调旧命令 | 中 | 中 | 删除旧 CLI 后立即 grep 零检查；`grep -r "kata-state\|ui-autotest-progress" .claude/` 为 0 |
| `.kata/` 误 commit | 低 | 低 | `.gitignore` 显式加；migrator 启动时断言目录在 gitignore |
| 锁文件目录被手动删除 | 低 | 低 | 写前 `mkdirSync(..., {recursive: true})` |
| legacy-backup 占空间 | 低 | 低 | 文档说明保留 30 天，用户手动清 |
| subagent 不知道 SESSION_ID | 中 | 中 | workflow step-1 显式导出 `SESSION_ID`；subagent prompt 模板硬编码 `$SESSION_ID` |
| 新 CLI 性能问题（每次 fork bun） | 低 | 中 | 本期不处理；如有问题后续加批量命令或 daemon |

## 非目标（本期不做）

- 任务依赖图的 `blocks / blockedBy` 双向维护（只有单向 `depends_on`，够用）
- 跨 session 查询（如 "project 下所有 blocked 任务"）——`session-list` + 循环
- UI / Web 面板
- 自动 roll-up（只提供显式 `task-rollup` 命令）
- 多级 schema 版本共存（v1 → v2 时走 migrate，不双写）

## 后续

本设计通过 review 后，由 writing-plans skill 细化为：
- 可按顺序执行的 Task 列表（参考 `2026-04-24-rename-to-kata-and-unified-cli.md` 风格）
- 每个 Task 指明改动文件、验收标准、依赖前置 Task
- 按文件粒度的 checkbox 清单，便于 subagent-driven-development 或 executing-plans 接力

## 关联文档

- 现状代码：`.claude/scripts/kata-state.ts` / `.claude/scripts/ui-autotest-progress.ts`
- 现状测试：`.claude/scripts/__tests__/kata-state.test.ts` / `ui-autotest-progress.test.ts`
- CLAUDE.md 约束：脚本修改后必须同步更新单测，禁止硬编码绝对路径
- 既有 spec 风格参考：`docs/refactor/specs/2026-04-24-rename-to-kata-and-unified-cli.md`
