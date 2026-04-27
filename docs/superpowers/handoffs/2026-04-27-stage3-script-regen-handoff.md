# Stage 3 脚本重生 Handoff（3 个内置规则 suite）

> 上下文：dataAssets 项目 Stage 3 — 3 个 archive MD 已重写并 reverse-sync 到 xmind，剩余「按新 MD 重生 Playwright 脚本 + 跑通 P0」。本 doc 让任何 cc 实例从零恢复完整上下文继续推进。
>
> 关联 plan：`docs/superpowers/plans/2026-04-27-md-cases-rework.md` Task 12 + Task 13
> 关联 spec：`docs/superpowers/specs/2026-04-27-md-cases-rework-design.md`

---

## 1. 当前状态（已完成 / 剩余）

### ✅ 已完成（提交至分支 `feat/desktop-shell-spec1`）

```
8d0a2135 docs(pitfalls): G8 — TreeSelect/Select dropdown 必须用搜索框过滤
2d073545 fix(helpers): apply pitfall C2 hadoop keyword to value-format suite
8d146e14 sync(xmind): regen 3 internal-rule xmind from rewritten MD
f7abd70c fix(archive): rewrite 3 internal-rule MDs per R1-R8 (Stage 3 parallel)
b84ff1c6 docs(pitfalls): feedback from json-config pilot
3c34a10a feat(test): rebuild json-config suite P0 (3 cases)
1a591095 sync(xmind): reverse-sync json-config archive to xmind
60675995 fix(archive): apply user arbitration on 3 ambiguous points
3421b9a5 fix(archive): rewrite json-config MD per R1-R6 (pilot)
cdfd7d79 fix(helpers): apply pitfalls to key-range suite
11fae0f3 docs(rules): append SparkThrift/Doris field type matrix
bac9f389 docs(pitfalls): add 8 debug stories
2e859c7d feat(rules): add ui-autotest-pitfalls hard rules
```

- Stage 1：踩坑库种子化 + helpers fix（8 篇 pitfalls + 30+ 条硬规则 + key-range helpers 修过）
- Stage 2：通用配置 json 格式配置试点闭环（MD + xmind + 3 P0 全绿）
- Stage 3 Phase 1：3 MD 按 R1-R8 重写 + 用户 3 项专属修正落地
- Stage 3 Phase 2：3 xmind regenerate + 15694 SparkThrift keyword 补 hadoop
- Stage 3 Phase 3：G8 TreeSelect 搜索框规则沉淀

### ⏳ 剩余（本 doc 范围）

**3 个 suite 各自跑一轮**：删旧 t\*.ts → 基于新 MD 重生脚本 → 跑 P0 → 修失败 → commit

| Suite                                                            | PRD ID | Cases | P0  | Helpers 现状                  | 已知阻塞                       |
| ---------------------------------------------------------------- | ------ | ----- | --- | ----------------------------- | ------------------------------ |
| 【内置规则丰富】完整性，json中key值范围校验                      | 15693  | 37    | 5   | helpers 已合规（双路径回退） | 用户场景修正 A/B 已落 MD       |
| 【内置规则丰富】有效性，json中key对应的value值格式校验           | 15694  | 30    | 2   | C2 keyword 已补；其他需 G8   | 用户场景修正 A/B/C 已落 MD     |
| 【内置规则丰富】有效性，支持设置字段多规则的且或关系             | 15695  | 27    | 2   | rule-editor-helpers 单路径   | 无用户专属修正                 |

> P1+ 暂不在本 doc 范围（按 plan，P0 跑通即可进 Task 13 验收，P1 可在后续迭代补）

---

## 2. 必读规则（任何 cc 实例进场前先 Read 一遍）

按读取顺序：

1. `workspace/dataAssets/rules/case-writing.md` — R1-R8 + §8 SparkThrift/Doris 矩阵 + §9 R7 CRUD 例外 + §10 R8 case_count 对账 + §11 R6 拍板范本
2. `workspace/dataAssets/rules/ui-autotest-pitfalls.md` — A1-A5 选择器 + B1-B3 fixture + C1-C5 数据 + D1-D3 SDK + E1-E3 流程 + F1-F3 命令 + **G1-G8 CRUD UI**
3. `workspace/dataAssets/rules/xmind-structure.md`
4. `workspace/dataAssets/knowledge/modules/data-quality.md`（如存在）— 数据质量模块业务流
5. `workspace/dataAssets/knowledge/pitfalls/2026-04-27-*.md`（10 篇，按症状关键词检索）
6. 全局 `rules/case-writing.md`

读完后 grep 验证规则已加载：
```bash
bun run /Users/poco/Projects/kata/.claude/scripts/kata-cli.ts rule-loader load --project dataAssets > /tmp/rules.json
grep -c "ui-autotest-pitfalls\|G8\|treeselect-search-not-scroll" /tmp/rules.json
# 期望 ≥ 2
```

---

## 3. G1-G8 关键规则速查（subagent A 写脚本必备）

### G1 数据源类型大小写敏感
- ✅ `Hive2.x` `SparkThrift2.x` `Doris3.x`
- ❌ `hive2.x` `sparkthrift2.x`

### G2 Modal title 按源码常量
- 「**新建**」（不是「新增」；BM）
- 「**编辑**」（不拼接记录名；CZ）
- 「**新建子层级**」（CH）

### G3 正则匹配结果文案
- 「**符合正则**」/「**不符合正则**」（CF/CG），不是「匹配成功/失败」

### G4 form-item 内 dynamic input 用兜底选择器
- ❌ `modal.locator(".ant-form-item").filter({ hasText: "测试数据" }).locator("input")`
- ✅ `modal.locator("input:visible, textarea:visible").last()`

### G5 Popconfirm/Modal 文案按源码常量
- 单条删除 Popconfirm：「请确认是否删除key信息,」+「若存在子层级key信息会联动删除」（AS+AT）
- 批量删除 Modal：「是否批量删除key信息?」（DQ）
- 导出 Popconfirm 按钮：「**确认**」（不是「确定」；DY）

### G6 表单字段顺序按源码 JSX
- json 格式配置 CreateModal：**数据源类型 → key → 中文名称 → value 格式**

### G7 默认 pageSize 按源码 `Table pagination.defaultPageSize`
- json 格式配置：默认 10

### G8 TreeSelect / Select 用搜索框过滤，不要逐层展开滚动
```ts
const dropdown = page.locator(".ant-tree-select-dropdown:visible, .ant-select-dropdown:visible").first();
await dropdown.waitFor({ state: "visible", timeout: 10000 });
const searchInput = dropdown
  .locator("input.ant-select-tree-input, .ant-select-tree-search input, input[type='search']")
  .first()
  .or(dropdown.locator("input:visible").first());
if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
  await searchInput.fill(keyName);
  await page.waitForTimeout(400);
}
const node = dropdown.locator(".ant-select-tree-title").filter({ hasText: keyName }).first();
await expect(node).toBeVisible({ timeout: 5000 });
// 多 key：fill("") 清空再下一轮
```
- 现 15693 `selectJsonKeys` (key-range-utils.ts:725-733) 已合规
- 15694 `json-format-suite-helpers.ts` 与 15695 `rule-editor-helpers.ts` 写新脚本时按 G8 对齐

### A4/E1 字段级前置
新增「完整性校验」/「有效性校验」规则后，必须**先选「规则类型 = 字段级」**，「统计函数」select 才会渲染：
```ts
const ruleTypeSelect = ruleForm.locator(".ant-form-item").filter({ hasText: /规则类型/ }).first().locator(".ant-select").first();
if (await ruleTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
  await selectAntOption(page, ruleTypeSelect, /字段级|字段/);
  await page.waitForTimeout(300);
}
```

### C1 项目 ID 必须动态解析
```ts
import { resolveEffectiveQualityProjectId } from "./test-data";
const projectId = await resolveEffectiveQualityProjectId(page);
```
- ❌ 硬编码 `QUALITY_PROJECT_ID = 90`（实际 LTQC = 92）

---

## 4. 用户专属场景修正（已落 MD，subagent A 写脚本时直接消费）

### 修正 A — 字段类型不置灰（应用于 15693 + 15694）
- 用户原话："虽然可以选择, 但是只有在实际运行时才会在校验结果查询中知道是否错误"
- 实现：选 INT/DATE/BIGINT 等非支持类型字段时**仍可选择**统计函数（不置灰），保存执行后在【校验结果查询】实例详情显示「校验不通过」
- MD 引用：
  - 15693：line ~328「【P1】验证非json和string类型字段选择key范围校验后任务执行报错」
  - 15694：line ~278 用例已改方向

### 修正 B — "前两个" 截断仅在数据质量报告（应用于 15693 + 15694）
- 用户原话："这是数据质量报告中才展示前两个. 其它的页面, 比如规则集管理, 规则任务管理中都是全量展示的"
- 实现：
  - 主用例验证 `/dq/qualityReport`（数据质量报告）页"默认前两个 + 悬浮全部"
  - 反向用例验证 `/dq/ruleSet` + `/dq/rule` 页"全量展示无截断"（`maxTagCount="responsive"`）
- MD 引用：
  - 15693：line ~187 主 + line ~220 反向
  - 15694：line ~322 主 + 同段反向 case

### 修正 C — 必填项提示文案按源码常量（应用于 15694）
- 实现：i18n key `views.valid.ruleConfig.edit.components.rule.index.CG`，文案模板：`'"{val1}"统计函数存在必填项未填写'`（**注意花引号 `"…"`**）
- MD 引用：15694 line ~318 用例

---

## 5. Per-Suite 工作流程

每个 suite 重复以下 6 步。**3 suite 顺序无依赖，可并行**（建议每个 suite 独立 cc 实例派 subagent A，避免单实例资源压力）。

### Step 1 — 验证当前状态

```bash
cd /Users/poco/Projects/kata
git log --oneline -5  # 期望最新 commit 包含 8d0a2135
# 当前分支：feat/desktop-shell-spec1
```

### Step 2 — 删除 suite 现有 t\*.ts + spec（保留 helpers + .test.ts 单测）

**15693 (key range)**：
```bash
cd "/Users/poco/Projects/kata/workspace/dataAssets/tests/202604/【内置规则丰富】完整性，json中key值范围校验/"
rm -f t*.ts smoke.spec.ts full.spec.ts _debug-*.spec.ts
ls  # 应剩 helpers：data-15693.ts key-range-utils.ts suite-helpers.ts task-helpers.ts test-data-15693.ts test-data.ts
```

**15694 (value format)**：
```bash
cd "/Users/poco/Projects/kata/workspace/dataAssets/tests/202604/【内置规则丰富】有效性，json中key对应的value值格式校验/"
rm -f t*.ts smoke.spec.ts full.spec.ts
ls  # 应剩 helpers + .test.ts：data-15694.ts json-fixture-sql.ts json-format-* json-suite-* json-tree-* monitor-create-retry.ts rule-editor-base.ts rule-task-base.ts suite-case-helpers.ts test-data-15694.ts test-data.ts validation-key-label.ts validation-result-status.ts + 各 .test.ts
```

**15695 (multi-rule and/or)**：
```bash
cd "/Users/poco/Projects/kata/workspace/dataAssets/tests/202604/有效性-取值范围枚举范围规则/"
rm -f t*.ts smoke.spec.ts full.spec.ts diag_test.spec.ts order-repro.spec.ts
ls  # 应剩 helpers + .test.ts：datasource-candidates.ts offline-* page-readiness.ts rule-editor-helpers.ts rule-task-helpers.ts task-instance-state.ts test-data.ts + 各 .test.ts
```

### Step 3 — 派 subagent-a-agent 生成脚本

直接派内置 sub-agent，prompt 模板（根据 suite 调整路径变量）：

```
任务：基于已重写的 archive MD 重新生成本 suite 的 Playwright t*.ts 脚本，跑通 P0。

**suite slug**：{15693-key-range | 15694-value-format | 15695-and-or}
**archive MD**：workspace/dataAssets/archive/202604/{对应 MD 名}.md
**suite 目录**：workspace/dataAssets/tests/202604/{对应目录名}/
**helpers**：保留所有非 t*.ts 文件，复用现有 API（grep "export async function" 看清单）
**P0 优先**：先生成 P0 用例对应的 t*.ts + 一个 smoke.spec.ts 聚合 P0
**model**：sonnet（subagent-a-agent 默认）

工作流（按 ui-autotest skill 步骤 3 三阶段）：

阶段 1：解析 + 生成
- Read archive MD，找出所有 ##### 【P0】... 用例，按 case_count 编号生成 t1.ts ~ tN.ts
- 每个 t*.ts 用 fixture step-screenshot，setTimeout(600000)
- 严格按 archive 步骤生成 await step("步骤N: ...", async () => { ... })
- 所有 helper 调用用现有 API；新 helper 不写在 t*.ts 内（写到对应 helpers 文件并增量 export）
- 生成 smoke.spec.ts 聚合 P0：import { default } from "./t1"; ...

阶段 2：自测修复（loop 直到 P0 全绿或上抛 unfixable）
- 跑：QA_PROJECT=dataAssets QA_SUITE_NAME={suite-slug} ACTIVE_ENV=ltqc \
       UI_AUTOTEST_SESSION_PATH=$(pwd)/.auth/dataAssets/session-ltqc.json \
       bunx playwright test "workspace/dataAssets/tests/202604/{对应目录名}/smoke.spec.ts" --reporter=list --workers=1
- 失败按 ui-autotest-pitfalls.md A1-G8 自检
- 单条用例失败 ≤ 3 轮，3 轮内修不掉上抛主 agent

阶段 3：共性收敛
- 修复完成后归纳新撞坑模式：是否需要新增 ui-autotest-pitfalls.md 规则？
- 写到 returned message 让主 agent 收纳

**必读规则**（按顺序）：
- workspace/dataAssets/rules/ui-autotest-pitfalls.md（A1-G8 全量）
- workspace/dataAssets/rules/case-writing.md（§8 字段类型矩阵 + §9 R7 + §10 R8 + §11 R6）
- workspace/dataAssets/knowledge/pitfalls/2026-04-27-treeselect-search-not-scroll.md（G8 详情）
- workspace/dataAssets/knowledge/modules/data-quality.md（如存在）

**必避坑**（grep 自检）：
- 禁 .rule__function-list__item 单路径（须双路径 fallback）
- 禁硬编码 QUALITY_PROJECT_ID（用 resolveEffectiveQualityProjectId）
- 禁 datasourceType: "hive2.x"（须 "Hive2.x"）
- 禁 selectJsonKeys 类 helper 用展开+滚动（须 G8 搜索框过滤）

**产出**：
- t1.ts ~ tN.ts（P0 用例对应）
- smoke.spec.ts（聚合 P0 import）
- 跑通 P0 的最终 reporter 输出（贴到 returned message）
- 未修掉的 ambiguous 上抛清单
- 共性新撞坑（用于追加 G9, G10... 规则）
```

### Step 4 — 主 agent 收 returned message

- 检查 P0 全绿（5/5 / 2/2 / 2/2）
- 收 ambiguous 报告并拍板（参考 §11 R6 范本）
- 收新撞坑追加到 ui-autotest-pitfalls.md（必要时）

### Step 5 — Commit per suite

```bash
git add "workspace/dataAssets/tests/202604/{对应目录名}/"
git commit -m "feat(test): rebuild {suite-slug} suite P0 from rewritten archive

- N P0 cases all pass (X.X min)
- helpers preserved, t*.ts regenerated per R1-R8 + G1-G8
"
```

如有 helpers 增量改动 + pitfalls 追加：
```bash
git add workspace/dataAssets/tests/202604/{对应目录名}/{改动 helper}.ts \
        workspace/dataAssets/rules/ui-autotest-pitfalls.md \
        workspace/dataAssets/knowledge/pitfalls/{新文档}.md
git commit -m "fix(helpers): {简述} + docs(pitfalls): G{N} from {suite} regen"
```

### Step 6 — Mark task complete

如有任务列表，更新 Task 28 / Task 13。

---

## 6. 命令清单

```bash
# 跑某 suite 的 P0
QA_PROJECT=dataAssets QA_SUITE_NAME={suite-slug} ACTIVE_ENV=ltqc \
  UI_AUTOTEST_SESSION_PATH=$(pwd)/.auth/dataAssets/session-ltqc.json \
  bunx playwright test "workspace/dataAssets/tests/202604/{目录}/smoke.spec.ts" \
  --reporter=list --workers=1

# 跑单个 case
... bunx playwright test "..../t3.ts" --reporter=list --workers=1

# 验证 archive case_count 与解析一致
bun run .claude/skills/ui-autotest/scripts/parse-cases.ts \
  --file "workspace/dataAssets/archive/202604/{md}.md" | jq '.stats'

# regen xmind（若 MD 改了）
bun run .claude/scripts/kata-cli.ts xmind-gen \
  --input "workspace/dataAssets/archive/202604/{md}.md" \
  --output "workspace/dataAssets/xmind/202604/{md}.xmind" --mode replace

# rule-loader 验证规则加载
bun run .claude/scripts/kata-cli.ts rule-loader load --project dataAssets | jq '.rules | length'

# helper 反模式审计
echo "=== A1 ===" && grep -rn '\.rule__function-list__item' workspace/dataAssets/tests/202604/{目录}/ | grep -v node_modules
echo "=== C1 ===" && grep -rn 'QUALITY_PROJECT_ID' workspace/dataAssets/tests/202604/{目录}/ | grep -v 'export const' | grep -v 'import' | grep -v 'resolveEffectiveQualityProjectId'
echo "=== C2 ===" && grep -rEn 'spark\|thrift([^|]|$)' workspace/dataAssets/tests/202604/{目录}/
echo "=== A2 ===" && grep -rEn 'filter\(\{ hasText: /字段[^级^/]' workspace/dataAssets/tests/202604/{目录}/
```

---

## 7. ambiguous TODO 上抛清单（22 处，subagent A 跑通时根据真实 UI 回填）

### 15693（8 处）
1. line 189 数据质量报告"前两个"位置 — 保用户口述
2. line 222 反向 case 验证"全量展示" — 保用户口述
3. line 330 + 364 INT 字段执行报错文案 — 待运行时回填
4. line 516 SparkThrift json 字段 → STRING 替代 — 已知 pitfall
5. line 635 Hive2.x 同样无 json — 同上
6. line 886 删除被引用 key 后是否参与校验 — 保"已删除不参与"
7. line 1092 字段类型列文案 SparkThrift 用 STRING 但 PRD 写 json — 保 PRD 业务语义

### 15694（8 处）
1. line 223 TreeSelect 搜索是前端本地还是后端接口 — 默认前端
2. line 257 200 条 key 默认加载上限位置 — 待运行时回填
3. line 323 "前两个"实现位置 — 保 maxTagCount=responsive 与 qualityReport 双 case
4. line 375 弹窗默认 pageSize — 默认 10
5. line 414 INT 字段运行时校验失败文案 — 待运行时回填
6. line 720 通用配置删除 Popconfirm 按钮 — 默认「确认」（G5）
7. line 866 + 955 纯 UI / 运维场景删除 Doris 句式

### 15695（6 处）
1. line 267 ENUM_INFO 显示文案 — 保源码「枚举值信息」
2. line 343 枚举值空校验文案 — 默认「请输入数值」
3. line 375 取值范围+枚举均空校验文案 — 待运行时回填
4. line 570 弱规则不通过整体语义 — 待运行时回填
5. line 580+589 SQL 错误构造方式 + 「查看日志」入口 — 改人工或 P2 跳过
6. line 799 数据质量报告异步生成 — 改写为校验结果查询实例详情

---

## 8. 验收标准（Task 13）

- ✅ 4 suite 全部 P0 通过（通用配置 3/3 已绿 + 3 内置 5+2+2=9 P0）
- ✅ 4 xmind 节点数 = 对应 MD case_count（通用配置 44 / 15693 37 / 15694 30 / 15695 27）
- ✅ grep 4 类禁用模式（A1/A2/C1/C2）hit count = 0（在已 commit 的 t\*.ts + helpers）
- ✅ rule-loader 能加载 G1-G8 + R1-R8 + 字段类型矩阵
- ✅ 任何新撞坑沉淀到 pitfalls + ui-autotest-pitfalls.md G 节追加

---

## 9. 关联文档

- Plan: `docs/superpowers/plans/2026-04-27-md-cases-rework.md`
- Spec: `docs/superpowers/specs/2026-04-27-md-cases-rework-design.md`
- JSON config P1 handoff（参考结构 + 同时进行的另一个 cc 实例任务）：`docs/superpowers/handoffs/2026-04-27-json-config-p1-handoff.md`
- 11 篇 pitfalls：`workspace/dataAssets/knowledge/pitfalls/2026-04-27-*.md`
- 硬规则：`workspace/dataAssets/rules/ui-autotest-pitfalls.md`
- 用例规范：`workspace/dataAssets/rules/case-writing.md`

---

## 10. 续传 prompt 模板（compact 后或新 cc 实例首条消息）

```
执行 docs/superpowers/handoffs/2026-04-27-stage3-script-regen-handoff.md。

读完整 doc 后按 §5 「Per-Suite 工作流程」推进剩余 3 suite。
建议顺序：15693（最稳）→ 15695 → 15694（最复杂）。
每 suite 跑通 P0 后单独 commit，不要捆绑。

如同时另一 cc 实例在跑 JSON config P1（handoffs/2026-04-27-json-config-p1-handoff.md），
注意 ltqc 环境并发：单 suite playwright --workers=1，3 suite 之间错峰串行。

完成 §8 验收清单后宣布 Task 13 done。
```
