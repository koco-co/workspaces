# v3 架构最终审查报告

> 生成日期：2026-04-29
> 审查范围：全项目路径引用、文案润色、工作流程、遗留文件、项目结构、Skill 编排、CLI 设计

---

## 🔴 必须修复

### F1: ui-autotest SKILL.md 引用不存在的 gate 文件

**文件：** `.claude/skills/ui-autotest/SKILL.md`
**问题：** 引用 `gates/R1.md` 和 `gates/R2.md` 作为审查门禁文件，但这两个文件不存在。实际门禁内容内联在 `workflow.md` 的 `#gate-r1` 和 `#gate-r2` 锚点中。subagent 按 SKILL.md 指示会读取不存在的文件而失败。
**修复：** 将 SKILL.md 中的 `gates/R1.md` 引用改为 `workflow.md#gate-r1`。

### F2: ui-autotest workflow.md 重复锚点 ID

**文件：** `.claude/skills/ui-autotest/workflow.md`
**问题：** `<a id="workflow-edit-step-3b">` 出现了两次（第 78 行和第 99 行），指向不同内容。导航和书签解析会混乱。
**修复：** 第二个锚点改为 `workflow-edit-step-3c`。

### F3: .claude/settings.local.json 残留清理 hook

**文件：** `.claude/settings.local.json:40-41`
**问题：** 两个清理 hook 指向已不存在的路径：

- `rm -f /Users/poco/Projects/kata/refactor-v3-*.log ...` — 日志文件已全部删除
- `rm -f /Users/poco/Projects/kata/.claude/scripts/README.md` — `.claude/scripts/` 目录已删除
  **修复：** 删除这两行。

---

## 🟡 建议修复

### S1: bug-reporter-agent 归属冲突

**文件：** `.claude/agents/bug-reporter-agent.md`
**问题：** frontmatter 声明 `owner_skill: daily-task`，但 description 写 "dispatched by ui-autotest skill step 6"。归属矛盾。
**修复：** 统一为 `daily-task`，description 改 "dispatched by daily-task bug-report mode or ui-autotest step 6"。

### S2: backend/frontend-bug-agent 描述用旧 skill 名

**文件：** `.claude/agents/backend-bug-agent.md`、`.claude/agents/frontend-bug-agent.md`
**问题：** description 写 "dispatched by bug-report skill"，但该功能已合并到 `daily-task` 的 bug-report mode 下。
**修复：** 改为 "dispatched by daily-task bug-report mode"。

### S3: xmind-gen.ts v2 路径转换逻辑残留

**文件：** `engine/src/xmind-gen.ts:871`
**问题：** `dirname(mdPath).replace(/archive/, "xmind")` 是 v2 的 archive→xmind 策略。v3 中 archive.md 和 cases.xmind 在同一个 feature 目录下，这个 replace 要么无效要么误触发。
**修复：** 改为直接使用 `dirname(mdPath)` 作为输出目录。

### S4: parse-cases.ts JSDoc 引用旧路径

**文件：** `engine/src/ui-autotest/parse-cases.ts:6-7`
**问题：** JSDoc 示例路径 `workspace/archive/202604/xxx.md` 是 v1 格式。
**修复：** 更新为 `workspace/{{project}}/features/{{ym}}-{{slug}}/archive.md`。

### S5: case-format 和 knowledge-keeper 缺少 references/ 目录

**文件：** `.claude/skills/case-format/`、`.claude/skills/knowledge-keeper/`
**问题：** 这两个 skill 缺少 `references/` 目录。其他 5 个 skill 都有。
**修复：** 创建空的 `references/.gitkeep`，或按需补充参考文档。

### S6: 仅 playwright-cli 声明了 allowed-tools

**文件：** `.claude/skills/*/SKILL.md`
**问题：** 7 个 skill 中只有 1 个声明了 `allowed-tools`。这可能导致 subagent 使用不必要的或禁止的工具。
**修复：** 为每个 skill 添加合理的 `allowed-tools`。

---

## ⚪ 项目基础设施缺失

### I1: CI/CD 缺失

**问题：** 无 `.github/` 目录，无 GitHub Actions 配置。`package.json` 已有完整的 `ci` 脚本，但未被任何 CI 触发。
**建议：** 创建 `.github/workflows/ci.yml`，触发 `bun run ci`。

### I2: 标准开源文件缺失

**缺失文件：** `CONTRIBUTING.md`、`CHANGELOG.md`、`CODE_OF_CONDUCT.md`
**建议：** 补充这三个文件。`CONTRIBUTING.md` 可从 README 的贡献指南提取。

### I3: package.json 元数据缺失

**文件：** `package.json`
**缺失字段：** `author`、`license`、`repository`、`bugs`、`homepage`
**建议：** 添加这些字段以符合 npm/GitHub 最佳实践。

### I4: Issue/PR 模板缺失

**建议：** 创建 `.github/ISSUE_TEMPLATE/` 和 `.github/PULL_REQUEST_TEMPLATE/`。

---

## ⚪ 低优先级

### L1: biome.json 弃用配置

**文件：** `biome.json:32`
**问题：** `experimentalScannerIgnores` 在 Biome v2 已废弃，应改为 `files.ignore`。

### L2: tsconfig.json 过时别名

**文件：** `tsconfig.json:7,13-15`
**问题：** `@e2e/*` 别名指向不存在的 `tests/e2e/` 目录；`include` 引用了不存在的 `tests/` 目录和 `.claude/skills/**/*.ts`（全是 .md 文件）。

### L3: init-wizard.ts 游离文件

**文件：** `engine/src/init-wizard.ts`
**问题：** 定义了自己的 commander 程序但从未被 `cli/index.ts` 加载，CLI 不可达。

### L4: CLI 描述混用中英文和阶段编号

**问题：** `kata-cli --help` 中约 8 个命令用中文描述，其余用英文。部分描述含内部阶段编号（`P3-B`、`P7.5` 等）对用户无意义。

### L5: 依赖项问题

- `@types/nodemailer` 在 `dependencies` 而非 `devDependencies`
- `prettier` 可能未使用（已用 biome）
- `tsx` 可能未使用（bun 原生支持 TS）

### L6: `engine/scripts/` 空目录

**文件：** `engine/scripts/`
**问题：** 完全空目录，未被 git 追踪。删除或加 `.gitkeep`。

---

## ✅ 已通过项

| 检查项                     | 状态                                   |
| -------------------------- | -------------------------------------- |
| README 双语文档完整性      | ✅ 优秀，672/642 行                    |
| 项目目录结构               | ✅ 清晰 monorepo 分离                  |
| .gitignore                 | ✅ 完善，14 个分段                     |
| Skill SKILL.md 完整性      | ✅ 全部有 trigger words + workflow     |
| Agent frontmatter 一致性   | ✅ 全部 16 个 agent 统一格式           |
| 路径引用（v2 路径）        | ✅ 无 `prds/` `xmind/` `archive/` 残留 |
| 重构日志文件               | ✅ 全部清除                            |
| engine 测试                | ✅ 966 pass / 0 fail / 0 errors        |
| engine type-check          | ✅ 0 errors                            |
| CLI 框架（cli-runner.ts）  | ✅ 架构清晰                            |
| 已废弃路径函数（paths.ts） | ✅ 全部标记 @deprecated + runtime warn |
| 工作树                     | ✅ 干净，无未追踪文件                  |
