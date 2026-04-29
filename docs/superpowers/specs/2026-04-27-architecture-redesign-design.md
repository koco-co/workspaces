# kata 架构重构设计

> **Status**: Draft · **Date**: 2026-04-27 · **Owner**: kopohub@gmail.com
> **Scope**: 项目整体目录结构 + workspace 内布局 + 信息源边界。不含 `apps/desktop` 内部实现。

## 1. 背景与目标

### 1.1 现状痛点

用户主诉：项目目录"很混乱、不好维护与管理、导致 AI 经常出错"，且对未来"可扩展、可插拔"不友好。

实际扫描确认：
- 信息源 6+ 层（用户全局 rules / 项目 rules / workspace 项目 rules / skill 内置 / `.claude/references/` / project knowledge / pitfalls / memory），优先级靠 prose 描述、AI 长链路（test-case-gen 8 步、ui-autotest 6 步）反复猜，错误累积
- workspace 按"产物形态"切（`prds/`、`xmind/`、`archive/`、`tests/`、`issues/`、`reports/` 等 11 个并列子目录），同一 PRD 的派生物分散在 5-6 处
- `.claude/scripts/` 30+ TypeScript 入口 + 37 个 lib 文件 + 38 个测试，业界先例不支持把这种规模的代码放在 `.claude/` 下
- workflow 文件碎片化：单个 skill 的步骤定义分散在 SKILL.md / workflow/main.md / protocols.md / step-1..N.md / gates/R*.md / references/×N，AI 跳转 6 类文档才能拼出当前步骤
- agent 目录认知错位：`.claude/agents/*.md` 是 sub-agent 提示词模板，README 描述为"15 Agent 架构"，AI 混淆 Skill / Agent / Workflow Step 三层
- 入口耦合：`.claude/scripts/` 既是 kata-cli 子命令又是 skill 调用工具，skill workflow 文件 hardcode `kata-cli xxx` 字符串
- 多 root 边界模糊：`tools/dtstack-cli`、`tools/lanhu`、`lib/playwright/`、`apps/desktop/`、`plugins/` 之间的归属规则只在口头

### 1.2 重构目标（两条主线）

| 主线 | 缩写 | 期望效果 |
|------|------|----------|
| 信息源边界清晰、用物理布局而非 prose 仲裁 | **δ** | AI 在长链路里"该读哪份规则、该写哪里"的模糊决策点降为 0 |
| workspace 按业务对象（PRD）聚合，跨业务对象产物提升到项目级共享区 | **β** | 一个 PRD 的全部产物在一个目录、删 / 重做一个 PRD 一条命令 |

### 1.3 非目标

- ❌ 不抽象出 platform/core/domain/adapter 三层（YAGNI；调研的 11 个生产仓库无此先例）
- ❌ 不为未来桌面端做 engine/adapter 显式分层（自然解决，见 §4.4）
- ❌ 不变成 plugin marketplace 形态（`.claude-plugin/marketplace.json`）— kata 是 app + 内嵌 skill，不是分发型 skill 仓
- ❌ 不动 `apps/desktop/` 内部实现（Tauri 早期试水）
- ❌ 不重切 `tools/dtstack-sdk/`（原 `dtstack-cli`）的内部目录结构（已经合理分了 sdk/cli/core/adapters；本次只做包改名，详见 §3.2）

## 2. 调研依据

调研了 11 个生产级 Claude Code skill / 工具集仓库的目录布局：

| 仓库 | 类型 | 支撑代码位置 |
|------|------|------------|
| anthropics/skills | 官方参考 | 每 skill 内 `scripts/` |
| trailofbits/skills | plugin marketplace | `plugins/{name}/ct_analyzer/`（独立 Python 包） |
| levnikolaevich/claude-code-skills | 多形态混合 | 顶层 `mcp/hex-graph-mcp/`（独立 TS 包，自带 lib/test/scripts/package.json） |
| wshobson/agents | plugin marketplace | 顶层 `tools/`（共享 helpers） |
| Aaronontheweb/dotnet-skills | 单 plugin | 顶层 `scripts/`（仓库维护脚本） |
| santifer/career-ops | app + skill（最像 kata） | 顶层 `*.mjs` + `dashboard/` + 顶层 `data/`/`output/`/`reports/` |
| addyosmani/agent-skills | plugin marketplace | 每 skill 内 `scripts/` |
| Ceeon/videocut-skills | 单 skill | 顶层 `scripts/` |
| davila7/claude-code-templates | 模板分发 | `cli-tool/`（顶层 Node CLI） |

**关键事实**：

1. `.claude/scripts/` 不是任何已发布仓库的约定。`.claude/` 在生产仓库里只装 Claude Code 协议要求的内容（`skills/` / `agents/` / `commands/` / `settings.json` / `.claude-plugin/marketplace.json`）。
2. 非 trivial 量级的支撑代码（多文件、有自己的 toolchain / 测试）的标准做法是：**作为独立 npm/Python 包放在 repo 根**，从 SKILL.md 通过 `${baseDir}/{pkg}/...` 或 `bun run --cwd {pkg}` 调用。
3. 没有任何调研过的仓库做 platform/core+domain+adapter 三层抽象。trailofbits 的 ct_analyzer、levnikolaevich 的 mcp 子包内部都是普通的 `src/lib/tests` 平铺。

来源：本设计 §2 表中所列 11 个 GitHub 仓库的实际文件树（通过 GitHub API 验证）。

## 3. 目标态：项目根目录树

```
kata/
├── README.md / INSTALL.md / LICENSE / CLAUDE.md      ← 项目门面（保持，定期对账）
├── package.json / bun.lock                            ← 单仓 + npm workspaces
├── biome.json / tsconfig.base.json                    ← 全局工具配置
├── playwright.config.ts                               ← 全局 Playwright 配置
├── config.json / .env / .env.envs / *.example         ← 业务配置 + 凭证
│
├── .claude/                                ← Claude Code 协议层（只装协议要求的）
│   ├── skills/                             ←   7 个 skill（位置硬约定）
│   ├── agents/                             ←   14 个 sub-agent prompts（位置硬约定）
│   ├── settings.json / settings.local.json
│   └── (废弃 scripts/ 与 references/，迁出)
│
├── engine/                                 ← 【新】kata 核心引擎（原 .claude/scripts/）
│   ├── package.json                        ←   独立 npm workspace 包
│   ├── tsconfig.json
│   ├── bin/                                ←     CLI entrypoint（kata-cli）
│   ├── src/                                ←     30+ 入口脚本（原 .claude/scripts/*.ts）
│   ├── lib/                                ←     公共库（原 .claude/scripts/lib/，子目录打平）
│   ├── tests/                              ←     单元测试（原 __tests__）
│   └── references/                         ←     通用技术资料（从 .claude/references/ 迁入的非 skill 私有部分）
│
├── plugins/                                ← 三方集成（保持）
│   ├── lanhu/ zentao/ notify/
│
├── tools/                                  ← 独立可发布的工具包
│   └── dtstack-sdk/                        ←   【改名】原 dtstack-cli，主用法是 SDK
│
├── lib/                                    ← 共享 runtime 库（保持位置）
│   └── playwright/                         ←   Playwright helpers / fixtures 共享底座
│
├── templates/                              ← 输出模板（HBS / 项目骨架）
│
├── docs/                                   ← 文档
│   ├── architecture/                       ←   【新】架构文档主入口
│   │   ├── README.md                       ←     索引
│   │   ├── information-architecture.md     ←     δ 主线落地文档
│   │   ├── workspace-layout.md             ←     β 主线落地文档
│   │   └── references/                     ←     从 .claude/references/ 迁入的通用技术资料
│   └── superpowers/{specs,plans,handoffs}/ ←   保持
│
├── apps/                                   ← 入口应用（早期试水，不强求合规）
│   └── desktop/                            ←   Tauri 桌面端
│
├── assets/                                 ← README 引用的图片 / 图表（保持）
│
└── workspace/                              ← 用户产物（按业务对象聚合，详见 §4）
    └── {project}/...
```

### 3.1 顶层 root 归属规则（强制）

| 顶层目录 | 装什么 | 不装什么 |
|---------|--------|---------|
| `.claude/` | 仅 Claude Code 协议要求的：`skills/` `agents/` `settings.json` | 业务代码、CLI 实现、共享库、文档 |
| `engine/` | kata 核心引擎：CLI 入口、领域逻辑、共享库、单元测试 | skill markdown、用户产物、第三方集成、桌面端代码 |
| `plugins/` | 三方系统集成（lanhu / zentao / notify），按 hook 接入主流程 | engine 通用功能 |
| `tools/` | 独立可发布的工具包（可能是 CLI、SDK 或两者皆有），自带 package.json | engine 内部模块 |
| `lib/` | 跨 root 共享的 runtime 库（如 Playwright fixtures） | CLI 入口、领域逻辑 |
| `templates/` | 输出模板（HBS）+ 项目骨架 | 运行时配置 |
| `docs/` | 项目文档（架构、superpowers spec/plan/handoff） | 代码 |
| `apps/` | 终端用户应用入口（桌面端 / Web 等，未来扩展） | engine 实现 |
| `workspace/` | 用户产物（每项目独立） | 框架代码 |

**Lint 规则（CI 强制）**：
- `.claude/` 下不允许出现 `scripts/` 或 `*.ts` 入口
- `engine/` 不允许 import `workspace/`、`plugins/{x}/` 内部
- `apps/desktop/` 不允许直接 import `engine/` 内部源码（应通过 engine 导出的 API）
- `tools/{name}/` 必须自带 `package.json` 且 `name` 字段语义准确（详见 §3.2）

### 3.2 tools/dtstack-cli → dtstack-sdk 改名（命名语义对齐）

**理由**：当前包名 `dtstack-cli` 误导。实际用法分析：

- `package.json` 主入口为 `"main": "src/index.ts"`，`exports` 暴露 SDK 导出（`.` 和 `./adapters/playwright`）
- 内部代码已自然分层：`src/sdk/`（5 个 SDK 函数）+ `src/cli/`（CLI 入口，仅 2 个文件）+ `src/core/`（共享逻辑）
- 真实消费方式：90% 是 Playwright 测试 `import { sdk } from "dtstack-sdk"`，10% 是用户手动跑 `dtstack-cli xxx`
- **SDK 是一等公民，CLI 是辅助形态**

**改名规则**：

| 项 | 旧 | 新 |
|---|---|---|
| 目录名 | `tools/dtstack-cli/` | `tools/dtstack-sdk/` |
| `package.json.name` | `"dtstack-cli"` | `"dtstack-sdk"` |
| `package.json.bin` | `{"dtstack-cli": "src/cli.ts"}` | **不变**（保留 `dtstack-cli` 命令名，npm 包名 ≠ shell 命令名） |
| 根 `package.json.workspaces` | `["tools/dtstack-cli", ...]` | `["tools/dtstack-sdk", ...]` |
| 所有 `from "dtstack-cli"` import | — | `from "dtstack-sdk"` |
| 文档内 `tools/dtstack-cli/docs/usage.md` 引用 | `tools/dtstack-cli/docs/usage.md` | `tools/dtstack-sdk/docs/usage.md`（CLAUDE.md / README 同步改） |
| Shell 命令名（用户敲的命令） | `dtstack-cli` | `dtstack-cli`（**不变**，用户视角无感知） |

**内部布局**（保持现有，不重切）：

```
tools/dtstack-sdk/
├── package.json                    ← name: "dtstack-sdk"，bin.dtstack-cli 保留
├── tsconfig.json
├── src/
│   ├── index.ts                    ← SDK 主导出（一等公民）
│   ├── sdk/                        ← SDK 函数（被 Playwright 测试 import）
│   │   ├── auth.ts
│   │   ├── ensure-project.ts
│   │   ├── exec-sql.ts
│   │   ├── ping-sql.ts
│   │   └── precond-setup.ts
│   ├── cli.ts + cli/               ← CLI 入口（次要，薄封装）
│   ├── core/                       ← 共享逻辑（auth/config/direct/http/platform）
│   ├── adapters/
│   │   └── playwright.ts           ← Playwright 专用 adapter（独立 export）
│   └── help/
├── __tests__/
│   ├── adapters/  cli/  core/  docs/  sdk/  smoke.test.ts
└── docs/usage.md                   ← AI / Skill 读取的 CLI 用法手册

```

**未来扩展位**：如果出现第二个类似形态的包（如 `lanhu-sdk` 取代散在 `plugins/lanhu/` + `tools/lanhu/` 的两份），按相同 `tools/{name}-sdk/` 形态收纳。

### 3.3 文件保留 / 删除 / 归档矩阵 + 散件治理

> 重构开始前必须先做"打扫"，避免在过期文件上做无效工作 + 修复 dangling reference。

**审计现状**：

| 路径 | 状态 | 处理 | 理由 |
|------|------|------|------|
| `docs/refactor/SKILL_REFACTOR_README.md` | ❌ 越权产物 | **删除** | 早期调研 sub-agent 越权创建（明确指令"DO NOT write any new files"被违反），内容已整合到本 spec §10 |
| `docs/refactor/specs/2026-04-27-skill-refactor-spec.md` | ❌ 越权产物 | **删除** | 同上 |
| `docs/refactor/specs/2026-04-27-skill-lint-rules.yaml` | ❌ 越权产物 | **删除** | 同上；lint 规则统一由本 spec §10 定义、由 engine 实现 |
| `docs/refactor/specs/2026-04-24-unified-progress-engine-design.md` | 👻 dangling | 已不存在但被 4 处代码注释引用 | 全部代码注释中的引用更新为 `docs/architecture/progress-engine.md`（重构期间新写） |
| `docs/refactor/specs/2026-04-17-knowledge-architecture-design.md` | 👻 dangling | 已不存在但被 CLAUDE.md 引用 | 同上，更新为 `docs/architecture/information-architecture.md`（§10.9 落地） |
| `docs/refactor/` 整个目录 | 半遗弃 | **删除整个目录** | 历史早期重构 spec 集中地，已被 `docs/superpowers/specs/` 取代；保留只会让"该读哪份 spec"持续混乱 |
| `docs/superpowers/plans/2026-04-26-desktop-shell-spec1-plan.md` | ✅ 在用 | 保留 | 桌面端 Spec 1 的 plan，未完成 |
| `docs/superpowers/plans/2026-04-27-desktop-e2e-test-plan.md` | ✅ 在用 | 保留 | 桌面端 e2e plan |
| `docs/superpowers/plans/2026-04-27-md-cases-rework.md` | ✅ 在用 | 保留 | 当前 stage 3 工作 |
| `docs/superpowers/specs/*.md`（4 个） | ✅ 在用 | 保留 | 含本 spec |
| `docs/superpowers/handoffs/*.md`（2 个） | ✅ 在用 | 保留（90 天后归档） | handoff 文档生命周期短，加 retention 策略 |
| `t15-debug.spec.ts`（仓库根） | ❌ 临时调试残留 | **删除** | 2026-04-27 22:53 临时调试，未清理；加 §10.11 T5 lint 兜底 |
| `cleanup-duplicates.sh`（仓库根） | ❌ 一次性脚本 | **删除** | 2026-04-15 一次性清理脚本，已完成使命 |
| `.DS_Store`（散落多处） | ❌ macOS 系统文件 | **gitignore + 全删** | 不应入库，增加 git 全局 ignore + 仓库级 .gitignore |
| `assets/diagrams/architecture.png/svg/drawio` | ⚠ 失效 | 重画（§10.10 R4） | 反映旧架构 |
| `assets/diagrams/plugin-system.{png,svg,drawio}` | ⚠ 失效 | 重画 | 同上 |
| `assets/diagrams/test-case-gen.{png,svg,drawio}` | ⚠ 部分失效 | 重画（features/ 路径反映） | 流水线节点编号会变 |
| `assets/diagrams/ui-autotest.{png,svg,drawio}` | ⚠ 部分失效 | 重画 | subagent 拆分后流程变 |
| `.kata/_desktop/...` | ⚠ 孤儿 | 评估后处理 | 仅桌面端 spec 1 用；β 后业务项目进度迁到 `features/{slug}/.state/{workflow}.json`，此目录是否保留留给桌面端自己决定 |
| `.auth/dataAssets/` `.auth/session.json` | ✅ 运行时缓存 | **保留位置 + gitignore** | 登录态 cookie 缓存，本就 gitignore；保留位置不变 |
| `test-results/`（仓库根） | ⚠ 多 project 撞名 | **迁移**（详见 §3.4） | Playwright 默认在仓库根、kata 是多 project 仓库会撞；改为 `workspace/{project}/.runs/test-results/` |
| `allure-results/` `allure-report/`（如有） | 同上 | 同上 | 改为 `workspace/{project}/.runs/allure-{results,report}/` |
| `node_modules/` | ✅ | gitignore | — |
| `.claude/scheduled_tasks.lock` | ⚠ | 评估 | scheduled-tasks MCP 的 lock 文件，是否应在 gitignore 待评估 |

**Lint 规则**：

| # | 规则 | 检测 |
|---|------|------|
| F1 | 仓库根禁止出现 `t*-debug.spec.ts` / `*.repro.ts` 模式 | gitignore + CI grep |
| F2 | 任何代码注释 / 文档引用 `docs/refactor/...` 都视为 dangling reference，必须改写 | grep |
| F3 | 一次性脚本（`*-once.sh` / `cleanup-*.sh` / `migrate-*.sh`）执行后必须删除或移到 `engine/scripts/maintenance/` 归档 | 命名扫描 |
| F4 | `.DS_Store` 严禁入库；CI 全仓扫描 | git ls-files |
| F5 | 任何 spec / plan / handoff 文档必须在 frontmatter 标明 `Status: Active / Archived / Deprecated`；archived 90 天后可清理 | YAML 解析 |

### 3.4 测试运行时产物归位（test-results / allure 等）

**问题**：Playwright / Allure / monocart-reporter 默认把 `test-results/` `allure-results/` `allure-report/` 输出到 **playwright.config.ts 所在目录**（即仓库根）。kata 是多 project 仓库，导致：

- `workspace/dataAssets/` 跑出来的失败截图 / trace 和 `workspace/xyzh/` 撞同一个 `test-results/` 目录
- 实测当前 `test-results/` 中 3 个失败 case 全是 dataAssets 项目——撞名风险已具备
- 报告也撞：跑完 dataAssets 的 allure-report 立刻被 xyzh 的覆盖

**目标态**：

```
workspace/{project}/
└── .runs/                           ← 【新】运行时产物归位（gitignore）
    ├── test-results/                ←   Playwright failures + trace + screenshots
    ├── allure-results/              ←   Allure raw 数据
    ├── allure-report/               ←   Allure HTML
    ├── monocart-report/             ←   monocart 报告
    └── playwright-report/           ←   Playwright HTML
```

**实施**：
- 根 `playwright.config.ts` 通过环境变量 `KATA_ACTIVE_PROJECT` 解析 outputDir：`outputDir: process.env.KATA_ACTIVE_PROJECT ? \`workspace/\${KATA_ACTIVE_PROJECT}/.runs/test-results\` : 'test-results'`（兼容期）
- 重构后强制 `KATA_ACTIVE_PROJECT` 必须设置（在 `kata-cli` 子命令派发时由 engine 自动 export）
- `.gitignore` 加 `workspace/*/.runs/`
- 仓库根 `test-results/` `allure-results/` 等迁移完成后删除

**Lint 规则**：

| # | 规则 | 检测 |
|---|------|------|
| F6 | 仓库根禁止出现 `test-results/` `allure-results/` `playwright-report/` 等运行时产物目录（兼容期外） | git status + path 扫描 |
| F7 | `playwright.config.ts` 必须使用 `KATA_ACTIVE_PROJECT` 解析 outputDir，不允许 hardcode `test-results` | regex 扫描 |
| F8 | engine 派发任何 Playwright 任务前必须 export `KATA_ACTIVE_PROJECT`，否则拒绝执行 | engine 自查 |

### 3.5 engine/ 内部组织（防止平铺退化）

**现状**：`.claude/scripts/lib/` 30+ 文件直接在 lib/ 下平铺 + 5 个稀疏子目录（cost/db/orchestrator/subagent/workflow，每个 1-4 文件——空抽屉）。打平 + 重排时如果不规划好，迁完后又是 30+ 文件平铺。

**目标态**：

```
engine/
├── package.json
├── tsconfig.json
├── bin/
│   └── kata-cli                ← shim 调用 src/cli/index.ts
├── src/
│   ├── cli/                    ← CLI 入口层（按领域分组）
│   │   ├── index.ts            ←   主 program 注册
│   │   ├── case/               ←   kata-cli case ...（generate/standardize/sync）
│   │   ├── feature/            ←   kata-cli feature ...（init/list/state）
│   │   ├── bug/                ←   kata-cli bug ...（report/conflict/hotfix）
│   │   ├── knowledge/          ←   kata-cli knowledge ...（read/write/search）
│   │   ├── progress/           ←   kata-cli progress ...
│   │   ├── repo/               ←   kata-cli repo ...（profile/sync）
│   │   └── platform/           ←   kata-cli platform ...（config/init-wizard/stats）
│   ├── domain/                 ← 领域逻辑（无 IO 假设）
│   │   ├── case/               ←   archive / xmind 双契约、generate / standardize / sync
│   │   ├── source/             ←   源码扫描、引用解析
│   │   ├── knowledge/          ←   知识库读写、guard
│   │   ├── progress/           ←   进度引擎
│   │   ├── bug/                ←   bug / conflict / hotfix 分析
│   │   └── workflow/           ←   workflow model / step / gate
│   ├── lib/                    ← 横切共享库
│   │   ├── path/               ←   path 函数（§4.3 唯一来源）
│   │   ├── env/                ←   env 解析、schema
│   │   ├── fs/                 ←   文件系统辅助
│   │   ├── http/               ←   HTTP client（plugins 复用）
│   │   ├── logger/             ←   logger（统一日志层）
│   │   ├── prompt/             ←   prompt preamble 注入、@reference 解析（§10.6）
│   │   └── unicode/            ←   unicode 符号转换
│   ├── adapter/                ← 外部依赖适配
│   │   ├── playwright/         ←   Playwright 自动化派发
│   │   └── claude-code/        ←   Skill / Sub-agent 派发协议
│   ├── hooks/                  ← Claude Code hooks（§10.8 落地）
│   │   ├── pre-bash/
│   │   ├── pre-edit/
│   │   ├── post-edit/
│   │   ├── session-start/
│   │   └── stop/
│   ├── references/             ← engine 内部参考文档（被 prompt @reference 引用）
│   ├── api.ts                  ← 【关键】engine public API（桌面端 / 其他 frontend 接入点，详见 §3.6）
│   └── index.ts                ← package main，仅 re-export api.ts
├── tests/                      ← 单元测试（按 src/ 镜像组织）
└── references/                 ← 通用技术资料（迁自 .claude/references/）
```

**强制规则**：

| # | 规则 | 检测 |
|---|------|------|
| EI1 | `engine/src/{cli,domain,lib,adapter,hooks}/` 是固定 5 顶层目录，不得新增 | path 校验 |
| EI2 | 依赖箭头：`cli → domain → lib`，`adapter → lib`，`hooks → lib`；不允许反向（如 lib import domain）| madge / depcruise |
| EI3 | 单子目录文件数 ≥ 8 时强制再分子目录（防回到平铺） | 计数 |
| EI4 | 单文件 ≤ 400 行（lib/）/ ≤ 800 行（domain/）；超过强制拆 | wc -l |
| EI5 | 任何顶层 src/*.ts 入口都禁止（必须放在某个 src/{topic}/ 下） | path 校验 |

### 3.6 engine public API（桌面端 / 其他 frontend 接入契约）

**问题**：spec §4.4 说"未来桌面端可 spawn 或 import"，但没定义 import 时的接入点。等真做时如果发现 engine 没暴露稳定 API，会被迫深入 `engine/src/` 内部，破坏封装。

**目标态**：

```ts
// engine/src/api.ts — 唯一公开 API surface
export {
  // Feature 管理
  listFeatures, getFeature, createFeature, deleteFeature,
  // 用例
  generateCases, standardizeCases, syncCases,
  // Bug / Hotfix
  analyzeBug, analyzeConflict, generateHotfixCase,
  // 知识
  readKnowledge, writeKnowledge, searchKnowledge,
  // 进度
  getProgress, updateProgress,
  // 元数据
  listProjects, getStats,
  // 类型
  type Feature, type CaseDoc, type Project, type ProgressState,
} from "./domain/...";
```

**契约**：

| # | 规则 |
|---|------|
| AP1 | `engine/src/api.ts` 是 engine 的唯一对外 API surface；外部包只能从 `kata-engine` 顶层 import，禁止 `from "kata-engine/src/domain/..."` 深入路径 |
| AP2 | api.ts 中函数必须保持向后兼容（添加可、删除/改签必须 major bump） |
| AP3 | api.ts 函数禁止 IO 副作用未声明：返回值要么是纯数据，要么明确文档化"会写文件"|
| AP4 | 所有 CLI 子命令的实现必须先调用 api.ts 的函数（CLI 是 thin adapter）|
| AP5 | api.ts 行数 ≤ 200（仅 re-export + 极少 facade 函数）；具体实现仍在 domain/ |

## 4. 目标态：workspace 内布局（β 主线）

### 4.1 设计原则

- **PRD-centric**：90% 的工作流是"为这个 PRD 出用例 → 跑自动化 → 跟 bug → 沉淀 pitfall"，物理布局贴合工作流
- **本就不属于任何 PRD 的产物**（线上 bug 粘贴、周期回归、跨 feature 知识）有兄弟目录承接，不强塞进 features/
- **共享物**（helpers、fixtures、page objects）提升到项目级 `shared/`

### 4.2 目录树

```
workspace/{project}/
├── README.md                                ← 项目业务说明（业务视角）
├── project.json                             ← 项目元数据 + 仓库映射 + 插件开关
│                                              （取代 config.json 内 projects.{name} 节）
│
├── features/                                ← 【核心】PRD 派生产物聚合
│   └── {yyyymm}-{slug}/                     ←   一个 PRD = 一个目录
│       ├── prd.md                           ←     原 PRD（取代 prds/{ym}/{slug}/original.md）
│       ├── enhanced.md                      ←     处理后 PRD
│       ├── source-facts.json                ←     源码引用扫描结果
│       ├── images/                          ←     PRD 关联图片
│       ├── archive.md                       ←     用例 Markdown（取代 archive/{ym}/{slug}.md）
│       ├── cases.xmind                      ←     XMind 用例（取代 xmind/{ym}/{slug}.xmind）
│       ├── tests/                           ←     该 PRD 的 Playwright 脚本
│       ├── issues/                          ←     该 PRD 衍生的 hotfix（取代 issues/{ym}/）
│       ├── reports/                         ←     该 PRD 的 bug / conflict 报告
│       ├── knowledge.md                     ←     该 PRD 局部知识 / pitfalls
│       └── .state/                          ←     进度状态目录（取代 .kata/{project}/sessions/）
│           └── {workflow}.json              ←       按 workflow 分文件，支持多 workflow 并行
│
├── incidents/                               ← 非 PRD 派生：粘贴报错 / 线上 bug
│   └── {yyyymmdd}-{slug}/
│       └── report.html
│
├── regressions/                             ← 周期性回归 / 冒烟（cron 触发或手动批次）
│   └── {yyyymmdd}-{batch-name}/
│
├── knowledge/                               ← 项目级知识（跨 feature）
│   ├── overview.md                          ←   业务概览
│   ├── glossary.md                          ←   术语
│   ├── modules/                             ←   模块知识
│   └── pitfalls/                            ←   项目级踩坑（PRD 局部 pitfall 留在 feature 内）
│
├── shared/                                  ← 跨 feature 复用
│   ├── helpers/                             ←   Playwright helpers（原 helpers/）
│   ├── fixtures/                            ←   测试数据（原 fixtures/）
│   └── pages/                               ←   page objects（如有）
│
├── rules/                                   ← 项目级硬约束（保持）
│
├── archive-history/                         ← 一次性导入的旧 xmind / csv（不参与日常工作流）
│
└── .repos/                                  ← 只读源码副本（保持）
```

### 4.3 路径函数契约（engine/lib/paths.ts 提供，强制使用）

```ts
featureDir(project, yyyymm, slug)         // workspace/{p}/features/{ym}-{slug}/
featureFile(project, yyyymm, slug, name)  // featureDir(...)/{name}
incidentDir(project, yyyymmdd, slug)
regressionDir(project, yyyymmdd, batch)
projectKnowledge(project, ...segments)
projectShared(project, kind, ...segments) // kind ∈ {helpers,fixtures,pages}
projectRules(project)
```

旧路径函数（`prdDir` / `archiveDir` / `xmindDir` / `issuesDir` / `reportsDir` / `testsDir` / `kataDir`）保留为兼容期 alias，内部转发到新路径。

### 4.4 桌面端兼容性

`engine/` 是独立 npm workspace 包，未来桌面端要做时：

- **方式 A（spawn 子进程）**：直接 `spawn('kata-cli', ['features', 'list', ...])`，不动 engine 一行代码
- **方式 B（import 包）**：`import { listFeatures } from 'kata-engine'`，复用 engine 的纯函数能力

**今天不为桌面端做任何额外抽象**。`engine/` 作为独立包本身就是接入点。

### 4.5 features/{slug}/tests/ 子目录规范（防飘移）

**问题背景**：

当前抽查 3 个 PRD 测试目录（`workspace/dataAssets/tests/202604/...`）暴露 6 类问题：

1. case 文件命名 `t1.ts ~ t45.ts` 纯编号、零业务含义
2. 单 PRD 51 文件全平铺，case 数 ≥ 15 时不分组
3. helpers 单文件 80KB / 72KB / 58KB（远超 800 行硬上限）
4. fixtures / 静态数据混在 case 目录
5. spec runner（`*.spec.ts`）和 case（`tN.ts`）混在一起
6. 单元测试 `*.test.ts` 与 e2e specs 混在 e2e 目录、调试遗物（`*-repro.spec.ts` / `diag_*.spec.ts`）散件

**目标态布局**：

```
features/{ym}-{slug}/tests/
├── README.md                     ← 套件总览：用例编号 → 业务场景映射、运行方法、helpers 索引
│
├── runners/                      ← Playwright runner 装配（注册 test() 入口，仅 import cases/）
│   ├── full.spec.ts              ←   全量
│   ├── smoke.spec.ts             ←   冒烟（核心 P0）
│   └── retry-failed.spec.ts      ←   失败重跑
│
├── cases/                        ← 用例脚本本体
│   ├── README.md                 ←   编号 → 业务场景映射表（强制存在）
│   ├── t01-{slug}.ts             ←   case 数 < 15 时直接平铺
│   └── {module}/                 ←   case 数 ≥ 15 时按 PRD 模块分组
│       ├── t01-{slug}.ts
│       └── t02-{slug}.ts
│
├── helpers/                      ← PRD 私有 helper（按职责拆，单文件 ≤ 800 行）
│   ├── README.md                 ←   helper 职责索引
│   ├── {domain-1}.ts             ←   单职责，超 800 行强制拆
│   └── {domain-2}/               ←   超 800 行时按子职责拆为目录
│       ├── create.ts
│       ├── edit.ts
│       └── validate.ts
│
├── data/                         ← 测试数据 / fixtures
│   ├── README.md                 ←   数据来源、生成方式、依赖关系
│   ├── seed.sql                  ←   前置 SQL（如有）
│   ├── *.ts                      ←   静态数据（禁止 `_v1` / `_v2` / `-{number}` 变体名）
│   └── storage-state.json        ←   登录态（如有）
│
├── unit/                         ← helpers 的单元测试（可选）
│   └── *.test.ts                 ←   命名 `*.test.ts`，与 e2e `*.spec.ts` 严格区分
│
└── .debug/                       ← 调试遗物（gitignore，CI 不跑）
    └── *-repro.spec.ts           ←   一次性诊断 / 复现脚本
```

**强制规则（CI lint，违反则报错）**：

| # | 规则 | 检测方式 |
|---|------|---------|
| L1 | `cases/*.ts` 文件名匹配 `^t\d{2}-[a-z0-9-]+\.ts$` | regex 扫描；`t1.ts` / `t27.ts` 这种纯编号一律拒绝 |
| L2 | `cases/` 下文件数 ≥ 15 时必须有 ≥ 2 个模块子目录 | 计数校验 |
| L3 | `cases/README.md` 必须存在且包含全部 `t{nn}` 编号到业务场景的映射表 | grep 编号 vs 文件清单 |
| L4 | `helpers/*.ts` 单文件 ≤ 800 行（kata 全局约束） | `wc -l` 校验 |
| L5 | `runners/` 下只允许 `*.spec.ts`，`cases/` 下只允许 `t{nn}-*.ts` | 文件名规则 |
| L6 | `unit/` 下只允许 `*.test.ts`，`runners/` 下只允许 `*.spec.ts` — 防止单元测试和 e2e 混淆 | 后缀校验 |
| L7 | `data/` 下文件名禁止匹配 `.*[-_]v\d+\..*` 或 `.*-\d+\.ts$`（变体副本）；鼓励 git 历史 | regex 拒绝 |
| L8 | `.debug/` 必须在 `.gitignore` 中 | gitignore 检查 |

**case 命名约定**：

- `t{两位编号}-{kebab-slug}.ts`，例：`t01-create-rule.ts` / `t27-edit-data-source-with-spark-thrift.ts`
- 编号在该 feature 内全局唯一、按创建时间分配、删除后不复用
- slug 是用例标题的 kebab-case 缩写，必须能从 `cases/README.md` 索引回完整业务场景

**helpers 拆分阈值**：

- ≤ 400 行：理想态
- 400-800 行：可接受，建议拆
- ≥ 800 行：CI 报错，强制拆为子目录（`{domain}/{sub}.ts`）

**与 shared/ 的边界**：

- `features/{slug}/tests/helpers/` — 该 PRD 私有 helper（与该 PRD 业务紧耦合）
- `workspace/{p}/shared/helpers/` — 跨 ≥ 2 个 PRD 复用的 helper（首次跨用时由该写第二个 PRD 的人主动提升）

## 5. 目标态：信息源 3 层（δ 主线）

### 5.1 三层定义

| 层 | 物理位置 | 语义 | 谁读写 | 颗粒度 |
|---|---|---|---|---|
| **memory** | `~/.claude/projects/.../memory/` | AI 协作偏好 + 跨会话状态 | Claude Code 自动 | 用户级 |
| **rules** | (a) 全局 `rules/`<br/>(b) 项目 `workspace/{p}/rules/`<br/>(c) feature 内 `features/{slug}/rules.md`（可选）<br/>(d) skill 私有 `.claude/skills/{name}/rules.md` | **硬约束**（机器可校验：格式、必须项、禁止项） | 用户写、skill / engine 读 | 三档作用域：全局 / 项目 / feature |
| **knowledge** | (a) 全局 `docs/architecture/` + `engine/references/`<br/>(b) 项目 `workspace/{p}/knowledge/`<br/>(c) feature 内 `features/{slug}/knowledge.md` | **业务事实**（流程 / 术语 / 模块知识 / 踩坑） | knowledge-keeper skill 统一读写 | 全局 / 项目 / feature |

### 5.2 优先级（lint 强制）

```
用户当前指令 (memory)
  > feature rules
  > project rules
  > 全局 rules
  > skill 私有 rules

knowledge 不参与硬约束优先级（事实 ≠ 约束）
但所有 skill / engine 必须先读 knowledge 再做决策
```

### 5.3 废弃 / 重新归位

| 旧位置 | 新位置 | 原因 |
|--------|--------|------|
| `.claude/references/` | 拆分：通用技术资料 → `docs/architecture/references/`；engine 内部参考 → `engine/references/`；skill 私有 → `.claude/skills/{name}/references/` | references 不是规则也不是知识，是"技术参考"，按归属拆分到对应位置 |
| skill 内零散 rules（散在 SKILL.md / workflow/*.md） | `.claude/skills/{name}/rules.md`（每 skill 一份） | 集中、可机器校验 |
| `workspace/{p}/knowledge/pitfalls/{name}/` 子目录 | `workspace/{p}/knowledge/pitfalls/{name}.md` 扁平化 | 同等颗粒度强制单层 |
| `.kata/{project}/sessions/{workflow}/{slug}.json` | `workspace/{p}/features/{slug}/.state/{workflow}.json` | 进度归属于 feature 本身；按 workflow 分文件支持同 feature 多 workflow 并行（test-case-gen 和 ui-autotest 可同时进行） |

### 5.4 Skill 内部文件锁定（4 文件契约）

每个 skill 内部强制只允许 4 类文件：

```
.claude/skills/{name}/
├── SKILL.md              ← 入口（触发词 + 工作流概览，<100 行）
├── workflow.md           ← 工作流（合并 main+step+gate+protocols，长文档但单文件）
├── rules.md              ← skill 私有硬约束
└── references/           ← skill 私有参考（可选）
    └── *.md
```

废弃：`workflow/` 子目录、`gates/` 子目录、`workflow/step-N.md` 多文件拆分、`protocols.md` 单独存在。AI 只读 1-3 份文档就能定位到当前步骤要做什么。

### 5.5 Sub-agent prompts 归属（物理 vs 语义分离）

`.claude/agents/*.md` 物理位置由 Claude Code 协议硬约定，无法移动。但语义归属按以下规则明确：

- 每个 sub-agent prompt 在 frontmatter 中**必须**声明 `owner_skill: <skill-name>`
- engine 内置 `kata-cli skill audit` 命令：扫描所有 `.claude/agents/*.md`，按 owner_skill 分组列出，并校验每个 prompt 引用的 reference 路径必须在自己 owner_skill 的 `references/` 内
- README / CLAUDE.md 不再用"15 Agent 架构"这种平铺叙述，改为"7 个 skill，每个 skill 含 1-N 个 sub-agent prompt"

## 6. 迁移路径

### 6.1 阶段切分（每阶段一次原子提交，可独立验证）

| 阶段 | 内容 | 风险 | 验证 |
|------|------|------|------|
| **P0** | 写本 spec + 设计 lint 规则 + 评审通过 + 写 P1-P11 的 plan | 0 | spec doc 通过 review |
| **P0.5** | 散件清理（详见 §3.3）：删 `docs/refactor/` 整个目录、删根目录 `t15-debug.spec.ts` `cleanup-duplicates.sh`、扫除 `.DS_Store`、修复 5 处 dangling reference（progress.* + CLAUDE.md）；运行时产物迁移（详见 §3.4）：根 `test-results/` 迁到 `workspace/dataAssets/.runs/`，`playwright.config.ts` 读取 `KATA_ACTIVE_PROJECT` | 低 | grep `docs/refactor/` 命中 0；根目录 `test-results/` 不存在；F1-F8 lint 全绿 |
| **P1** | `.claude/scripts/` → `engine/`，建立独立 npm workspace 包（根 `package.json` 的 `workspaces` 加入 `"engine"`）；engine 自带 `package.json` + `tsconfig.json` + `bin/kata-cli`；导入路径全量改写；`bun test` 全绿 | 中 | 116 个 ts + 38 个测试全绿；现有 kata-cli 子命令全部可用；`bun link` 可用 |
| **P2** | `.claude/references/` 拆分：通用 → `docs/architecture/references/`；engine 内部 → `engine/references/`；skill 私有 → `.claude/skills/{name}/references/` | 低 | 文档链接全部可达 |
| **P3** | workspace 物理重排：写迁移脚本聚合到 `features/{ym}-{slug}/`；提供回滚脚本；先在 dataAssets 上 dry-run | **高** | dataAssets 项目跑通一次完整 test-case-gen → ui-autotest 流程 |
| **P3.5** | `features/{slug}/tests/` 内部按 §4.5 子目录规范重排（runners/cases/helpers/data/unit/.debug）；现有 `tN.ts` 重命名为 `t{nn}-{slug}.ts`；helpers 巨型文件拆分；fixtures / spec runners 归位；写 `cases/README.md` 编号映射表；引入 §4.5 L1-L8 lint | **高** | 抽样 dataAssets 的 `【通用配置】json格式配置`（51 文件 P0 case）和 `有效性-取值范围枚举范围规则`（41 文件 + 80KB helpers）跑通；lint 全绿 |
| **P4** | skill workflow 文件合并：每 skill 锁 4 文件（SKILL/workflow/rules/references/）；废弃 workflow/ gates/ 子目录 | 中 | 文档 lint 通过；7 个 skill 至少各跑一次冒烟 |
| **P4.5** | `tools/dtstack-cli` → `tools/dtstack-sdk` 改名（详见 §3.2）：目录改名、`package.json.name` 改、所有 import 改、根 workspaces 改、CLAUDE.md / README 引用改、tools/dtstack-cli/docs/usage.md 路径改 | 低 | `bun test` 全绿；`dtstack-cli --help` 仍可用（bin 名不变）；所有依赖 SDK 的 Playwright 测试仍可跑 |
| **P5** | §10.6 prompt 重复段落抽取 + §10.3 路径引用全量改写（131 处 kata-cli + 5 处 bun test 路径 + 20 处 workspace 子目录） | 中 | grep 校验 0 残留 |
| **P6** | §10.2 sub-agent 拆分（subagent-a → script-writer-agent / fix-agent / convergence-agent；source-facts-agent 拆分）+ §10.4 命名规范（agent 改名、kata-cli 子命令分组）；writer-agent 系统提示词从 436 行拆分到 ≤ 300 | 中 | 单 agent 行数 lint 全绿 |
| **P7** | §10.7 prompt 约束 → 脚本/lint 改造（路径硬编码、unique 数据、断言强度、临时文件归位）；§10.8 hooks 扩展（PreToolUse/PostToolUse/SessionStart 全套）；engine/hooks/ 落地 | 低 | hooks 触发覆盖率：写文件至少触发 1 hook |
| **P8** | §10.5 askUser 单点 API + Task 命名规范化 + gates 合并；§10.6 prompt preamble 注入；engine 暴露统一 `askUser` / `progress` API | 低 | skill 内 hardcode `请确认` 字符串 = 0 |
| **P9** | §10.10 README / README-EN 大改 + 4 张架构图重画（drawio 工具）+ `docs/architecture/diagram-style.md` + `<!-- BEGIN:STATS -->` 自动注入 | 中 | 中英 README + 4 张图全部更新；CI stats 自动注入 |
| **P10** | §10.9 CLAUDE.md 改造（≤ 100 行、链接化、加 pitfall 自动注入说明）+ §10.11 Playwright 配置收敛（playwright.shared.ts + 子 root config）+ 根目录散件清理（`t15-debug.spec.ts` / `cleanup-duplicates.sh`）| 低 | CLAUDE.md ≤ 100 行；selftest config 删除；根 spec 残留 = 0 |
| **P11** | 信息源 lint：rules / knowledge 写错位置 CI 报错；§10.1 SKILL.md 长度 lint；§10.2 agent lint；§10.4 命名 lint；CLAUDE.md / README 与实际数字对账 | 低 | 全套 lint 全绿、文档对账 |

### 6.2 关键不可逆点

**P3 + P3.5** 是不可逆阶段。要求：
- 双向迁移脚本（forward + rollback）
- 在 dataAssets 项目上 dry-run + 人工抽检 5 个 feature 目录 + 抽样跑通最大 2 个测试套件
- 迁移期间产生的新 PRD 走双写（旧路径 + 新路径），并行 1 周后再切单写
- P3.5 的 case 重命名（`tN.ts` → `t{nn}-{slug}.ts`）需要从 archive.md / cases.xmind 反推 slug，**不能由 AI 自行起名**——必须从用例标题派生（保持业务语义可追溯）

### 6.3 兼容期策略

- P1 完成后，`.claude/scripts/` 留空目录 + 一份 README 指向 `engine/`，6 个月后删除
- P3 完成后，`workspace/{p}/{prds,archive,xmind,tests,issues,reports}/` 旧路径函数保留 alias，6 个月后删除
- 迁移期间通过 `engine/lib/paths.ts` 内的 alias 函数兼容新旧路径

### 6.4 Git 分支策略

**现状**：当前在 `feat/desktop-shell-spec1` 分支，桌面端 spec 1 工作未完成。

**目标态**：

| 阶段 | 分支策略 |
|------|---------|
| P0 spec | 在 main（或当前活跃分支）写 spec，spec 不入库（gitignore），无分支动作 |
| P0.5 - P11 重构 | 开**长期分支** `refactor/v3-architecture`，从 main HEAD 拉，所有重构 commit 走这个分支 |
| 各 P 阶段内子任务 | 在 `refactor/v3-architecture` 上直接连续 commit；**不开 sub-feature 分支**（避免合并地狱）|
| 每个 P 阶段完成 | tag `refactor-v3-P0.5` `refactor-v3-P1` …，便于回滚定位 |
| 全部完成后 | 合并 `refactor/v3-architecture` → main，merge commit 含完整 changelog；删除分支 |
| 桌面端 spec 1 | 与重构**并行**在 `feat/desktop-shell-spec1`，重构合并后 rebase 到新 main |

**强制约束（hooks 检测）**：
- 重构期间禁止 cherry-pick `feat/*` 分支的 commit 到 `refactor/v3-architecture`
- main 在重构期间冻结（仅 hotfix 例外）
- 桌面端 / 其他业务并行工作不得 merge 进 `refactor/v3-architecture`（§10.12 已列）

### 6.5 重构进度跟踪

**问题**：12 个阶段（P0-P11）跨多次会话执行，状态不能只靠 chat 记忆。

**目标态**：在 `refactor/v3-architecture` 分支根目录维护 `REFACTOR_STATUS.md`：

```markdown
# kata v3 重构进度

| 阶段 | 描述 | 状态 | tag | 负责会话 | 完成日期 |
|------|------|------|-----|---------|---------|
| P0   | spec | ✅ done | — | 2026-04-27 | 2026-04-27 |
| P0.5 | 散件清理 + runtime 归位 | 🚧 in-progress | — | 2026-04-28 |  |
| P1   | engine 提升 | ⏳ pending | | | |
| ...  | | | | | |
```

**规则**：
- 每完成一个 P 必须更新 `REFACTOR_STATUS.md` + 打 tag + commit message 含 `refactor(P{N}): ...`
- 进入新 P 前必须验证上一 P 的"完成验证"列全绿
- 文件在 `refactor/v3-architecture` 分支独有，main 合并时删除（重构完成的标志）

### 6.6 P3 / P3.5 不可逆点的回滚预案

**问题**：P3（workspace 物理重排）和 P3.5（tests 子目录重排）涉及用户产物大规模移动，dry-run 通过不代表正式执行不出问题。

**预案**：

| 阶段 | 前置 | 执行 | 失败回滚 |
|------|------|------|---------|
| 准备 | 在 `feat/refactor-v3-P3-snapshot` tag 上完整快照当前 workspace（git tag）| - | tag 永久保留 |
| Dry-run | 在 `workspace/dataAssets-shadow/` 复制一份 + 跑 forward 脚本 | 验证产物完整性 | 删除 shadow，不触主目录 |
| Forward | 跑 forward 脚本（含每 feature 完整性 checksum） | 写迁移日志 `refactor-v3-P3.log` | 跑 rollback 脚本 + 验证 checksum 复原 |
| 双写过渡（1 周） | engine path 函数同时写新旧路径 | 观察 AI 工作流 + 真实 PRD | 单切回旧路径函数 |
| 切换 | 关闭旧路径写入，仅读不写 alias | 跑 1 个完整 PRD 流程 | 同上 |
| 清理（6 个月后）| 删旧路径目录 | - | tag 仍可恢复 |

**执行约束**：
- forward / rollback 脚本必须**互为反函数**（`apply(rollback(x)) === x`），引入单元测试
- 任何 P3 / P3.5 commit 必须能在 < 5 分钟内 rollback（用 tag + script，不用人工）
- 双写期间任何写入旧路径的代码必须 console.warn，定位仍未迁移的调用点

## 7. 验收标准

### 7.1 量化指标（1-3 个月后回看）

| 指标 | 现状 | 目标 |
|------|------|------|
| AI 在长链路中"该读哪份规则"的模糊决策点（按 sub-agent prompt 中"如有冲突按..."的句子数计） | ≥ 8 | ≤ 2 |
| 删除一个 PRD 的全部产物所需命令数 | 6+（rm 6 个目录） | 1（rm features/{slug}） |
| 顶层目录数 | 14（含散件 t15-debug.spec.ts / cleanup-duplicates.sh / .DS_Store） | 11（净化散件） |
| `.claude/` 下文件类别数 | 8（agents/ skills/ scripts/ references/ scheduled_tasks.lock + settings*）| 3（agents/ skills/ settings*） |
| 单 skill 内文件类别数（test-case-gen 为例） | 6（SKILL.md / workflow/main.md / protocols.md / step-N.md / gates/R*.md / references/） | 4（SKILL.md / workflow.md / rules.md / references/） |
| README/CLAUDE.md 数字与实际偏差 | 7 skill 报告为 7、15 agent 报告为 14 | 0 偏差 |
| 单个 PRD `tests/` 平铺文件数（最大值） | 51（`【通用配置】json格式配置`） | ≤ 6（README + 4 子目录 + .debug） |
| `tests/` 内 helpers 单文件最大行数 | ~3000 行（80KB rule-editor-helpers.ts） | ≤ 800 |
| `tN.ts` 纯编号命名占比 | 100% | 0%（强制 `t{nn}-{slug}.ts`）|
| `tools/dtstack-cli` 包名语义偏差 | 主入口是 SDK，包名却叫 cli | 0（包名 `dtstack-sdk`，bin 仍叫 `dtstack-cli`）|
| skill 内文件 hardcode `kata-cli` 命令字符串 | 131 处 | 0 |
| skill / agent prompt hardcode `.claude/scripts/` 路径 | 5 处 | 0 |
| skill / agent prompt hardcode 旧 workspace 子目录（prds/archive/xmind/issues/reports） | ~20 处 | 0 |
| 单 agent prompt 最大行数 | 436（writer-agent） | ≤ 300 |
| 违反单一职责的 agent description（>2 task）数 | 2（subagent-a / source-facts） | 0（已拆分） |
| SKILL.md 行数最大值 | 359（playwright-cli） | ≤ 200 |
| Hooks 数量（settings.json） | 1（Stop） | ≥ 6（PreToolUse Edit/Bash + PostToolUse Edit + Stop + SessionStart + PreToolUse Skill） |
| CLAUDE.md 行数 | 84 | ≤ 100（保持） + 数字 0 漂移 |
| 根目录 `t*-debug.spec.ts` / 一次性脚本残留 | 2 | 0 |
| 中英 README 同步性 | 手维护、易漂移 | 用 anchor + CI 校验，0 数字偏差 |
| 架构图更新率（4 张） | 全部停留在 v2 | 4/4 重画为 v3 |
| `docs/refactor/` dangling reference 数 | 5（progress 4 + CLAUDE.md 1） | 0 |
| 一次性脚本 / debug spec 散件 | 2（`t15-debug.spec.ts` + `cleanup-duplicates.sh`） | 0 |
| 运行时产物撞名风险（多 project 共用根 test-results） | 已存在（dataAssets 已落 3 份） | 0（每 project `.runs/` 隔离） |
| `.DS_Store` 入库数 | ≥ 3 | 0 |

### 7.2 体感指标（用户主诉）

- 用户表述"AI 经常出错"的频率显著下降（基线对比 P3 完成前后 1 个月）
- 用户表述"找不到东西"的频率显著下降
- 加新 skill 时不需要改 5 处文档（CLAUDE.md / README / kata-cli.ts / settings 等）

## 8. 设计软肋（诚实记录）

| # | 软肋 | 缓解 |
|---|------|------|
| 1 | engine/ 内部不再分 platform/core+domain+adapter 三层，未来 engine 自己变大可能需要再切 | 业界先例（trailofbits ct_analyzer / levnikolaevich mcp 子包）也是平铺，等真出现 engine 内部子领域稳定再切 |
| 2 | feature 内的 schema 靠 path 函数硬编码，没有"feature manifest" 契约 | P5 的 lint 规则部分覆盖（写错位置报错），manifest 留待真出现"工具间需要共享 feature 元数据"时再加 |
| 3 | P3 用户产物迁移有不可逆风险 | 双向脚本 + dry-run + 双写过渡期 |
| 4 | 兼容期 alias 6 个月，期间存在新旧路径并存 | 在 paths.ts 单点加 console.warn，定位仍在用旧路径的代码 |
| 5 | `apps/desktop/` 目前不强制对齐新规则 | 桌面端是早期试水，不为它让路；它要稳定时再单独 spec |

## 9. 不做什么（非目标的扩展说明）

- **不做 platform/core+domain+adapter 三层抽象**：业界先例 0、是为想象中的桌面端做的过早抽象、增加 60% 工作量却不解决今天痛点
- **不做 plugin marketplace 化**（`.claude-plugin/marketplace.json`）：kata 是 app + 内嵌 skill，不是分发型仓库；变成 marketplace 形态会强迫每个 skill 独立打包发布，得不偿失
- **不做 domain-first 切分**（按 case-gen / ui-test / bug / hotfix / knowledge 切 domain）：domain 边界拍偏的风险高、跨 domain 共享代码归属难定、调研中没有任何先例
- **不为桌面端做 adapter 层**：`engine/` 作为独立 npm 包本身就是接入点

## 10. 重构前置护栏（Pre-Refactor Guardrails）

> 本节将所有"交叉关注点"提前锁死，避免重构期间反复推翻 plan。每个子节遵循同一格式：**现状审计**（具体问题）→ **目标态规范**（强制规则）→ **Lint / 自动化执行机制**（不靠人类自律）。

### 10.1 SKILL.md 规范（按需加载 + frontmatter 一致性）

**Anthropic 官方最佳实践依据**：
- SKILL.md 推荐 ≤ 200 行（详细内容下沉到 references/，按需 Read）
- frontmatter 仅 `name` + `description` 必填；description 上限 1536 字符，front-load 触发关键词与"何时用"判据
- progressive disclosure：description 始终在 context（低成本），SKILL.md 仅在被调用时加载，references/ 在 Claude 主动 Read 时加载

**现状审计（实测数字）**：

| skill | 行数 | description 风格 | 触发词 | argument-hint | 备注 |
|------|-----|----------------|-------|---------------|-----|
| using-kata | 25 | 单行中文 | 有 | 有 | ✅ |
| test-case-gen | 21 | 单行中文 | 有 | 有 | ✅ |
| case-format | 54 | YAML 多行（带 `-` 列表） | 有 | 有 | ⚠ 多行 description 不一致 |
| daily-task | 30 | YAML 多行 | 有 | 有 | ⚠ 同上 |
| knowledge-keeper | 75 | 单行中文 | 有 | 有 | ✅ |
| ui-autotest | 62 | 单行中文 | 有 | 有 | ✅ |
| **playwright-cli** | **359** | 英文一句 | **无** | **无** | ❌ 严重违反 progressive disclosure；唯一使用 `allowed-tools` 字段；无 argument-hint |

**目标态规范**：

| 规则 | 内容 | 检测 |
|------|------|------|
| S1 | SKILL.md 主体 ≤ 200 行（warn）/ ≤ 300 行（fail）。超过强制下沉到 `references/` | `wc -l` |
| S2 | frontmatter 必填 `name` + `description`，description ≤ 1536 字符 | YAML 解析 |
| S3 | description 内必须包含触发词（中文项目用 `触发词：` 关键字明确划分） | 文本扫描 |
| S4 | description 风格统一：**全部使用单行字符串**，多触发词用顿号分隔；废弃 YAML 多行（case-format / daily-task 改写） | regex 检测换行 |
| S5 | `argument-hint` 必填（playwright-cli 补） | YAML 字段检查 |
| S6 | 同一 skill 内 description 中的触发词必须与 README.md / CLAUDE.md 命令索引一致 | 交叉对账脚本 |
| S7 | playwright-cli 的 359 行内容拆为：SKILL.md（≤ 80 行索引） + `references/{topic}.md`（已有 5 个但未拆透） | 行数 + 内部 anchor |

### 10.2 Sub-agent 提示词规范（单一职责 + 长度 + frontmatter）

**Anthropic 最佳实践依据**：
- frontmatter `name` + `description` 必填，`tools` 与 `disallowedTools` 二选一不可同设
- model 字段必须在 `{haiku, sonnet, opus, inherit}`
- description 列出 > 2 个 distinct task 即违反单一职责
- 系统提示词 < 1000 行

**现状审计**：

| agent | 行数 | model | 单一职责违规 |
|------|-----|-------|------|
| writer-agent | **436** | sonnet | ⚠ 接近上限 |
| subagent-a-agent | **335** | sonnet | ❌ "脚本生成 + 自测修复 + 共性收敛"（3 职责） |
| source-facts-agent | 202 | sonnet | ❌ "源码扫描 + 图像语义化 + 页面要点提取"（3 职责） |
| hotfix-case-agent | 195 | sonnet | ✅ |
| 其他 | < 200 | 合理 | ✅（多数）|

**目标态规范**：

| 规则 | 内容 | 检测 |
|------|------|------|
| A1 | system prompt ≤ 300 行（warn）/ ≤ 500 行（fail）；writer-agent 必须拆 | `wc -l` |
| A2 | description 中 `+` / `／` / `,` / `、` 切分得到的 task 数 ≤ 2 | regex 计数 |
| A3 | frontmatter 字段顺序统一：`name → description → model → tools`（现状有 6 个 agent 是 `tools → model` 顺序）| YAML key 序 |
| A4 | model 字段必填且取值合法 | enum |
| A5 | `tools` 必须显式 allowlist（不允许省略），且最小化原则（不需要的工具不列） | YAML 字段 |
| A6 | description 末尾必须含 "Owner: {skill-name}"（明确归属于哪个 skill），CLI 校验 reference 路径必须在该 skill 的 references/ 内 | regex + 路径检查 |
| A7 | subagent-a 必须按 3 阶段拆为 3 个独立 sub-agent（script-writer-agent / fix-agent / convergence-agent）—— 单一职责强制落地 | 重构后清单对比 |
| A8 | source-facts-agent 同样拆 2-3 个：source-scanner / image-semanticizer（图像语义化交主 agent 视觉能力）| 重构后清单对比 |

### 10.3 路径引用治理（重构高危区）

**现状审计**：

| Hardcode 类型 | 实测数 | 重构后失效原因 |
|------------|-------|--------------|
| `kata-cli {sub-cmd}` 在 skill / agent 文件中 | **131 处** | engine 移位后 cwd 假设可能改 |
| `.claude/scripts/...` 在 references | 4-5 处 | engine/ 后路径全部失效 |
| `bun test ./.claude/scripts/__tests__` | 5 处（README/CLAUDE/INSTALL/package.json/README-EN）| engine 后路径变为 `bun test --filter engine` |
| `workspace/{project}/{prds,archive,xmind,tests,issues,reports,knowledge}` 引用 | ~20 处 | β 重排后全部移到 `features/{slug}/` |
| `tools/dtstack-cli/...` 引用 | 多处（CLAUDE / docs / kata-cli 子命令注册）| 改名为 `dtstack-sdk` 后失效 |

**目标态规范**：

| 规则 | 内容 | 检测 |
|------|------|------|
| P1 | skill / agent 文件**禁止 hardcode** `kata-cli` 命令字符串；统一通过 engine 暴露的"命令注册表"读取 | grep 扫描 |
| P2 | 任何引用 `.claude/scripts/` 的 prompt 替换为 `engine/`；提供单点搜索 + 替换脚本 | regex |
| P3 | `workspace/{project}/...` 子目录引用全部用变量名 `${FEATURE_DIR}` / `${PROJECT_KNOWLEDGE_DIR}` / `${PROJECT_SHARED_DIR}` 等；engine 提供 path-token 解析器 | 变量名规范 |
| P4 | `bun test` 在所有文档（README/CLAUDE/INSTALL/package.json）改为 `bun test`（package.json 的 `test` 脚本内部 cd 到 engine） | 文档对账 |
| P5 | 重构 PR 必须附带"路径引用迁移报告"：列出所有改写位置 + 验证脚本 | 模板强制 |

### 10.4 命名规范审查（CLI / Skill / Agent / 参数 / 函数）

**现状审计 + 目标态**：

| 类别 | 当前 | 目标 | 理由 |
|------|------|------|------|
| **包名** | `dtstack-cli` | `dtstack-sdk` | SDK 一等公民（已写入 §3.2） |
| **shell 命令名** | `kata-cli` `dtstack-cli` | 保持 | 用户视角无感知 |
| **SKILL 名** | `using-kata` `test-case-gen` `case-format` `daily-task` `ui-autotest` `playwright-cli` `knowledge-keeper` | 全部保持 | 已稳态、改名收益 < 全网替换成本 |
| **Agent 名** | `subagent-a-agent` / `subagent-b-agent` | `script-writer-agent` / `regression-runner-agent`（拆分后命名） | "subagent-a/b" 完全无业务含义，违反命名可读性 |
| **agent 文件后缀** | `*-agent.md` | 保持（与 skill 区分） | 一致性优先 |
| **kata-cli 子命令** | 28 个平铺 | 按领域分组：`kata-cli case ...` / `kata-cli bug ...` / `kata-cli platform ...`（兼容期保留旧命名） | 平铺导致 `kata-cli --help` 一屏装不下 |
| **函数命名** | `xmindGen` / `archiveGen` / `historyConvert` 等动词后置 | 统一动词前置：`generateXmind` / `generateArchive` / `convertHistory` | TypeScript 社区惯例 |
| **path 函数** | `prdDir(p, ym, slug)` `archiveDir(p)` `xmindDir(p)` 各管一摊 | 统一 `featureDir(p, ym, slug)` + `featureFile(p, ym, slug, kind)`（β 后） | 已写入 §4.3 |
| **参数命名** | `--project` / `--quick` / `--ym` / `--slug` 大体一致 | 保持 + 补 `--feature` 短形参（取代 `--ym --slug`） | 减少参数数 |

**Lint 规则**：
- N1：`.claude/agents/` 下不允许包含 `subagent-[a-z]` 模式的命名
- N2：函数名必须动词前置（biome rule: `useNamingConvention`）
- N3：所有 path 函数集中在 `engine/lib/path/`，禁止其他文件 `import { join } from "node:path"` 后自行拼路径（违者改用 path 函数）

### 10.5 工作流交互规范（AskUser / Task 命名 / 进度可视化）

**现状审计**：
- 各 SKILL.md / workflow 文件 hardcode 提示词如"请确认是否继续"、"输入 yes 继续"，散落不统一
- Task 命名：当前 sub-agent 派发时 description 字段长短不一（"调研最佳实践"、"Audit current kata prompts for defects"），用户在 task list 看到的可读性差
- gates/R1.md / R2.md / R3.md 是 review gate 的 prompt，但格式不一致

**目标态规范**：

| 规则 | 内容 |
|------|------|
| I1 | 所有用户交互入口收敛到 engine 暴露的 `askUser({ question, options, allowFreeText, defaultIfTimeout })` 单点 API；skill / agent 不再自行 print 问题等输入 |
| I2 | Task 描述统一格式：`{动词}{对象}—{产物}`，例：`生成测试用例—archive.md + xmind`、`修复测试脚本—失败 case 自测通过`，长度 ≤ 30 字 |
| I3 | gates 改为单文件 `gates.md`，每个 gate 锚点 `## R1 / ## R2 / ## R3`；提示词模板统一（标题 + 通过/打回标准 + 通过后行动） |
| I4 | 工作流进度可视化：engine 提供 `progress.update(step, status, evidence)` API；TodoWrite 工具调用由 engine 统一发出（不靠 skill 各自调） |
| I5 | 二次确认（破坏性操作）必须经过 `askUser({ destructive: true })`，单点拦截 |

### 10.6 提示词重复 / 冗余 / 精简

**现状审计**：
- `protocols.md` 在 test-case-gen / ui-autotest 各有一份，内容相似（Task 可视化、产物契约）但分别维护
- skill 内 `references/playwright-patterns.md` + `.claude/references/playwright-patterns.md` 同名疑似重复
- 14 个 agent 中有 6+ 个的 system prompt 含相同的"输出 schema 必须严格 JSON、禁止 markdown 包裹"段落
- 各 agent / skill 都有"如有冲突按..."的优先级 prose（应统一引用 §5.2）

**目标态规范**：

| 规则 | 内容 | 检测 |
|------|------|------|
| D1 | 跨 skill / agent 重复 ≥ 3 次的段落必须提取到 `engine/references/{topic}.md`，被 prompt 用 `@reference:topic` 占位符引用，由 engine 在派发时注入 | 3-gram 相似度扫描 |
| D2 | `.claude/skills/{a}/references/X.md` 与 `.claude/skills/{b}/references/X.md` 同名时强制合并为 `engine/references/X.md` 或显式声明"不是同一份" | 同名扫描 |
| D3 | 所有 agent prompt 头部禁止重复"输出 JSON 严格 schema..."这段，统一由 `engine/lib/prompt-preamble.ts` 在派发时注入 | 重复段落扫描 |
| D4 | 优先级 prose 全部替换为单一引用 "[详见 §5.2 优先级]" | 字符串 lint |

### 10.7 脚本化代替 prompt 约束（最小化模型 cognitive load）

**原则**：能用代码确定性执行的事，就不用 prompt 让模型"自己注意"。模型注意力是稀缺资源。

**现状审计 + 改造清单**：

| 当前用 prompt 约束 | 改用脚本 / 自动化 |
|------------------|---------------------|
| "提示词里写：禁止 hardcode 路径，请用 path 函数" | biome rule + grep CI 校验，违反直接构建失败 |
| "提示词里写：写完 archive.md 必须同步 xmind" | engine 提供 `writeFeature(payload)` 单点 API，内部强制双写 |
| "提示词里写：unicode 符号请使用 √ 不用 ✓" | post-edit hook 自动替换 |
| "提示词里写：测试数据必须 uniqueName()" | biome rule 检测字符串字面量 + 提示 |
| "提示词里写：先 read knowledge/pitfalls/" | 派发 sub-agent 时 engine 自动 prepend pitfalls 索引到 prompt |
| "提示词里写：失败时不要弱化断言" | grep CI 拒绝 `.toBeTruthy()` 兜底空数组 / `filter(Boolean)` 等模式 |
| "提示词里写：提交前跑 bun test" | git pre-commit hook 自动跑 |
| "提示词里写：临时文件请放到 .debug/" | post-write hook 检测 `*-repro.spec.ts` `diag_*.spec.ts` 自动移动 |

**Lint 规则**：
- E1：每条进入 prompt 的"禁止 / 必须"约束必须先尝试用代码实现；新增 prompt 约束的 PR 必须解释"为什么不能用代码"
- E2：engine 暴露的 API 必须把"模型容易出错的副作用"封装为原子操作（双写 / 同步 / 校验）

### 10.8 Hooks 机制扩展

**现状**：`.claude/settings.json` 仅 1 个 Stop hook（notify/detect-events.ts）。

**目标态规范**：

| Hook 类型 | 用途 | 实施 |
|----------|------|------|
| **PreToolUse: Edit/Write** | 拒绝写入 `.repos/` 下任何文件（只读源码强约束） | shell 检查路径 |
| **PreToolUse: Bash** | 拒绝 `git push` / `git commit` 在 `.repos/` 下；拒绝 `rm -rf` `workspace/` 这种 | shell 检查 |
| **PostToolUse: Edit (*.ts)** | 自动 biome format + 触发 `tsc --noEmit` 给当前文件，错误以非阻塞 warning 形式 surface | bun script |
| **PostToolUse: Edit (*.md)** | markdown link 检查（防止重构时引用断裂） | bun script |
| **PostToolUse: Edit (workspace/{p}/features/...)** | 自动校验 §4.5 L1-L8 lint，违规即 warning | bun script |
| **PreToolUse: Skill** | 派发 sub-agent 时自动 prepend 该 skill 对应的 pitfalls 索引（来自 §10.7 E1） | bun script |
| **Stop** | 现有 notify + 增加：检查未提交的临时调试文件（`t*-debug.spec.ts` 之类） | bun script |
| **SessionStart** | 加载当前项目的 knowledge/overview.md 摘要到 context（取代各 skill 自行 read） | bun script |

**实施约束**：
- 所有 hooks 脚本统一放 `engine/hooks/`，由 engine 暴露
- `.claude/settings.json` 只引用 hook 名（如 `engine-hook:pre-bash`），不内联 shell
- Hooks 失败必须有清晰错误信息（哪条规则、哪个路径、如何修复）

### 10.9 CLAUDE.md 规范（Anthropic 最佳实践）

**Anthropic 官方指引**：
- CLAUDE.md 是项目级"AI onboarding context"，不是知识库
- 应包含：项目骨架（命令索引 / 目录布局 / 核心约束）、协作偏好、硬约束（禁止项 / 测试纪律）
- **不应包含**：详细业务知识（应在 knowledge-keeper）、详细工作流（应在 SKILL.md / workflow.md）、长篇 prose

**现状审计**：当前 CLAUDE.md ≈ 84 行，结构良好（命令索引 / 工作区布局 / 核心约束 / 三层信息架构 / 测试纪律 / 测试数据唯一性 / 数据源命名 / 禁止硬编码）。但有几处需要调整：

| 节 | 现状 | 调整 |
|----|------|------|
| 命令索引 | 6 个命令 | 重构后改为 5 个（`/dtstack-cli` 不是 slash command，移到"独立工具"小节）；加入 `kata-cli case` `kata-cli bug` 分组提示 |
| 工作区布局 | 旧的 `prds/ xmind/ archive/ tests/ issues/ reports/` 列表 | 改为 `features/ incidents/ regressions/ knowledge/ shared/ rules/`（β 后）|
| 三层信息架构 | 现表写"3 层"，但实际涉及 6+ | 改为指向 §5.1（`docs/architecture/information-architecture.md`），不在 CLAUDE.md 重复 |
| 测试用例保真度 + 测试数据唯一性 + 数据源命名 + 禁止硬编码 | 当前在 CLAUDE.md 里 | 这些是"硬约束"应留在 CLAUDE.md（短小、AI 每次必读），但具体规则下沉到 `rules/`，CLAUDE.md 只列条目 + 链接 |

**目标态规范**：

| 规则 | 内容 |
|------|------|
| C1 | CLAUDE.md ≤ 100 行（不超过一屏滚动） |
| C2 | 必有节：命令索引 / 顶层布局 / 核心约束（禁止项）/ 三层信息架构（链接到 docs/architecture/）/ 协作偏好 / 测试纪律 |
| C3 | 不放：长篇业务知识、详细工作流、具体规则原文（用链接） |
| C4 | "**遇到问题优先调 knowledge/pitfalls/**" 这一条**应该写**，但要 actionable：写为 *硬约束："失败诊断前 MUST `kata-cli knowledge search --kind pitfall <错误关键词>`，命中即引用、未命中再自由分析"*。同时它的执行用 §10.8 的 `PreToolUse: Skill` hook 自动注入 pitfalls 索引，**不靠 prompt 自律** |
| C5 | 所有"硬约束"段落必须有对应的 lint / hook，不允许只是 prose |
| C6 | 每次 spec 重大修订后，CLAUDE.md 与实际代码 / 文档计数对账（数字漂移 = CI 失败）|

**举例**：你问的"遇到问题优先自动调用知识库踩坑"是该写的，但要按 C4 / C5 改造为可执行约束（hook 自动注入）+ CLAUDE.md 用一行说明并链接到 hook 文档。

### 10.10 README / 中英双份 / 架构图更新

**现状审计**：
- `README.md`（中）+ `README-EN.md`（英）双份维护，重构后两份必须同步改
- `README.md` 描述 "7 Skill / 5 工作流 / 15 Agent / 5 cross-cutting 能力"——数字偏差（实际 14 agent）
- 架构图共 4 张：`assets/diagrams/{architecture,plugin-system,test-case-gen,ui-autotest}.{drawio,svg,png}` 全部于 2026-04-19 / 04-24 生成，所有顶层重构后都失效
- README 的"项目结构"节列出 `.claude/scripts/` 和旧 workspace 子目录，重构后需大改

**目标态规范**：

| 规则 | 内容 |
|------|------|
| R1 | README 必须更新章节：架构总览（重画图 + 简文）、项目结构（新顶层）、工作流详解（features/ 聚合后的目录引用）、脚本 CLI 参考（kata-cli 子命令分组）、环境配置 |
| R2 | README-EN.md 翻译同步更新；建立 `docs/sync-readme.md` 记录中英对应章节锚点 |
| R3 | 数字（skill 数 / agent 数 / 工作流数）由 engine 命令 `kata-cli stats` 输出，README 用 `<!-- BEGIN:STATS -->...<!-- END:STATS -->` 占位由 CI 自动注入；杜绝手写漂移 |
| R4 | 架构图必须更新（4 张全部重画）：使用 drawio 工具（`/Users/poco/Projects/CLI-Anything/drawio/agent-harness/cli_anything/drawio`），统一导出 `.drawio` + `.svg` + `.png`；P0 阶段交付前 4 张全部入库 |
| R5 | 架构图风格统一：所有图采用同一 legend / 字体 / 配色（在 P0 写一份 `docs/architecture/diagram-style.md` 作为图样契约）|
| R6 | 重构期间 README 的"过渡说明"节加入"本仓库正在 v2 → v3 架构迁移，旧路径在兼容期"，引用本 spec 链接 |

### 10.11 Playwright 测试体系治理（多入口收敛）

**现状审计**：
- 根 `playwright.config.ts`（业务 e2e 入口）+ `playwright.selftest.config.ts`（ui-blocks 自测，重复了一半 loadDotEnv 逻辑）
- `apps/desktop/e2e/` 桌面端 e2e（独立 config，独立 mock claude.sh）
- `tools/dtstack-cli/__tests__/` SDK 自带测试
- `.claude/scripts/__tests__/`（单元测试，bun:test）
- 根目录 `t15-debug.spec.ts` 临时调试遗物（脏！）
- selftest config 与主 config 有重复实现

**目标态规范**：

| 规则 | 内容 |
|------|------|
| T1 | Playwright 配置层级：根 `playwright.config.ts`（业务 e2e 默认）+ 各子 root 自带（`apps/desktop/e2e/playwright.config.ts` / `tools/dtstack-sdk/__tests__/playwright.config.ts`）；不再有 `playwright.selftest.config.ts` 这种"配置变体" |
| T2 | 公共配置抽到 `playwright.shared.ts`（lib/playwright/ 内），各 config 通过 `defineConfig({ ...sharedConfig, testDir: ... })` 复用 |
| T3 | `playwright.selftest.config.ts` 的 ui-blocks 自测改用 testDir + project 配置实现，不再重复 config 文件 |
| T4 | 测试类型严格分离：`*.spec.ts` 仅 e2e、`*.test.ts` 仅单元；混在同目录由 §4.5 L6 校验 |
| T5 | 根目录 `t*-debug.spec.ts` / `cleanup-duplicates.sh` 等"脏件"清理 + 加入 `.gitignore` 模式 `t*-debug.spec.ts` 兜底 |
| T6 | 测试运行入口统一：`bun test`（单元）/ `bun playwright`（e2e）；package.json 暴露聚合脚本 |

### 10.12 文档语言规范（中英混合治理）

**现状**：项目大量中文（PRD / 用例 / knowledge / pitfalls / SKILL description），代码注释和 commit message 中英混合，没有规范。

**目标态规范**：

| 内容类型 | 语言 | 理由 |
|---------|------|------|
| 用户产物（PRD / archive.md / knowledge.md / pitfalls） | **中文** | 业务一线用户母语 |
| SKILL.md description | **中文 + 英文 keyword** | 触发词中文，少量英文术语（如 `e2e` `bug` `merge conflict`）保留 |
| sub-agent system prompt | **中文** | 与 SKILL 一致；Anthropic 模型对中文理解良好 |
| 代码注释 | **英文** | 国际化、利于复用 / 开源 |
| commit message | **英文**（type + 描述）| 沿用 conventional commits |
| TypeScript 错误消息 / log | **英文** | 调试场景跨语言通用 |
| README.md | **中文 + README-EN.md 英文双份** | 已有形态保留，加 anchor 同步 |
| docs/architecture/ | **中文为主，关键术语保留英文** | 团队语境 |
| docs/superpowers/specs/ | **中文为主** | 内部设计文档 |
| Lint 错误消息 | **英文** | engine 一致 |
| Hook 错误消息 | **中文 + 英文 hint** | 用户态可读 + 排查关键词 |

**Lint 规则**：
- L1：commit message 必须英文（CI 检测中文字符）
- L2：`engine/src/**/*.ts` 注释必须英文（grep 中文 → warning）
- L3：用户产物文件（archive.md / knowledge/ / pitfalls/）禁止全英文（rare false positive，warning 即可）

### 10.13 环境变量命名规范

**现状审计**：实测 19 个 env 变量、5 种前缀混杂：
- `KATA_*`（KATA_ROOT_OVERRIDE）
- `UI_AUTOTEST_*`（UI_AUTOTEST_BASE_URL / COOKIE / SESSION_PATH）
- `PW_*`（PW_FULLY_PARALLEL / PW_TWO_PHASE / PW_WORKERS）
- `QA_*`（QA_ACTIVE_ENV / QA_PROJECT / QA_SUITE_NAME）
- `ALLURE_*`（ALLURE_BIN / ALLURE_REPORT_BASE_URL）
- 无前缀：`ACTIVE_ENV` `HEADLESS` `WORKSPACE_DIR` `CONFIG_JSON_PATH` `SKIP_ALLURE_GEN` `SKIP_NOTIFY`

**目标态规范**：

| 域 | 前缀 | 示例 |
|----|------|------|
| kata 框架核心 | `KATA_*` | `KATA_ACTIVE_PROJECT` `KATA_WORKSPACE_DIR` `KATA_ROOT_OVERRIDE` `KATA_CONFIG_PATH` `KATA_LOG_LEVEL` |
| Playwright 调度 | `KATA_PW_*` | `KATA_PW_WORKERS` `KATA_PW_FULLY_PARALLEL` `KATA_PW_TWO_PHASE` `KATA_PW_HEADLESS` |
| Allure 报告 | `KATA_ALLURE_*` | `KATA_ALLURE_BIN` `KATA_ALLURE_REPORT_URL` |
| Skip / Feature flag | `KATA_SKIP_*` | `KATA_SKIP_ALLURE_GEN` `KATA_SKIP_NOTIFY` |
| 第三方平台凭证 | `{平台}_*` | `DTSTACK_*`（已存在）`LANHU_*` `ZENTAO_*`（plugin 各自管） |
| 测试目标系统 | `KATA_TEST_*` | `KATA_TEST_BASE_URL` `KATA_TEST_COOKIE` `KATA_TEST_SESSION_PATH`（取代 `UI_AUTOTEST_*`）|

**Lint 规则（V1-V3）**：
- V1：engine 内 process.env 读取必须前缀 `KATA_*` 或第三方平台名；其他前缀视为遗漏
- V2：env 变量必须在 `engine/src/lib/env/schema.ts` 集中声明（zod schema），未声明的 env 读取 CI 失败
- V3：`.env.example` / `.env.envs.example` 由 schema 自动生成，避免漂移

**迁移**：在 P7 / P10 阶段完成；过渡期 schema 中允许两个名字（旧 + 新）对照存在 1 个月后切单。

### 10.14 重构期间禁止的偏差（行为约束）

| 禁止 | 原因 |
|------|------|
| ❌ 在重构 PR 中**同时**修改业务逻辑（lib 函数行为） | 偏差源于"顺手改一下"，会让回滚成本爆炸 |
| ❌ AI 自行决定 case 的 `slug`（必须从 archive.md 反推，详见 §6.2） | 业务语义可追溯 |
| ❌ AI 跨阶段"提前预判优化"（P3 阶段不允许动 P4 的内容） | 阶段切分的整个意义 |
| ❌ 在 prompt 里加"模型请注意 X"作为约束（必须改用脚本/hook，详见 §10.7） | cognitive load |
| ❌ 引入新的顶层 root（除非 §3 已列） | 顶层结构稳定优先 |
| ❌ 引入新的命名约定而不更新 §10.4 | 一致性 |
| ❌ 重构期间合并 main 分支以外的来源 | 减少冲突面 |

## 11. 参考

- [claude-code-docs § Where skills live](https://code.claude.com/docs/en/skills.md)
- [anthropics/skills](https://github.com/anthropics/skills)
- [trailofbits/skills](https://github.com/trailofbits/skills)
- [levnikolaevich/claude-code-skills](https://github.com/levnikolaevich/claude-code-skills)
- [santifer/career-ops](https://github.com/santifer/career-ops)
- [wshobson/agents](https://github.com/wshobson/agents)
- [Aaronontheweb/dotnet-skills](https://github.com/Aaronontheweb/dotnet-skills)
- [docs/refactor/specs/2026-04-17-knowledge-architecture-design.md](../../refactor/specs/2026-04-17-knowledge-architecture-design.md)（前置：三层信息架构早期设计，本 spec §5 是其落地版本）
