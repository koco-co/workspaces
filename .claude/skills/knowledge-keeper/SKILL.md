---
name: knowledge-keeper
description: "业务知识库读写。记录/查询业务概览、术语、模块知识、踩坑记录。触发词：记一下、沉淀到知识库、更新知识库、查业务规则、这个坑记一下、查术语、查模块知识。"
argument-hint: "[操作] [关键词或内容]"
---

# knowledge-keeper

## 前置加载

### 项目选择

扫描 `workspace/` 目录下的子目录（排除以 `.` 开头的隐藏目录）：

- 仅 1 个项目：自动选择，输出 `当前项目：{{project}}`
- 多项目：列出让用户选择
- 无项目：提示 `/qa-flow init` 初始化

选定的项目记为 `{{project}}`。

### 规则上下文

按 rule-loader 合并加载：

```bash
bun run .claude/scripts/rule-loader.ts load --project {{project}}
```

## 场景 A：查询（只读）

### A1. 查术语

```bash
bun run .claude/scripts/knowledge-keeper.ts read-core --project {{project}}
```

从返回 JSON 的 `terms` 字段中过滤用户关键词并 Markdown 渲染。

### A2. 查模块知识

```bash
bun run .claude/scripts/knowledge-keeper.ts read-module --project {{project}} --module {{name}}
```

渲染 `frontmatter` + `content`。文件不存在时给用户建议（列出已有 modules）。

### A3. 查踩坑

```bash
bun run .claude/scripts/knowledge-keeper.ts read-pitfall --project {{project}} --query {{keyword}}
```

空结果时提示"未找到，建议：补充关键词 / 列出已有 pitfalls / 新增踩坑"。

## 场景 B：写入

### B1. 写入流程（所有 type 通用）

1. **识别触发词 + 解析意图**
   - "记一下 X 是 Y" → type=term，confidence=high
   - "项目的 XX 模块有 YY 规则" → type=module
   - "XX 概览是..." → type=overview
   - "踩坑：ZZ" → type=pitfall

2. **判断置信度**
   - 用户显式"记一下" / 提供完整信息 → high
   - 从源码/PRD 提炼推断 → medium
   - 信息不足 → 走 low 升级流程（见 B3）

3. **构造 content JSON**（按 type）：

   ```json
   // type=term: { "term": "...", "zh": "...", "desc": "...", "alias": "" }
   // type=overview: { "section": "...", "body": "...", "mode": "append"|"replace" }
   // type=module/pitfall: { "name": "kebab-case", "title": "...", "tags": ["..."], "body": "...", "source": "" }
   ```

4. **dry-run 预览**：

   ```bash
   bun run .claude/scripts/knowledge-keeper.ts write \
     --project {{project}} --type {{type}} \
     --content '{{json}}' --confidence {{conf}} --dry-run
   ```

5. **展示 before/after + 置信度分流**：
   - `confidence=high`：跳过 AskUser，直接真实写入
   - `confidence=medium`：AskUserQuestion 确认后带 `--confirmed` 真写

6. **真实写入**：去掉 `--dry-run` 加 `--confirmed`（如为 medium）：

   ```bash
   bun run .claude/scripts/knowledge-keeper.ts write \
     --project {{project}} --type {{type}} \
     --content '{{json}}' --confidence {{conf}} --confirmed
   ```

7. **展示结果摘要**：
   ```
   已写入 knowledge/{{path}}
   _index.md 已自动刷新
   ```

### B2. 覆盖已有 module/pitfall

CLI 默认拒绝覆盖。选择：

- **走 update**（推荐）：使用 `update` 命令精细改 frontmatter / body
- **强制覆盖**：加 `--overwrite` flag（同时需要 `--confirmed`）

### B3. low 置信度升级流程

当主 agent 判断置信度为 low 时（信息不足/推断性结论），使用 AskUserQuestion：

```
该知识条目证据不足（low 置信度），需补充信息升级为 medium 再写入。

推断内容：{{content_summary}}
推断依据：{{source_or_reasoning}}

选项：[补充证据] [直接升级为 medium 并确认] [放弃]
```

用户选择后视为 medium 继续 B1 流程。

### B4. medium 置信度 AskUser 模板

```
检测到新的业务知识条目（置信度：medium）

类型：{{type}}
目标：workspace/{{project}}/knowledge/{{path}}
标题：{{title}}
标签：{{tags}}
证据：{{source}}

【内容预览】
{{body 前 200 字}}...

选项：[确认写入] [调整内容] [更换路径] [跳过]
```

## 场景 C：维护

### C1. 刷新 \_index.md

```bash
bun run .claude/scripts/knowledge-keeper.ts index --project {{project}}
```

通常 write/update 会自动刷新；用户手改或导入后需显式触发。

### C2. 健康检查

```bash
bun run .claude/scripts/knowledge-keeper.ts lint --project {{project}}
```

返回 `errors` + `warnings`。exit 0 = 健康 / exit 1 = 有 error / exit 2 = 仅 warning。

`--strict` 将 warning 升级为 error。

## Subagent 调用守则

- subagent **禁止**直接调 `write` / `update`
- subagent 发现需沉淀知识时，在返回报告中标注：
  `建议沉淀：{{type}} / {{content 摘要}} / 置信度 {{conf}}`
- 主 agent 收到后由本 skill 统一处理写入流程
- subagent 可自由调 `read-core` / `read-module` / `read-pitfall`（只读安全）

## 其他 skill 集成

其他 skill 如需业务背景，在 SKILL.md 顶部新增：

```bash
bun run .claude/scripts/knowledge-keeper.ts read-core --project {{project}}
```

返回的 overview / terms / index 作为业务背景注入后续决策。

**本阶段仅在本 SKILL.md 提供标准调用块**，其他 skill 的集成不做强制修改。
