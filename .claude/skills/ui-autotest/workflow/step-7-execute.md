# ui-autotest · step 7 — 执行测试（全量回归）

> 由 SKILL.md 路由后加载。执行时机：步骤 6 完成后。

按 Task Schema 更新：将 `步骤 7` 标记为 `in_progress`。

> 此步骤为合并后的全量回归验证，因步骤 5 已逐条验证通过，此处预期全部通过。

根据执行范围选择 spec 文件：

```bash
# 冒烟测试
ACTIVE_ENV={{env}} QA_PROJECT={{project}} QA_SUITE_NAME="{{suite_name}}" \
  bun run .claude/scripts/run-tests-notify.ts \
  workspace/{{project}}/tests/{{YYYYMM}}/{{suite_name}}/smoke.spec.ts \
  --project=chromium

# 完整测试
ACTIVE_ENV={{env}} QA_PROJECT={{project}} QA_SUITE_NAME="{{suite_name}}" \
  bun run .claude/scripts/run-tests-notify.ts \
  workspace/{{project}}/tests/{{YYYYMM}}/{{suite_name}}/full.spec.ts \
  --project=chromium
```

> **必须使用 `run-tests-notify.ts` 包装器**：直接调用 `bunx playwright test` 只会执行测试，**不会**刷新 Allure HTML 报告、**不会**发送钉钉通知。包装器会在测试结束后自动生成 `allure-report/` 并推送 IM 卡片。如需临时跳过通知，加 `SKIP_NOTIFY=1`；跳过报告生成加 `SKIP_ALLURE_GEN=1`。
>
> 报告输出至 `workspace/{{project}}/reports/allure/{{YYYYMM}}/{{suite_name}}/{{env}}/`，含 `allure-results/`（原始数据）和 `allure-report/`（HTML 入口 `index.html`）两个子目录。

**并发执行（可选，加速全量回归）**：默认串行，用例多时可开启并发：

```bash
PW_FULLY_PARALLEL=1 PW_WORKERS=4 \
  ACTIVE_ENV={{env}} QA_PROJECT={{project}} QA_SUITE_NAME="{{suite_name}}" \
  bun run .claude/scripts/run-tests-notify.ts \
  workspace/{{project}}/tests/{{YYYYMM}}/{{suite_name}}/full.spec.ts \
  --project=chromium
```

- `PW_FULLY_PARALLEL=1`：开启同文件内并发（Playwright 的 `fullyParallel` 模式）
- `PW_WORKERS=N`：worker 数量；不设置时 Playwright 默认 CPU/2
- **数据冲突前置检查**：开并发前确认测试用 `uniqueName()` 生成隔离标识、前置数据（数据源/质量项目）已提前创建好可复用，避免多 worker 抢占同名资源

记录执行开始时间，计算 `duration`。

---

按 Task Schema 更新：将 `步骤 7` 标记为 `completed`（subject: `步骤 7 — 回归完成，{{passed}}/{{total}} 通过`）。
