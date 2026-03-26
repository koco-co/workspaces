# XMind 输出规范

## 文件命名

同一 Story 下所有 PRD 用例推荐输出到同一文件：

- 单 PRD：`YYYYMM-<功能名>.xmind`（如 `202603-数据质量-质量问题台账.xmind`）
- 整个 Story：`YYYYMM-Story-YYYYMMDD.xmind`（如 `202603-Story-20260322.xmind`）

## 输出路径

参考 `.claude/config.json` 中的 `modules[].xmind` 字段确定输出目录。

| 项目     | 路径                           |
| -------- | ------------------------------ |
| 离线开发 | `cases/xmind/batch-works/`     |
| 数据资产 | `cases/xmind/data-assets/`     |
| 统一查询 | `cases/xmind/data-query/`      |
| 变量中心 | `cases/xmind/variable-center/` |
| 公共组件 | `cases/xmind/public-service/`  |
| 信永中和 | `cases/xmind/custom/xyzh/`     |

## 层级结构

```
Root → L1（版本+需求名）→ L2（模块）→ [L3（子分组）] → 用例标题 → 步骤 → 预期
```

- 追加模式：同一 XMind 文件中，不同 PRD 的用例以各自的 L1 节点区分

## XMind 快捷访问

生成完成后，在根目录创建符号链接：

```bash
ln -sf <实际XMind路径> ./latest-output.xmind
```
