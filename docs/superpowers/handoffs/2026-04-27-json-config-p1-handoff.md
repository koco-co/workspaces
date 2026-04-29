# 【通用配置】json 格式配置 — P1 脚本生成 交接文档

> 目标 cc 实例任务：基于已通过的 P0 脚本扩 P1（38 条），目标 ≥ 80% pass。
> 主会话已完成 Stage 0/1/2 的 Task 1–9 (P0 部分)，并行继续 Stage 2 反馈回流（Task 10）。

---

## 0. 速览

| 项 | 状态 |
|---|---|
| MD 重写完毕 | ✅ R1-R6 应用，44 用例（3 P0 + 38 P1 + 3 P2），3 模糊点已用户拍板 |
| XMind 同步 | ✅ `kata-cli xmind-gen --input <md> --output <xmind> --mode replace`（不是 case-format reverse-sync！） |
| Helpers 已审计 | ✅ `json-config-helpers.ts` 610 行，4 类禁用模式 hit count = 0 |
| P0 脚本 | ✅ 3/3 通过（commit `3c34a10a`，1.0 min） |
| P1 脚本 | ⏳ 待生成（38 条） |
| P2 脚本 | 暂不做（Stage 2 不要求） |

---

## 1. 关键路径

### 1.1 工作目录与文件

```
工作目录:  /Users/poco/Projects/kata
当前分支:  feat/desktop-shell-spec1
git 远程:  origin/feat/desktop-shell-spec1（已领先 17+ 个提交，未推）

源 MD:     workspace/dataAssets/archive/202604/【通用配置】json格式配置.md  (44 用例, 1003+ 行)
对应 xmind: workspace/dataAssets/xmind/202604/【通用配置】json格式配置.xmind
PRD:       workspace/dataAssets/prds/202604/【通用配置】json格式配置/【通用配置】json格式配置.md
PRD 图:    workspace/dataAssets/prds/202604/【通用配置】json格式配置/images/

测试目录:  workspace/dataAssets/tests/202604/【通用配置】json格式配置/
  ├─ json-config-helpers.ts   (610 行，已审计，所有 helper exports 见 §2.2)
  ├─ smoke.spec.ts            (P0 only：import t1/t2/t3)
  ├─ t1.ts  (P0：新增 key 完整流程)
  ├─ t2.ts  (P0：导入正确文件全流程)
  └─ t3.ts  (P0：导出列表数据流程)

脚本规则（auto-loaded by rule-loader）：
  workspace/dataAssets/rules/case-writing.md       (§8 SparkThrift/Doris 矩阵)
  workspace/dataAssets/rules/ui-autotest-pitfalls.md  (30 条硬规则 A1-F2)
  workspace/dataAssets/knowledge/pitfalls/2026-04-27-*.md  (8 篇背景)

测试基础设施：
  workspace/dataAssets/tests/fixtures/step-screenshot.ts  (test/expect/step fixture)
  workspace/dataAssets/helpers/test-setup.ts              (uniqueName)
  workspace/dataAssets/helpers/preconditions.ts           (setupPreconditions adapter)
```

### 1.2 测试运行命令模板

```bash
cd /Users/poco/Projects/kata && \
  QA_PROJECT=dataAssets QA_SUITE_NAME=json-config ACTIVE_ENV=ltqc \
  UI_AUTOTEST_SESSION_PATH=$(pwd)/.auth/dataAssets/session-ltqc.json \
  bunx playwright test "<spec path>" --reporter=list --workers=1
```

### 1.3 环境约束

- **必须** `ACTIVE_ENV=ltqc`（NOT ltqcdev）— 租户 = `pw_test`
- **session 路径**：`.auth/dataAssets/session-ltqc.json`
- **base URL**：`http://shuzhan63-test-ltqc.k8s.dtstack.cn`
- **quality project ID**：92（不要写死 90，用 `resolveEffectiveQualityProjectId(page)`）
- **SparkThrift cluster name**：`pw_test_HADOOP`

---

## 2. P0 脚本（已通过，作为模板）

### 2.1 文件结构模板（参考 `t1.ts`）

```ts
// META: {"id":"t1","priority":"P0","title":"【P0】验证新增key完整正向流程（含正则测试）"}
import { expect, test } from "../../fixtures/step-screenshot";
import { uniqueName } from "../../helpers/test-setup";
import {
  gotoJsonConfigPage,
  clickHeaderButton,
  waitModal,
  fillKeyInput,
  fillNameInput,
  fillValueFormat,
  selectDataSourceType,
  clickModalConfirm,
  confirmAndWaitClose,
  ensureRowVisibleByKey,
  deleteKey,
} from "./json-config-helpers";

test.use({ storageState: process.env.UI_AUTOTEST_SESSION_PATH ?? ".auth/session.json" });
test.setTimeout(600000);

const SUITE_NAME = "【通用配置】json格式配置(#15696)";
const PAGE_NAME = "json格式校验管理";

test.describe(`${SUITE_NAME} - ${PAGE_NAME}`, () => {
  // 数据：使用 uniqueName 唯一化
  const newKey = uniqueName("json_cfg_p0_new");

  test.afterEach(async ({ page }) => {
    // 清理（可失败）
    await deleteKey(page, newKey).catch(() => undefined);
  });

  test("验证新增key完整正向流程（含正则测试）", async ({ page, step }) => {
    await step("步骤1: 进入json格式校验管理页面", async () => {
      await gotoJsonConfigPage(page);
      // 断言列表加载
    });

    await step("步骤2: 点击【新增】按钮", async () => {
      await clickHeaderButton(page, "新增");
      const modal = await waitModal(page, "新建");
      // ...
    });
    // ...
  });
});
```

### 2.2 `json-config-helpers.ts` 已导出函数（直接复用，禁止重复造轮子）

```ts
gotoJsonConfigPage(page)                        // 导航到 json 格式校验管理页
clickHeaderButton(page, label)                  // 点击页面顶部按钮（新增/导入/导出/批量删除等）
waitModal(page, title)                          // 等待 modal 出现并返回 locator
fillKeyInput(modal, key)                        // modal 内填 key
fillNameInput(modal, name)                      // modal 内填中文名称
fillValueFormat(modal, regex)                   // modal 内填 value 格式
selectDataSourceType(modal, type)               // modal 内选数据源类型
clickModalConfirm(modal)                        // 点击 modal 内的 确定/确认
confirmAndWaitClose(page, modal)                // 等 modal 关闭
addKey(page, keyName, opts)                     // 高级：完整新增 key
ensureRowVisibleByKey(page, keyName, timeout)   // 断言列表中存在该行
addChildKey(page, parentKey, childOpts)         // 添加子层级 key
expandRow(page, keyName)                        // 展开行（含子层级）
deleteKey(page, keyName)                        // 删除 key（含 Popconfirm）
searchKey(page, keyword)                        // key 名搜索
clearSearch(page)                               // 清搜索
buildImportXlsx(rows)                           // 构造导入用 xlsx Buffer
```

完整签名见 `workspace/dataAssets/tests/202604/【通用配置】json格式配置/json-config-helpers.ts`。

---

## 3. ★ P0 调试中踩到的 P1 关键坑（先看再写）★

按出现概率从高到低：

### 3.1 数据源类型大小写敏感

UI 实际显示 **`Hive2.x`**（首字母大写），不是 `hive2.x`。
- ❌ `dataSourceType: "hive2.x"` → `selectDataSourceType` 内部断言失败
- ✅ `dataSourceType: "Hive2.x"`

`SparkThrift2.x` 同理（也是大写 ST）。

### 3.2 Modal title

PRD/原 MD 写的「新增」实际是「新建」（源码 BM=新建）。
- ✅ `await waitModal(page, "新建")` （新增弹窗）
- ✅ `await waitModal(page, "新建子层级")`（新增子层级弹窗）
- ✅ `await waitModal(page, "编辑")`（编辑弹窗 — title 仅「编辑」二字，**不**拼接中文名称！）

### 3.3 正则测试结果文案

源码：「**符合正则**」/「**不符合正则**」。原 MD 写「匹配成功」/「匹配失败」是错的。

### 3.4 表单字段顺序

CreateModal 实际顺序：**数据源类型 → key → 中文名称 → value 格式**（不是 PRD 图的 key→中文名称→value→数据源）。

### 3.5 Popconfirm 文本

- 单条删除 Popconfirm：「请确认是否删除key信息,」+「若存在子层级key信息会联动删除」
- 批量删除 Modal：「是否批量删除key信息?」+「确认删除后，若存在子层级key信息会联动删除」
- 导出 Popconfirm 按钮文案：「**确认**」（不是「确定」）

### 3.6 测试数据输入框定位陷阱

`form-item filter('测试数据')` 找到的是 label 元素，containing input 不可即时定位。  
解决：`visibleModal.locator("input:visible, textarea:visible").last()`

### 3.7 导入弹窗实际字段

源码 = 重复处理规则 + 数据源类型 + 上传文件（PRD 仅写两个，漏了数据源类型）。

### 3.8 默认每页条数

源码 `pageSizeOptions=['10','20','50','100']`，**默认 10**（不是 20）。

---

## 4. P1 任务清单（38 条，按 MD 行号）

按业务区分 3 组（建议并行 3 个 sub-agent 各处理一组，文件名按 t4-t41 顺序）：

### Group A — 单 key CRUD + 边界 + 层级（13 条）→ t4-t16

| # | MD 行 | 标题 |
|---|---|---|
| t4  | 49  | 【P1】验证新增key时key字段为空不可提交 |
| t5  | 64  | 【P1】验证新增key时key字段输入超255字符不可提交 |
| t6  | 79  | 【P1】验证新增key时key字段输入恰好255字符边界值可成功提交 |
| t7  | 111 | 【P1】验证新增key表单中切换数据源类型后其余字段内容仍保留 |
| t8  | 129 | 【P1】验证编辑key名称、value格式、数据源类型并保存生效 |
| t9  | 148 | 【P1】验证新增子层级完整流程 |
| t10 | 165 | 【P1】验证第5层级的新增子层级按钮是置灰、不可点击（disabled） |
| t11 | 188 | 【P1】验证单个删除含子层级的key会联动删除子层级数据 |
| t12 | 206 | 【P1】验证批量删除多条key（含子层级） |
| t13 | 227 | 【P1】验证key名模糊搜索功能（含子层级key命中） |
| t14 | 246 | 【P1】验证数据源类型筛选功能 |
| t15 | 270 | 【P1】验证5层层级展开下钻及展开图标显示逻辑 |
| t16 | 297 | 【P1】验证value格式有内容时正则测试控件显示及匹配通过失败场景 |

### Group B — 导入场景（19 条）→ t17-t35

| # | MD 行 | 标题 |
|---|---|---|
| t17 | 343 | 【P1】验证导入模板下载功能 |
| t18 | 358 | 【P1】验证重复处理规则「重复则覆盖更新」生效 |
| t19 | 379 | 【P1】验证重复处理规则「重复则跳过」对已存在key不覆盖 |
| t20 | 400 | 【P1】验证导入文件key名超255字符时标红并批注长度超限 |
| t21 | 420 | 【P1】验证导入文件必填项未填写时标红并批注必填项未填写 |
| t22 | 440 | 【P1】验证导入文件二层key上一层级key名无法匹配时标红并批注提示 |
| t23 | 464 | 【P1】验证导入非xlsx格式文件时报错 |
| t24 | 480 | 【P1】验证导入功能正常(重复则覆盖更新, 1~5层key存在相同 -> 报错) |
| t25 | 500 | 【P1】验证导入功能正常(重复则覆盖更新, 1层key已存在 -> 更新1层key) |
| t26 | 520 | 【P1】验证导入功能正常(重复则覆盖更新, 1层key不存在 -> 新增1层key) |
| t27 | 540 | 【P1】验证导入功能正常(重复则覆盖更新, 2~5层上一层key存在+key存在+value不存在 -> 更新N层value) |
| t28 | 562 | 【P1】验证导入功能正常(重复则覆盖更新, 2~5层上一层key存在+key不存在 -> 新增N层key) |
| t29 | 582 | 【P1】验证导入功能正常(重复则覆盖更新, 2~5层上一层key不存在 -> 报错) |
| t30 | 602 | 【P1】验证导入功能正常(重复则跳过, 1~5层key存在相同 -> 报错) |
| t31 | 622 | 【P1】验证导入功能正常(重复则跳过, 1层key已存在 -> 跳过不变) |
| t32 | 642 | 【P1】验证导入功能正常(重复则跳过, 1层key不存在 -> 新增1层key) |
| t33 | 662 | 【P1】验证导入功能正常(重复则跳过, 2~5层上一层key存在+key存在+value不存在 -> 跳过不变) |
| t34 | 684 | 【P1】验证导入功能正常(重复则跳过, 2~5层上一层key存在+key不存在 -> 新增N层key) |
| t35 | 704 | 【P1】验证导入功能正常(重复则跳过, 2~5层上一层key不存在 -> 报错) |

### Group C — 导出/筛选/关联（6 条）→ t36-t41

| # | MD 行 | 标题 |
|---|---|---|
| t36 | 745 | 【P1】验证筛选后导出仅包含筛选结果数据 |
| t37 | 802 | 【P1】验证大数据量场景key记录下载数量是否存在限制 |
| t38 | 820 | 【P1】验证删除已被完整性和有效性校验规则引用的key后规则不受影响 |
| t39 | 855 | 【P1】验证编辑页与新增页表单结构保持一致（字段顺序、必填项、title） |
| t40 | 876 | 【P1】验证筛选导出三种筛选组合的行为一致性（数据源类型单筛 / key 名模糊单筛 / 组合筛） |
| t41 | 906 | 【P1】验证导入 xlsx 第 2 个 sheet 页的第一层级 key 名不存在时，标红列应为「第一层级 key 名」而非「key」 |

---

## 5. 推荐执行流程

### 5.1 单 sub-agent 全干（保守，~1.5h）

派一个 sonnet sub-agent 顺序生成 t4-t41。给它本文档 + json-config-helpers.ts + 3 个 P0 t*.ts 作为模板。生成完跑 full.spec.ts 验证。

### 5.2 3 sub-agent 并行（推荐，~30-40 min wall time）

> 文件名互不重叠，无 race condition。

```
Sub-agent A: Group A (t4-t16, MD 行 49-296)   — 13 条 单 key CRUD
Sub-agent B: Group B (t17-t35, MD 行 343-720) — 19 条 导入场景
Sub-agent C: Group C (t36-t41, MD 行 745-906) — 6 条 导出/筛选/关联
```

每个 sub-agent 收到：
- 本文档全文（必读）
- 自己的 t*-行号 映射表（只生成自己负责的，不读他人区段）
- json-config-helpers.ts 路径（只读，禁改）
- t1.ts/t2.ts/t3.ts 路径（只读，作为模板）

返回：t*.ts 文件 + 简短笔记（每条一句：用了哪些 helper，是否有 R6 ambiguous）

### 5.3 验证

3 个 sub-agent 完成后：

```bash
# 写 full.spec.ts
cat > "workspace/dataAssets/tests/202604/【通用配置】json格式配置/full.spec.ts" <<'EOF'
// 全量回归 (P0 + P1)
import "./t1"; import "./t2"; import "./t3";
import "./t4"; import "./t5"; import "./t6"; import "./t7"; import "./t8";
import "./t9"; import "./t10"; import "./t11"; import "./t12"; import "./t13";
import "./t14"; import "./t15"; import "./t16";
import "./t17"; import "./t18"; import "./t19"; import "./t20";
import "./t21"; import "./t22"; import "./t23"; import "./t24"; import "./t25";
import "./t26"; import "./t27"; import "./t28"; import "./t29"; import "./t30";
import "./t31"; import "./t32"; import "./t33"; import "./t34"; import "./t35";
import "./t36"; import "./t37"; import "./t38"; import "./t39";
import "./t40"; import "./t41";
EOF

# 跑全量
QA_PROJECT=dataAssets QA_SUITE_NAME=json-config ACTIVE_ENV=ltqc \
  UI_AUTOTEST_SESSION_PATH=$(pwd)/.auth/dataAssets/session-ltqc.json \
  bunx playwright test "workspace/dataAssets/tests/202604/【通用配置】json格式配置/full.spec.ts" \
  --reporter=list --workers=1 2>&1 | tee /tmp/p1-full.log
```

### 5.4 验收阈值

- ✅ P0 全过 — 已满足
- ✅ ≥ 80% P1 通过（≥ 31/38）
- ❌ 失败 case 必须登记原因：
  - 产品 bug → 上抛主 agent，标 archive_writeback
  - 用例描述错 → 改 MD 后 case-format 同步
  - helper 限制 → 加 helper / 写到 ui-autotest-pitfalls.md A6+ / F3+
  - 环境波动 → 重试 1 次后再判定

---

## 6. 已知 R6 ambiguous（已被用户拍板，不需再问）

| MD 行 | 主题 | 用户决策 |
|---|---|---|
| 743 | 导出文件「层级关系」列 | 保留 PRD 描述（含层级关系列） |
| 798 | 大数据量分页默认值 | 按源码改写（默认每页 10 条） |
| 871 | 编辑弹窗 title | 按源码改写（仅「编辑」二字，不拼接） |
| frontmatter | case_count: 41 vs 实际 44 | 改为 44 |

---

## 7. 提交规范

每个 commit：
```
feat(test): rebuild json-config suite P1 group <A|B|C> based on rewritten archive
```

不要：`Co-Authored-By` trailer（项目约定禁止）

---

## 8. 不要做

- ❌ 改 archive MD（已定稿）
- ❌ 改 xmind（已同步）
- ❌ 加新 helper 函数（除非确实缺；先用现有的）
- ❌ 写 P2 用例（Stage 2 不要求）
- ❌ 调用 ui-autotest skill（heavyweight，已在主会话中加载）
- ❌ commit 到 docs/superpowers/（在 .gitignore）
- ❌ 弱化断言来通过（assertion fidelity 是硬规则）

---

## 9. 关联文件清单（新 cc 启动后第一时间读）

```
docs/superpowers/specs/2026-04-27-md-cases-rework-design.md   (整体设计)
docs/superpowers/plans/2026-04-27-md-cases-rework.md          (13-task plan，本文档对应 Task 9 P1 部分)
workspace/dataAssets/rules/case-writing.md                    (含 §8 数据源矩阵)
workspace/dataAssets/rules/ui-autotest-pitfalls.md            (30 条硬规则)
workspace/dataAssets/archive/202604/【通用配置】json格式配置.md  (44 用例源)
workspace/dataAssets/tests/202604/【通用配置】json格式配置/json-config-helpers.ts (610 行 helpers)
workspace/dataAssets/tests/202604/【通用配置】json格式配置/t1.ts/t2.ts/t3.ts (P0 模板)
```

---

## 10. 启动 prompt（在新 cc 实例 paste）

```
请按 docs/superpowers/handoffs/2026-04-27-json-config-p1-handoff.md 完成「【通用配置】json 格式配置」suite 的 P1 脚本生成（38 条），目标 ≥ 80% pass。

执行偏好：
- Auto mode，自主推进
- §5.2 3-sub-agent 并行方案
- 全部完成后写 full.spec.ts 跑全量，给我通过率摘要 + 失败原因登记
- commit 按 §7 规范
- 失败原因如属产品 bug，请按 archive_writeback 协议上抛我拍板

环境检查：
- ACTIVE_ENV=ltqc，session 在 .auth/dataAssets/session-ltqc.json
- 当前分支 feat/desktop-shell-spec1
- 已通过 P0 commit: 3c34a10a
```
