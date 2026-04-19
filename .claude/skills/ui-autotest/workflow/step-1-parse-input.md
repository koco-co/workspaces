# ui-autotest · step 1 — 解析输入

> 由 SKILL.md 路由后加载。共享的 Task schema、命令别名、项目选择、共享工具库在 SKILL.md 前段定义，本文件不重复。

---

## 步骤 1：解析输入

按 Task Schema 更新：创建 9 个主流程任务，将 `步骤 1` 标记为 `in_progress`。

**1.1 参数提取**

从用户输入中提取：

- `md_path`：Archive MD 文件路径（支持功能名模糊匹配 → 在 `workspace/{{project}}/archive/` 下搜索）
- `url`：目标测试 URL（如 `https://www.bing.com/`）
- `env`：环境标识（如 `ltqcdev`、`ci63`）。优先从用户输入提取；若未指定，读取 `ACTIVE_ENV` 环境变量；若仍为空，从 `url` 的域名推断或向用户询问

若 `md_path` 为功能名而非完整路径，在 `workspace/{{project}}/archive/` 中递归搜索匹配的 `.md` 文件。

若 `url` 未提供，向用户询问：

```
请提供目标测试 URL（如 https://www.bing.com/）：
```

**1.2 解析用例**

```bash
bun run .claude/skills/ui-autotest/scripts/parse-cases.ts --file {{md_path}}
```

解析输出为任务队列 JSON，格式：

```json
{
  "source": "workspace/{{project}}/archive/{{YYYYMM}}/xxx.md",
  "suite_name": "功能名称",
  "tasks": [
    {
      "id": "t1",
      "title": "【P0】验证xxx",
      "priority": "P0",
      "page": "列表页",
      "steps": [{ "step": "进入【xxx】页面", "expected": "页面正常加载" }],
      "preconditions": "前置条件说明"
    }
  ],
  "stats": { "total": 20, "P0": 5, "P1": 10, "P2": 5 }
}
```

其中 `title` 保留 Archive MD 原始 H5 标题（Contract B），`priority` 为从该标题中额外提取出的结构化字段。

---

按 Task Schema 更新：将 `步骤 1` 标记为 `completed`（subject: `步骤 1 — 解析完成，{{total}} 条用例`）。

