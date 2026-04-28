# P7 Hooks + Script-Lint Conversion Report

> **Status**: Complete · **Date**: 2026-04-28

## §10.7 Lint 改造

| Rule | Tool | Tests | Workspace baseline |
|------|------|-------|-------|
| E1-WEAK | weak-assertion.ts | 3 | 365 (filter(Boolean) + toBeTruthy) |
| E1-PATH | hardcode-path.ts | 2 | 1 (report JSON) |
| E1-DEBUG | debug-file-naming.ts | 3 | 0 |
| E1-OWNER | owner-skill-dup.ts | 2 | 0 (M-4 already fixed) |

新增 CLI：`kata-cli cases:lint --exit-code --scope workspace` + `lint:cases` npm script.

Workspace baseline: 366 total violations (mostly `.filter(Boolean)` in test helpers, 1 E1-PATH in JSON report). **Not fixed** — detection layer only, repair deferred to user priority decision.

## §10.8 Hooks 扩展

| Hook | 文件 | 测试 | 行为 |
|------|------|------|------|
| H1 PreToolUse Edit | engine/hooks/pre-edit-guard.ts | 2 (block/allow) | 阻止 `.repos/` 写, exit 2 |
| H2 PreToolUse Bash | engine/hooks/pre-bash-guard.ts | 4 (2 block/2 allow) | 阻止 `rm -rf workspace/` + `.repos/ push` |
| H3 PostToolUse Edit | engine/hooks/post-edit-debug-naming.ts | 2 (warn/silent) | warning `*-debug.spec.ts` 应在 `.debug/`, exit 0 |
| H4 PostToolUse Edit | engine/hooks/post-edit-md-link.ts | 2 (broken/good) | warning broken md 相对链接, exit 0 |

所有 hook 支持 `KATA_BYPASS_HOOK=1` 旁路。

## P6 收尾

| 项 | 处置 |
|---|------|
| script-writer-agent 335 → 225 (A1-warn 清零) | Task 1 完成 |
| agents:audit --severity fail-only | Task 2 完成 |
| M-1 off-by-one 行数修正 | Task 2 完成 |
| M-3 orchestrator 结构性测试 | Task 2.5 完成 |
| M-4 workflow vision dispatch 补写 | Task 0 完成 |

## Test Counts

- engine: **193 pass** (168 baseline + 25 new TDD)
- agents:audit --exit-code --severity fail-only: **0**
- paths:audit --exit-code: **0**
- cases:lint --exit-code: 366 (workspace baseline, not blocking)

## 未注册的 hook

当前 `.claude/settings.json` 已注册 H1–H4 + 保留原有 Stop hook（用户已 ack）。

## Known Followups

- workspace/ 内的 weak-assertion baseline (366 violations) — 需用户优先级决策
- E2 engine API 单点封装（双写 / 校验 / 同步）延后到 P8
- SessionStart + PreToolUse-Skill 高级 hook 延后到 P8
- LOW-1: 180 fail engine baseline 仍未稳定，建议 P7.5 专项
