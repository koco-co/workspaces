# 中间 JSON 格式 Schema

Writer Subagent 输出的 JSON 文件必须严格符合本 Schema。

---

## 完整 Schema

```json
{
  "meta": {
    "project_name": "string  // 项目名称，如「信永中和」「DTStack」",
    "product": "string       // 产品名称，如「数据运营门户」",
    "version": "string       // 版本标识，如「0322版本」「202603版本」",
    "requirement_name": "string  // 需求名称，如「数据质量-质量问题台账」",
    "requirement_id": "string    // 需求ID，如「PRD-26」（可选）",
    "prd_path": "string          // PRD 文件相对路径（可选）",
    "generated_at": "string      // ISO8601 时间戳，如「2026-03-25T10:00:00Z」",
    "agent_id": "string          // Subagent 标识，如「writer-module-list」（可选）"
  },
  "modules": [
    {
      "name": "string  // 模块名称，对应 XMind L2 节点",
      "sub_groups": [  // 可选：子分组（对应 XMind L3 节点）
        {
          "name": "string  // 子分组名称",
          "test_cases": [
            {
              "title": "string       // 必须以「验证」开头",
              "precondition": "string // 前置条件（可为空字符串）",
              "priority": "string    // P0 / P1 / P2",
              "case_type": "string   // 正常用例 / 异常用例 / 边界用例",
              "steps": [
                {
                  "step": "string     // 操作步骤描述",
                  "expected": "string // 与步骤对应的预期结果"
                }
              ]
            }
          ]
        }
      ],
      "test_cases": []  // 可选：无子分组时直接放用例（sub_groups 和 test_cases 二选一）
    }
  ]
}
```

---

## 使用规则

### sub_groups 与 test_cases 的选择

- 模块包含多类操作（搜索/新增/编辑/删除）→ 使用 `sub_groups`
- 模块功能单一或用例数量少（≤5条）→ 直接使用 `test_cases`

示例（有子分组）：
```json
{
  "name": "质量问题台账列表",
  "sub_groups": [
    { "name": "搜索", "test_cases": [...] },
    { "name": "导出", "test_cases": [...] }
  ]
}
```

示例（无子分组）：
```json
{
  "name": "质量问题台账权限验证",
  "test_cases": [...]
}
```

---

## 字段约束

| 字段 | 约束 |
|------|------|
| `meta.project_name` | 必须与 XMind 输出目录对应 |
| `meta.version` | 格式：`YYYYMM版本` 或 `mmdd版本` |
| `test_cases[].title` | 必须以「验证」二字开头 |
| `test_cases[].priority` | 枚举：`P0` / `P1` / `P2` |
| `test_cases[].case_type` | 枚举：`正常用例` / `异常用例` / `边界用例` |
| `steps[].step` 数量 | 必须与 `steps[].expected` 数量相等 |

---

## 临时文件命名规则

Writer Subagent 输出的临时 JSON 文件命名：

```
zentao-cases/<项目名>/temp/<模块简称>.json
```

示例：
- `zentao-cases/customItem-platform/信永中和/temp/list.json`
- `zentao-cases/customItem-platform/信永中和/temp/create.json`
