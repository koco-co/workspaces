# XMind 层级映射规范

（与 xmind-converter/references/xmind-structure-spec.md 内容相同，此处为 test-case-generator 的本地副本）

## JSON 中间格式 → XMind 节点映射

### 基本结构（无子分组）

```
Root (meta.project_name)
  └── L1 (【meta.version】meta.requirement_name)
       └── L2 (modules[].name)
            └── 用例标题 (test_cases[].title)
                 [marker = priority, note = precondition]
                 └── 步骤描述 (steps[].step)
                      └── 预期结果 (steps[].expected)
```

### 含子分组结构

```
Root (meta.project_name)
  └── L1 (【meta.version】meta.requirement_name)
       └── L2 (modules[].name)
            └── L3 (sub_groups[].name)
                 └── 用例标题 (test_cases[].title)
                      [marker = priority, note = precondition]
                      └── 步骤描述 (steps[].step)
                           └── 预期结果 (steps[].expected)
```

## Priority 映射规则

| JSON priority | XMind marker | 含义 |
|---------------|--------------|------|
| P0 | `priority-1` | 冒烟测试 |
| P1 | `priority-2` | 核心功能 |
| P2 | `priority-3` | 扩展场景 |

## 前置条件处理

- `test_cases[].precondition` → XMind 节点的 `notes.plain.content`
- 如 precondition 为空字符串或 null，则不设置 note
