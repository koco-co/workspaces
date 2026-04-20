# ui-autotest · step 7 — 执行测试（全量回归）

> 由 SKILL.md 路由后加载。执行时机：步骤 6 完成后。

按 Task Schema 更新：将 `步骤 7` 标记为 `in_progress`。

> 此步骤为合并后的全量回归验证，因步骤 5 已逐条验证通过，此处预期全部通过。

根据执行范围选择 spec 文件：

```bash
# 冒烟测试
ACTIVE_ENV={{env}} QA_PROJECT={{project}} QA_SUITE_NAME="{{suite_name}}" \
  bunx playwright test workspace/{{project}}/tests/{{YYYYMM}}/{{suite_name}}/smoke.spec.ts \
  --project=chromium

# 完整测试
ACTIVE_ENV={{env}} QA_PROJECT={{project}} QA_SUITE_NAME="{{suite_name}}" \
  bunx playwright test workspace/{{project}}/tests/{{YYYYMM}}/{{suite_name}}/full.spec.ts \
  --project=chromium

# 生成 Allure HTML 报告（合并 / 回归后必跑）
npx allure generate \
  workspace/{{project}}/reports/allure/{{YYYYMM}}/{{suite_name}}/{{env}}/allure-results \
  --output workspace/{{project}}/reports/allure/{{YYYYMM}}/{{suite_name}}/{{env}}/allure-report \
  --clean
```

> 报告输出至 `workspace/{{project}}/reports/allure/{{YYYYMM}}/{{suite_name}}/{{env}}/`，含 `allure-results/`（原始数据）和 `allure-report/`（HTML 入口 `index.html`）两个子目录。

记录执行开始时间，计算 `duration`。

---

按 Task Schema 更新：将 `步骤 7` 标记为 `completed`（subject: `步骤 7 — 回归完成，{{passed}}/{{total}} 通过`）。
