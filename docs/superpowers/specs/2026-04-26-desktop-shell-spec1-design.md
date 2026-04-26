# Spec 1 — kata Workbench Shell（桌面端骨架 + PTY 对话流）

> **Status**: Draft · **Date**: 2026-04-26 · **Owner**: kopohub@gmail.com
> **Scope**: 这是 4 个 Spec 中的第 1 个；后续 Spec 2/3/4 见 §11。

## 1. 背景

kata 现状是基于 Claude Code CLI 的 QA 工具集，所有能力（用例生成、UI 自动化、bug 报告等）通过 slash command 在终端触发，产物落到 `workspace/{project}/`。痛点是 CLI 操作门槛高、产物分散、跨项目无全景视图。

整体目标是构建一个 macOS 桌面端 **kata Workbench**，定位为 "Claude Code CLI 的驾驶舱 + QA 产物的取景器"——保留 CLI 全部能力（spawn `claude` 进程，零业务逻辑下沉），同时提供更友好的入口与可视化。

整体被拆为 4 个独立 Spec（见 §11），本文档仅定义 **Spec 1：桌面端骨架 + PTY 对话流**。

## 2. 目标与边界

### 2.1 Spec 1 目标

交付一个可分发的 macOS 桌面应用（ad-hoc 签名 dmg），用户能：

1. 启动 app，自动检测 `claude` CLI 安装与登录态，未就绪有清晰引导
2. 看到 `workspace/*/` 下所有项目，点击切换（PTY cwd 跟随）
3. 在选定项目里输入任意 slash command 或自然语言，看到完整的 stream-json 流式渲染
4. 多轮交互回复（PTY 长 session）
5. 浏览 `workspace/{project}/` 文件树，拖拽文件到 composer 自动注入 `@相对路径`
6. 任务结束后日志自动归档到 `.kata/{project}/tasks/{taskId}.jsonl`，30 天滚动 + 用户标记保留
7. 启动时可从历史 session 列表里恢复任意会话（带事件回放）
8. 全程 Apple HIG 视觉风格（毛玻璃、SF Pro 字体、8pt 网格、SF Blue 强调色）

### 2.2 非目标（明确不做）

- ❌ 任何表单化触发（参数收集器） → Spec 2
- ❌ 任何产物专用 viewer（xmind 渲染、trace 嵌入、用例表格） → Spec 2
- ❌ markdown 编辑器风格的 inline 渲染（仅纯文本预览） → Spec 2
- ❌ 跨项目仪表盘 / 配置编辑器 → Spec 3
- ❌ 多 session 并行（一个项目多 PTY） → Spec 4
- ❌ Windows / Linux 打包 → 后续平台 Spec
- ❌ 自动更新机制 → 后续分发 Spec
- ❌ Developer ID 签名 + 公证 → 长期路径（取决于 Apple Developer 账号申请）
- ❌ 团队协作功能（共享 session、用户系统） → 始终非目标

### 2.3 成功标准

```
全新 mac 安装 ad-hoc 签名 dmg
 → 首次启动看到 preflight 引导（CLI 未安装 / 未登录的不同分支）
 → 完成 `claude login` → 重新检测进入主界面
 → 选 dataAssets 项目（cwd 自动跟随）
 → 拖拽 archive/foo.md 到 composer 自动 @相对路径
 → 输入命令 → 看到完整 stream-json 流式输出（assistant / tool_use / tool_result / result 全渲染）
 → 任务结束 → .kata/dataAssets/tasks/{taskId}.jsonl 完整存在
 → 关闭 app → 重开 → 历史 sessions 列表点击 → 完整事件回放 → 继续输入
 → 全程无崩溃、无白屏、无僵死、视觉符合 Apple HIG
```

## 3. 决策记录

13 项决策已通过 brainstorming Q&A 锁定，是后续实施的契约。

| # | 主题 | 决定 | 理由摘要 |
|---|------|------|----------|
| Q1 | 范围 | 拆 4 个 Spec，本次只做 Spec 1 | 单 spec 聚焦原则，4 个子系统耦合度低 |
| Q2 | Hero 用例 | 自由对话 + 项目切换器 | 验证最难技术（PTY/stream-json）用最简 UI；表单触发留给 Spec 2 |
| Q3 | Session 模型 | 每项目一个长 PTY | 多轮交互天然支持，token 缓存命中率高，与终端用户体验一致 |
| Q4 | 平台 | 仅 macOS（Spec 1） | 地基阶段不分散精力到平台扩展；写跨平台 API 留接口 |
| Q5 | 框架 | Tauri 2.0 | 包体小一个数量级，桌面端架构是 spawn 不是 import，TS 复用价值有限 |
| Q6 | Session 持久化 | 列出历史 sessions 让用户选 | 启动透明、灵活，与 `claude --resume` 对齐 |
| Q7 | CLI 前置 | 启动检测 + 引导页 | 体验/工作量平衡，覆盖 95% 新装环境卡点 |
| Q8 | 项目机制 | 扫 `workspace/*/` + 读 `config.json.projects.{name}` 元数据 | 单一可信源，与 kata 现有约定一致 |
| Q9 | 对话流渲染 | 完整透明模式（折叠卡片）| QA 工程师看得懂工具调用，长任务期间需要进展可见性 |
| Q10 | 代码位置 | `apps/desktop/` | 与 `tools/` 区分应用层 vs 工具层 |
| Q11 | 日志归档 | 30 天滚动 + 用户标记保留 | 默认覆盖排错需求，硬上限 50MB 防失控 |
| Q12 | 实施策略 | 三段式带里程碑（M1/M2/M3） | 风险均匀、每周可 demo、契合 kata handoff 文化 |
| Q13 | 文件树 | 文件树 + 文本预览 + 拖拽注入路径 | 弥补 Spec 1 没有 viewer 的方向感缺失，但严守"无专用 viewer"边界 |

**额外约束**：

- 临时文件根：`{kata-root}/.kata/`（与最近 `.kata/ 路径迁移` commit 对齐）
- 视觉语言：Apple HIG（毛玻璃、SF Pro、8pt 网格、SF Blue）
- 打包：ad-hoc codesign（无 Developer 账号），未来补 Developer ID 签名 + notarize

## 4. 系统架构

### 4.1 总览

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React 18 + TS + Tailwind + shadcn/ui)                │
│                                                                 │
│  ┌──────────────┐  ┌────────────────────────────────────────┐   │
│  │ Sidebar      │  │ Main Pane                              │   │
│  │ - Projects   │  │ - StreamRenderer                       │   │
│  │ - Sessions   │  │ - Composer                             │   │
│  │ - FileTree   │  │                                        │   │
│  └──────────────┘  └────────────────────────────────────────┘   │
│                                                                 │
│  PreflightGate（启动闸门）                                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ IPC Bridge — invoke() / event listener                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Tauri IPC
┌──────────────────────────────┴──────────────────────────────────┐
│  Backend (Rust + Tauri 2.0)                                     │
│                                                                 │
│  preflight  │  projects  │  pty_manager  │  stream_parser       │
│  db         │  task_log  │  commands     │  state               │
└──────────────────────────────┬──────────────────────────────────┘
                               │ spawn / fs / pty
                               ▼
                       ┌──────────────────────┐
                       │ claude CLI           │
                       │ (per project, long)  │
                       └──────────────────────┘
```

### 4.2 前端 features

| feature | 内容 |
|---------|------|
| `preflight` | 启动闸门页（CLI 缺失/未登录三态引导） |
| `projects` | 侧栏项目列表 + 切换 + 元数据展示 |
| `workbench` | StreamRenderer + Composer + Workbench 布局 |
| `sessions` | 历史 sessions 列表 + 恢复入口 |
| `filetree` | 项目文件树 + 文本预览 + 拖拽注入 |

### 4.3 Rust 模块

| 模块 | 路径 | 职责 | 主要依赖 |
|------|------|------|----------|
| `preflight` | `src-tauri/src/preflight.rs` | 检测 `claude --version` / 登录态 / PATH | `std::process` |
| `projects` | `src-tauri/src/projects.rs` | 扫描 `workspace/*/`、读取 `config.json` 元数据 | `serde_json`, `walkdir` |
| `pty_manager` | `src-tauri/src/pty.rs` | 维护每项目 PTY，spawn/kill、stdin 写、stdout 读、状态机 | `portable-pty`, `tokio` |
| `stream_parser` | `src-tauri/src/stream.rs` | 逐行解析 `--output-format=stream-json` 事件 | `serde_json` |
| `db` | `src-tauri/src/db.rs` | sqlite 连接池（global + per-project）、迁移 | `rusqlite`, `r2d2` |
| `task_log` | `src-tauri/src/log.rs` | 任务 jsonl 文件写入 + GC | `tokio::fs` |
| `commands` | `src-tauri/src/commands.rs` | Tauri `#[tauri::command]` 入口，编排 | `tauri` |
| `state` | `src-tauri/src/state.rs` | AppState（活跃 PTY 句柄表、当前项目）| `tokio::sync::RwLock` |

**模块边界原则**：

- 业务逻辑只住在 Rust 模块；前端零业务，所有调用走 IPC
- Rust 模块单一职责，不交叉依赖（`pty_manager` 不知道 `db` 存在，编排在 `commands` 层）
- 状态集中在 `state.rs` 的 AppState，加 `RwLock` 防数据竞争

### 4.4 IPC 接口

```typescript
// Commands (前端 → 后端)
invoke('get_preflight_status'): PreflightStatus  // 'ready' | 'cli_missing' | 'not_logged_in'
invoke('recheck'): PreflightStatus
invoke('list_projects'): ProjectInfo[]
invoke('switch_project', { name }): void
invoke('list_recent_tasks', { project, limit }): TaskInfo[]
invoke('list_sessions', { project }): SessionInfo[]
invoke('send_input', { project, text }): TaskId  // 起 PTY（如需）+ 写 stdin
invoke('stop_task', { taskId }): void
invoke('resume_session', { project, sessionId }): TaskId
invoke('list_files', { project, path }): FileEntry[]  // 文件树用
invoke('read_file', { path }): string                 // 文本预览用
invoke('open_in_finder', { path }): void
invoke('open_with_default', { path }): void
invoke('pin_task', { taskId, pinned }): void
invoke('export_diagnostics'): string  // 复制诊断信息

// Events (后端 → 前端)
on('task:event', { taskId, event })   // stream-json 事件
on('task:status', { taskId, status }) // started | succeeded | failed | cancelled
on('pty:status', { project, state })   // PTY 级：NotSpawned | Spawning | Idle | Active | Closed
on('project:switched', { projectName })
on('session:resumed', { project, sessionId, events: [...] })
on('preflight:changed', { status })   // 例如运行中 401 失效
```

## 5. 数据流（关键路径）

### 5.1 启动 → preflight → 主界面

```
启动 Tauri app
  ↓
Rust: preflight::check()
  ├─ 探测 `claude --version`
  ├─ 探测登录态（读 ~/.claude/config.json 或 spawn `claude config get`）
  └─ 返回 PreflightStatus
  ↓
前端根据 status 路由：
  ├─ ready → 主界面
  ├─ cli_missing → 引导页 + 文档链接 + "重新检测"
  └─ not_logged_in → 引导页 + "打开终端" + "重新检测"
  ↓
（ready 路径）
Rust: projects::scan(workspaceRoot) → ProjectInfo[]
Rust: db::load_recent_active() → 上次活跃 project name
前端：渲染 Sidebar，自动选中上次项目（无则等用户选）
```

### 5.2 用户输入 → 流式输出

```
前端 Composer onSubmit(text)
  ↓
invoke('send_input', { project, text })
  ↓
Rust: pty_manager 检查 PTY 是否已起
  ├─ 未起：spawn(`claude`, ['--output-format=stream-json'], cwd=workspace/{project})
  │       → 创建 PtyHandle 存入 AppState.ptys[project]
  │       → 等待 system.init 事件拿到 session_id，写入 sessions 表
  └─ 已起：直接复用 PTY（同一 session）

无论 PTY 是否新起，每次 send_input 都创建一个新 task：
  → 创建 task: { id, project, session_id, command, started_at, log_path }
  → 打开 .kata/{project}/tasks/{taskId}.jsonl

关系：1 PTY ↔ 1 session ↔ N tasks（每次用户输入 = 一个 task = 一份 jsonl）
  ↓
Rust: pty.write_stdin(text + '\n')
  ↓
（异步循环，已在 PTY 创建时启动）
Rust: pty.read_stdout 逐行 → stream_parser::parse_line → StreamEvent
  ↓
并行：
  ├─ 写入 jsonl（一行一事件）
  └─ emit('task:event', { taskId, event })
  ↓
前端 StreamRenderer 监听：
  ├─ assistant.text → 流式追加到 markdown 渲染区
  ├─ assistant.tool_use → 新建折叠卡片（🔧 工具名 + 参数预览）
  ├─ user.tool_result → 关联到对应 tool_use 卡片
  └─ result → 底部状态条 + 写 task.ended_at + status
```

### 5.3 切换项目（PTY 不杀）

```
前端 Sidebar 点击项目 X
  ↓
invoke('switch_project', { name: 'X' })
  ↓
Rust: AppState.current_project = X
Rust: db::update_last_active(X, now())
  ↓
emit('project:switched', { projectName: 'X' })
  ↓
前端：
  ├─ 清空 Workbench 显示（不杀 PTY）
  ├─ 重新加载该项目历史 tasks
  ├─ 重新加载文件树
  └─ 加载该项目 sessions 列表
```

注：项目 A 的 PTY 不杀（保持 idle）；30 分钟无 IO 由 idle GC 任务关闭。

### 5.4 历史 session 恢复（带事件回放）

```
前端 Sidebar 「历史 Sessions」面板
  ↓
invoke('list_sessions', { project }) → SessionInfo[]
  从 .kata/{project}/tasks.db sessions 表读取
  ↓
用户点某条历史 session
  ↓
invoke('resume_session', { project, sessionId })
  ↓
Rust:
  ├─ 关闭该项目当前 PTY（若有）
  ├─ spawn(`claude`, ['--resume', sessionId, '--output-format=stream-json'])
  └─ 加载该 session 历史 jsonl 重放到前端
  ↓
emit('session:resumed', { project, sessionId, events: [...] })
  ↓
前端：清空 Workbench → 按事件序回放（不重复执行工具，纯展示）→ 用户继续输入
```

## 6. 错误处理

### 6.1 PTY 状态机（PTY 级，非 task 级）

```
NotSpawned ──input──▶ Spawning ──ok──▶ Idle ◀───┐
                          │                     │
                       fail│         input      │
                          ▼            ▼        │ result event
                        (error)     Active ─────┘
                                       │
                              exit/idle│
                                       ▼
                                    Closed ──input──▶ Spawning
```

| 状态 | 含义 | UI 表现 |
|------|------|---------|
| `NotSpawned` | 还没起过 | composer 可输入，"准备就绪" |
| `Spawning` | spawn 中 | composer 禁用 + spinner |
| `Idle` | 已起、无任务 | composer 可输入 |
| `Active` | 任务运行中 | composer 仅允许多轮回复，停止按钮可见 |
| `Closed` | 进程已退出（正常 exit / 崩溃 / idle GC 关闭） | composer 可输入（再输入触发重 spawn） |

**与 task 的关系**：状态机是 PTY 级，不是 task 级。一个 PTY 在 Active 状态下只对应 1 个 task；从 Active 回到 Idle 即该 task 结束（result 事件）。idle GC 关闭 PTY 不影响已结束 tasks 的 status。

### 6.2 故障矩阵

| 故障 | 触发 | 响应 | UI |
|------|------|------|-----|
| `claude` spawn 失败（ENOENT） | PATH 缺失 | 进入 preflight `cli_missing` | 模态："Claude CLI 不可用，请重新检测" |
| 登录态运行中失效 | stream-json 收到 401-like result | 弹登录引导 + task `failed` | toast："登录已过期，请重新登录" |
| stdin broken pipe | claude 退出但用户输入 | 转 `Closed` | 内联："会话已断开，回车重启" |
| stream-json 解析失败 | 非 JSON / schema 不匹配 | skip + warning 写 jsonl | UI 不显示，jsonl 排查 |
| claude 崩溃（非正常 exit） | exit code != 0 | task `failed`，保留 jsonl | 红色错误卡 + "查看完整日志" |
| jsonl 写失败（磁盘满） | fs Err | task `failed` + kill PTY | toast："磁盘空间不足" |
| sqlite 损坏 | rusqlite Err | 启动期引导重置；运行时降级 | 启动闸门："数据损坏，是否重置？" |
| 项目目录消失 | fs check fail | 列表移除 | toast："项目 X 不存在，已移除" |
| `workspace/` 不存在 | 启动扫描 fail | 引导配置 | 引导页："未找到 workspace/" |
| app 关闭时 Active | window close event | 拦截 + 弹确认 | "任务进行中，确定退出？" |
| idle GC 关闭 PTY | 30 分钟无 IO | 静默关闭 PTY（无 active task 时）；如有 active task 先 mark `cancelled` 再关 | 状态条："会话已休眠，下次输入将重启" |

### 6.3 设计原则

1. **失败必持久化**：先写 jsonl + sqlite，再渲染 UI；重启后能查
2. **降级优于崩溃**：sqlite 损坏 → 降级"无历史"模式仍可工作
3. **明确的恢复入口**：每个错误状态必有"下一步"按钮
4. **不静默吞错误**：除已知噪声外，unexpected error 必在 UI 露面

### 6.4 错误上报

- 所有错误写 `.kata/_desktop/errors.log`（rolling，10MB cap）
- Spec 1 不上报远端（无 telemetry）
- 「帮助 → 复制诊断信息」菜单：errors.log 最近 100 行 + preflight 状态 + tauri 版本 → 剪贴板

## 7. 数据存储

### 7.1 路径布局

```
{kata-root}/.kata/
├── {project_name}/                    # 每项目独立子目录
│   ├── tasks/{taskId}.jsonl           # 任务流式日志
│   └── tasks.db                       # sqlite：tasks + sessions 表
└── _desktop/                          # 桌面端全局（不属于任何项目）
    ├── state.json                     # 窗口位置、最近项目、preflight 缓存
    ├── ui.db                          # sqlite：projects 元数据 + 用户偏好
    └── errors.log                     # rolling 错误日志
```

### 7.2 sqlite schema

**`_desktop/ui.db`**：

```sql
CREATE TABLE projects (
  name TEXT PRIMARY KEY,
  display_name TEXT,
  path TEXT NOT NULL,
  last_active_at INTEGER,
  metadata TEXT  -- JSON：从 config.json.projects.{name} 同步
);

CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**`{project}/tasks.db`**：

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,         -- 用户输入的原始文本
  session_id TEXT,               -- 关联到 sessions 表
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL,          -- 'running' | 'success' | 'failed' | 'cancelled'
  log_path TEXT NOT NULL,        -- jsonl 相对路径
  retain_until INTEGER,          -- GC 保留截止时间戳，NULL 表示按默认 30 天
  pinned INTEGER DEFAULT 0       -- 1 = 用户标记保留，不被 GC
);

CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  first_task_id TEXT NOT NULL,
  first_input_summary TEXT,      -- 首条用户输入前 80 字符
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  task_count INTEGER DEFAULT 0
);

CREATE INDEX idx_tasks_started_at ON tasks(started_at DESC);
CREATE INDEX idx_sessions_last_active ON sessions(last_active_at DESC);
```

### 7.3 GC 策略

- **任务日志**：app 启动时扫描所有 `{project}/tasks` 表，删除 `retain_until < now() && pinned = 0` 的记录与对应 jsonl
- **任务日志硬上限**：单 jsonl > 50MB 自动截断 + 警告（防失控）
- **errors.log**：写入时滚动，保持 ≤10MB
- **session 不 GC**：session 元数据轻量，永久保留；具体任务 jsonl 才进 GC

## 8. 视觉规范（Apple HIG）

### 8.1 字体

```css
font-family:
  -apple-system,
  "SF Pro Text", "SF Pro Display",
  system-ui,
  "PingFang SC",
  sans-serif;
```

- 标题：SF Pro Display（17px+ 自动切换）
- 正文：SF Pro Text
- 等宽：SF Mono / Menlo（代码块）

### 8.2 颜色

| Token | Light | Dark |
|-------|-------|------|
| `accent` | `#007AFF` | `#0A84FF` |
| `red` | `#FF3B30` | `#FF453A` |
| `green` | `#34C759` | `#32D74B` |
| `orange` | `#FF9500` | `#FF9F0A` |
| `bg/window` | (vibrancy) | (vibrancy) |
| `bg/sidebar` | NSVisualEffectView Sidebar | NSVisualEffectView Sidebar |
| `text/primary` | `#000` (alpha 0.85) | `#FFF` (alpha 0.85) |

跟随系统主题，不提供 in-app 切换。

### 8.3 间距

8pt 网格：`4 / 8 / 12 / 16 / 24 / 32 / 48`

### 8.4 圆角

- 按钮、输入框：8px
- 卡片、面板：12px
- 模态、对话框：16px

### 8.5 动画

```css
--ease-default: cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast: 120ms;
--duration-base: 180ms;
--duration-slow: 240ms;
--duration-page: 320ms;
```

- hover/press：fast-base
- 面板切换：slow-page

### 8.6 微交互

- 列表项 hover：浅底（`bg/hover`）
- 按钮 press：缩放 0.97 + opacity 0.85
- 侧栏选中态：左侧 3px accent bar
- 流式文本：assistant 末尾光标闪烁（类 Apple Notes/Messages）

### 8.7 毛玻璃（Vibrancy）

- 接入 `tauri-plugin-window-vibrancy`
- 侧边栏：`Sidebar` material
- 主区背景：`UnderWindowBackground`
- 模态/命令面板：`HudWindow`

### 8.8 窗口

- 无边框窗口（hide titlebar buttons = false 保留 traffic light）
- 圆角 12px（macOS 系统级）
- 投影微弱（系统默认）
- 初始尺寸 1280×800，最小 1024×640

### 8.9 UI 库与图标

- 基础组件：shadcn/ui（Radix + Tailwind），主题化为 Apple 风格
- 图标：lucide-react，1.5px 描边
- 不引入 Inter / Roboto / HeroUI / Mantine

## 9. 测试策略

### 9.1 Rust 单元测试

| 模块 | 重点 |
|------|------|
| `preflight` | claude 可用/不可用、登录/未登录、损坏 config |
| `projects` | 空 workspace、含子目录、含 symlink、权限拒绝、合并 config 元数据 |
| `stream_parser` | 完整事件、半行、非 JSON、未知类型、subagent 嵌套 |
| `db` | 迁移正向/回滚、并发写、锁定恢复 |
| `task_log` | 追加、轮转、磁盘满模拟、损坏文件 |

目标：核心模块 ≥80% 行覆盖；边界 case 必覆盖。

### 9.2 Tauri command 集成测试

每个 IPC command ≥1 happy-path + 1 error-path。

关键 commands 必测：
- `list_projects` / `switch_project`
- `send_input` / `stop_task`
- `list_sessions` / `resume_session`
- `list_files` / `read_file`

### 9.3 前端组件测试

| 组件 | 重点 |
|------|------|
| `<StreamRenderer>` | 各 event 渲染、折叠展开、流式追加 |
| `<Composer>` | 回车提交、shift+enter 换行、Active 禁用 |
| `<Sidebar>` | 项目切换、空状态、最近活跃排序 |
| `<PreflightGate>` | 三种 status 各自路由 |
| `<FileTree>` | 展开折叠、双击打开、拖拽到 composer |

工具：bun test + React Testing Library；mock `invoke()`。

### 9.4 E2E 烟测

3 条端到端（Spec 1 阶段仅本地跑，CI 仅前三层）：

1. 冷启动 → preflight 引导 → 重新检测 → 主界面
2. 跑通一次任务 → 看到 assistant + tool_use + result → jsonl 落地
3. session 恢复 → 关 app → 重开 → 历史列表恢复 → 看到回放事件

### 9.5 手动验收清单

```
[ ] 全新 mac 安装 dmg，按 INSTALL 步骤（右键打开）能正常启动
[ ] codesign -dv 显示 ad-hoc 签名标识
[ ] 完成 claude login，重新检测进入主界面
[ ] 切换两个项目，cwd 跟随
[ ] 拖拽 archive/foo.md 到 composer 自动 @相对路径
[ ] 跑长任务（30s+），观察 stream 渲染顺序与折叠
[ ] 任务进行中关 app，确认弹拦截窗
[ ] 模拟磁盘满（dd 填满），任务正确失败 + 提示
[ ] kill claude 进程，状态机进 Closed，再输入触发重 spawn
[ ] 30 分钟空闲 → idle GC 关闭 PTY → UI 状态更新
[ ] 检查 .kata/{project}/tasks/{taskId}.jsonl 完整性
[ ] 暗色模式切换，毛玻璃/字体/间距视觉稳定
[ ] 复制诊断信息能拿到完整 errors.log
```

### 9.6 视觉一致性

- Storybook 单独跑组件预览，每组件 ≥4 状态（default/hover/disabled/loading）
- 设计 review 人工对照 Apple HIG 清单
- PR 截图主界面 + 引导页贴 PR 描述

## 10. 实施里程碑

三段式，每段一周（单人 + sub-agent 并行的现实工时）。

### M1（Week 1）— 地基：Preflight + 项目切换器 + 设计系统

**目标**：app 能开，能看到引导页，能切项目，但还跑不了命令。

任务：

- [ ] `apps/desktop/` 脚手架（Tauri 2.0 init + bun workspaces 接入）
- [ ] biome + tsconfig 复用根配置；`tauri.conf.json` 配置无边框窗口、12px 圆角
- [ ] **Apple HIG 设计系统基线**（关键，后两段都依赖）
  - Tailwind theme：SF System Colors、8pt 间距、自定义缓动
  - `tauri-plugin-window-vibrancy` 接入
  - 基础组件 + Storybook：`<Button>` `<Card>` `<List>` `<TextField>` `<Spinner>` `<Toast>`
- [ ] `preflight` 模块 + `<PreflightGate>`（三种状态引导页）
- [ ] `projects` 模块（扫 `workspace/*/` + 合并 config 元数据）
- [ ] `db` 模块（rusqlite + 全局 ui.db 迁移）
- [ ] `<Sidebar>` 项目列表（虚拟列表、hover/选中态）
- [ ] IPC：`get_preflight_status`、`recheck`、`list_projects`、`switch_project`

**M1 验收**：

- 全新环境装 app 看到合规引导页
- 完成 `claude login` 后重启进入主界面看到项目列表
- 切换两个项目，状态持久化
- Storybook 跑通，所有基础组件 4 状态可见
- Rust 单测 `preflight`/`projects`/`db` ≥80% 行覆盖

**推荐 sub-agent 切分**：`feature-dev:code-architect`（脚手架）+ `frontend-design`（设计系统）+ 主会话（preflight/projects/db）

### M2（Week 2）— 对话流：PTY + Stream Renderer + 文件树

**目标**：能在选定项目跑命令，看到完整 stream-json 渲染，文件树拖拽注入路径。

任务：

- [ ] `pty_manager` 模块（portable-pty + HashMap<Project, PtyHandle> 状态机）
- [ ] `stream_parser` 模块（逐行 JSON parse + schema 守卫）
- [ ] `task_log` 模块（jsonl 写入到 `.kata/{project}/tasks/{taskId}.jsonl`）
- [ ] 项目级 sqlite `.kata/{project}/tasks.db`（tasks 表迁移 + per-project pool）
- [ ] IPC：`send_input`、`stop_task`、`list_recent_tasks`、`list_files`、`read_file`、`open_in_finder`、`open_with_default`
- [ ] 事件通道：`emit('task:event', ...)`
- [ ] `<StreamRenderer>` 组件（Q9 A 完整透明）
  - 流式 markdown（react-markdown + 流式追加）
  - 代码块语法高亮（shiki，按需加载）
  - tool_use 折叠卡（🔧 工具名 + 参数预览）
  - tool_result 折叠卡（关联到 tool_use）
  - subagent 事件嵌套渲染（缩进 + 副色块）
- [ ] `<Composer>` 输入区（多行、回车提交、shift+enter 换行、Active 禁用）
- [ ] `<FileTree>` 左下角面板（虚拟列表 + 折叠 + 系统打开 + 右键菜单）
- [ ] **拖拽**：file tree → composer 自动注入 `@workspace/{project}/相对路径`
- [ ] PTY 状态机 UI 反馈

**M2 验收**：

- 选 dataAssets → `/test-case-gen examples/sample-prd.md` → 完整流式输出
- tool_use 卡片可展开/收起，tool_result 关联正确
- 任务结束 `.kata/dataAssets/tasks/{id}.jsonl` 完整存在
- 拖拽 archive/foo.md → composer 自动 `@workspace/dataAssets/archive/foo.md`
- 长任务（30s+）流式渲染不卡顿
- 暗色模式所有渲染稳定

**推荐 sub-agent 切分**：`subagent-a-agent`（pty/stream/task_log）+ `frontend-design`（StreamRenderer/Composer/FileTree）+ 主会话（IPC 编排）

### M3（Week 3）— Session 管理 + 错误恢复 + 打包

**目标**：交付可分发 ad-hoc dmg，session 列表可恢复，错误矩阵全实现。

任务：

- [ ] `sessions` 模块（每项目 tasks.db sessions 表）
- [ ] `resume_session` IPC：spawn `claude --resume <id>` + 加载历史 jsonl 重放
- [ ] `<SessionsList>` 侧栏面板（时间倒序、首条输入摘要、点击恢复）
- [ ] 错误矩阵全实现（§6.2 所有 11 项）
- [ ] **idle GC**（tokio interval，30 分钟无 IO 关闭 PTY）
- [ ] **task 日志 GC**（启动时跑一次）
- [ ] 任务详情页"📌 保留"按钮 + `pinned` 字段
- [ ] 诊断信息导出（"帮助 → 复制诊断信息"）
- [ ] **macOS 打包（ad-hoc）**
  - app icon（1024×1024 主图 + 各尺寸自动派生）
  - tauri build → dmg
  - ad-hoc codesign（`codesign --sign -`）
  - dmg 自定义背景 + 拖入 Applications 引导
  - INSTALL 文档：首次右键 → 打开（绕过 Gatekeeper 一次）
  - 提供 `xattr -dr com.apple.quarantine` 一键 fallback 脚本
- [ ] E2E 烟测（§9.4 三条路径，本地跑通）
- [ ] 手动验收清单（§9.5）全部通过

**M3 验收**：

- dmg 在干净 mac 按 INSTALL 步骤能正常启动
- `codesign -dv` 显示 ad-hoc 签名标识
- 跑一次任务 → 关 app → 重开 → 历史 sessions 点击 → 完整事件回放 + 继续输入
- 模拟所有 11 项错误，UI 响应符合 §6.2 矩阵
- E2E 三条路径本地跑通
- 手动验收清单逐项打勾

**推荐 sub-agent 切分**：`subagent-a-agent`（sessions/resume/错误矩阵）+ 主会话（打包/签名）+ `subagent-b-agent`（E2E 跑全量）

### 阶段交接物（每段尾必产）

按 CLAUDE.md「阶段收尾产出 handoff 三件套」：

1. 状态快照（测试通过数增量、git SHA、未决项）
2. 可粘贴的 handoff prompt
3. 决策清单（等用户拍板）

## 11. 与后续 Spec 的关系

整体被拆为 4 个 Spec：

| Spec | 主题 | 里程碑 |
|------|------|--------|
| **Spec 1** | 桌面端骨架 + PTY 对话流 | 本文档 |
| Spec 2 | 产物可视化中枢 | archive 浏览、xmind 渲染、报告/trace 查看器、表单触发 |
| Spec 3 | 跨项目仪表盘 + 配置面板 | 仪表盘、配置编辑、Project Rules/Knowledge 浏览 |
| Spec 4 | 协作扩展 | 多 session 并行、通知中心、导出周报、自动更新 |

**Spec 1 给后续 Spec 的契约**：

- `.kata/{project}/` 路径结构稳定
- IPC 接口风格（invoke/event）稳定
- 设计系统基线稳定（Apple HIG token）
- PTY/stream-json 解析层抽象稳定（adapter 模式）
- 项目元数据来源（`config.json.projects.{name}`）稳定

后续 Spec 不该破坏这些契约；如需破坏需单独发起破坏性变更 spec。

## 12. 风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| stream-json 格式后续变更 | 中 | `stream_parser` adapter 抽象 + 版本号守卫 + 订阅 Anthropic CLI release notes |
| Tauri 2.0 生态成熟度 | 中 | 关键能力 (PTY/notify/sqlite) 社区方案齐全；UI 层纯前端复用 React 生态 |
| Rust 学习成本 | 中 | Spec 1 Rust 代码量 <1500 行，模式化为主；外协或 sub-agent 协作 |
| 大用例 / 大文件渲染卡顿 | 中 | 虚拟列表（react-virtuoso）、流式渲染 RAF 控制、jsonl 单文件 50MB cap |
| ad-hoc 签名首次启动门槛 | 中 | INSTALL 文档清晰；提供 `xattr` 一键脚本；长期申请 Developer 账号补正式签名 |
| 三周时间表偏紧（单人） | 高 | 按 sub-agent 并行规划；时间不够时优先 M1+M2 完整，M3 削减"包装精度"（先内部用 zip） |
| Anthropic API 成本（E2E） | 低 | Spec 1 E2E 仅本地跑，CI 跑前三层不消耗 API |

## 13. 参考资料

- [Tauri 2.0 docs](https://tauri.app/)
- [Apple Human Interface Guidelines — macOS](https://developer.apple.com/design/human-interface-guidelines/macos)
- [SF Pro Font](https://developer.apple.com/fonts/)
- [tauri-plugin-window-vibrancy](https://github.com/tauri-apps/tauri-plugin-window-vibrancy)
- [portable-pty (Rust)](https://crates.io/crates/portable-pty)
- [shadcn/ui](https://ui.shadcn.com/)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [shiki (syntax highlighting)](https://shiki.matsu.io/)
- [lucide-react](https://lucide.dev/)
- [CLAUDE.md（项目规范）](../../../CLAUDE.md)
- [最近 commit `5ecbf0b refactor: .kata/ 路径迁移`](https://github.com/koco-co/kata/commit/5ecbf0b)（路径约束起源）

## 14. 术语对照

| 术语 | 含义 |
|------|------|
| skill | Claude Code 的 slash command（`~/.claude/skills/` 或项目本地） |
| subagent | skill 内派发的子 agent |
| workspace | `workspace/{project}/`，每个测试项目的独立数据目录 |
| .kata | `.kata/{project}/` + `.kata/_desktop/`，桌面端临时与状态存储根 |
| stream-json | `claude --output-format=stream-json` 的逐行 JSON 输出 |
| PTY | Pseudo-Terminal（伪终端），维持子进程交互式会话 |
| session | claude CLI 中一次连续对话上下文，可通过 `--resume` 恢复 |
| task | Spec 1 内一次"用户提交输入到任务结束"的完整事件序列，对应一份 jsonl |
| vibrancy | macOS NSVisualEffectView 提供的毛玻璃效果 |
