# WorkSpaces QA 测试用例工作空间

## 项目概述

本工作空间用于 QA 测试用例的自动化编写与管理，覆盖 DTStack 平台和信永中和定制项目。

## 快速开始

发送以下指令触发完整自动化流程（任选其一）：

```
根据需求文档: Story-20260322 中的 PRD-26 生成测试用例
```

```
使用 test-case-generator skill 为 Story-20260322 生成测试用例
```

系统将自动执行：PRD 增强 → 解耦分析 → 并行生成用例 → 评审 → 输出 XMind。

---

## 目录结构

```
WorkSpaces/
├── zentao-cases/                          # 测试用例输出目录
│   ├── XMind/                             # XMind 文件存放
│   │   ├── CustomItem/信永中和/            # 信永中和项目
│   │   ├── dtstack-platform/              # DTStack 平台
│   │   └── DataAssets/ BatchWorks/ ...    # 其他模块
│   ├── customItem-platform/信永中和/       # 信永中和需求文档与历史用例
│   │   ├── Requirement/Story-YYYYMMDD/   # PRD 文档按 Story 归档
│   │   └── v0.x.x/                       # 历史 CSV 用例（已废弃，改用 XMind）
│   └── dtstack-platform/                  # DTStack 历史用例
├── gitlab-projects/                       # 源码仓库（用于验证按钮/文案）
│   ├── dt-insight-front/                  # 前端源码
│   ├── dt-insight-web/                    # Web 层源码
│   └── dt-insight-plat/                   # 后端源码
└── .claude/
    ├── CLAUDE.md                          # 本文件
    ├── skills/                            # 项目级 skills
    │   ├── prd-enhancer/                  # PRD 文档增强
    │   ├── test-case-generator/           # 用例生成编排（主入口）
    │   └── xmind-converter/               # JSON → XMind 转换
    └── scripts/
        ├── package.json                   # Node.js 依赖
        └── json-to-xmind.mjs             # 转换脚本
```

---

## 代码仓库路径映射

| 项目 | 类型 | 路径 |
|------|------|------|
| DTStack 平台 | 前端 | `gitlab-projects/dt-insight-front/dt-insight-studio/` |
| DTStack 平台 | Web 层 | `gitlab-projects/dt-insight-web/` |
| DTStack 平台 | 后端 | `gitlab-projects/dt-insight-plat/` |
| 信永中和 | — | 无源码，仅 PRD |

---

## 完整工作流（9 步）

```
1. 解析用户指令（识别 Story 路径、PRD 列表、输出路径）
2. brainstorming（确认测试范围和重点）
3. prd-enhancer（图片读取 + 文本增强 + 格式标准化）
4. 用户确认增强结果
5. 需求解耦分析（判断哪些模块可并行）
6. 用户确认拆分方案
7. 并行 writer subagents（每个模块独立生成 JSON）
8. reviewer subagent（评审 + 查漏补缺 + 修正）
9. xmind-converter（合并 JSON → 生成 .xmind 文件）
```

---

## Skills 独立使用说明

### prd-enhancer（单独使用）

```
帮我增强这个 PRD：zentao-cases/customItem-platform/信永中和/Requirement/Story-20260322/PRD-26-数据质量-质量问题台账.md
```

### xmind-converter（单独使用）

```
将 zentao-cases/customItem-platform/信永中和/temp/cases.json 转换为 XMind 文件
```

### test-case-generator（主入口，完整流程）

```
根据需求文档: Story-20260322 中的 PRD-26 生成测试用例
```

---

## XMind 输出规范

- 文件命名：`YYYYMM-<功能名>.xmind`（如 `202603-数据质量-质量问题台账.xmind`）
- 输出路径：`zentao-cases/XMind/<项目>/<功能名>/`
- 层级：Root → L1（版本+需求名）→ L2（模块）→ [L3（子分组）] → 用例标题 → 步骤 → 预期

---

## 临时文件管理

- 中间 JSON 临时文件存放路径：`zentao-cases/<项目>/temp/`
- 生成 XMind 后自动删除 temp/ 下的临时文件

---

## 工具依赖

```bash
# 安装脚本依赖（首次使用）
cd .claude/scripts && npm install
```

依赖项：`xmind-generator@^1.0.1`
