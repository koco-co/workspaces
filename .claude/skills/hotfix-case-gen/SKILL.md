---
name: hotfix-case-gen
description: "Hotfix 用例生成。粘贴禅道 Bug 链接即触发，自动抓取 Bug 信息、同步修复分支源码、派发 hotfix-case-agent 生成一条简洁可执行的 Archive Markdown 验证用例。触发词：hotfix、hotfix 用例、线上 bug 验证、分析这个 bug 链接、禅道 Bug、bug-view-。接收输入为形如 {{ZENTAO_BASE_URL}}/zentao/bug-view-{{bug_id}}.html 的禅道链接，也接受裸 Bug ID。"
argument-hint: "[禅道 Bug URL | Bug ID]"
---

<role>
你是 hotfix-case-gen 编排技能，负责把禅道 Bug 链接或 Bug ID 转化为一条可执行的 Hotfix Archive MD 验证用例。职责在编排层结束——分析与用例生成由 `hotfix-case-agent` 完成。
</role>

<inputs>
- 禅道 Bug URL（`{{ZENTAO_BASE_URL}}/zentao/bug-view-{{bug_id}}.html`）或裸 Bug ID
- `workspace/{{project}}` 输出目录、`config.ts` 配置、只读源码副本（按需同步）
- 用户可选补充：`fix_branch`、`repo_name`
</inputs>

<pre_guard>
  <hard_required>输入必须是禅道 Bug URL（含 `bug-view-{{bug_id}}`）或纯数字 Bug ID；否则请求用户提供链接或 ID，禁止进入后续步骤</hard_required>
  <soft>`fix_branch` 缺失时通过 AskUserQuestion 补充；全部缺失时进入路径 B（见 E2）</soft>
  <invalid_input>链接格式损坏 / 无法解析出 Bug ID → 立即返回输入无效，不进入 agent 派发</invalid_input>
</pre_guard>

<confirmation_policy>
<rule id="status_only">模式识别、分析摘要、报告生成完成仅作状态展示，不要求确认。</rule>
<rule id="no_merge">引用源码 / 执行 repo sync 与写回 `.env` / 分支映射是两道独立门禁，不得合并为一次确认。</rule>
<rule id="reference_sync">Hotfix 模式若已给出 fix_branch，可自动 sync 作为 reference，但不自动写回配置；fix_branch 缺失时需先 AskUserQuestion 确认仓库和分支。</rule>
<rule id="writeback">写回 `.env`、repo branch mapping 或其他配置前，必须单独展示变更预览并再次确认。</rule>
</confirmation_policy>

<output_contract>
<hotfix_artifact>Hotfix 场景输出 Archive Markdown，用于后续验证与归档。</hotfix_artifact>
</output_contract>

## 执行前准备

参见 [`.claude/references/skill-preamble.md`](../../references/skill-preamble.md)（项目选择、读取配置、符号规则、异常处理通用片段）。

---

## 步骤

### E1. 抓取禅道 Bug 信息

```bash
bun run plugins/zentao/fetch.ts --bug-id {{bug_id}} --project {{project}} --output workspace/{{project}}/.temp/zentao
```

读取输出 JSON，提取：`bug_id`、`title`、`severity`、`fix_branch`、`status`。

若返回 `partial: true`（API 不可达），则跳过 E2，直接用 URL 中的 Bug ID 继续后续步骤。

### E2. 源码同步（自动优先，必要时才确认）

根据 fix_branch 是否可用，分两种路径：

**路径 A — fix_branch 已获取（自动引用，不自动写回配置）：**

1. 从 fix_branch 名称中推断仓库（匹配 config.repos 中已有的仓库，或根据分支前缀、Bug 所属产品推断）
2. 直接执行同步，不询问用户：

```bash
bun run .claude/scripts/repo-sync.ts --url {{repo_url}} --branch {{fix_branch}}
```

3. 同步完成后输出一行状态信息即可：`源码已同步：{{repo_name}} @ {{fix_branch}}`
4. 若需要把推断出的 repo / branch 持久化到 `.env` 或分支映射，按双门策略的 `writeback` 规则单独确认。

**路径 B — fix_branch 为 null（需要用户确认）：**

通过 AskUserQuestion 工具询问仓库和分支：

确认格式：`确认 [Hotfix 源码同步] 分析 → 目标: [repo_name @ branch] → 来源: [用户提供]`。用户确认后继续。

用户确认后执行同步。若提供了新仓库或分支，仍需先展示写回预览，再单独确认是否持久化到配置。

### E3. AI 分析

派发 `hotfix-case-agent`（model: sonnet），传入禅道 Bug 信息和 git diff，由 Agent 独立完成分析并返回 Archive 格式 Markdown。

### E4. 输出用例文件

> **约束：直接使用 agent 返回的用例内容写入文件，编排层不得追加、拆分或重写用例。** 若 agent 输出质量不足，应调整 agent 提示词，而非在编排层补救。

文件路径：`workspace/{{project}}/issues/{{YYYYMM}}/hotfix_{{version}}_{{bugId}}-{{summary}}.md`

其中：

- `{{YYYYMM}}`：当前年月，如 `202604`
- `{{version}}`：从 fix_branch 提取版本号（如 `6.4.10`），无法提取时省略该段
- `{{bugId}}`：Bug ID
- `{{summary}}`：Bug 标题前 20 字（去除特殊字符）

```bash
mkdir -p workspace/{{project}}/issues/{{YYYYMM}}
```

### E5. 发送通知

```bash
bun run .claude/scripts/plugin-loader.ts notify --event hotfix-case-generated --data '{"bugId":"{{bugId}}","branch":"{{fix_branch}}","file":"{{output_path}}","changedFiles":{{changed_files_json}}}'
```

### E6. 完成摘要（状态展示，无需确认）

```
Hotfix 用例生成完成

Bug：#{{bugId}} {{title}}
修复分支：{{fix_branch}}
用例文件：{{output_path}}
```

---

## 输出目录约定

| 类型        | 目录                                     |
| ----------- | ---------------------------------------- |
| Hotfix 用例 | `workspace/{{project}}/issues/YYYYMM/`   |
| 临时文件    | `workspace/{{project}}/.temp/zentao/`    |
