# QA Test Case Workspace

本工作空间用于 QA 测试用例的自动化编写与管理，覆盖 DTStack 平台和信永中和（xyzh）定制项目。

> 不知道从哪开始？输入 `/start` 查看功能菜单。

---

## 快速开始

```bash
# 生成测试用例（完整流程）
生成用例 Story-20260322 PRD-26
为 <Story目录> 写测试用例

# 快速模式（跳过交互）
为 <Story目录> 快速生成测试用例
<Story目录> --quick

# 续传 / 模块重跑
继续 <Story> 的用例生成
重新生成 <Story> 的「列表页」模块用例

# 单独使用各 Skill
帮我增强这个 PRD：<PRD文件路径>
帮我分析这个报错                  # 粘贴日志即可
转化所有历史用例
```

---

## 目录结构

> 路径配置集中管理于 `.claude/config.json`，所有 Skill 和脚本从该文件读取路径。

```
WorkSpaces/
├── cases/                         # 测试用例（核心输出）
│   ├── xmind/                     # XMind 文件（按模块）
│   │   ├── batch-works/           # 离线开发
│   │   ├── data-assets/           # 数据资产
│   │   ├── data-query/            # 统一查询
│   │   ├── variable-center/       # 变量中心
│   │   ├── public-service/        # 公共组件
│   │   └── custom/xyzh/           # 信永中和
│   ├── archive/                   # 归档用例 MD（同模块划分）
│   ├── requirements/              # PRD 需求文档
│   │   ├── xyzh/Story-YYYYMMDD/  # 信永中和
│   │   └── data-assets/           # 数据资产
│   └── history/                   # 历史 CSV
├── repos/                         # 源码仓库（只读）
│   ├── CustomItem/                # 定制项目
│   ├── dt-insight-*/              # DTStack 各层
│   └── dt-insight-qa/             # QA 工具
├── reports/                       # 代码分析报告
│   ├── bugs/{yyyy-MM-dd}/
│   └── conflicts/{yyyy-MM-dd}/
├── assets/images/                 # 图片资源
└── .claude/
    ├── config.json                # 集中路径配置
    ├── agents/                    # 子代理（case-writer / case-reviewer / case-code-analyzer）
    ├── rules/                     # 详细规范（按需加载）
    ├── skills/                    # 项目 Skills
    │   ├── test-case-generator/   # 用例生成（主入口，10 步）
    │   ├── prd-enhancer/          # PRD 增强
    │   ├── xmind-converter/       # JSON → XMind
    │   ├── archive-converter/     # 历史用例转化
    │   ├── code-analysis-report/  # 代码报错分析
    │   └── start/                 # /start 快捷菜单
    └── scripts/                   # Node.js 工具脚本
```

### 模块名称映射

| 中文     | 英文代号        | 类型    |
| -------- | --------------- | ------- |
| 离线开发 | batch-works     | DTStack |
| 数据资产 | data-assets     | DTStack |
| 统一查询 | data-query      | DTStack |
| 变量中心 | variable-center | DTStack |
| 公共组件 | public-service  | DTStack |
| 信永中和 | custom/xyzh     | 定制    |

---

## 源码仓库

> **`repos/` 下所有仓库为只读。** 详细规则见 `.claude/rules/repo-safety.md`。

- git 仓库位于**二级子目录**（如 `repos/dt-insight-plat/DAGScheduleX/`）
- 仅允许：fetch、pull、checkout、log、diff、blame、grep
- 禁止：push、commit、修改文件、reset --hard、rebase

### 报错堆栈 → 仓库定位

| Java 包名                     | 仓库               |
| ----------------------------- | ------------------ |
| `com.dtstack.center.assets`   | dt-center-assets   |
| `com.dtstack.center.metadata` | dt-center-metadata |
| `com.dtstack.dagschedulex`    | DAGScheduleX       |
| `com.dtstack.datasource`      | datasourcex        |
| `com.dtstack.ide`             | dt-center-ide      |
| `com.dtstack.public.service`  | dt-public-service  |
| `com.dtstack.sql.parser`      | SQLParser          |
| `com.dtstack.engine`          | engine-plugins     |

> 完整仓库路径映射见 `.claude/config.json` 的 `repos` 字段。

---

## 工作流概要（10 步）

| #   | 步骤           | 说明                                            |
| --- | -------------- | ----------------------------------------------- |
| 1   | 解析指令       | 提取 Story/PRD 路径、检测断点续传               |
| 2   | PRD 增强       | prd-enhancer：增量 diff + 图片读取 + 健康度预检 |
| 3   | Brainstorming  | 讨论测试范围、高风险场景（`--quick` 跳过）      |
| 4   | Checklist 预览 | 展示测试点清单（`--quick` 跳过）                |
| 5   | 用户确认       | 确认 PRD 摘要 + 拆分方案（`--quick` 跳过）      |
| 6   | 并行 Writer    | case-writer 子代理并行生成用例（结合源码分析）  |
| 7   | Reviewer       | case-reviewer 子代理 3 轮修正 + 源码验证覆盖率  |
| 8   | XMind 输出     | xmind-converter 生成 .xmind（支持 --append）    |
| 9   | 归档同步       | 生成 archive MD + 验证提示                      |
| 10  | 清理           | 用户确认通过，清理临时文件                      |

### 增量 & 断点续传

- PRD 修改后重跑相同指令，仅受影响模块重新生成
- 流程中断后重新发起同指令，自动从断点继续（`.qa-state.json`）
- 强制全量重跑：删除 `-enhanced.md` 和 `.qa-state.json`

### 质量阈值

| 问题率  | 行为               |
| ------- | ------------------ |
| < 15%   | 自动修正           |
| 15%–40% | 修正 + 质量警告    |
| > 40%   | 阻断，等待用户决策 |

---

## 详细规范索引

| 文件                                 | 内容                                     | 触发路径           |
| ------------------------------------ | ---------------------------------------- | ------------------ |
| `.claude/rules/test-case-writing.md` | 用例编写规范（标题、步骤、预期、禁止词） | `cases/**`         |
| `.claude/rules/xmind-output.md`      | XMind 输出格式、命名、层级               | `cases/xmind/**`   |
| `.claude/rules/archive-format.md`    | 归档 MD 模板、层级映射                   | `cases/archive/**` |
| `.claude/rules/directory-naming.md`  | 目录命名约定、模块映射                   | 全局               |
| `.claude/rules/image-conventions.md` | 图片引用、路径、压缩规则                 | `assets/**`        |
| `.claude/rules/repo-safety.md`       | 源码仓库只读规则                         | `repos/**`         |

---

## 工具依赖

```bash
cd .claude/scripts && npm install
```

- `xmind-generator@^1.0.1` — XMind 生成
- `jszip@^3.10.1` — ZIP 读写（--append 模式）
