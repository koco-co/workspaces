---
name: xmind-converter
description: 将中间 JSON 格式的测试用例转换为 .xmind 文件。当用户提到「转换为 XMind」「生成 XMind 文件」「输出 XMind」时触发。也被 test-case-generator skill 作为最后一步自动调用。
---

# XMind 转换 Skill

本 Skill 将测试用例的中间 JSON 格式转换为可用 XMind 打开的 `.xmind` 文件。

**在执行任何操作前，必须阅读本文件和 `references/xmind-structure-spec.md`。**

---

## 一、执行流程

```
Step 1: 确认输入 JSON 文件路径
Step 2: 验证 JSON 格式
Step 3: 确定输出路径和文件名
Step 4: 运行转换脚本
Step 5: 验证输出文件
Step 6: 通知用户
```

---

## 二、输入格式要求

接受以下输入形式：
1. **单个 JSON 文件路径** — 直接转换
2. **多个 JSON 文件路径** — 合并后转换（meta 取第一个文件，modules 全部合并）
3. **temp/ 目录路径** — 自动扫描目录下所有 `.json` 文件进行合并转换

JSON 格式必须符合 `references/intermediate-format.md` 中定义的结构。

---

## 三、输出文件规则

### 文件命名
```
YYYYMM-<功能名>.xmind
```
- `YYYYMM` 从 `meta.generated_at` 或当前日期提取
- `功能名` 来自 `meta.requirement_name`，去除特殊字符

示例：`202603-数据质量-质量问题台账.xmind`

### 输出目录

根据 `meta.project_name` 自动判断：

| project_name | 输出目录 |
|---|---|
| 信永中和 | `zentao-cases/XMind/CustomItem/信永中和/` |
| DTStack | `zentao-cases/XMind/dtstack-platform/` |
| 其他 | `zentao-cases/XMind/` |

---

## 四、转换命令

```bash
# 单文件转换
node .claude/scripts/json-to-xmind.mjs <input.json> <output.xmind>

# 多文件合并转换
node .claude/scripts/json-to-xmind.mjs <input1.json> <input2.json> <output.xmind>
```

**注意：** 所有路径必须是绝对路径或相对于工作目录（WorkSpaces/）的路径。

---

## 五、验证步骤

转换完成后，执行以下验证：

```bash
# 验证文件存在且大小合理
ls -la <output.xmind>

# 解压验证 content.json 结构（检查 rootTopic.title 是否正确）
unzip -p <output.xmind> content.json | python3 -m json.tool | head -30
```

验证通过标准：
- 文件大小 > 1KB
- `rootTopic.title` 等于 `meta.project_name`
- 子节点层级正确（Root → L1 → L2 → [L3] → 用例 → 步骤 → 预期）

---

## 六、清理临时文件

转换成功后，如果输入来自 temp/ 目录，删除临时 JSON 文件：

```bash
rm -rf zentao-cases/<项目>/temp/
```

---

## 七、完成通知

转换完成后，向用户输出：

```
XMind 文件已生成：<相对路径>/<文件名>.xmind

文件结构摘要：
- 根节点：<project_name>
- 版本：<version>
- 需求：<requirement_name>
- 模块数：<N> 个
- 总用例数：<M> 条

可使用 XMind 应用打开查看。
```

---

## 参考文件

- `references/xmind-structure-spec.md` — XMind 层级映射规范
