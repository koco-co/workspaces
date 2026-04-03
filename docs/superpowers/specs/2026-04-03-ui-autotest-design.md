# UI 自动化测试集成设计文档

**日期**：2026-04-03
**状态**：待实施
**技术栈**：TypeScript + Playwright v1.50+ + claude-in-chrome MCP

---

## 一、背景与目标

在现有 qa-flow 工作流（PRD → 用例生成 → XMind 归档）基础上，集成 WebUI 自动化测试能力。当用户收到前端提测分支后，系统自动将 MD 测试用例转化为可执行的 Playwright 脚本，由多个 Sub-Agent 并行完成「页面探索 → 脚本编写 → 执行验证」，最终输出测试报告、更新 MD 用例并重新生成 XMind。

---

## 二、整体架构

### 新增 Skill：`ui-autotest`

**触发词**：`UI自动化测试`、`自动化回归`、`执行UI测试`、`生成测试脚本`、`e2e回归`

### 三个角色分工

```
用户
 │
 ▼
主 Agent（Orchestrator）
 ├── 管理动态任务队列（最多 5 个 sub-agent 并发）
 ├── 与用户双向通信（确认 URL、分支、中转子 agent 问题）
 ├── 维护全局进度状态文件
 └── 收尾：合并脚本 → 更新 MD → 重新生成 XMind → Bug 报告 → 通知
      │
      ├── Sub-Agent × N（Script-Writer，最多 5 个并发）
      │    ├── claude-in-chrome MCP 创建专属 Tab 探索页面
      │    │    ├── tabs_create_mcp → 新建 Tab
      │    │    ├── navigate → 导航到目标功能页
      │    │    ├── read_page / find / get_page_text → 读取 DOM
      │    │    └── computer → 截图确认页面状态
      │    ├── 读 .repos/ 前端源码定位精确 selector
      │    ├── 写 TypeScript test() 代码块
      │    ├── 执行 npx playwright test（有头模式）验证
      │    ├── 监听 network requests，捕获后端 API 异常
      │    ├── 失败时：computer 截图诊断 → 修正 selector → 重试一次
      │    └── 返回 SubAgentResult（completed / blocked / failed）
      │
      └── Sub-Agent（Bug-Reporter，收尾阶段按需触发）
           ├── 分析失败接口（curl 信息 + 后端源码）
           ├── 两级策略：源码定位分析 / 兜底复现包
           └── 写 Bug 报告到 reports/e2e/YYYYMM/
```

---

## 三、数据流

### 输入
- `cases/archive/YYYYMM/【功能名】.md`（已有 MD 用例）
- 目标访问 URL（用户提供）
- 前端提测分支 + 后端提测分支（用户确认）

### 任务粒度：以 L3 页面为单位

MD 中每个 `###` 层级（如「列表页」「新增页」）作为一个任务单元，分配给一个 Sub-Agent：

```
## 商品管理                          → L2 模块
  ### 列表页          ← 任务 A       → tests/e2e/202604/商品管理/列表页（块）
      ##### 【P0】验证默认加载
      ##### 【P1】验证搜索筛选
  ### 新增页          ← 任务 B       → tests/e2e/202604/商品管理/新增页（块）
      ##### 【P0】验证必填项校验
```

### 输出文件（每个需求固定两个 spec）

```
tests/e2e/YYYYMM/【功能名】/
  ├── smoke.spec.ts    # 仅含 P0 用例（快速冒烟）
  └── full.spec.ts     # 含 P0 + P1 + P2 全量用例（完整回归）
```

**优先级分配规则**：
- `【P0】` → smoke.spec.ts + full.spec.ts
- `【P1】` → full.spec.ts 独有
- `【P2】` → full.spec.ts 独有

### Sub-Agent 代码块合并策略

Sub-agent 按 L3 页面并行工作，各自输出 `test()` 代码块，由主 agent 在收尾阶段统一合并写入两个 spec 文件，避免多 agent 同时写同一文件。

### 重跑策略

已存在的 spec 文件默认**覆盖**（overwrite）。重跑时状态文件同步重置，所有任务恢复为 `pending`。

---

## 四、新增目录结构

```
qa-flow/
├── playwright.config.ts                     # Playwright 全局配置（新增）
├── .auth/
│   └── session.json                         # 登录态存储（gitignore，不提交）
├── tests/
│   └── e2e/
│       └── YYYYMM/
│           └── 【功能名】/
│               ├── smoke.spec.ts
│               └── full.spec.ts
├── reports/
│   └── e2e/
│       └── YYYYMM/
│           └── 【功能名】-e2e-report.html
└── .claude/
    └── skills/
        └── ui-autotest/
            ├── SKILL.md
            ├── prompts/
            │   ├── 00-orchestrator.md       # 主 agent 编排提示词
            │   ├── 01-script-writer.md      # Script-Writer 子 agent 提示词
            │   └── 02-bug-reporter.md       # Bug-Reporter 子 agent 提示词
            └── scripts/
                ├── parse-md-cases.mjs       # MD → 任务队列解析
                ├── session-login.mjs        # 登录 + 保存 storageState
                └── merge-spec-blocks.mjs    # 合并代码块 → 写 spec 文件
```

---

## 五、Sub-Agent 通信协议

### 返回契约（SubAgentResult）

每个 Script-Writer Sub-Agent 执行完毕返回统一结构：

```typescript
interface SubAgentResult {
  pageId: string;              // e.g. "列表页"
  status: "completed" | "blocked" | "failed";

  smokeBlocks: string[];       // P0 test() 代码块
  fullBlocks: string[];        // P0+P1+P2 全部 test() 代码块

  mdCorrections: {
    caseTitle: string;
    field: "step" | "expected" | "precondition";
    before: string;
    after: string;
  }[];

  userQuestions: {
    id: string;
    caseTitle: string;
    question: string;
  }[];

  failedCases: {
    caseTitle: string;
    errorMsg: string;
    screenshotPath: string;
    networkRequests: {
      url: string;
      method: string;
      requestHeaders: Record<string, string>;
      requestBody: string;
      responseStatus: number;
      responseBody: string;
    }[];
  }[];
}
```

### 用户问题中转协议

1. Sub-agent 返回 `status: "blocked"` + `userQuestions`
2. 主 agent 将问题汇总后逐条向用户呈现（带用例上下文）
3. 用户回答后，答案写入状态文件 `userAnswers` 字段
4. 任务变为 `answered` 状态，下轮循环重新分发（携带答案作为上下文）

### 状态文件格式

```jsonc
// cases/prds/YYYYMM/.qa-state-ui-【功能名】.json
{
  "version": "1.0",
  "url": "https://xxx.dtstack.cn",
  "branches": {
    "frontend": { "repo": "dt-insight-studio-front", "branch": "feature/xxx" },
    "backend": [{ "repo": "dt-center-assets", "branch": "feature/xxx" }]
  },
  "queue": [
    {
      "id": "列表页",
      "specFile": "tests/e2e/202604/【功能名】/",
      "cases": ["验证默认加载", "验证搜索筛选"],
      "status": "pending",        // pending|running|passed|failed|blocked|answered
      "attempts": 0,
      "mdUpdated": false,
      "userQuestions": [],
      "userAnswers": []
    }
  ],
  "summary": { "total": 18, "passed": 0, "failed": 0, "pending": 18 }
}
```

---

## 六、错误处理与 Bug 报告

### 错误来源定位

测试失败的主要原因来自**后端接口异常**，而非前端交互问题。网络监听在 Playwright 脚本内部完成（`page.on('response', ...)`），而非通过 MCP（MCP 与 Playwright 运行在不同的浏览器进程中）：

```typescript
// 每个 test() 内部自动注入网络监听
const failedRequests: NetworkEntry[] = []
page.on('response', response => {
  if (response.status() >= 400) {
    failedRequests.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
      requestHeaders: response.request().headers(),
      requestBody: response.request().postData() ?? '',
      responseBody: '<待 test 结束后读取>',
    })
  }
})
```

```
test() 执行过程中
  ├── page.on('response') 监听 API 响应（Playwright 内部）
  └── 用例断言失败
        ├── failedRequests 有 4xx/5xx  → 收集完整请求信息 → Bug-Reporter
        ├── failedRequests 为空         → selector 问题（脚本修正，重试）
        └── 页面无响应/白屏             → 环境问题（中转用户）
```

### 失败重试上限

每个用例最多 2 次（首次 + selector 修正后重试），仍失败则上报 Bug-Reporter。

### 分支确认（多仓库）

主 agent 向用户一次性确认前端分支 + 后端分支（通常一个后端，可多个）及目标 URL，用户确认部署完成后才开始拉取源码。

### Bug-Reporter 两级策略

**策略一（源码定位）**：
- 提取失败接口路径 → 在后端 .repos/ 中定位 Controller → Service → 关键逻辑
- 结合请求参数推断错误根因 → 生成根因分析报告

**策略二（兜底复现包，无法定位时）**：
- 详细复现步骤（从登录到触发错误的完整操作）
- 完整 curl 命令（含 Cookie、Authorization 等敏感 Header）
- 请求 Body + 响应 Body（完整 JSON）
- 错误截图

**报告输出**：`reports/e2e/YYYYMM/【功能名】-e2e-report.html`（与现有 `reports/bugs/` 格式一致）

---

## 七、MD 反向更新机制

### 常见修正类型

| 类型 | 示例 |
|------|------|
| 按钮文本 | MD 写「新增」，实际按钮为「创建」 |
| 导航路径 | MD 写「商品管理 → 列表」，实为「商品管理 → 商品列表」 |
| 预期结果 | MD 写「保存成功」，实为「操作成功」 |
| 缺失前置条件 | 发现需要先开启某个开关才能操作 |

### 写回规则

- 仅修改有差异的字段，其余内容保持原样
- 每处修正附加注释：`<!-- auto-corrected by ui-autotest {YYYY-MM-DD} -->`（日期动态填写）
- 修正完成后向用户输出变更摘要

### 触发 XMind 重新生成

MD 有任何变更时，调用 `xmind-converter` skill 覆盖对应 XMind 文件。

---

## 八、完整首次交互流程

```
① 主 Agent 读取 MD → 解析用例 → 推断仓库分支

② 一次性向用户确认（URL + 前端分支 + 后端分支 + 部署状态）

③ 用户确认部署完成

④ 并行准备
   ├── git pull 前端源码
   ├── git pull 后端源码（可多个）
   └── session-login.mjs → .auth/session.json

⑤ 写入初始状态文件

⑥ 编排循环
   ├── 分发 Script-Writer Sub-Agent（≤5 并发）
   ├── 动态接收结果 → 更新状态 → 分发下一任务
   └── blocked 任务 → 中转用户 → 重新分发

⑦ 收尾
   ├── 合并 code blocks → smoke.spec.ts + full.spec.ts
   ├── 应用 mdCorrections → 更新 MD
   ├── MD 有变更 → xmind-converter 重新生成 XMind
   ├── 有 failedCases → Bug-Reporter → HTML 报告
   └── notify.mjs --event ui-test-completed

⑧ 向用户输出汇总（通过/失败统计 + 产物路径）
```

---

## 九、Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    headless: false,
    storageState: '.auth/session.json',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: process.env.QA_BASE_URL,
  },
  reporter: [
    ['html', { outputFolder: 'reports/e2e/playwright-html' }],
    ['list']
  ],
  workers: 1,
})
```

---

## 十、环境初始化检查（首次运行）

| 检查项 | 缺失时处理 |
|--------|-----------|
| `playwright.config.ts` | 自动生成默认配置 |
| `@playwright/test` 已安装 | `npm install -D @playwright/test` |
| Chromium 已安装 | `npx playwright install chromium` |
| `.env` 含 `QA_USERNAME` / `QA_PASSWORD` | 提示用户填写 |
| `.auth/` 在 `.gitignore` | 自动追加 |

---

## 十一、通知事件

沿用 `notify.mjs`，新增事件类型：

| 事件 | 触发条件 | 必需 data 字段 |
|------|----------|---------------|
| `ui-test-completed` | 全部用例执行完成 | `passed`, `failed`, `specFiles`, `reportFile`, `duration` |
| `workflow-failed` | Skill 执行异常中断 | `step`, `reason` |
