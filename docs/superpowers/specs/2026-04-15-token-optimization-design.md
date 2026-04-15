# Token 消耗优化设计方案

## 概述

对 qa-flow 全部工作流（test-case-gen、ui-autotest、code-analysis）进行系统性 token 消耗优化。通过提取共享 reference 文档、新增预处理脚本、精简 agent/skill 提示词、优化数据流四个层面，预计总体节省 30-40% token 消耗。

## 关键决策

| 决策项 | 选择 | 原因 |
|--------|------|------|
| format-checker-agent | 分层处理：脚本处理纯格式规则，haiku 只做语义类二次检查 | FC04/FC06 有语义理解成分 |
| 图片 OCR 脚本化 | 跳过 | enhance 节点图片识别是核心价值 |
| references 目录位置 | `.claude/references/` | 与 agents/skills/scripts 平级，保持 .claude 内聚 |
| 实施策略 | 按层实施（reference → agent/skill → scripts → 数据流） | reference 一次成型，后续改动有统一基础 |

---

## Section 1：Reference 文档体系

在 `.claude/references/` 下创建共享文档：

### 1.1 test-case-standards.md

统一规则集，合并去重：
- **FC01-FC11**（原 format-checker-agent 137行）
- **R01-R11**（原 writer-agent 200行）
- **F07-F15**（原 reviewer-agent 84行）

规则按编号统一编排，用表格格式替代散文。每条规则包含：规则 ID、规则名、检查条件、正例、反例、适用 agent。

### 1.2 output-schemas.json

集中定义所有 agent 的 JSON 输出 schema：
- `test_points_json` — analyze-agent 输出
- `writer_json` — writer-agent 输出
- `review_json` — reviewer-agent 输出
- `format_check_json` — format-checker-agent 输出
- `standardize_json` — standardize-agent 输出
- `bug_report_json` — bug-reporter-agent 输出
- `script_fixer_json` — script-fixer-agent 输出
- `backend_bug_json` / `frontend_bug_json` / `conflict_json` — code-analysis 系列 agent 输出

### 1.3 error-handling-patterns.md

标准错误分类与恢复策略矩阵：

| 错误类型 | 描述 | 恢复策略 |
|----------|------|----------|
| invalid_input | 输入格式不合法 | 输出警告，跳过该条目继续 |
| blocking_unknown | 无法推断的关键信息 | 生成 blocked_envelope，中止当前条目 |
| defaultable_unknown | 可推断或有默认值 | 使用默认值并标记 warning |
| external_failure | 外部依赖（网络/文件/服务）失败 | 重试 1 次，失败则报错中止 |

消除 6 个 agent 各自 14-17 行的重复错误处理段落。

### 1.4 unicode-symbols.md

符号使用规范：
- 允许范围：U+2600-U+26FF（杂项符号）
- 禁止范围：U+1F000-U+1FFFF（emoji）
- 映射表：对勾/叉/警告/箭头等常用符号的规范写法

消除 code-analysis SKILL.md + 4 个 bug/conflict agent 的重复。

### 1.5 playwright-patterns.md

Playwright 最佳实践：
- 4 层定位器优先级（getByRole > getByLabel > getByTestId > CSS）
- 常见 UI 模式代码片段（表单填写、表格验证，仅保留这两个高错率模式）
- step() 函数用法规范
- 等待策略

消除 script-writer-agent(65行) + script-fixer-agent 的重复，同时消除 ui-autotest SKILL.md 中的代码模板。

---

## Section 2：新增脚本

### 2.1 format-check-script.ts

**用途：** 纯格式规则的确定性检查，替代 format-checker-agent 70% 的工作。

**接口：**
```bash
bun run .claude/scripts/format-check-script.ts check \
  --input <archive-md-path> \
  --rules .claude/references/test-case-standards.md \
  --output json
```

**输出：**
```json
{
  "definite_issues": [
    { "rule": "FC01", "case_idx": 3, "line": 42, "description": "标题缺少【P0】前缀", "severity": "error" }
  ],
  "suspect_items": [
    { "rule": "FC04", "case_idx": 7, "line": 88, "context": "检查数据是否正确", "reason": "疑似模糊词'正确'" }
  ],
  "stats": { "total_cases": 20, "definite_count": 3, "suspect_count": 1 }
}
```

**纯格式规则（脚本处理）：** FC01(标题格式)、FC02(首步格式)、FC03(步骤编号)、FC05(数据真实性-关键词匹配)、FC07(正向用例结构)、FC08(逆向单一性)、FC09(表单字段格式)、FC10(前置条件格式)、FC11(异步等待格式)

**语义规则（输出 suspect_items 交 haiku）：** FC04(模糊词检测)、FC06(预期可断言性)

### 2.2 preference-loader.ts

**用途：** 一次性加载并合并多级偏好。

**接口：**
```bash
bun run .claude/scripts/preference-loader.ts load --project <name> --output json
```

**输出：** 合并后的 JSON，包含所有偏好键值对 + 来源标记（global/project）。

**合并优先级：** 项目级 `workspace/{project}/preferences/` > 全局 `preferences/` > 内置默认值。

### 2.3 source-analyze.ts

**用途：** 批量搜索源码仓库，返回结构化分析结果。

**接口：**
```bash
bun run .claude/scripts/source-analyze.ts analyze \
  --repo workspace/{project}/.repos/<repo> \
  --keywords "关键词1,关键词2" \
  --output json
```

**输出：**
```json
{
  "a_level": [{ "file": "src/xxx.ts", "line": 42, "content": "...", "confidence": 0.95 }],
  "b_level": [{ "file": "src/yyy.ts", "line": 18, "content": "...", "confidence": 0.6 }],
  "coverage_rate": 0.75,
  "searched_files": 120,
  "matched_files": 8
}
```

A 级：精确匹配（函数名/类名/接口名直接命中）。B 级：模糊匹配（注释/字符串/变量名包含关键词）。

### 2.4 writer-context-builder.ts

**用途：** 按模块切分增强 PRD，为每个 writer 构建精简上下文。

**接口：**
```bash
bun run .claude/scripts/writer-context-builder.ts build \
  --prd workspace/{project}/prds/YYYYMM/xxx.md \
  --test-points <test-points.json path> \
  --writer-id <module-name> \
  --preferences <merged-preferences.json path> \
  --output json
```

**输出：** 只含该 writer 负责模块的 PRD 片段 + 测试点子集 + 历史引用 + 偏好。

### 2.5 auto-fixer.ts

**用途：** 对 reviewer 审查发现的规则性问题执行自动修正。

**接口：**
```bash
bun run .claude/scripts/auto-fixer.ts fix \
  --input <writer-json-path> \
  --issues <review-issues.json> \
  --output <fixed-json-path>
```

**处理的规则：** F07(正向用例合并)、F09(表单字段格式)、FC01(标题前缀修正)、FC02(首步格式修正)、FC03(步骤编号修正) 等确定性修复。

### 2.6 search-filter.ts

**用途：** 对 archive 搜索结果去重、排序、截断。

**接口：**
```bash
bun run .claude/scripts/search-filter.ts filter \
  --input <raw-search-results.json> \
  --top 5 \
  --output json
```

**输出：** top-N 结果，每条包含标题 + 摘要（前 3 行）+ 匹配度分数。

---

## Section 3：Agent 提示词瘦身

### 3.1 通用变更模式

所有 14 个 agent 统一执行：

1. **JSON schema 引用化：** 删除内嵌 JSON 示例，替换为 `输出格式参见 .claude/references/output-schemas.json 中的 {schema_key}`
2. **错误处理引用化：** 删除错误处理段落，替换为 `错误处理遵循 .claude/references/error-handling-patterns.md`
3. **符号规则引用化：** 删除符号映射表，替换为 `符号使用遵循 .claude/references/unicode-symbols.md`

### 3.2 按 agent 的特殊变更

| Agent | 特殊变更 |
|-------|---------|
| writer-agent | R01-R11 规则改为引用 test-case-standards.md |
| format-checker-agent | 删除 FC01-FC11 全部规则，改为消费 format-check-script.ts 的 suspect_items 输出，只保留 FC04+FC06 的语义判断指导 |
| reviewer-agent | F07-F15 规则改为引用 test-case-standards.md，自动修正逻辑改为调用 auto-fixer.ts |
| transform-agent | 源码搜索指令改为调用 source-analyze.ts |
| script-writer-agent | UI 模式示例改为引用 playwright-patterns.md，前置条件工作流精简 |
| analyze-agent | 7 维度头脑风暴精简为维度名 + 核心要点（每维度 1-2 行） |
| standardize-agent | 规则引用化（与 writer 共享 test-case-standards.md） |

### 3.3 预期效果

| 指标 | 优化前 | 优化后 | 缩减 |
|------|--------|--------|------|
| 14 个 agent 总行数 | ~3,850 | ~2,225 | 42% |

---

## Section 4：Skill SKILL.md 瘦身

### 4.1 test-case-gen/SKILL.md（894行 → ~714行）

- confirmation_policy 提取到 `references/confirmation-policy.json`
- 运行模式表压缩为 3 行简表
- Contract A/B 定义一次，后续引用
- JSON 结构示例引用 output-schemas.json
- 偏好加载改为步骤 0 调用 preference-loader.ts

### 4.2 ui-autotest/SKILL.md（698行 → ~556行）

- output_contract 代码模板引用 playwright-patterns.md
- Task 可视化规则提取为统一 Task Schema 表
- `bun run` 命令定义别名表，步骤中简写
- 步骤 5 调试流程精简，引用 script-fixer-agent

### 4.3 code-analysis/SKILL.md（418行 → ~373行）

- 符号使用规则引用 unicode-symbols.md
- 确认提示模板精简

### 预期效果

| 指标 | 优化前 | 优化后 | 缩减 |
|------|--------|--------|------|
| 3 个核心 Skill 总行数 | 2,010 | ~1,643 | 18% |

---

## Section 5：数据流优化

### 5.1 偏好预加载

工作流启动时 preference-loader.ts 一次性加载，输出到 `.temp/preferences-merged.json`，所有下游 agent 通过参数接收，不再各自读文件。

### 5.2 断点恢复缓存

state.ts / ui-autotest-progress.ts 在首次解析完成后，将解析结果缓存到进度文件的 `cached_parse_result` 字段。恢复时直接读缓存。缓存附带 source file mtime，源文件修改则自动失效。

### 5.3 错误信息分类传递

主 agent 从 Playwright stderr 用正则提取 `{ error_type, failed_locator, line_number, stderr_last_20_lines }`，只传分类信息给 script-fixer-agent。Sub-agent 自行读完整日志。

### 5.4 Archive 搜索预过滤

search-filter.ts 包装 archive-gen.ts search，增加相关度排序、去重、截断 top-N、摘要输出。Agent 只在需要深入时才 Read 具体文件。

### 5.5 format-check 分层流水线

```
format-check-script.ts
    ├── definite_issues → 直接输出
    └── suspect_items → 仅此部分交给 haiku agent
若 suspect_items 为空 → 跳过 haiku 调用
```

---

## 实施计划（按层）

### 第一层：Reference 文档（无依赖）
1. 创建 .claude/references/ 目录
2. 编写 test-case-standards.md
3. 编写 output-schemas.json
4. 编写 error-handling-patterns.md
5. 编写 unicode-symbols.md
6. 编写 playwright-patterns.md

### 第二层：Agent/Skill 提示词瘦身（依赖第一层）
7. 更新 14 个 agent .md 文件，替换内联内容为引用
8. 更新 test-case-gen/SKILL.md
9. 更新 ui-autotest/SKILL.md
10. 更新 code-analysis/SKILL.md

### 第三层：新增脚本（依赖第一层，部分依赖第二层）
11. 实现 preference-loader.ts + 测试
12. 实现 format-check-script.ts + 测试
13. 实现 source-analyze.ts + 测试
14. 实现 writer-context-builder.ts + 测试
15. 实现 auto-fixer.ts + 测试
16. 实现 search-filter.ts + 测试

### 第四层：数据流优化（依赖第二、三层）
17. state.ts / ui-autotest-progress.ts 增加缓存字段
18. ui-autotest SKILL.md 增加错误分类传递逻辑
19. test-case-gen SKILL.md 接入 preference-loader + search-filter + format-check 分层流水线
20. 全量测试验证
