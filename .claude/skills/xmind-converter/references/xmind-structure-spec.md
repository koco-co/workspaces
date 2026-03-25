# XMind 层级映射规范

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

## 文件命名规则

```
YYYYMM-<功能名>.xmind
```

示例：`202603-数据质量-质量问题台账.xmind`

## 输出目录规则

```
zentao-cases/XMind/<项目名>/<YYYYMM-功能名>/
```

示例：
- 信永中和：`zentao-cases/XMind/CustomItem/信永中和/`
- DTStack：`zentao-cases/XMind/dtstack-platform/`
