# Phase A — skills 架构重组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 11 个 skills 合并为 7 个（using-kata / daily-task / case-format 三合并、setup 删除），并把 `test-case-gen/workflow/main.md` 从 709 行拆分为 10 个节点文件，为后续 Phase B（discuss 节点增强）腾出可维护的文件骨架。

**Architecture:** 本 phase 只做结构重组，不改变 workflow 行为逻辑。所有合并采用「新建 skill 目录 → git mv 原有文件到新位置 → 重写 SKILL.md 做模式路由 → 删原 skill 目录」的四步套路。test-case-gen/workflow/main.md 拆分保持节点内容等价。

**Tech Stack:** bash / markdown / git / kata-cli（无变更）

**Spec reference:** `docs/refactor/specs/2026-04-24-discuss-enhancement-and-skills-refactor-design.md` Part 2

---

## Task 1: INSTALL.md 解绑 `/kata init`

**Files:**
- Modify: `INSTALL.md:10`, `INSTALL.md:86`, `INSTALL.md:109`

**Why first:** `setup` skill 即将删除，INSTALL.md 仍以 `/kata init` 作为终态目标——需要先把 INSTALL.md 改到不依赖 setup skill 的状态，再删。

- [ ] **Step 1: 检查 INSTALL.md 中的 `/kata init` 引用点**

Run: `grep -n "/kata init\|kata init" INSTALL.md`
Expected: 三行命中（第 10 / 86 / 109 行）

- [ ] **Step 2: 替换为 `/using-kata`（Phase A 新命令）**

Modify `INSTALL.md:10`:
```diff
-你是 Kata 的安装助手。目标：在用户当前终端会话中完成 Kata 的环境初始化，直至 `/kata init` 可用。
+你是 Kata 的安装助手。目标：在用户当前终端会话中完成 Kata 的环境初始化，直至 `/using-kata` 可用。
```

Modify `INSTALL.md:86`:
```diff
-- 下一步动作：`在 Claude Code 中打开项目目录并输入 /kata init`
+- 下一步动作：`在 Claude Code 中打开项目目录并输入 /using-kata`
```

Modify `INSTALL.md:109`:
```diff
-Step 1–5 全绿，Step 7 摘要已输出。用户回到 Claude Code 执行 `/kata init` 能进入向导即视为安装完成。
+Step 1–5 全绿，Step 7 摘要已输出。用户回到 Claude Code 执行 `/using-kata` 能看到功能菜单即视为安装完成。
```

- [ ] **Step 3: 验证无遗留**

Run: `grep -n "/kata init\|kata init" INSTALL.md`
Expected: 无输出（exit code 1）

- [ ] **Step 4: 提交**

```bash
git add INSTALL.md
git commit -m "docs(install): replace /kata init with /using-kata terminal target"
```

---

## Task 2: 创建 case-format skill（xmind-editor 重命名 + 迁入 reverse-sync + other2md）

**Files:**
- Rename: `.claude/skills/xmind-editor/` → `.claude/skills/case-format/`
- Move: `.claude/skills/test-case-gen/workflow/reverse-sync.md` → `.claude/skills/case-format/workflow/reverse-sync.md`
- Move: `.claude/skills/test-case-gen/workflow/standardize.md` → `.claude/skills/case-format/workflow/other2md.md`
- Rewrite: `.claude/skills/case-format/SKILL.md`

- [ ] **Step 1: 用 git mv 重命名 skill 目录**

```bash
cd /Users/poco/Projects/kata
git mv .claude/skills/xmind-editor .claude/skills/case-format
```

- [ ] **Step 2: 验证目录结构**

Run: `ls .claude/skills/case-format/`
Expected: `SKILL.md  workflow  references`（或 xmind-editor 原有的子目录）

Run: `test ! -d .claude/skills/xmind-editor && echo ok`
Expected: `ok`

- [ ] **Step 3: 创建 workflow/edit.md（把原 SKILL.md 中的工作流主体抽出）**

Run: `wc -l .claude/skills/case-format/SKILL.md`

Read 原 `SKILL.md` 全文，把「前置加载」以下的操作步骤部分抽到新文件 `.claude/skills/case-format/workflow/edit.md`，保留原文一字不改。顶部加一行：
```markdown
# case-format / edit — XMind 测试用例局部编辑工作流
```

- [ ] **Step 4: 迁入 reverse-sync.md（来自 test-case-gen）**

```bash
git mv .claude/skills/test-case-gen/workflow/reverse-sync.md \
       .claude/skills/case-format/workflow/reverse-sync.md
```

Run: `head -1 .claude/skills/case-format/workflow/reverse-sync.md`
Expected: 看到原 reverse-sync.md 的标题行

- [ ] **Step 5: 迁入 other2md.md（来自 test-case-gen/standardize.md，改名）**

```bash
git mv .claude/skills/test-case-gen/workflow/standardize.md \
       .claude/skills/case-format/workflow/other2md.md
```

在文件顶部修改标题（保留正文不动）:
```diff
-# test-case-gen · standardize workflow（XMind/CSV → 标准化 Archive MD）
+# case-format · other2md workflow（XMind/CSV → 标准化 Archive MD）
```

- [ ] **Step 6: 重写 case-format/SKILL.md 为模式路由**

Overwrite `.claude/skills/case-format/SKILL.md` with:

```markdown
---
name: case-format
description: "测试用例格式中枢：XMind 编辑 / XMind↔Archive 双向同步 / 外部格式（XMind、CSV）标准化。触发词：
  - edit 模式：修改用例、编辑用例、新增用例、删除用例
  - reverse-sync 模式：同步 xmind、反向同步、同步 XMind 文件
  - other2md 模式：标准化归档、归档用例、转化用例、标准化 xmind、标准化 csv；直接传入 .xmind 或 .csv 文件路径亦自动进入此模式。"
argument-hint: "[edit | reverse-sync | other2md] [文件路径或关键词]"
---

# case-format

## 模式路由

根据第一个参数 / 自然语言关键词 / 输入文件类型切模式：

| 模式 | 触发词 / 输入 | 工作流文件 |
|---|---|---|
| `edit` | 修改用例、编辑用例、新增用例、删除用例 | `workflow/edit.md` |
| `reverse-sync` | 同步 xmind、反向同步、XMind 文件 + Archive MD | `workflow/reverse-sync.md` |
| `other2md` | 标准化归档、归档用例、`.xmind` / `.csv` 文件路径 | `workflow/other2md.md` |

确定模式后，Read 对应 workflow 文件并按其指引继续执行。

## 项目选择（所有模式共享）

扫描 `workspace/` 目录下的子目录（排除 `.` 开头的隐藏目录和 `.repos` 等）：
- 仅 1 个项目 → 自动选中
- 多个项目 → 列出供用户选择

## 共享约束

- 产出写入 `workspace/{project}/archive/{YYYYMM}/` 或 `workspace/{project}/xmind/{YYYYMM}/`
- 不改 Archive MD / XMind 的 A/B 产物契约
- 遵守 `rules/case-writing.md` 与 `rules/xmind-structure.md`
```

- [ ] **Step 7: 验证 case-format 结构**

```bash
ls .claude/skills/case-format/workflow/
# Expected: edit.md  reverse-sync.md  other2md.md

ls .claude/skills/test-case-gen/workflow/
# Expected: main.md（reverse-sync.md 和 standardize.md 已移除）
```

- [ ] **Step 8: 提交**

```bash
git add .claude/skills/case-format .claude/skills/test-case-gen/workflow/
git commit -m "refactor(skills): create case-format from xmind-editor + migrate reverse-sync + other2md"
```

---

## Task 3: test-case-gen workflow 拆分为 10 节点文件

**Files:**
- Modify: `.claude/skills/test-case-gen/workflow/main.md` (709 行 → 80-120 行)
- Create: `.claude/skills/test-case-gen/workflow/01-init.md` ... `10-output.md`

**Strategy:** 机械拆分，每个节点内容一字不改迁到新文件。main.md 降级为路由表 + 任务可视化 + 共享协议索引。

- [ ] **Step 1: 对照 spec §2.3 建立编号映射**

旧编号 → 新编号 → 新文件：
```
1       → 01-init          节点 1 init
1.75    → 02-probe         节点 1.75 probe
1.5     → 03-discuss       节点 1.5 discuss
2       → 04-transform     节点 2 transform
3       → 05-enhance       节点 3 enhance
4       → 06-analyze       节点 4 analyze
5       → 07-write         节点 5 write
6       → 08-review        节点 6 review
6.5     → 09-format-check  节点 6.5 format-check
7       → 10-output        节点 7 output
```

- [ ] **Step 2: 读取原 main.md 并按标题切块**

Read `.claude/skills/test-case-gen/workflow/main.md` 全文，用「## 节点 X:」作为切分点，识别 10 段正文。

- [ ] **Step 3: 为每个节点创建独立文件**

对每个节点块，创建对应文件（以 `01-init.md` 为例）：

```markdown
# 节点 1: init — 输入解析与环境准备

> 由 workflow/main.md 路由后加载。上游：用户输入；下游：节点 2 probe。

（此处粘贴原 main.md 中「## 节点 1: init — 输入解析与环境准备」的完整正文，
直到下一个「## 节点 X:」之前的所有内容，一字不改）
```

对每个 01-init / 02-probe / … / 10-output 重复。

- [ ] **Step 4: 重写 main.md 为路由骨架**

Overwrite `.claude/skills/test-case-gen/workflow/main.md` with:

```markdown
# test-case-gen · primary workflow

> 由 SKILL.md 路由后加载。适用场景：PRD 路径 / 蓝湖 URL / 模块重跑指令。
> 共享的契约、断点续传、Writer 阻断协议、异常处理定义见本文件末尾。

## 节点映射表

| # | 名称 | 文件 | 默认超时 | 可跳过条件 |
|---|---|---|---|---|
| 1 | init | workflow/01-init.md | 30s | — |
| 2 | probe | workflow/02-probe.md | 2min | 断点恢复 |
| 3 | discuss | workflow/03-discuss.md | 15min | plan.status=ready |
| 4 | transform | workflow/04-transform.md | 5min | — |
| 5 | enhance | workflow/05-enhance.md | 3min | --quick |
| 6 | analyze | workflow/06-analyze.md | 5min | — |
| 7 | write | workflow/07-write.md | 10min | — |
| 8 | review | workflow/08-review.md | 3min | --quick |
| 9 | format-check | workflow/09-format-check.md | 5min | — |
| 10 | output | workflow/10-output.md | 1min | — |

**加载规则**：主 agent 按映射表 `文件` 字段动态 Read；同会话已读无需重复读。

## 任务可视化（TaskCreate 10 任务）

（此处粘贴原 main.md 中「任务可视化」章节的全部内容——TaskCreate 10 任务的 subject/activeForm 表、write 子任务规则、format-check 循环子任务规则。原文保留。）

## 共享协议

### Writer 阻断中转协议
（此处粘贴原 main.md 中「## Writer 阻断中转协议」章节的完整正文，原文保留。）

### 断点续传说明
（同上粘贴原章节正文。）

### 异常处理
（同上粘贴原章节正文。）
```

- [ ] **Step 5: 更新 SKILL.md 中对 main.md 的引用（确认仍可用）**

Run: `grep -n "main.md\|workflow/" .claude/skills/test-case-gen/SKILL.md`

SKILL.md 原有描述是 `.claude/skills/test-case-gen/workflow/{{scenario}}.md`。由于 `scenario=primary` 对应 `main.md`，此引用仍然正确。无需改 SKILL.md。

但 SKILL.md 中提到的 `standardize` 和 `reverse_sync` 两个场景已迁出，要删除这两个场景的路由。

Read `.claude/skills/test-case-gen/SKILL.md`，在「流程路由」章节中删除 `standardize` 和 `reverse_sync` 两行：

```diff
-| 场景                        | 触发词 ... | 读取文件                   |
-| --------------------------- | ... | -------------------------- |
-| `primary`（主生成）         | ... | `workflow/main.md`         |
-| `standardize`（标准化归档） | ... | `workflow/standardize.md`  |
-| `reverse_sync`（反向同步）  | ... | `workflow/reverse-sync.md` |
+| 场景        | 触发词 ... | 读取文件           |
+| ----------- | ... | ------------------ |
+| `primary`   | ... | `workflow/main.md` |
```

在 SKILL.md 其他章节若提到 standardize / reverse_sync 流程，统一改为「已迁至 `case-format` skill」并删除该段。

- [ ] **Step 6: 结构校验**

```bash
ls .claude/skills/test-case-gen/workflow/
# Expected: main.md  01-init.md  02-probe.md  03-discuss.md  04-transform.md
#           05-enhance.md  06-analyze.md  07-write.md  08-review.md
#           09-format-check.md  10-output.md

wc -l .claude/skills/test-case-gen/workflow/main.md
# Expected: < 200 行

wc -l .claude/skills/test-case-gen/workflow/*.md
# Expected: 每个节点文件 40-200 行，无单文件超过 300 行
```

- [ ] **Step 7: 回归（若有现成 PRD 可跑）**

若用户有可跑的 PRD 用例，走一次 `/test-case-gen <prd_path> --quick`：
- 预期所有 10 节点顺序执行
- 产出的 XMind + Archive MD 与拆分前等价

若无现成 PRD，这一步留给 Task 7 集中冒烟。

- [ ] **Step 8: 提交**

```bash
git add .claude/skills/test-case-gen/
git commit -m "refactor(test-case-gen): split 709-line main.md into 10 node files

- workflow/01-init.md through 10-output.md (one file per node)
- main.md reduced to routing table + task visualization + shared protocols
- SKILL.md removes standardize/reverse_sync scenarios (migrated to case-format)
- behavior-equivalent refactor: node contents unchanged"
```

---

## Task 4: 创建 daily-task skill（合并 bug-report + conflict-report + hotfix-case-gen）

**Files:**
- Create: `.claude/skills/daily-task/SKILL.md`
- Move: `.claude/skills/bug-report/workflow/` → `.claude/skills/daily-task/modes/bug-report/`
- Move: `.claude/skills/conflict-report/workflow/` → `.claude/skills/daily-task/modes/conflict-report/`
- Move: `.claude/skills/hotfix-case-gen/workflow/` → `.claude/skills/daily-task/modes/hotfix-case-gen/`
- Merge: 三个原 skill 的 `references/` 子目录统一迁入 `.claude/skills/daily-task/references/`
- Delete: `.claude/skills/bug-report/`、`.claude/skills/conflict-report/`、`.claude/skills/hotfix-case-gen/` 原目录

- [ ] **Step 1: 创建 daily-task 目录骨架**

```bash
cd /Users/poco/Projects/kata
mkdir -p .claude/skills/daily-task/modes .claude/skills/daily-task/references
```

- [ ] **Step 2: 迁入 bug-report**

```bash
git mv .claude/skills/bug-report/workflow .claude/skills/daily-task/modes/bug-report
# 把原 SKILL.md 保存成该模式的入口文档
git mv .claude/skills/bug-report/SKILL.md .claude/skills/daily-task/modes/bug-report/README.md
# 迁移 references（若存在）
if [ -d .claude/skills/bug-report/references ]; then
  git mv .claude/skills/bug-report/references .claude/skills/daily-task/references/bug-report
fi
# 迁移 scripts（若存在）
if [ -d .claude/skills/bug-report/scripts ]; then
  git mv .claude/skills/bug-report/scripts .claude/skills/daily-task/modes/bug-report/scripts
fi
# 删除空壳
rmdir .claude/skills/bug-report 2>/dev/null || git rm -rf .claude/skills/bug-report
```

- [ ] **Step 3: 迁入 conflict-report**

```bash
git mv .claude/skills/conflict-report/workflow .claude/skills/daily-task/modes/conflict-report
git mv .claude/skills/conflict-report/SKILL.md .claude/skills/daily-task/modes/conflict-report/README.md
if [ -d .claude/skills/conflict-report/references ]; then
  git mv .claude/skills/conflict-report/references .claude/skills/daily-task/references/conflict-report
fi
if [ -d .claude/skills/conflict-report/scripts ]; then
  git mv .claude/skills/conflict-report/scripts .claude/skills/daily-task/modes/conflict-report/scripts
fi
rmdir .claude/skills/conflict-report 2>/dev/null || git rm -rf .claude/skills/conflict-report
```

- [ ] **Step 4: 迁入 hotfix-case-gen**

```bash
git mv .claude/skills/hotfix-case-gen/workflow .claude/skills/daily-task/modes/hotfix-case-gen
git mv .claude/skills/hotfix-case-gen/SKILL.md .claude/skills/daily-task/modes/hotfix-case-gen/README.md
if [ -d .claude/skills/hotfix-case-gen/references ]; then
  git mv .claude/skills/hotfix-case-gen/references .claude/skills/daily-task/references/hotfix-case-gen
fi
if [ -d .claude/skills/hotfix-case-gen/scripts ]; then
  git mv .claude/skills/hotfix-case-gen/scripts .claude/skills/daily-task/modes/hotfix-case-gen/scripts
fi
rmdir .claude/skills/hotfix-case-gen 2>/dev/null || git rm -rf .claude/skills/hotfix-case-gen
```

- [ ] **Step 5: 创建 daily-task/SKILL.md 主路由**

Write `.claude/skills/daily-task/SKILL.md`:

```markdown
---
name: daily-task
description: "QA 日常任务集合：bug 报告生成 / 合并冲突分析 / hotfix 用例生成。触发词：
  - bug-report 模式：Java 堆栈、TypeError、Exception、Console 错误、分析报错、生成 bug 报告、--template full
  - conflict-report 模式：分析冲突、合并冲突、merge conflict、<<<<<<< HEAD
  - hotfix 模式：hotfix、线上 bug 验证、禅道 Bug、bug-view-、分析 bug 链接。
  根据第一个参数、自然语言关键词或粘贴内容自动切模式。"
argument-hint: "[bug | conflict | hotfix] [输入（堆栈 / 冲突片段 / 禅道 URL）]"
---

# daily-task

## 模式路由

| 模式 | 触发条件 | 入口文档 |
|---|---|---|
| `bug` | 参数 `bug` / 粘贴 Java 堆栈或 Console 报错 / Exception / TypeError | `modes/bug-report/README.md` |
| `conflict` | 参数 `conflict` / 粘贴含 `<<<<<<< HEAD` 的片段 | `modes/conflict-report/README.md` |
| `hotfix` | 参数 `hotfix` / 禅道 Bug URL（含 `bug-view-`）/ Bug ID | `modes/hotfix-case-gen/README.md` |

## 路由步骤

1. 识别模式（按「模式路由」表）
2. Read 对应 `modes/{mode}/README.md` 获取该模式的 `<role>` / `<workflow>` / 操作细节
3. 按其指引继续执行，使用 `modes/{mode}/workflow.md` 或同目录其他文档

## 共享约束

- 所有产出写入 `workspace/{project}/reports/` 或 `workspace/{project}/issues/`
- 不改变三个原模式的 A/B 产物契约（HTML bug 报告、HTML conflict 报告、Archive MD hotfix）
```

- [ ] **Step 6: 更新原三个 SKILL.md 内的内部路径引用**

三个 README.md（原 SKILL.md）中可能存在相对路径 `references/xxx`，现在 references 位于 `.claude/skills/daily-task/references/{bug-report|conflict-report|hotfix-case-gen}/...`。全局 grep 修正：

```bash
grep -rn "references/" .claude/skills/daily-task/modes/
```

对每个命中，把相对路径改为 `../../references/{mode}/xxx`。

- [ ] **Step 7: 结构校验**

```bash
ls .claude/skills/daily-task/
# Expected: SKILL.md  modes  references

ls .claude/skills/daily-task/modes/
# Expected: bug-report  conflict-report  hotfix-case-gen

test ! -d .claude/skills/bug-report && \
test ! -d .claude/skills/conflict-report && \
test ! -d .claude/skills/hotfix-case-gen && echo ok
# Expected: ok
```

- [ ] **Step 8: 提交**

```bash
git add .claude/skills/daily-task .claude/skills/bug-report .claude/skills/conflict-report .claude/skills/hotfix-case-gen
git commit -m "refactor(skills): merge bug-report + conflict-report + hotfix-case-gen into daily-task

- .claude/skills/daily-task/SKILL.md: mode router (bug / conflict / hotfix)
- modes/{mode}/: original workflow + README (ex-SKILL.md)
- references/{mode}/: original reference assets
- delete three legacy skill directories"
```

---

## Task 5: 创建 using-kata skill + 删除 setup

**Files:**
- Create: `.claude/skills/using-kata/SKILL.md`
- Move: `.claude/skills/kata/SKILL.md` → `.claude/skills/using-kata/workflow/menu.md`
- Move: `.claude/skills/create-project/*` → `.claude/skills/using-kata/workflow/create-project/`
- Delete: `.claude/skills/kata/`、`.claude/skills/create-project/`、`.claude/skills/setup/`

- [ ] **Step 1: 创建 using-kata 骨架**

```bash
cd /Users/poco/Projects/kata
mkdir -p .claude/skills/using-kata/workflow .claude/skills/using-kata/references
```

- [ ] **Step 2: 迁入 kata**

```bash
git mv .claude/skills/kata/SKILL.md .claude/skills/using-kata/workflow/menu.md
# 若 kata 有其他文件一并迁入
if [ -d .claude/skills/kata ]; then
  for f in .claude/skills/kata/*; do
    [ -e "$f" ] && git mv "$f" .claude/skills/using-kata/workflow/
  done
fi
git rm -rf .claude/skills/kata 2>/dev/null || rmdir .claude/skills/kata
```

- [ ] **Step 3: 迁入 create-project**

```bash
git mv .claude/skills/create-project .claude/skills/using-kata/workflow/create-project
```

若 create-project 内有 `SKILL.md`，重命名为 `README.md`：
```bash
[ -f .claude/skills/using-kata/workflow/create-project/SKILL.md ] && \
  git mv .claude/skills/using-kata/workflow/create-project/SKILL.md \
         .claude/skills/using-kata/workflow/create-project/README.md
```

- [ ] **Step 4: 删除 setup skill**

```bash
git rm -rf .claude/skills/setup
```

- [ ] **Step 5: 重写 using-kata/SKILL.md**

Write `.claude/skills/using-kata/SKILL.md`:

```markdown
---
name: using-kata
description: "kata 功能菜单与项目管理入口。触发词：kata、功能菜单、帮助、创建项目、新建项目、补齐项目、项目初始化。"
argument-hint: "[menu | create] [项目名或关键词]"
---

# using-kata

## 模式路由

| 模式 | 触发 | 入口文件 |
|---|---|---|
| `menu`（默认） | 空输入 / `help` / 功能菜单 / 帮助 | `workflow/menu.md` |
| `create` | 创建项目 / 新建项目 / 补齐项目 / 项目初始化 / `create` | `workflow/create-project/README.md` |

## 菜单入口（默认）

Read `workflow/menu.md` 并按其中的路由逻辑响应用户命令。

> 环境初始化不再由 skill 承担；参见仓库根目录 `INSTALL.md`（由 Coding Agent 按指令集执行）。

## 共享约束

- 不修改 `workspace/{project}/` 结构，create 模式仅创建新骨架或补齐缺失子目录
- 不执行 destructive 操作
```

- [ ] **Step 6: 更新 workflow/menu.md 内的路由表（删除 init/setup 路由，更新 skill 名）**

Read `.claude/skills/using-kata/workflow/menu.md`，把下列路由项修正：

```diff
- - 空输入或 `help` → 显示功能菜单（若无项目则先路由到 `setup`）
- - `init` 或 `0` → 初始化环境（`setup` skill）
- - `1` 或 生成用例相关关键词 → 生成测试用例（`test-case-gen`）
- - `2` 或 ui / autotest / 自动化 相关关键词 → UI 自动化测试（`ui-autotest`）
- - `3` 或 编辑 / xmind 相关关键词 → 编辑 XMind 用例（`xmind-editor`）
- - `4` 或 禅道 Bug 链接 / `hotfix` / `线上 bug 验证` → 生成 Hotfix 用例（`hotfix-case-gen`）
- - `5` 或 `报错` / `异常` / `Exception` / `TypeError` / `Console 错误` → Bug 报告生成（`bug-report`）
- - `6` 或 `冲突` / `merge conflict` / `<<<<<<< HEAD` → 合并冲突分析（`conflict-report`）
- - `7` 或 标准化 / 归档 / 转化 相关关键词 → 标准化归档（`test-case-gen`）
+ - 空输入或 `help` → 显示功能菜单
+ - `1` 或 生成用例相关关键词 → 生成测试用例（`test-case-gen`）
+ - `2` 或 ui / autotest / 自动化 相关关键词 → UI 自动化测试（`ui-autotest`）
+ - `3` 或 编辑 / xmind / 标准化 / 归档 / 反向同步 相关关键词 → 用例格式中枢（`case-format`）
+ - `4` 或 禅道 Bug 链接 / `hotfix` / `线上 bug 验证` → Hotfix 模式（`daily-task hotfix`）
+ - `5` 或 `报错` / `异常` / `Exception` / `TypeError` / `Console 错误` → Bug 报告（`daily-task bug`）
+ - `6` 或 `冲突` / `merge conflict` / `<<<<<<< HEAD` → 合并冲突分析（`daily-task conflict`）
+ - `7` 或 创建项目 / 新建项目 / 补齐项目 相关关键词 → 项目初始化（本 skill 的 `create` 模式）
+ - `8` 或 切换项目 相关关键词 → 切换项目
```

同时删除 `<first_run_policy>` 中对 setup 的引用。

- [ ] **Step 7: 结构校验**

```bash
ls .claude/skills/using-kata/
# Expected: SKILL.md  workflow  references

ls .claude/skills/using-kata/workflow/
# Expected: menu.md  create-project  （以及 kata 原目录下的其他文件，如有）

test ! -d .claude/skills/kata && \
test ! -d .claude/skills/create-project && \
test ! -d .claude/skills/setup && echo ok
# Expected: ok
```

- [ ] **Step 8: 提交**

```bash
git add .claude/skills/using-kata .claude/skills/kata .claude/skills/create-project .claude/skills/setup
git commit -m "refactor(skills): merge kata + create-project into using-kata, delete setup

- .claude/skills/using-kata/SKILL.md: menu + create mode router
- workflow/menu.md: 原 kata SKILL.md，修正路由表指向新 skill 名
- workflow/create-project/: 原 create-project 全内容
- setup skill 删除，环境检查职责由 INSTALL.md 承担
- menu 路由不再含 init/setup 项"
```

---

## Task 6: 全仓库清理老 slash 命令 + 更新 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (功能索引表)
- Modify: `README.md`、`README-EN.md` (命令引用)
- Grep: 全仓库搜索残留的老命令字符串

- [ ] **Step 1: 更新 CLAUDE.md 功能索引表**

Modify `CLAUDE.md` 中的表格：

```diff
-| 命令               | 功能             |
-| ------------------ | ---------------- |
-| `/kata`         | 功能菜单         |
-| `/kata init`    | 环境初始化       |
-| `/test-case-gen`   | 生成测试用例     |
-| `/ui-autotest`     | UI 自动化测试    |
-| `/xmind-editor`    | 编辑 XMind 用例  |
-| `/hotfix-case-gen` | 生成 Hotfix 用例 |
-| `/bug-report`      | 分析 Bug 报告    |
-| `/conflict-report` | 分析合并冲突     |
+| 命令             | 功能                                      |
+| ---------------- | ----------------------------------------- |
+| `/using-kata`    | 功能菜单 + 项目创建                       |
+| `/test-case-gen` | 生成测试用例（PRD → 用例）                |
+| `/case-format`   | XMind 编辑 / XMind↔Archive 同步 / 格式转换 |
+| `/daily-task`    | bug / conflict / hotfix 三模式            |
+| `/ui-autotest`   | UI 自动化测试                             |
```

同时修改 CLAUDE.md:5 「输入 `/kata` 查看功能菜单，首次使用请先执行 `/kata init`。」→「输入 `/using-kata` 查看功能菜单，首次安装请按仓库根目录 `INSTALL.md` 指引。」

- [ ] **Step 2: 更新 README.md**

全局替换（保证 `--dry-run` 先看清影响）:

```bash
# 预览
grep -n "/bug-report\|/conflict-report\|/hotfix-case-gen\|/xmind-editor\|/kata init\|/kata[^-]\|/setup" README.md
```

逐行替换（不用 sed 全局替换避免误伤）:
- `/bug-report` → `/daily-task bug`
- `/conflict-report` → `/daily-task conflict`
- `/hotfix-case-gen` → `/daily-task hotfix`
- `/xmind-editor` → `/case-format edit`
- `/kata init` → （根据上下文）`INSTALL.md`
- `/kata`（独立出现） → `/using-kata`
- `/setup` → 删除或改写为 `INSTALL.md`

README.md 中的 ASCII 架构图（第 39-42 行）：

```diff
-📋 现有 XMind ─────────── /xmind-editor ────→ 👀 预览 → ✅ 确认 → ✏️ 写入
-🔗 禅道 Bug 链接 ─────── /hotfix-case-gen ──→ 🔧 Hotfix Archive MD
-🔥 报错 / 异常 ───────── /bug-report ──────→ 📊 后端/前端 Bug HTML 报告
-⚡ git 冲突片段 ───────── /conflict-report ──→ 📊 合并冲突 HTML 报告
+📋 现有 XMind ─────────── /case-format edit ───→ 👀 预览 → ✅ 确认 → ✏️ 写入
+🔗 禅道 Bug 链接 ─────── /daily-task hotfix ───→ 🔧 Hotfix Archive MD
+🔥 报错 / 异常 ───────── /daily-task bug ──────→ 📊 后端/前端 Bug HTML 报告
+⚡ git 冲突片段 ───────── /daily-task conflict ──→ 📊 合并冲突 HTML 报告
```

README.md 第 94 行 kata Router 描述：
```diff
-- **kata Router** — 入口路由层；首次使用、无项目或 `/kata init` 会优先路由到 `setup`
+- **using-kata Router** — 入口路由层；首次使用请按仓库根目录 `INSTALL.md` 指引完成安装
```

第 139-142 行及其他 `/kata init` / `/setup` 引用同理修正。

功能对照表（第 265-272 行）：列名替换与前述一致。

- [ ] **Step 3: 更新 README-EN.md（同 README.md 逻辑）**

同样步骤应用于 `README-EN.md`。英文版的 `/xmind-editor` → `/case-format edit`，以此类推。

- [ ] **Step 4: 全仓库最终扫描**

```bash
grep -rn "/bug-report\|/conflict-report\|/hotfix-case-gen\|/xmind-editor\|/kata init\|/setup[^-]" \
  --include="*.md" --include="*.ts" --include="*.json" \
  --exclude-dir=".repos" --exclude-dir="node_modules" --exclude-dir=".temp" --exclude-dir=".git" \
  . 2>/dev/null
```

Expected: 仅返回 `docs/refactor/specs/2026-04-24-*.md`（本 spec 与 plan 自身引用），`memory/` 下可能的历史便签（可不管），以及 `.claude/skills/daily-task/` 和 `.claude/skills/case-format/` 的模式描述（这些是新 skill 里用于自然语言触发词的合法引用，**保留**）。

如果命中其他文件（CI 配置、脚本、文档），逐一评估是否需要改。

- [ ] **Step 5: 提交**

```bash
git add CLAUDE.md README.md README-EN.md
git commit -m "docs: retire legacy slash commands, update references

- CLAUDE.md: 功能索引表改为 5 条新命令（using-kata / test-case-gen / case-format / daily-task / ui-autotest）
- README.md / README-EN.md: 架构图与对照表同步更新
- /kata init 相关说明改为指向 INSTALL.md"
```

---

## Task 7: Phase A 回归 smoke test

**Files:**
- 读取（不修改）: 全仓库 skills 目录结构

- [ ] **Step 1: 目录结构终态验证**

```bash
cd /Users/poco/Projects/kata
ls .claude/skills/ | sort
```

Expected:
```
case-format
daily-task
knowledge-keeper
playwright-cli
test-case-gen
ui-autotest
using-kata
```

（精确 7 个 skill；无 bug-report / conflict-report / hotfix-case-gen / kata / create-project / setup / xmind-editor）

- [ ] **Step 2: test-case-gen workflow 拆分验证**

```bash
ls .claude/skills/test-case-gen/workflow/ | sort
```

Expected:
```
01-init.md
02-probe.md
03-discuss.md
04-transform.md
05-enhance.md
06-analyze.md
07-write.md
08-review.md
09-format-check.md
10-output.md
main.md
```

（无 standardize.md、reverse-sync.md）

- [ ] **Step 3: case-format 集成验证**

```bash
ls .claude/skills/case-format/workflow/ | sort
```

Expected:
```
edit.md
other2md.md
reverse-sync.md
```

- [ ] **Step 4: daily-task 集成验证**

```bash
ls .claude/skills/daily-task/modes/ | sort
```

Expected:
```
bug-report
conflict-report
hotfix-case-gen
```

- [ ] **Step 5: 运行现有单元测试**

```bash
bun test ./.claude/scripts/__tests__ 2>&1 | tail -20
```

Expected: 全部通过（Phase A 未改 CLI 脚本，所有 kata-cli 测试应保持绿）。
若失败，检查是否有脚本 hardcode 了老 skill 路径 → 修正后重跑。

- [ ] **Step 6: 冒烟测试一：用例生成**

若工作区有可跑的 PRD（`workspace/dataAssets/prds/YYYYMM/*.md`），在 Claude Code 中触发：

```
/test-case-gen <prd_path> --quick
```

Expected: 10 节点顺序走完，产出 XMind + Archive MD 与拆分前等价。

若无可跑 PRD，记录为「待用户提供 PRD 后验证」，但不阻塞 Phase A 合并。

- [ ] **Step 7: 冒烟测试二：skill 触发词识别**

在 Claude Code 中输入以下 prompt（不执行、只看主 agent 识别哪个 skill）:

| 输入 | 预期识别的 skill |
|---|---|
| `帮我分析这段 Java 堆栈：Caused by: java.lang.NullPointerException` | `daily-task`（bug 模式） |
| `这段 <<<<<<< HEAD 冲突怎么合？` | `daily-task`（conflict 模式） |
| `禅道链接 https://zentao.example.com/bug-view-12345.html 分析一下` | `daily-task`（hotfix 模式） |
| `修改用例：登录失败场景` | `case-format`（edit 模式） |
| `创建一个新项目 abc` | `using-kata`（create 模式） |

Expected: 5 条全部路由到对应 skill。若有错路由，打开对应 SKILL.md 调整 description 关键词。

- [ ] **Step 8: 最终提交（若 Step 5-7 有修正）**

```bash
git add -u
git commit -m "fix(skills): polish SKILL.md description keywords per smoke test" --allow-empty-message
# 若无修正跳过本步
```

- [ ] **Step 9: 打 tag 标记 Phase A 完成**

```bash
git tag -a phase-a-skills-refactor-done -m "Phase A — skills 架构重组完成"
```

---

## Self-Review

**1. Spec coverage（对照 spec Part 2）：**
- ✅ 2.1 重组前后对比 → Task 2/4/5 实现合并
- ✅ 2.2 新目录结构 → Task 2/3/4/5 分别建立
- ✅ 2.3 节点编号迁移 → Task 3 拆分
- ✅ 2.4 节点文件标准结构 → Task 3 的 Step 3 模板
- ✅ 2.5 main.md 新结构 → Task 3 Step 4 骨架
- ✅ 2.6 触发词策略（不建别名） → Task 6 删除老 slash
- ✅ 2.7 CLAUDE.md 更新 → Task 6 Step 1

**2. Placeholder scan：** 已检查无 TODO / TBD / "similar to ..."；每个 step 有可执行命令或完整代码。

**3. Type consistency：** skill 目录名前后一致（`case-format` / `daily-task` / `using-kata`）；slash 命令对齐（`/daily-task bug` 而非 `/daily-task-bug`）。

**已知开放项**：
- Task 4 Step 6 `references/` 相对路径修正依赖原三个 skill 的具体引用数量，实际执行时按 grep 命中处理。
- Task 6 Step 2 README.md 行号引用以当前版本为准，若在执行前 README 有其他变更，行号需重核。

---

## Execution Handoff

Plan 保存至 `docs/refactor/specs/2026-04-24-phase-a-skills-refactor-plan.md`。

**两种执行方式**：

**1. Subagent-Driven（推荐）** — 每个 task 派一个新的 subagent 执行，主 agent 在 task 之间做两阶段 review。优点：上下文干净、快速迭代、每个 task 独立可回滚。

**2. Inline Execution** — 在当前会话中按 task 顺序执行，带 checkpoint 让用户审阅。

---

## 后续计划

Phase A 落地后，Phase B（discuss 节点改造）和 Phase C（下游门禁 + source_ref）的详细 plan 将基于拆分后的 `workflow/03-discuss.md` 继续细化，预计产出：

- `docs/refactor/specs/2026-04-24-phase-b-discuss-enhancement-plan.md`
- `docs/refactor/specs/2026-04-24-phase-c-downstream-gate-plan.md`

Phase B/C 强耦合，建议打包发布。
