# E2E Test Plan — kata Desktop Shell

**Date:** 2026-04-27
**Status:** Draft
**Branch:** feat/desktop-shell-spec1

## Overview

端到端测试覆盖 kata Workbench 桌面应用的三层架构：前端 UI（React + Vite）、Rust 后端 IPC、以及外部 CLI（claude）集成。采用混合分层策略，平衡覆盖深度与执行效率。

## Architecture

```
tauri-driver (WebDriver)          Vite dev server              cargo test
      │                               │                            │
      ▼                               ▼                            ▼
  Layer 1: Critical E2E         Layer 2: Components           Layer 3: Rust IPC
  完整 Tauri 窗口                  Playwright + Vite               集成测试
  6-8 条 @critical 场景            mock IPC 调用                  真实 SQLite + mock 进程
```

## Layer 3 — Rust IPC Integration (`src-tauri/tests/`)

### cli_mock.rs

创建 mock `claude` 可执行脚本用于 PTY 集成测试。

```rust
// 通过环境变量 KATA_CLAUDE_BIN 指定 mock claude 路径
// mock 脚本接收输入行，输出 stream-json 格式回应

pub struct MockClaude {
    script_path: PathBuf,
    data_dir: TempDir,
}

impl MockClaude {
    pub fn new() -> Self {
        let dir = TempDir::new().unwrap();
        let script = dir.path().join("claude");
        fs::write(&script, MOCK_SCRIPT).unwrap();
        fs::set_permissions(&script, Permissions::from_mode(0o755)).unwrap();
        Self { script_path: script, data_dir: dir }
    }

    pub fn bin_path(&self) -> &Path { &self.script_path }
    pub fn session_id(&self) -> &str { KATA_MOCK_SESSION_ID }
}
```

**测试场景：**

| 测试 | 操作 | 断言 |
|---|---|---|
| `pty_parses_normal_output` | 启动 mock PTY → write_input("hello") → 读 reader | 收到 system.init + assistant + result 事件 |
| `pty_handles_slow_output` | 写 "slow-task" → 逐行输出中间事件 | 事件顺序正确，无丢失 |
| `pty_detects_cli_crash` | mock 中途 exit 1 | PtyState → Closed，reader 停止 |
| `pty_kill_during_active` | 启动后先 Active → kill | PtyState → Closed，reader channel 关闭 |
| `session_persistence` | send_input → 收到 session_id → 查 DB | sessions 表中存在对应记录 |

### sessions.rs

| 测试 | 操作 | 断言 |
|---|---|---|
| `create_then_list_sessions` | 创建多个 task，关联同一 session | list_sessions 返回按 last_active_at 降序 |
| `session_task_count_increments` | upsert 同 session_id 两次 | task_count 自增 |
| `task_belongs_to_session` | create_task 设 session_id → 按 session_id 查 | 返回正确任务列表 |

## Layer 2 — Component Tests (`e2e/specs/layer2-components.spec.ts`)

所有测试前：启动 Vite dev server，在每个 test 中 mock Tauri IPC。

### IPC Mock 机制

```typescript
// e2e/utils/ipc-mock.ts
export async function mockIpc(page: Page, handlers: Record<string, (...args: any[]) => any>) {
  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = {
      invoke: (cmd: string, args?: any) => {
        const handler = (window as any).__MOCK_HANDLERS__?.[cmd];
        if (!handler) throw new Error(`unmocked IPC: ${cmd}`);
        return Promise.resolve(handler(args));
      },
    };
  });
  await page.evaluate((h) => { (window as any).__MOCK_HANDLERS__ = h; }, handlers);
}
```

### Test Suites

#### PreflightGate

| 测试 | Mock | 断言 |
|---|---|---|
| 登录就绪时显示主界面 | `get_preflight_status → {kind:"ready", version:"1.2.0"}` | 子内容可见，顶部无错误提示 |
| CLI 缺失时显示安装引导 | `get_preflight_status → {kind:"cli_missing"}` | 显示 "Claude Code CLI 不可用"+ 安装文档按钮 |
| 未登录时显示登录提示 | `get_preflight_status → {kind:"not_logged_in", version:"1.2.0"}` | 显示 "尚未登录 Claude" + 打开终端按钮 |
| 重新检测按钮触发 refresh | 首次缺失 → 点击重试 → mock 返回 ready | 从 CLI 缺失状态过渡到主界面 |
| 401 事件触发 preflight 变更 | listen `preflight:changed` | store 中 status 变为 not_logged_in |

#### Composer

| 测试 | 操作 | 断言 |
|---|---|---|
| 输入文字后 submit 可用 | 输入文本 | 按钮 enabled，无 disabled 样式 |
| 空输入时 submit 禁用 | 输入框为空 | 按钮 disabled |
| 拖入 @path 注入 | fire DropEvent(`text/x-kata-relpath`) | textarea 中出现 `@path/to/file` |
| 非文件拖入不注入 | 拖入目录 entry | textarea 无变化 |

#### StreamRenderer

| 测试 | Mock 数据 | 断言 |
|---|---|---|
| 空列表显示占位 | events: [] | 显示 "等待输入" |
| assistant text 渲染 | 单条 text 事件 | 文本渲染正确 |
| tool_use 渲染 | tool_use with JSON input | 显示卡片标题 + 格式化 JSON |
| tool_result 渲染 | tool_result 文本/数组内容 | 内容展开 |
| result 显示成本徽标 | result event with cost | 显示 `$0.10` / `4200ms` |
| 大量事件虚拟滚动 | 500+ 事件 | DOM 节点数 << 事件数 |
| loading spinner | status: "running", events: [] | spinner 可见 |

#### FileTree

| 测试 | Mock | 断言 |
|---|---|---|
| 空项目显示空 | `listFiles → []` | "空目录" 文本 |
| 根目录文件列表 | `listFiles → [...]` | 文件 + 文件夹图标渲染 |
| 展开目录加载子项 | click 目录 → `listFiles` 返回子项 | 子节点渲染 + indent |
| 空子目录标记 | click → `listFiles → []` | "空目录" 占位 |
| 文件预览触发 | click 文件 | onPreview 被调用 |
| 双击文件触发 open | dblclick 文件 | `openWithDefault` 被调用 |
| 文件可拖拽 | dragstart 非目录 | `text/x-kata-relpath` data 设置 |

#### SessionsList

| 测试 | Mock | 断言 |
|---|---|---|
| 空历史显示 | `list_sessions_cmd → []` | "无历史 session" |
| 多条 session 列表 | `list_sessions_cmd → [...]` | 每条显示 summary + 时间 + task 数 |
| 超长 summary 截断 | summary 长字符串 | CSS truncate |
| Resume 触发 | click session → `resume_session` | IPC 被调用 |
| session:resumed 事件处理 | emit 事件 → store 更新 | activeTask 为 replay-xxx |

#### Modal

| 测试 | 操作 | 断言 |
|---|---|---|
| 关闭窗口弹窗 | listen `app:close-requested` → set state | Modal 渲染 + 文字正确 |
| 取消按钮关闭弹窗 | click 取消 | Modal 消失 |
| 强制退出按钮触达 stop | click 强制退出 | stop IPC 被调用 |

### 测试隔离

每个 `describe` 前：创建 page + 注入 mock IPC handler。
每个 test 后：清理 page 状态、清除 store。

## Layer 1 — Critical E2E (`e2e/specs/layer1-critical.spec.ts`)

### 基础设施

```typescript
// e2e/utils/tauri-app.ts
export async function startTauriApp(): Promise<{ app: ChildProcess; driver: WebDriver }> {
  // 1. 设置环境变量 KATA_CLAUDE_BIN / KATA_ROOT
  // 2. 启动 tauri-driver --binary target/debug/kata-workbench
  // 3. 等待 WebDriver session ready
  // 4. 返回 driver 实例
}

export async function stopTauriApp(app: ChildProcess, driver: WebDriver) {
  // 1. 关闭 WebDriver session
  // 2. kill tauri 进程 + 子进程
  // 3. 清理临时数据目录
}
```

### Test Suites

#### App Lifecycle

| # | 场景 | 步骤 | 断言 | 重试 |
|---|---|---|---|---|
| 1 | 正常启动 → Preflight ready | 启动 app（mock claude 就绪） | 侧边栏可见，workbench 提示 "请选择项目" | 1x |
| 2 | CLI 缺失 → 安装引导 | 启动 app（mock claude 不在 PATH） | "Claude Code CLI 不可用" | 1x |
| 3 | 未登录状态 | 启动 app（mock claude 返回未登录配置） | "尚未登录 Claude" | 1x |

#### Task Execution

| # | 场景 | 步骤 | 断言 | 重试 |
|---|---|---|---|---|
| 4 | 发送指令 → 渲染结果 | 选择项目 → 输入 "hello" → mock 回复 3 条事件 | StreamRenderer 显示所有事件 | 1x |
| 5 | Stop 任务 | 输入 "slow-task" → 等 5s → click stop | 状态变为 cancelled | 0x |
| 6 | 401 自动重检 | 输入 "fail-login" → mock 返回 401 | Preflight 切换为 not_logged_in | 0x |

#### Session & Navigation

| # | 场景 | 步骤 | 断言 | 重试 |
|---|---|---|---|---|
| 7 | Session 续接 | 完成 task → open SessionsList → click resume | Workbench 显示历史事件 | 1x |
| 8 | 文件树展开 | 展开目录 → hover 子目录 → 加载子项 | 子目录内容可见 | 0x |

#### Window Events

| # | 场景 | 步骤 | 断言 | 重试 |
|---|---|---|---|---|
| 9 | 关闭拦截 | 发送 "slow-task" → close window | Modal "任务进行中" 显现 | 0x |
| 10 | 强制退出 | close window → confirm 强制退出 | 窗口关闭，进程退出 | 0x |

### 测试隔离

每个 test 独立启动 tauri-driver session + 独立 temp 数据目录。test 间不共享状态。

## Test Data & Fixtures

### mock-claude.sh

路径：`e2e/fixtures/mock-claude.sh`

```bash
#!/bin/bash
# 根据输入关键词路由到不同响应路径
# 环境变量：
#   KATA_MOCK_SESSION_ID   — 固定 session_id（默认 test-sid）
#   KATA_MOCK_RESPONSE     — 强制指定响应路径
# 响应路径：
#   slow-task  — 延迟 30s 后返回 result
#   fail-login — 返回 401 错误
#   default    — 标准回复

SESSION_ID="${KATA_MOCK_SESSION_ID:-test-sid}"
TIMEOUT="${KATA_MOCK_TIMEOUT:-100}"

# 单次对话模式：读一行输入 → 输出完整回复 → 退出
IFS= read -r input_line
case "$input_line" in
  *"fail-login"*)
    echo '{"type":"system","subtype":"init","session_id":"fail-sid"}'
    echo '{"type":"assistant","message":{"content":[{"type":"text","text":"401 Unauthorized"}]}}'
    echo '{"type":"result","is_error":true,"result":"401 Unauthorized"}'
    ;;
  *)
    echo '{"type":"system","subtype":"init","session_id":"'"$SESSION_ID"'"}'
    echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Mock reply"}]}}'
    echo '{"type":"result","total_cost_usd":0.0,"duration_ms":'"$TIMEOUT"'}'
    ;;
esac
```

### Project Fixtures

```
e2e/fixtures/test-projects/
  demo-project/
    src/
      index.ts          # export const greet = (name: string) => `Hello ${name}`
      utils.ts          # export const add = (a: number, b: number) => a + b
    package.json         # { "name": "demo-project" }
    README.md
  empty-project/         # 空目录，仅 .keep
  deep-nested/
    a/b/c/
      file.txt
```

### Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `KATA_CLAUDE_BIN` | Path to mock claude binary | `e2e/fixtures/mock-claude.sh` |
| `KATA_MOCK_SESSION_ID` | Fixed session ID for assertions | `test-sid` |
| `KATA_MOCK_TIMEOUT` | result 事件中的 duration_ms | `100` |
| `KATA_DATA_DIR` | Temp .kata data directory | Auto-created `__e2e__` |
| `KATA_ROOT` | Workspace root | Auto-set to fixture path |

## CI Integration

### Workflow: `.github/workflows/e2e.yml`

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2

      - name: Install tauri-driver
        run: cargo install tauri-driver

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build

      - name: Layer 3 — Rust integration
        run: cargo test --test '*'

      - name: Layer 2 — Components
        run: |
          bun run dev &
          sleep 3
          bun playwright test --config e2e/playwright.config.ts --grep @component

      - name: Layer 1 — Critical E2E
        run: |
          KATA_CLAUDE_BIN=e2e/fixtures/mock-claude.sh \
          KATA_ROOT=$PWD/e2e/fixtures/test-projects \
            bun playwright test --config e2e/playwright.config.ts --grep @critical

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-screenshots
          path: e2e/results/
```

### Flakiness Handling

- `@flaky` tag：已知不稳定测试，CI 自动重试 1 次
- Layer 1 关键路径失败：**阻断** CI Pipeline
- Layer 2 组件测试失败：**warning**（日志 + artifact 但不阻断）

### Error Reporting

- 失败自动截图→ `e2e/results/screenshots/`
- tauri-driver 和 app stderr → `e2e/results/logs/`
- Playwright trace → `e2e/results/traces/`
- Layer 2 mock IPC 调用记录失败 → 打印未 mock 的命令名

## Debugging & Maintenance

### Local Debug Commands

```bash
# Rust 集成测试
cargo test --test sessions -- --nocapture

# Layer 2 (Vite-only)
KATA_ROOT=./e2e/fixtures/test-projects \
  bun playwright test --config e2e/playwright.config.ts --grep @component --debug

# Layer 1 (Tauri)
KATA_CLAUDE_BIN=./e2e/fixtures/mock-claude.sh \
KATA_ROOT=./e2e/fixtures/test-projects \
  bun playwright test --config e2e/playwright.config.ts --grep @critical --headed
```

### Adding New Tests

1. Layer 3（Rust）：新增 `src-tauri/tests/{module}.rs`，遵循现有 `#[test]` 模式
2. Layer 2（组件）：在 `layer2-components.spec.ts` 新增 `test`，使用 `mockIpc` helper
3. Layer 1（关键路径）：在 `layer1-critical.spec.ts` 新增 `test`，使用 `startTauriApp` helper
4. 需要真实 CLI 的测试：跳过 mock，在 CI 中标记 `@requires-cli`

### Known Gaps

- Tauri 原生对话框（文件打开/保存）不可自动化，需手动验证
- 窗口 vibrancy / 透明度效果不可在 CI 中像素断言
- `claude login` OAuth 流程不可自动化，只测 CLI 存在性检测
