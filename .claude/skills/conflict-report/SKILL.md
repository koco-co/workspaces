---
name: conflict-report
description: "合并冲突分析。解析 git 合并冲突代码（含 <<<<<<< HEAD / ======= / >>>>>>> 标记），派发 conflict-agent 判断每处冲突的性质（逻辑 / 格式 / 依赖）并给出可直接执行的合并建议，输出 HTML 冲突报告。触发词：分析冲突、合并冲突、解决冲突、merge conflict、git conflict、<<<<<<< HEAD。"
argument-hint: "[冲突代码片段]"
---

<role>
你是 conflict-report 编排技能，负责把 git 合并冲突代码片段交给 `conflict-agent` 独立分析，并将结果渲染成 HTML 冲突报告。分析逻辑在 Agent 层，本 skill 只负责守卫、分支上下文询问、渲染和通知。
</role>

<inputs>
- 冲突代码片段（必须包含 `<<<<<<< HEAD` / `=======` / `>>>>>>>` 三段标记）
- 可选：冲突涉及的分支信息（HEAD 分支、合入分支）
- `workspace/{{project}}` 输出目录、`config.ts` 配置、报告模板
</inputs>

<pre_guard>
  <hard_required>输入文本必须包含 `<<<<<<<` / `=======` / `>>>>>>>` 三段 git 冲突标记；缺任一段 → 请求用户补齐完整冲突块</hard_required>
  <soft>冲突涉及的分支信息（HEAD / incoming）可选；缺失时在报告中标注"未提供"</soft>
  <invalid_input>输入为空、非冲突格式文本、仅截图无可解析文本 → 立即返回输入无效</invalid_input>
</pre_guard>

<confirmation_policy>
<rule id="status_only">模式识别、分析摘要、报告生成完成仅作状态展示，不要求确认。</rule>
</confirmation_policy>

<output_contract>
<conflict_json>{"summary":"...","conflict_type":"logic|format|dependency","manual_decisions":[],"recommendations":[]}</conflict_json>
</output_contract>

## 执行前准备

参见 [`.claude/references/skill-preamble.md`](../../references/skill-preamble.md)（项目选择、读取配置、符号规则、异常处理通用片段）。

---

## 步骤

### 1. 获取分支信息（可选）

若用户未提供冲突来源分支，询问：

```
请提供冲突涉及的分支信息（可跳过）：
- 当前分支（HEAD）：
- 合入分支：
```

跳过时在报告中标注"未提供"。

### 2. 派发分析 Agent

派发 `conflict-agent`（model: sonnet），传入冲突代码片段和分支信息，由 Agent 独立完成分析并返回 `conflict_json`（结构见 `<output_contract>`）。

### 3. 渲染 HTML 报告

将报告数据写入 `workspace/{{project}}/reports/conflicts/{{YYYYMMDD}}/{{冲突描述}}.html`（模板：`templates/conflict-report.html.hbs`）。

```bash
mkdir -p workspace/{{project}}/reports/conflicts/{{YYYYMMDD}}
```

### 4. 发送通知

```bash
bun run .claude/scripts/plugin-loader.ts notify --event conflict-analyzed --data '{"reportFile":"{{path}}","conflictCount":{{n}},"branches":["{{head}}","{{incoming}}"]}'
```

### 5. 完成摘要（状态展示，无需确认）

```
冲突分析完成

报告：{{report_path}}
冲突块：{{conflict_count}} 处
需人工决策：{{manual_count}} 处
```

---

## 输出目录约定

| 类型         | 目录                                                 |
| ------------ | ---------------------------------------------------- |
| 冲突分析报告 | `workspace/{{project}}/reports/conflicts/YYYYMMDD/`  |
| 临时文件     | `workspace/{{project}}/.temp/`                       |
