---
name: test-case-generator
description: QA 测试用例生成主编排 Skill。一键触发完整自动化流程：PRD 增强 → 需求解耦 → 并行生成用例 → 评审 → 输出 XMind。当用户说「生成测试用例」「根据需求文档生成用例」「为 Story-xxx 生成用例」时触发。
---

# 测试用例生成编排 Skill（主入口）

本 Skill 是整个 QA 自动化流程的主编排器，串联所有子步骤。

**执行前必须阅读本文件及所有 references/ 和 prompts/ 文件。**

---

## 完整工作流

```
Step 1: 解析用户指令
Step 2: 调用 brainstorming（确认测试范围）
Step 3: 调用 prd-enhancer（增强所有 PRD）
Step 4: 用户确认增强结果
Step 5: 需求解耦分析
Step 6: 用户确认拆分方案
Step 7: 并行 Writer Subagents
Step 8: Reviewer Subagent
Step 9: 调用 xmind-converter
```

---

## Step 1: 解析用户指令

从用户指令中提取以下信息：

| 信息 | 来源 | 示例 |
|------|------|------|
| Story 目录路径 | 用户指令 | `zentao-cases/customItem-platform/信永中和/Requirement/Story-20260322/` |
| PRD 文件列表 | 扫描 Story 目录 | `PRD-26-xxx.md`, `PRD-27-xxx.md` |
| 项目名称 | 目录路径推断 | `信永中和` / `DTStack` |
| 源码仓库路径 | CLAUDE.md 路径映射表 | 信永中和无源码 |
| 输出 XMind 路径 | CLAUDE.md 输出规范 | `zentao-cases/XMind/CustomItem/信永中和/` |
| 历史用例路径 | 自动查找 | `zentao-cases/customItem-platform/信永中和/v0.x.x/` |

如果用户只说了 Story 编号（如 `Story-20260322`），自动补全完整路径。
如果同一 Story 下有多个 PRD，询问用户要生成哪些 PRD 的用例（默认全部）。

---

## Step 2: 调用 brainstorming

**目的：** 在生成用例前，与用户对齐测试范围和重点，避免遗漏或过度覆盖。

调用方式：
```
使用 brainstorming skill，带入以下信息：
- 需求文档路径：[PRD 文件列表]
- 历史用例路径：[历史用例文件]
- 核心问题：本次测试重点覆盖哪些功能？是否有高风险功能需要额外关注？
```

Brainstorming 结束后，整理出：
- 本次覆盖的功能模块清单
- 优先级最高（P0）的核心路径
- 需要额外关注的风险点（如联动逻辑复杂的字段、权限相关功能）

---

## Step 3: 调用 prd-enhancer

对 Step 1 中识别出的所有 PRD 文件逐个调用 prd-enhancer Skill。

**执行方式：**
```
调用 prd-enhancer Skill，输入文件：[PRD 文件路径]
```

prd-enhancer 执行完毕后，增强版文件位于：
`[原文件名]-enhanced.md`（与原文件同级目录）

如有多个 PRD，串行处理（避免 context 污染）。

---

## Step 4: 用户确认增强结果

向用户展示增强摘要，询问确认：

```
PRD 增强完成！

处理结果：
- [PRD-26-xxx-enhanced.md]：发现 N 张图片，成功读取 M 张
- [PRD-27-xxx-enhanced.md]：发现 N 张图片，成功读取 M 张

关键信息：
- 主要功能页面：[列表页] [新增弹窗] [详情页]...
- 主要按钮：【新增】【编辑】【删除】【导出】【查询】【重置】
- 必填字段：[字段名1] [字段名2]...

请确认以上信息是否完整准确，确认后继续生成测试用例。
如有问题（如某张图片未能正确识别），请告知，我将重新处理。
```

等待用户确认后继续。

---

## Step 5: 需求解耦分析

读取所有增强后的 PRD，按照 `references/decoupling-heuristics.md` 中的规则进行解耦分析。

**分析步骤：**
1. 识别所有独立功能页面（列表页、新增页、详情页、设置页等）
2. 识别 CRUD 操作（增/查/改/删）
3. 判断模块间耦合度
4. 确定 Writer Subagent 数量和各自的负责范围
5. 估算每个 Writer 的用例数量

参考 `references/decoupling-heuristics.md` 中的「拆分输出格式」向用户展示拆分方案。

---

## Step 6: 用户确认拆分方案

等待用户确认拆分方案。

用户可以：
- 确认方案（继续执行）
- 调整 Writer 的任务范围（修改后重新展示）
- 要求合并某些 Writer（减少并行度）

用户确认后继续。

---

## Step 7: 并行 Writer Subagents

**重要：所有 Writer 同时启动（并行执行）。**

为每个解耦模块创建临时目录和启动 Writer：

```bash
mkdir -p zentao-cases/[项目路径]/temp/
```

使用 `prompts/writer-subagent.md` 中的模板，为每个 Writer 填充：
- `[模块名称]` → 对应的功能模块
- `[列举具体功能点]` → 该 Writer 负责的功能点
- `[粘贴 PRD 中相关章节]` → 增强后 PRD 的对应章节
- `[历史用例参考]` → 已覆盖功能点（避免重复）
- `[临时文件路径]` → `zentao-cases/[项目路径]/temp/[模块简称].json`

通过 Agent 工具并行启动所有 Writer。

等待所有 Writer 完成。

---

## Step 8: Reviewer Subagent

所有 Writer 完成后，启动 Reviewer。

使用 `prompts/reviewer-subagent.md` 中的模板，填充：
- 所有 Writer 输出的临时 JSON 文件路径
- 增强后 PRD 文件路径
- 源码仓库路径（如有）
- 最终 JSON 输出路径：`zentao-cases/[项目路径]/temp/final-reviewed.json`

通过 Agent 工具启动 Reviewer。

等待 Reviewer 完成，查看评审报告。

如果 Reviewer 报告中有「待核实」的用例，向用户展示并询问处理方式。

---

## Step 9: 调用 xmind-converter

Reviewer 完成后，调用 xmind-converter Skill：

**输入：** `zentao-cases/[项目路径]/temp/final-reviewed.json`

**输出文件名：**
```
YYYYMM-[requirement_name].xmind
```
从 meta.generated_at 和 meta.requirement_name 生成。

**输出目录：** 根据 CLAUDE.md 中的路径映射规则确定。

xmind-converter 执行完毕后：
1. 验证 .xmind 文件正确性
2. 删除 temp/ 目录下的临时文件
3. 向用户发出完成通知

---

## 完成通知

```
测试用例生成完成！

XMind 文件：zentao-cases/XMind/[路径]/[文件名].xmind

生成摘要：
- 需求：[requirement_name]
- 处理的 PRD：[PRD-26, PRD-27, ...]
- 功能模块：[N] 个
- 总用例数：[M] 条（P0: N / P1: N / P2: N）
- 其中：正常用例 X 条 / 异常用例 Y 条 / 边界用例 Z 条

可使用 XMind 应用打开文件查看用例结构。
```

---

## 参考文件

- `references/decoupling-heuristics.md` — 需求解耦判断规则
- `references/intermediate-format.md` — 中间 JSON 格式 Schema
- `references/xmind-structure-spec.md` — XMind 层级映射规范
- `prompts/writer-subagent.md` — Writer Subagent 提示词模板
- `prompts/reviewer-subagent.md` — Reviewer Subagent 提示词模板

## 关联 Skills

- `prd-enhancer` — PRD 图片读取和文档增强（Step 3）
- `xmind-converter` — JSON 转 XMind（Step 9）
- 全局 `brainstorming` — 测试范围确认（Step 2）
