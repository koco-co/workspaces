# Writer Agent — 结构化阻断协议

> Owner: test-case-gen · 引用方：writer-agent.md

> **在开始编写用例前，必须先执行阻断自检。** 这是独立步骤，不可跳过。

### 阻断前置自检

在编写用例之前，逐条检查以下维度，判断是否有信息缺失会导致用例无法正确编写：

| 维度          | 自检问题                                                               |
| ------------- | ---------------------------------------------------------------------- |
| 导航路径      | 每个页面的完整菜单路径是否已知？（首步必须写「进入【完整路径】页面」） |
| 字段枚举值    | 下拉框、状态筛选等字段的可选值是否明确？（影响逆向用例设计）           |
| 权限角色      | 涉及权限的功能，各角色的操作范围是否清晰？（影响前置条件）             |
| 数据源类型    | 涉及数据表/SQL 的场景，数据源类型是否确定？（影响 SQL 编写）           |
| 按钮/入口名称 | 关键操作按钮的确切名称是否已知？（影响步骤精度）                       |

### 不确定性分类

- **defaultable_unknown**：可通过源码上下文、历史用例或同页一致性高置信度推断；直接继续编写，不输出阻断载荷。
- **blocking_unknown**：导航路径、字段枚举、权限角色、数据源类型、按钮名称等关键事实缺失，且会直接影响用例正确性。
- **invalid_input**：增强 PRD、测试点清单、`writer_id` 或已确认上下文缺失/损坏，无法开始编写。

### blocked_envelope 格式

如遇到 `blocking_unknown` 或 `invalid_input`，只返回结构化 `<blocked_envelope>`：

```xml
<blocked_envelope>
{
  "status": "needs_confirmation",
  "writer_id": "module-a",
  "items": [
    {
      "id": "B1",
      "severity": "blocking_unknown",
      "type": "field_enum",
      "location": "列表页 → 状态筛选",
      "question": "「审批状态」字段的可选值有哪些？",
      "recommended_option": "A",
      "options": [
        { "id": "A", "description": "待审批/审批中/已通过/已驳回", "reason": "历史归档与截图均出现驳回入口" },
        { "id": "B", "description": "待审批/已通过" },
        { "id": "C", "description": "由用户自行输入" }
      ],
      "context": "PRD 第 3 节提到审批流程，但未列出状态枚举值。"
    }
  ],
  "summary": "存在 1 个 blocking_unknown，需主 agent 确认后重跑。"
}
</blocked_envelope>
```

输入无效时：

```xml
<blocked_envelope>
{
  "status": "invalid_input",
  "writer_id": "module-a",
  "items": [
    {
      "id": "B0",
      "severity": "invalid_input",
      "type": "missing_writer_input",
      "location": "writer_id=module-a",
      "question": "测试点清单中缺少该 writer_id 对应模块。",
      "context": "无法定位需要编写的测试点集合。"
    }
  ],
  "summary": "输入无效，需修正后再执行 writer。"
}
</blocked_envelope>
```

**阻断触发条件**：

- 导航路径完全无法推断
- 字段可选值影响逆向用例设计
- 权限角色划分影响用例前置条件
- 数据源类型不明确影响 SQL 编写

**不应阻断的情况**：

- 可从 PRD 上下文合理推断的信息
- 不影响用例核心逻辑的细节（如图标样式、颜色值）
- 已确认信息中已回答的问题

**自检结果**：

- 所有维度均可确定，或仅存在已落地的 `defaultable_unknown` → 直接输出 Contract A JSON
- 每条 test_case 必含 `source_ref` 字段，且值直接继承自对应 test_point.source_ref；若 test_point 未提供 → 按 `blocking_unknown` 阻断，不可自造锚点
- 存在 `blocking_unknown` / `invalid_input` → 仅输出 `<blocked_envelope>`，不输出半成品用例 JSON
