# UI 自动化 — 硬规则清单

> 本文件由 rule-loader 自动并入 ui-autotest sub-agent 上下文。违反任何一条都会导致脚本撞坑。详细背景见 `workspace/dataAssets/knowledge/pitfalls/2026-04-27-*.md`。

## A. 选择器（Locator）

- A1 [禁] `ruleForm.locator(".rule__function-list__item")` 是 legacy DOM
  - 正例：双路径回退
    ```ts
    const legacy = ruleForm.locator(".rule__function-list__item .ant-select").first();
    const inline = ruleForm.locator(".ant-form-item").filter({ hasText: /统计函数/ }).first().locator(".ant-select").first();
    await expect.poll(async () =>
      (await legacy.isVisible().catch(() => false)) ||
      (await inline.isVisible().catch(() => false)),
      { timeout: 10000 }
    ).toBe(true);
    const select = (await legacy.isVisible().catch(() => false)) ? legacy : inline;
    ```

- A2 [禁] `.ant-form-item` filter `/字段/` 会误命中"字段级"（规则类型行的标签也含"字段"二字）
  - 正例：用 `/^字段/` 精确匹配
    ```ts
    const fieldFormItem = ruleForm.locator(".ant-form-item").filter({ hasText: /^字段/ }).first();
    ```

- A3 [必] 校验方法 select 不在 `.rule__function-list__item` 内，需在 ruleForm 顶层 form-item 找
  - 正例：`ruleForm.locator(".ant-form-item").filter({ hasText: /校验方法/ }).locator(".ant-select").first()`

- A4 [必] 选择"统计函数 = 完整性校验"后，必须先选「规则类型 = 字段级」才会渲染统计函数下拉
  - 正例：addRuleToPackage 后立即检查规则类型 select 是否可见，可见则选「字段级」

- A5 [必] TreeSelect / 校验内容下拉的容器在新版 UI 不在 functionRow 内，需要 ruleForm fallback：
    ```ts
    const trigger = await functionRowTreeSelect.isVisible({ timeout: 2000 })
      ? functionRowTreeSelect
      : ruleForm.locator(".ant-tree-select").first();
    ```

## B. Test Fixture / API

- B1 [禁] `const x = await step('...', async () => { ... return ... })` — `step` fixture 不返回 callback 值
- B2 [必] step 内赋值用闭包变量：
    ```ts
    let ruleForm!: import("@playwright/test").Locator;
    await step('步骤 N: ...', async () => {
      ruleForm = await addKeyRangeRule(page, packageName);
      await expect(ruleForm).toContainText("...");
    });
    ```
- B3 [必] 每个测试文件必须 `test.setTimeout(600000)`，否则默认 60s 跑不完含等待的 case

## C. 数据 / 项目 ID / 数据源

- C1 [禁] 硬编码 `QUALITY_PROJECT_ID = 90` 直接传给 API；必须 `await resolveEffectiveQualityProjectId(page)` 动态解析（实际可能是 92）
- C2 [禁] datasource keyword `spark|thrift`；必须含 `hadoop`（LTQC 环境的 SparkThrift 集群名为 `pw_test_HADOOP`）
  - 正例：`SPARKTHRIFT_DATASOURCE_KEYWORD = "spark|thrift|hadoop"`
- C3 [必] SparkThrift2.x **不支持** JSON 字段：表 DDL 用 `STRING` + JSON 字符串内容
  - 反例：`info JSON` ❌
  - 正例：`info STRING` + `INSERT ... '{"key1":"张三"}'`
- C4 [必] Doris3.x 支持 JSON 也支持 STRING：表 DDL 优先 JSON、回退 `VARCHAR(65533)`
- C5 [必] LTQC 环境的 quality 项目名为 `pw_test`（dt_tenant_name），不是 ltqcdev 环境的 `DT_demo`

## D. Preconditions / SDK 形态

- D1 [必] `setupPreconditions(page, opts)` 通过 `helpers/preconditions.ts` 适配层调 `precondSetup`；旧字段名映射：
  - `datasourceType` → `datasource`
  - `projectName` → `project`
- D2 [必] 通过 `createClient(page)` 或 `createClientFromPage(page)` 从 page 构造 client，再调 SDK
- D3 [必] runPreconditions 默认重试 3 次，遇 metadata sync timeout 视为成功（数据已同步）

## E. UI 流程隐式依赖

- E1 [必] 新增"完整性校验"规则后必须先选「规则类型 = 字段级」，「统计函数」select 才会渲染（与 A4 重复，强调）
- E2 [必] 选择字段后再切统计函数为"key范围校验"，字段会保留首个选中（验单选回退保留首项的设计）
- E3 [必] 校验内容 TreeSelect 必须等 `.ant-tree-select-dropdown:visible` 出现再勾选

## F. 环境变量 / 命令行

- F1 [必] 跑测试必须传：
    ```bash
    QA_PROJECT=dataAssets QA_SUITE_NAME=<suite-slug> ACTIVE_ENV=ltqc \
      UI_AUTOTEST_SESSION_PATH=$(pwd)/.auth/dataAssets/session-ltqc.json \
      bunx playwright test "<spec path>" --reporter=list --workers=1
    ```
- F2 [必] LTQC 环境对应 `pw_test` 租户；ltqcdev 环境对应 `DT_demo` 租户。本 suite 期望 `pw_test`，必须用 ltqc

## 关联背景文档

详细的撞坑过程、根因分析、复现步骤见：
- `workspace/dataAssets/knowledge/pitfalls/2026-04-27-*.md`（每个 fix 一篇）
