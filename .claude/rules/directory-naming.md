# 目录命名约定

> 技术层（目录名/文件名/变量名）使用英文，面向用户的文档使用中文。

## 模块名称中英文映射

| 中文名   | 英文代号        | XMind 目录                   | 归档目录                       |
| -------- | --------------- | ---------------------------- | ------------------------------ |
| 离线开发 | batch-works     | cases/xmind/batch-works/     | cases/archive/batch-works/     |
| 数据资产 | data-assets     | cases/xmind/data-assets/     | cases/archive/data-assets/     |
| 统一查询 | data-query      | cases/xmind/data-query/      | cases/archive/data-query/      |
| 变量中心 | variable-center | cases/xmind/variable-center/ | cases/archive/variable-center/ |
| 公共组件 | public-service  | cases/xmind/public-service/  | cases/archive/public-service/  |
| 信永中和 | xyzh (custom)   | cases/xmind/custom/xyzh/     | cases/archive/custom/xyzh/     |

## 顶层目录结构

```
WorkSpaces/
├── CLAUDE.md
├── cases/              # 测试用例（原 zentao-cases/）
│   ├── xmind/          # XMind 输出
│   ├── archive/        # 归档 MD 用例
│   ├── requirements/   # PRD 需求文档
│   └── history/        # 历史 CSV
├── repos/              # 源码仓库只读（原 gitlab-projects/）
├── reports/            # 代码分析报告（原 Code分析报告/）
│   ├── bugs/
│   └── conflicts/
├── assets/
│   └── images/         # 全局图片（原 images/）
└── .claude/
    ├── config.json     # 集中路径配置
    ├── rules/          # 按需加载规范
    ├── skills/         # 项目 Skills
    ├── agents/         # 子代理定义
    └── scripts/        # Node.js 脚本
```

## 文件命名规则

- XMind 文件：`YYYYMM-<功能名>.xmind`（如 `202603-数据质量-质量问题台账.xmind`）
- 归档 MD：与 XMind 同名但 `.md` 后缀
- PRD 文件：`PRD-XX-<功能名>.md`，增强版追加 `-enhanced` 后缀
- 报告文件：`<标题>.html`，按日期目录归档
