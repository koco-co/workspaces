# 4 MD 用例修复 + xmind 同步 + 脚本重生 — 设计

**日期**：2026-04-27
**触发背景**：调试「【内置规则丰富】完整性，json 中 key 值范围校验」suite 的最重要 P0 用例（t16）时，连续撞 8 处 fix 才把 t1 跑通，而 t16 自身仍是退化骨架。Archive MD 步骤/前置模糊、SparkThrift/Doris 字段类型矩阵未固化、helpers 散布 legacy DOM 选择器，是当前 UI 自动化转换的核心阻碍。

---

## 0. 决策汇总（已与用户确认）

| 决策点 | 选择 |
|---|---|
| 修复粒度 | 轻修补 — 步骤+前置完整化，不动结构 |
| 踩坑库分配 | rules/ 主（约 80%，自动加载）+ knowledge/pitfalls/ 辅（约 20%，按需查阅），不改 ui-autotest skill |
| Doris 重复处理 | 保留"重复"句式但精确化为「仅变 SQL、UI 不变」 |
| 脚本重生策略 | 清掉 t*.ts + spec，保留 helpers 但先批量审计修 legacy 选择器 |
| 模糊点修复源 | 源码优先 + PRD 补充，不一致时报告用户 |
| xmind 同步 | case-format reverse-sync (MD → xmind) |
| 执行方案 | 方案 B — 试点 + 半并行 |

---

## 1. 顶层架构与阶段切分

```
阶段 1 [基座]               阶段 2 [试点闭环]            阶段 3 [并行扩散]
┌──────────────────┐    ┌──────────────────┐         ┌─────────────────────┐
│ 1.1 踩坑库种子化  │    │ 通用配置 json     │         │ 完整性 key 范围     │
│  (rules/+pitfalls)│ ─▶ │ 格式配置 端到端   │ ─模板─▶ │ ┐                  │
│ 1.2 helpers 审计  │    │ (MD→xmind→脚本→  │         │ │ 3 sub-agent 并行 │
│ 1.3 t1 烟测验证  │    │  实跑通过)       │         │ │ 复用试点流程     │
└──────────────────┘    └──────────────────┘         │ ┘                  │
                                                      │ 有效性 json key/val │
                                                      │ ┐                  │
                                                      │ │ 同上              │
                                                      │ ┘                  │
                                                      │ 有效性 多规则且或   │
                                                      └─────────────────────┘
```

**4 个产物的依赖**：

```
通用配置 json 格式配置 (key1/key2/key11/key22 维护)
        │
        ├──▶ 完整性 key 范围校验    (用 key1/key2)
        ├──▶ 有效性 json key/value  (用 key1/key2 + value 正则)
        └──▶ 有效性 多规则且或      (基础规则配置)
```

**基本原则**：
- 阶段 1 = 一次性沉淀，所有后续 sub-agent 依赖
- 阶段 2 试点 = 一个完整 PR，跑出来什么坑就回流到 rules/
- 阶段 3 = 3 sub-agent 用同一份"基座+试点反馈"并行，每条独立 commit

---

## 2. 阶段 1.1 — 踩坑库种子化

### 2.1 `workspace/dataAssets/rules/ui-autotest-pitfalls.md`（新建）— 硬规则清单

按主题切 4 节，每条规则一行：「规则 + 反例 + 正例（代码片段）」。预计约 30 条。示例：

```markdown
## A. 选择器（Locator）

- A1 [禁] `ruleForm.locator(".rule__function-list__item")` legacy DOM；统计函数选择器必须双路径回退（legacy + inline form-item filter `/统计函数/`）
- A2 [禁] `.ant-form-item` filter `/字段/` 会误命中"字段级"（规则类型）；必须用 `/^字段/` 精确匹配
- A3 [必] 校验方法 select 不在 `.rule__function-list__item` 内，需在 ruleForm 顶层 form-item 找

## B. Test Fixture / API

- B1 [禁] `const x = await step('...', async () => ... return ...)` — step fixture 不返回 callback 值
- B2 [必] step 内赋值用闭包变量：`let x!: Locator; await step(..., async () => { x = await ... })`

## C. 数据 / 项目 ID

- C1 [禁] 硬编码 `QUALITY_PROJECT_ID = 90`；必须 `await resolveEffectiveQualityProjectId(page)` 动态解析
- C2 [禁] datasource keyword `spark|thrift`；必须含 `hadoop`（LTQC 环境的 SparkThrift 集群名为 pw_test_HADOOP）
- C3 [必] SparkThrift2.x 不支持 JSON 字段：表 DDL 用 `STRING` + JSON 字符串内容
- C4 [必] Doris3.x 支持 JSON 也支持 STRING：表 DDL 优先 JSON、回退 VARCHAR(65533)

## D. Preconditions / SDK 形态

- D1 [必] `setupPreconditions(page, opts)` 通过 `helpers/preconditions.ts` 适配层调 `precondSetup`；旧字段名 `datasourceType`→`datasource`、`projectName`→`project`
- D2 [必] 新增"完整性校验"规则后必须先选「规则类型 = 字段级」，「统计函数」select 才会渲染
```

### 2.2 `workspace/dataAssets/knowledge/pitfalls/`（新建文件）— 详情背景

每个 fix 一篇，约 50 行：背景、复现步骤、根因分析、代码 diff、关联 rule 编号。新会话遇到症状时通过 `knowledge-keeper` skill 检索。预计 8 篇。

```
knowledge/pitfalls/
  2026-04-27-preconditions-adapter.md       (D1 详情)
  2026-04-27-quality-project-id-90-vs-92.md (C1 详情)
  2026-04-27-sparkthrift-keyword-hadoop.md  (C2 详情)
  2026-04-27-legacy-rule-function-list.md   (A1, A3 详情)
  2026-04-27-field-regex-precision.md       (A2 详情)
  2026-04-27-step-fixture-no-return.md      (B1, B2 详情)
  2026-04-27-rule-type-prerequisite.md      (D2 详情)
  2026-04-27-sparkthrift-no-json-field.md   (C3, C4 详情)
```

每篇模板：
```markdown
## 症状（grep 关键词）
"no tables provided" / "Cannot read properties of undefined (reading 'locator')" / ...

## 复现条件
LTQC 环境 / 修改了 helpers 重构 / ...

## 根因
（1-3 段）

## 修复 diff
\`\`\`diff
- old code
+ new code
\`\`\`

## 关联硬规则
ui-autotest-pitfalls.md#D1
```

### 2.3 项目级 rules 增补 — 追加到现有 `case-writing.md`

把 SparkThrift / Doris 字段类型矩阵作为「业务编写规则」追加：

```markdown
## §N. SparkThrift / Doris 数据源 字段类型矩阵

| 数据类型场景    | SparkThrift2.x       | Doris3.x              |
| --------------- | -------------------- | --------------------- |
| 主 JSON 字段    | `STRING`（必须）     | `JSON`（首选）/ `VARCHAR(65533)` 回退 |
| 一般文本字段    | `STRING`             | `VARCHAR(N)`          |

写"用 Doris 重复以上步骤"时必须明确：「info 字段 STRING → JSON，其余不变」。
```

---

## 3. 阶段 1.2 — helpers 批量审计

### 3.1 审计范围

**全局 helper（`workspace/dataAssets/helpers/`）**：

| 文件 | 审计重点 | 预期改动 |
|---|---|---|
| `preconditions.ts` | adapter 已就位 | ✅ 已完成（本次会话） |
| `test-setup.ts` / `index.ts` / `env-setup.ts` / `batch-sql.ts` / `metadata-sync.ts` / `quality-project.ts` | 通用 helper，今天没动 | 跳过（无明显问题） |

**Suite 特有 helper（每 suite 各自一份）**：

| 适用 suite | 文件 | 审计重点 | 预期改动 |
|---|---|---|---|
| 完整性 key 范围（已有） | `key-range-utils.ts` | grep `.rule__function-list__item` / `QUALITY_PROJECT_ID` 硬编码 / `/字段/` 不精确 / `spark\|thrift` keyword；`addKeyRangeRule` 已修，`selectJsonKeys` / `configureKeyRangeRule` 还有 legacy DOM 残留 | 按 ui-autotest-pitfalls.md A1-A3 + C1-C2 全部修 |
| 各 suite | `suite-helpers.ts` | 已有双路径写法（getFunctionSelect），其他选择器抽样验证 | grep + 抽样 |
| 各 suite | `task-helpers.ts`（21KB） | 任务管理 + 立即执行 + 实例查询 helper | grep；阶段 2 试点会真正用到 |
| 各 suite | `test-data.ts` | `BATCH_PROJECT_CANDIDATES` / `runPreconditions` 已修 | 抽样 |
| 完整性 key 范围 | `data-15693.ts` | `SPARKTHRIFT_DATASOURCE_KEYWORD` 已加 hadoop | ✅ 已完成 |
| 通用配置 / 多规则且或 / 有效性 json key/val | （阶段 2/3 期间评估是否需要新建对应 suite-utils） | 阶段 2 试点产出后回填 | 视实际需要 |

### 3.2 工具化审计

```bash
grep -rn '\.rule__function-list__item' workspace/dataAssets/tests/202604/
grep -rn 'QUALITY_PROJECT_ID' workspace/dataAssets/tests/202604/
grep -rn 'filter.*hasText.*\/字段[^级]' workspace/dataAssets/tests/202604/
grep -rn 'spark|thrift[^|]' workspace/dataAssets/tests/202604/
```

每条 hit 对照 ui-autotest-pitfalls.md 编号修复，commit message：`fix(helpers): apply ui-autotest-pitfalls A1/A3/C1/C2 to {suite}`。

### 3.3 验收

- t1 必须仍然通过（regression check）
- 阶段 2 试点的第一条 P0 通过即认为审计成果已被验证

### 3.4 不在本阶段做

- 不重写 helper 抽象层 / 不提取共享 helper（超出"轻修补"范围）
- 不做性能优化、代码风格统一
- 不新增 helper 函数（阶段 2/3 按需新增）

---

## 4. 阶段 2 — 通用配置 json 格式配置 试点闭环

### 4.1 MD 重写规范（4 MD 通用）

每条用例必须满足以下 6 条规则。Sub-agent 修复时违反就 NEED_USER_INPUT 上抛。

```
R1 [前置条件 SQL 自洽]
  - 完整 DDL（含 SparkThrift STRING + Doris JSON 双套，每套独立可执行）
  - 完整 INSERT，不能是片段
  - SQL 写在 ```sql ``` 代码块
  - 字段类型严格按"SparkThrift / Doris 矩阵"

R2 [前置条件 UI 路径明确]
  - 不写"已配置 xxx 规则" / "假设环境已就绪"
  - 写：「通过【数据质量 → 通用配置】→ 点击【新增】→ 填写 key=key1, 数据源=sparkthrift2.x → 点击【确定】」
  - 跨需求依赖：明确指向另一个 MD

R3 [步骤精确化]
  - 每步必含：操作（点哪个按钮 / 填哪个字段）+ 等待（等什么元素 / API 返回）
  - 按钮、字段、菜单名加【】标记
  - 避免"等加载完成" → "等 .ant-table-tbody 出现"
  - 触发悬浮 / 下拉等"动作语义"必须命名

R4 [预期断言可机械验证]
  - 数值/文本断言对齐 PRD/实现原文（不放宽）
  - 多条预期编号 1/2/3
  - 禁止"显示正确"等空话；改成具体值

R5 ["Doris 重复"句式]
  - 末尾固定格式：「使用 Doris3.x 数据源重复以上步骤，将 info 字段类型从 STRING 改为 JSON，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致」
  - 仅当本条用例确实需双数据源验证时保留；纯 UI 验证（如表单校验）删除此条

R6 [模糊点显式标注]
  - 修不动的地方写：「<!-- TODO[ambiguous]: 校验内容下拉滚动加载阈值 PRD 写 200，源码写 100，需确认 -->」
  - Sub-agent 不臆测、不放弃，标注后继续修后续条款
```

### 4.2 试点闭环 5 步

```
1. 修 MD（sub-agent + R1-R6 + 源码优先 + PRD 补充 + 不一致报告）
   产出：workspace/dataAssets/archive/202604/【通用配置】json格式配置.md（diff）

2. xmind 反向同步
   命令：case-format reverse-sync --md "..."
   产出：workspace/dataAssets/xmind/202604/【通用配置】json格式配置.xmind（更新）

3. helpers 审计该 suite
   产出：tests/202604/【通用配置】json格式配置/{suite-helpers,test-data,...}.ts（diff）

4. 脚本生成（ui-autotest skill, scope=P0+P1）
   - 删除现有 t*.ts + spec
   - 派 subagent A 基于新 MD 生成 t*.ts
   - 派 subagent B 跑全量验证
   产出：tests/202604/【通用配置】json格式配置/t*.ts、smoke.spec.ts、full.spec.ts

5. 实跑通过 + commit
   验收：所有 P0 通过 + ≥80% P1 通过；P2 允许已知失败但需登记
   commit：feat(test): rebuild json-config suite based on rewritten archive (pilot)
```

### 4.3 试点反馈回路

跑完后 sub-agent 把"试点中又新撞到的坑 / R1-R6 不够用的规则缺口"输出 → 主 agent 把增量回流到：
- 新坑 → 追加 `ui-autotest-pitfalls.md` + `knowledge/pitfalls/`
- 规则缺口 → 追加 R7/R8...
- 流程优化 → 更新阶段 3 的并行 sub-agent 任务模板

### 4.4 阶段 2 不做

- 不开始改其他 3 个 MD（避免规则未稳定就并行扩散）
- 不做跨 suite 的共享 helper 提取

---

## 5. 阶段 3 — 3 MD 并行扩散

### 5.1 任务分派

```
sub-agent-md-fix-1  ▶  完整性 key 范围校验      (36 用例)
sub-agent-md-fix-2  ▶  有效性 json key/value    (~38 用例 估算)
sub-agent-md-fix-3  ▶  有效性 多规则且或关系    (~40 用例 估算)
```

每个 sub-agent 接收**统一任务包**：
```
- 输入：原 archive MD 路径
- 规则：rules/case-writing.md + rules/ui-autotest-pitfalls.md + rules/case-writing.md §SparkThrift矩阵 + 试点产出的 R1-R7
- 知识：knowledge/pitfalls/* (按需读) + knowledge/modules/data-quality.md
- 源码：.repos/customltem/dt-center-assets (只读)
- PRD：workspace/dataAssets/prds/15693/15694/15695 (按需读)
- 产出 1：修复后的 MD（diff vs 原文）
- 产出 2：模糊点报告（NEED_USER_INPUT 列表，主 agent 集中拍板）
- 不做：xmind 同步、脚本生成（这些放在主 agent 串行跑，避免 4 sub-agent 同时 reverse-sync 锁文件）
```

### 5.2 主 agent 串行收尾

3 sub-agent 并发跑、各自完成后通知主 agent：

```
loop for each completed MD:
  1. 主 agent 审 sub-agent 模糊点报告，对照源码/PRD 拍板，回写 MD
  2. case-format reverse-sync MD → xmind
  3. helpers 审计该 suite
  4. ui-autotest skill 生成 t*.ts + spec + 实跑 P0+P1
  5. commit per suite
```

3 个独立 commit（不集中 PR），每条独立可回退。

### 5.3 失败隔离

任何一条 sub-agent 失败：
- 该需求的 MD 修复任务标记 failed、回到主会话排查；其他 2 个继续
- 不阻塞其他 2 个 suite 的脚本生成

---

## 6. 错误处理 / 回退路径 / 验收标准

### 6.1 NEED_USER_INPUT 触发条件

Sub-agent 必须上抛主 agent 的情况：
- MD 修复：源码与 PRD 不一致 / 实现缺失 / R6 无法机械补完
- xmind 同步：reverse-sync 报错 / xmind 节点结构与 MD 不对应
- helpers 审计：现有 helper 改不动（要重写整个抽象）
- 脚本生成：subagent A 三阶段无法收敛
- 实跑：P0 失败但根因不在 helper / 选择器（疑似产品 bug）

### 6.2 回退路径

| 阶段 | 失败回退 | 影响 |
|---|---|---|
| 1.1 踩坑库 | git revert | 阶段 2/3 暂停 |
| 1.2 helpers | git revert + t1 必须重新通过 | 阶段 2 暂停 |
| 2 试点 | 单独 PR 回滚 | 阶段 3 不启动 |
| 3 任意 1 个 | 单独 commit 回滚 | 其他 2 个不影响 |

### 6.3 验收标准

**阶段 1**：
- ui-autotest-pitfalls.md 被 rule-loader 加载（跑 `kata-cli rule-loader load --project dataAssets` 验证）
- knowledge/pitfalls/ 8 篇背景文档存在
- helpers grep 4 类禁用模式 hit count = 0
- t1 仍然通过

**阶段 2 试点**：
- 通用配置 MD 满足 R1-R6
- xmind 已更新且与 MD 一致
- 该 suite 所有 P0 通过、≥80% P1 通过；P1 失败必须登记原因（产品 bug / 环境 / 已知 helper 限制 / 规则缺口），无法解释的失败视为不通过
- 试点反馈写回 rules/

**阶段 3**：
- 3 个 suite 各自满足阶段 2 同等验收
- 每 suite 一个 commit（含该 suite 的 archive + xmind + helpers 修补 + 重生 t*.ts/spec），独立可回退
- 所有模糊点已用户拍板（无遗留 TODO[ambiguous]）

### 6.4 时间预估

- 阶段 1：0.5-1 天
- 阶段 2 试点：1 天
- 阶段 3：1-1.5 天
- **总计 2.5-3.5 天**

---

## 7. 已知风险

- **R1 模糊点过多**：若 4 MD 总计模糊点 > 50 条，用户单次拍板压力大；缓解：sub-agent 按"PRD/源码均能定夺"自动修，仅"两者冲突 + 实现缺失"上抛
- **R2 试点经验不能完全推广**：通用配置 suite UI 简单（CRUD），3 个校验 suite 含跨页面端到端流程；缓解：试点反馈回路明确接受新增 R7/R8 规则
- **R3 helpers 改不动**：legacy DOM 太深 / suite-helpers 抽象错误；缓解：阶段 1.2 仅做"按 grep 模式批量替换"，深层重构上抛
- **R4 实跑环境波动**：LTQC 环境 SQL 失败、metadata sync 超时；缓解：runPreconditions 已有 retry 机制 + 已知 transient error 列表；不通过的归类为环境问题、不阻塞 commit

---

## 8. 文件产出清单

```
新增：
  workspace/dataAssets/rules/ui-autotest-pitfalls.md
  workspace/dataAssets/knowledge/pitfalls/2026-04-27-*.md (8 篇)

修改：
  workspace/dataAssets/rules/case-writing.md (追加 §N SparkThrift/Doris 矩阵)
  workspace/dataAssets/archive/202604/【通用配置】json格式配置.md
  workspace/dataAssets/archive/202604/【内置规则丰富】完整性，json中key值范围校验.md
  workspace/dataAssets/archive/202604/【内置规则丰富】有效性，json中key对应的value值格式校验.md
  workspace/dataAssets/archive/202604/【内置规则丰富】有效性，支持设置字段多规则的且或关系.md
  workspace/dataAssets/xmind/202604/* (4 xmind 反向同步)
  workspace/dataAssets/tests/202604/{4 suite}/{suite-helpers,task-helpers,key-range-utils,test-data,data-15693}.ts (legacy 选择器修复)

删除并重生：
  workspace/dataAssets/tests/202604/{4 suite}/t*.ts
  workspace/dataAssets/tests/202604/{4 suite}/{smoke,full,_debug-*}.spec.ts
```
