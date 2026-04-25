# Phase D3 Implementation Plan — source-ref enhanced scheme + writer context switch + cleanup

> 上游：[`2026-04-25-phase-d2-workflow-merge-plan.md`](2026-04-25-phase-d2-workflow-merge-plan.md)
> 后续：D2 PR 合入 + D3 完成后，工作流彻底脱离 legacy `plan.md` 路径。
> Goal：闭合 D2 末尾"后续（Phase D3）"列出的 9 项遗留 + 用户拍板的 3 项决策，让 enhanced.md 成为唯一真相源。

**Architecture：** D3 由 5 个独立工作块组成（A→E），E 之前的块按依赖顺序串行；每块原子提交，块间允许并行 review。完成后 reviewer F16 / writer-context-builder / progress 引擎 / 文档全部脱离 legacy `plan#` / `plan.md` 兼容层。

**Tech Stack：** TypeScript (Bun), gray-matter, commander, 现有 `lib/enhanced-doc-store.ts` / `lib/source-ref.ts` / `lib/progress-store.ts`。

---

## 决策记录（与用户对齐于 2026-04-25）

| # | 决策 | 落点 |
|---|---|---|
| 1 | source-ref.ts 先于 writer-context-builder 切换；F16 切接口必须等 source-ref 实装完毕 | Block A → Block B → Block C |
| 2 | `error-handling-patterns.md` 中 transform-agent 示例彻底删除，用活跃 agent（source-facts-agent / reviewer-agent）替换；不保留为"历史参考" | Block D（cleanups） |
| 3 | `progress migrate-session` 按 artifact 存在性条件迁移：`enhanced.md` 存在 → transform/enhance task 自动 done；缺失 → 回退 discuss + 输出审计清单 | Block C-E 之间，独立块 |
| 4 | D2 的 35 个 commits 走 `refactor/phase-d2-workflow-merge` PR；D3 在独立分支 `refactor/phase-d3-source-ref-and-context` 上推进 | 见外部 git 流程，不属于本 plan |

---

## File Structure

| 类型 | 文件 | 责任 |
|---|---|---|
| **新增** | `.claude/scripts/lib/__tests__` 中补充 enhanced# resolve 用例 | 单测 |
| **修改** | `.claude/scripts/lib/source-ref.ts` | 加 `resolveEnhanced` + scheme 注册 |
| **修改** | `.claude/scripts/source-ref.ts` | CLI 加 `--prd-slug` / `--yyyymm` 选项 |
| **修改** | `.claude/scripts/writer-context-builder.ts` | 主路径读 enhanced.md，legacy `--prd <path>` 走兼容分支 |
| **修改** | `.claude/agents/reviewer-agent.md` | F16 轮零调用 `discuss validate --check-source-refs` |
| **修改** | `.claude/skills/test-case-gen/workflow/05-write.md` | writer 入口传 `--prd-slug` 而非 `--prd` |
| **新增** | `.claude/scripts/progress.ts` 内 `migrate-session` 子命令 + lib 实现 | 在途 session 迁移 |
| **删除** | `.claude/skills/test-case-gen/references/clarify-protocol.md` | 完全废弃 |
| **修改** | `.claude/references/error-handling-patterns.md` | transform-agent 示例改为 source-facts-agent |
| **修改** | `.claude/skills/test-case-gen/references/discuss-protocol.md` / `source-refs-schema.md` | 收尾清理对 clarify-protocol 的引用 |

---

## Block A — source-ref.ts enhanced# scheme（基础设施）

依赖：无。下游：Block B / Block C 都依赖 A 完成。

### Task A1：扩展 SourceRefScheme 类型

**Files：** `.claude/scripts/lib/source-ref.ts:14-21`

- [ ] **Step 1：写测试（先红）** — `.claude/scripts/__tests__/lib/source-ref.test.ts`

```typescript
test("parseSourceRef accepts enhanced scheme", () => {
  expect(parseSourceRef("enhanced#s-2-1-a1b2")).toEqual({
    scheme: "enhanced",
    anchor: "s-2-1-a1b2",
  });
  expect(parseSourceRef("enhanced#q7")).toEqual({
    scheme: "enhanced",
    anchor: "q7",
  });
});
```

- [ ] **Step 2：跑测试确认 fail** — `bun test ./.claude/scripts/__tests__/lib/source-ref.test.ts -t enhanced` 应报错（scheme 未识别）

- [ ] **Step 3：扩类型** — 把 `SourceRefScheme` 改为 `"plan" | "prd" | "knowledge" | "repo" | "enhanced"`，`SCHEMES` 数组同步加 `"enhanced"`

- [ ] **Step 4：跑测试确认 pass**

- [ ] **Step 5：commit** — `feat(source-ref): register enhanced scheme in parser`

### Task A2：实现 resolveEnhanced

**Files：** `.claude/scripts/lib/source-ref.ts:34-65`（`ResolveContext` 加 `enhancedDocPath?: string` 或 `prdSlug` + `yyyymm`），新增 `resolveEnhanced` 函数。

- [ ] **Step 1：写测试**（覆盖 6 种情况）

```typescript
test("resolveEnhanced finds anchor in enhanced.md", () => {
  // fixture：临时写一个 enhanced.md 含 <a id="s-2-1-a1b2"></a>
  const tmpDoc = writeFixtureEnhanced({ anchors: ["s-1", "s-2-1-a1b2", "q3"] });
  const r = resolveSourceRef("enhanced#s-2-1-a1b2", { enhancedDocPath: tmpDoc });
  expect(r.ok).toBe(true);
});

test("resolveEnhanced reports missing anchor", () => {
  const tmpDoc = writeFixtureEnhanced({ anchors: ["s-1"] });
  const r = resolveSourceRef("enhanced#s-9", { enhancedDocPath: tmpDoc });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("未找到");
});

test("resolveEnhanced rejects malformed anchor", () => {
  const r = resolveSourceRef("enhanced#bad anchor!", { enhancedDocPath: "/tmp/x" });
  expect(r.ok).toBe(false);
});

test("resolveEnhanced requires enhancedDocPath", () => {
  const r = resolveSourceRef("enhanced#s-1", {});
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("ctx.enhancedDocPath");
});

test("resolveEnhanced reports doc missing", () => {
  const r = resolveSourceRef("enhanced#s-1", { enhancedDocPath: "/tmp/no-such-file" });
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("不存在");
});

test("resolveEnhanced accepts q-anchors", () => {
  const tmpDoc = writeFixtureEnhanced({ anchors: ["q12"] });
  const r = resolveSourceRef("enhanced#q12", { enhancedDocPath: tmpDoc });
  expect(r.ok).toBe(true);
});
```

- [ ] **Step 2：跑测试确认全部 fail**

- [ ] **Step 3：实装 resolveEnhanced**

```typescript
function resolveEnhanced(anchor: string, ctx: ResolveContext): ResolveResult {
  if (ctx.enhancedDocPath === undefined) {
    return { ok: false, reason: "enhanced scheme 需要 ctx.enhancedDocPath" };
  }
  if (!existsSync(ctx.enhancedDocPath)) {
    return { ok: false, reason: `enhanced.md 不存在: ${ctx.enhancedDocPath}` };
  }
  // 锚点正则：s-N | s-N-M-uuid | source-facts | qN
  const validAnchor = /^(s-\d+(-\d+-[0-9a-f]{4})?|source-facts|q\d+)$/;
  if (!validAnchor.test(anchor)) {
    return { ok: false, reason: `enhanced 锚点格式非法: ${anchor}` };
  }
  const text = readFileSync(ctx.enhancedDocPath, "utf8");
  if (text.includes(`<a id="${anchor}"></a>`)) return { ok: true };
  return { ok: false, reason: `enhanced.md 未找到锚点: ${anchor}` };
}
```

并在 `resolveSourceRef` switch 内加 `case "enhanced": return resolveEnhanced(parsed.anchor, ctx);`

- [ ] **Step 4：跑测试** — 全绿

- [ ] **Step 5：commit** — `feat(source-ref): implement resolveEnhanced for enhanced.md anchors`

### Task A3：CLI 加 prd-slug / yyyymm 入口

**Files：** `.claude/scripts/source-ref.ts:19-91`、`.claude/scripts/__tests__/source-ref.test.ts`

- [ ] **Step 1：写 CLI 测试**

```typescript
test("source-ref resolve --prd-slug --yyyymm resolves enhanced anchor", () => {
  // fixture: 在 workspace/<project>/prds/<yyyymm>/<slug>/enhanced.md 中插入 <a id="s-1"></a>
  const out = runCli([
    "source-ref", "resolve",
    "--ref", "enhanced#s-1",
    "--project", "test-project",
    "--yyyymm", "202604",
    "--prd-slug", "demo",
    "--workspace-dir", tmpWorkspaceDir,
  ]);
  expect(JSON.parse(out).ok).toBe(true);
});
```

- [ ] **Step 2：跑测试确认 fail**

- [ ] **Step 3：扩 buildCtx** — 新增 `--prd-slug <slug>` / `--yyyymm <ym>` 选项；`buildCtx` 内当三者齐全时调用 `enhancedMd(project, yyyymm, slug)` 拼出 `enhancedDocPath`（直接 import `lib/paths.ts`）

```typescript
import { enhancedMd } from "./lib/paths.ts";

function buildCtx(opts: Record<string, unknown>): ResolveContext {
  const ctx: ResolveContext = {
    planPath: (opts.plan as string | undefined) ?? undefined,
    prdPath: (opts.prd as string | undefined) ?? undefined,
    projectName: (opts.project as string | undefined) ?? undefined,
    workspaceDir:
      (opts.workspaceDir as string | undefined) ?? getEnv("WORKSPACE_DIR"),
  };
  const ym = opts.yyyymm as string | undefined;
  const slug = opts.prdSlug as string | undefined;
  if (ctx.projectName && ym && slug) {
    ctx.enhancedDocPath = enhancedMd(ctx.projectName, ym, slug);
  }
  return ctx;
}
```

并在 `resolve` / `batch` 两个命令的 options 中加：
```typescript
{ flag: "--yyyymm <ym>", description: "月份（用于 enhanced scheme 自动定位 enhanced.md）" },
{ flag: "--prd-slug <slug>", description: "PRD slug（同上）" },
```

- [ ] **Step 4：跑全量** — `bun test ./.claude/scripts/__tests__` 应保持 897+ 通过（新增不退步）

- [ ] **Step 5：commit** — `feat(source-ref-cli): add --prd-slug + --yyyymm for enhanced scheme`

### Task A4：anchor-id-spec.md 状态切换

**Files：** `.claude/skills/test-case-gen/references/anchor-id-spec.md:69`

把 "旧前缀 plan#q<id>-<slug> 已于 Phase D3 前移到 enhanced#q{n}；如旧用例中仍出现，reviewer F16 放行但打 warning" 中的状态从"D3 前移"改为"D3 已完成；plan# 前缀正式 DEPRECATED，reviewer F16 检测到则按 F16 计数（不放行）"。

- [ ] **Step 1：编辑文档**
- [ ] **Step 2：commit** — `docs(anchor-id-spec): mark plan# scheme as fully deprecated post-D3`

---

## Block B — reviewer F16 切到 discuss validate（消费者 1）

依赖：Block A 完成。

### Task B1：reviewer-agent.md 轮零脚本切换

**Files：** `.claude/agents/reviewer-agent.md`（搜 "第零轮" / "F16" / "source-ref batch"）

- [ ] **Step 1：定位现行调用** — 用 `grep -n "source-ref batch\|--check-source-refs" .claude/agents/reviewer-agent.md` 找到当前 legacy dispatch 段。

- [ ] **Step 2：替换为 discuss validate 调用**

旧：
```bash
kata-cli source-ref batch --refs-json /tmp/refs.json --plan {{plan_path}}
```

新：
```bash
# 主路径：把所有 test_case 的 source_ref 拼成 csv
refs_csv=$(jq -r '[.test_cases[].source_ref] | join(",")' writer_json.json)
kata-cli discuss validate \
  --project {{project}} --yyyymm {{YYYYMM}} --prd-slug {{prd_slug}} \
  --check-source-refs "$refs_csv"
# exit 0 → 全部解析；exit 1 → issues 中 `source_ref unresolved:` 行计为 F16
```

- [ ] **Step 3：移除 legacy 备注** — 删除"或老 plan.md 解析（legacy）"注释

- [ ] **Step 4：commit** — `refactor(reviewer): F16 source_ref check switches to discuss validate`

### Task B2：六轮 review fixture 校验

**Files：** `.claude/scripts/__tests__/` 中如有 reviewer-agent 的快照，需要更新。

- [ ] **Step 1：grep `__tests__` 是否存在 reviewer 调用 source-ref batch 的 mock**
- [ ] **Step 2：若有，调整 mock 至 `discuss validate`**
- [ ] **Step 3：`bun test ./.claude/scripts/__tests__` 全绿**
- [ ] **Step 4：commit（若 Step 1 命中）** — `test(reviewer): update F16 source_ref fixture to discuss-validate path`

---

## Block C — writer-context-builder 切到 enhanced.md（消费者 2）

依赖：Block A（enhanced# scheme 已可解析；writer 在 prompt 中引用的 source_ref 必须能 resolve）。

### Task C1：加 --prd-slug / --yyyymm 入口

**Files：** `.claude/scripts/writer-context-builder.ts:283-302`

- [ ] **Step 1：写测试** — `.claude/scripts/__tests__/writer-context-builder.test.ts` 新增：

```typescript
test("build reads enhanced.md when --prd-slug + --yyyymm given", () => {
  // fixture: 创建 workspace/.../enhanced.md with §2.1 module heading + content
  const out = runWriterContextBuilder([
    "--prd-slug", "demo",
    "--yyyymm", "202604",
    "--project", "test-project",
    "--test-points", tpJsonPath,
    "--writer-id", "用户登录",
  ]);
  const ctx = JSON.parse(out);
  expect(ctx.module_prd_section).toContain("登录"); // 来自 enhanced.md §2.1
  expect(ctx.fallback).toBe(false);
});

test("build falls back to legacy --prd <path> when prd-slug missing", () => {
  // 现有 PRD 路径走 legacy
  const out = runWriterContextBuilder([
    "--prd", legacyPrdPath,
    "--test-points", tpJsonPath,
    "--writer-id", "用户登录",
  ]);
  const ctx = JSON.parse(out);
  expect(ctx.module_prd_section).toContain("登录");
});
```

- [ ] **Step 2：跑测试确认前者 fail**

- [ ] **Step 3：扩 CLI 选项 + 主路径分支**

```typescript
// commands[0].options 中追加：
{ flag: "--prd-slug <slug>", description: "PRD slug（主路径，从 enhanced.md 读模块内容）" },
{ flag: "--yyyymm <ym>", description: "月份（与 --prd-slug 配套）" },

// runBuild 顶部：
function runBuild(opts: { prd?: string; prdSlug?: string; yyyymm?: string; ... }) {
  // 主路径：enhanced.md
  let prdContent: string;
  if (opts.prdSlug && opts.yyyymm && opts.project) {
    prdContent = readEnhancedAsPrd(opts.project, opts.yyyymm, opts.prdSlug);
  } else if (opts.prd) {
    prdContent = readFileSync(resolve(opts.prd), "utf8");
  } else {
    process.stderr.write("Error: 必须提供 --prd-slug + --yyyymm + --project（主路径）或 --prd（legacy）\n");
    process.exit(1);
  }
  // ... 后续 splitPrdIntoModules 不变
}

function readEnhancedAsPrd(project: string, ym: string, slug: string): string {
  // 直接 readFileSync(enhancedMd(project, ym, slug))
  // splitPrdIntoModules 处理 ## 标题分段；enhanced.md §2 即原 PRD 模块树，可直接复用
  return readFileSync(enhancedMd(project, ym, slug), "utf8");
}
```

- [ ] **Step 4：把 `--prd <path>` 在 commands options 中标 deprecated（description 加 `[legacy]` 前缀）**

- [ ] **Step 5：跑全量测试**

- [ ] **Step 6：commit** — `feat(writer-context): read enhanced.md via --prd-slug primary path`

### Task C2：05-write.md workflow 入口切换

**Files：** `.claude/skills/test-case-gen/workflow/05-write.md`

- [ ] **Step 1：grep 当前调用** — `grep -n "writer-context-builder" .claude/skills/test-case-gen/workflow/05-write.md`

- [ ] **Step 2：替换 `--prd {{prd_path}}` → `--prd-slug {{prd_slug}} --yyyymm {{YYYYMM}}`**（保留 `--project` 不变）

- [ ] **Step 3：commit** — `refactor(workflow-write): writer-context-builder 入口切到 prd-slug`

### Task C3：workflow/05-write.md `<blocked_envelope>` 真实演练 fixture

**Files：** `.claude/scripts/__tests__/discuss.test.ts` 或新增 e2e fixture。

- [ ] **Step 1：构造 fixture session**
  - 起 session，跑到 writer 节点
  - 在 writer 内部模拟一个 unresolvable source_ref（手动改 writer_json）
  - writer 应回射 `<blocked_envelope>` → reentry_from=writing
- [ ] **Step 2：观察 progress 引擎接到 envelope 后**
  - `discuss add-pending` 自动 append（auto-revert）
  - writing task 状态切回 `pending`
- [ ] **Step 3：复查 enhanced.md §4 是否多出新 Q 区块**
- [ ] **Step 4：commit fixture（若选择固化）** — `test(writer): blocked_envelope reentry rehearsal fixture`

---

## Block D — Cleanups（与 A/B/C 并行）

依赖：无（与 A/B/C 互不冲突）。

### Task D1：删除 clarify-protocol.md

**Files：** `.claude/skills/test-case-gen/references/clarify-protocol.md`

- [ ] **Step 1：grep 引用** — `grep -rn "clarify-protocol" .claude/ docs/`
- [ ] **Step 2：清理引用**
  - `discuss-protocol.md:130` 把 "`references/clarify-protocol.md` 已标 DEPRECATED..." 整段删（已无意义）
  - `source-refs-schema.md:107` 同上整段删
- [ ] **Step 3：`rm .claude/skills/test-case-gen/references/clarify-protocol.md`**
- [ ] **Step 4：commit** — `chore(refs): delete clarify-protocol.md and dangling references`

### Task D2：error-handling-patterns.md 切换示例

**Files：** `.claude/references/error-handling-patterns.md`（行 28 / 62 / 114 / 199）

- [ ] **Step 1：评估示例** — 4 处 transform-agent 示例，分别覆盖 invalid_input / blocking_unknown / defaultable_unknown 三类。
- [ ] **Step 2：替换映射** — 用 `source-facts-agent` 作为新的活跃示例，重写：
  - 行 28 表格：`transform-agent` → `source-facts-agent`，列内 envelope 类型保持
  - 行 62 / 114 / 199 段落：把"transform-agent"全替换为"source-facts-agent"，并把示例文本（如 `"prd 缺失功能描述"` → `"源码仓库 dt-center-meta 缺 commit"`）改成新场景
- [ ] **Step 3：grep 校验** — `grep -n "transform-agent\|enhance-agent" .claude/references/error-handling-patterns.md` 应零命中
- [ ] **Step 4：commit** — `docs(error-patterns): replace transform-agent example with source-facts-agent`

### Task D3：全仓 grep 零检查

**Files：** 检查脚本（可手动跑或加 CI）

- [ ] **Step 1：跑命令**

```bash
# 应仅命中：legacy 备份目录、phase-d2 plan 文档、本 phase-d3 plan 文档
grep -rn -E "plan\.md|transform-agent|enhance-agent|append-clarify|plan_answered" .claude/ \
  | grep -vE "(__tests__|legacy|backup|phase-d2-workflow-merge-plan\.md|phase-d3-plan\.md|phase-d1-enhanced-doc-store-plan\.md|unified-discuss-document-design\.md)"
```

- [ ] **Step 2：处理零外命中** — 任何活跃文档/脚本中残留的引用，按 D1 / D2 取舍，归到对应 Block 的子任务。

- [ ] **Step 3：commit（如有）** — `chore(grep-zero): final cleanup of legacy plan/transform/enhance refs`

---

## Block E — progress migrate-session（在途 session 救援）

依赖：无；可与 A/B/C/D 并行。

### Task E1：lib 实现 migrateSession

**Files：** `.claude/scripts/lib/progress-migrator.ts`（新增 `migrateSession`）

- [ ] **Step 1：写测试** — 三场景（artifact 存在 / 缺失 / 已 done）

```typescript
test("migrateSession marks transform/enhance done when enhanced.md exists", () => {
  const session = createTestSession({ tasks: ["transform", "enhance", "discuss"] });
  writeEnhancedMd(session); // 模拟产物
  const report = migrateSession(session.id);
  expect(report.action).toBe("auto-done");
  expect(getTask(session.id, "transform").status).toBe("completed");
  expect(getTask(session.id, "enhance").status).toBe("completed");
});

test("migrateSession reverts to discuss when enhanced.md missing", () => {
  const session = createTestSession({ tasks: ["transform", "enhance", "discuss"] });
  // 不写 enhanced.md
  const report = migrateSession(session.id);
  expect(report.action).toBe("revert-to-discuss");
  expect(getTask(session.id, "discuss").status).toBe("pending");
});

test("migrateSession is idempotent on already-migrated session", () => {
  const session = createTestSession({ tasks: ["discuss", "analyze"] }); // 无 transform/enhance
  const report = migrateSession(session.id);
  expect(report.action).toBe("noop");
});
```

- [ ] **Step 2：跑确认 fail**

- [ ] **Step 3：实装**

```typescript
export interface MigrateSessionReport {
  sessionId: string;
  action: "auto-done" | "revert-to-discuss" | "noop";
  details: string[];
}

export function migrateSession(sessionId: string): MigrateSessionReport {
  const session = readSession(sessionId);
  const hasTransform = session.tasks.some(t => t.id === "transform");
  const hasEnhance = session.tasks.some(t => t.id === "enhance");
  if (!hasTransform && !hasEnhance) {
    return { sessionId, action: "noop", details: ["session has neither transform nor enhance task"] };
  }
  const enhancedPath = enhancedMd(session.project, session.yyyymm, session.prdSlug);
  if (existsSync(enhancedPath)) {
    if (hasTransform) updateTask(sessionId, "transform", { status: "completed" });
    if (hasEnhance) updateTask(sessionId, "enhance", { status: "completed" });
    return { sessionId, action: "auto-done", details: [`enhanced.md exists: ${enhancedPath}`] };
  }
  // revert: discuss task 重置为 pending（保留 progress 数据），删 transform/enhance
  if (hasTransform) removeTask(sessionId, "transform");
  if (hasEnhance) removeTask(sessionId, "enhance");
  updateTask(sessionId, "discuss", { status: "pending" });
  return { sessionId, action: "revert-to-discuss", details: ["enhanced.md missing; user must redo discuss"] };
}
```

- [ ] **Step 4：跑测试全绿**

- [ ] **Step 5：commit** — `feat(progress): migrate-session lib with artifact-aware strategy`

### Task E2：CLI 子命令

**Files：** `.claude/scripts/progress.ts`

- [ ] **Step 1：注册子命令**

```typescript
{
  name: "migrate-session",
  description: "迁移在途 session（按 enhanced.md 存在性 auto-done 或 revert）",
  options: [
    { flag: "--session-id <id>", description: "目标 session id；不传则迁移所有未完成 session" },
    { flag: "--dry-run", description: "只输出报告不落盘", defaultValue: false },
  ],
  action: (opts: any) => {
    const ids = opts.sessionId ? [opts.sessionId] : listSessions().map(s => s.id);
    const reports = ids.map(id => migrateSession(id, { dryRun: !!opts.dryRun }));
    emit({ migrated: reports });
  },
},
```

并在 `lib/progress-migrator.ts` 的 `migrateSession` signature 加 `opts?: { dryRun?: boolean }`

- [ ] **Step 2：补 CLI 测试**

- [ ] **Step 3：commit** — `feat(progress-cli): migrate-session subcommand`

### Task E3：真实在途迁移演练

**Files：** 无（操作步骤）

- [ ] **Step 1：列出当前 workspace 中所有未完成 session** — `kata-cli progress list-sessions --status active`
- [ ] **Step 2：dry-run** — `kata-cli progress migrate-session --dry-run`
- [ ] **Step 3：审计输出** — 用户确认 auto-done / revert 名单后，再去 `--dry-run` 跑实际迁移
- [ ] **Step 4：commit 演练记录到本 plan 末尾"演练日志"段（可选）**

---

## Block F — discuss migrate-plan 真实跑 + 回归

依赖：Block A 完成（确保 migrate 后的 enhanced.md 立即可被 source-ref 解析）

### Task F1：discuss migrate-plan 去 dry-run

**Files：** 操作命令，无代码改动。

- [ ] **Step 1：列举 workspace 中残留的 plan.md 文件** — `find workspace -name plan.md -not -path "*/.repos/*"`
- [ ] **Step 2：每个文件跑 dry-run** — `kata-cli discuss migrate-plan --project X --yyyymm Y --prd-slug Z --dry-run`
- [ ] **Step 3：用户审计后跑实际迁移** — 同上去 `--dry-run`
- [ ] **Step 4：跑 `discuss validate` 确认 enhanced.md 6 项校验全过**
- [ ] **Step 5：legacy plan.md 备份目录归位**（migrator 默认产物 `plan.md.legacy.bak`）

### Task F2：回归一轮真实 PRD → 用例全流程

**Files：** 无（端到端验证）

- [ ] **Step 1：选一份小型 PRD**（建议从最近 hot fix 或样例）
- [ ] **Step 2：起新 session** — `kata-cli progress session-create --workflow test-case-gen ...`
- [ ] **Step 3：依次跑** — 1-init → 2-probe → 3-discuss（add-pending / resolve / set-source-facts）→ 4-analyze → 5-write → 6-review → 7-format-check → 8-output
- [ ] **Step 4：观察指标**
  - F16 触发数（应为 0，所有 source_ref 都 enhanced# 指向 enhanced.md 真实锚点）
  - reviewer 问题率
  - XMind 输出可打开
- [ ] **Step 5：把演练数据贴进本 plan 末尾"演练日志"**

---

## Acceptance（D3 收尾自检）

- [ ] `bun test ./.claude/scripts/__tests__` 全绿（基线 897 → ~920+，新增 5+ 用例）
- [ ] `grep -rE "plan\.md|transform-agent|enhance-agent|append-clarify|plan_answered" .claude/` 仅命中 phase-d* plan 文档与 legacy backup
- [ ] `find .claude -name clarify-protocol.md` 零命中
- [ ] `kata-cli source-ref resolve --ref "enhanced#s-1" --project X --yyyymm Y --prd-slug Z` 可用
- [ ] reviewer F16 第零轮调用栈中无 `source-ref batch --plan` 字样
- [ ] writer-context-builder 默认入口为 `--prd-slug`，legacy `--prd` 仍兼容但 description 标 `[legacy]`
- [ ] 一轮真实 PRD 跑通，产出 Archive MD + XMind

---

## 演练日志（执行期间填）

> 跑完 Block F 后回填：session id / 触发的 F16 数 / 问题率 / 用时。

---

## 后续（Phase D4）

D3 完成后唯一遗留：legacy `plan` scheme（`source-ref.ts` 的 `resolvePlan`）的最终下线。建议 D3 收尾跑一轮"全仓 source_ref 0 个 plan# 前缀"再删 `resolvePlan` 与 `--plan` CLI 选项。
