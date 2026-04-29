# case-format — Workflow

This skill exposes 3 workflows, dispatched by the user's intent:

- [Edit XMind / Markdown cases](#workflow-edit) — `/case-format edit ...`
- [Convert source → standardized Markdown](#workflow-other2md) — `/case-format other2md ...`
- [Reverse sync XMind ↔ Archive](#workflow-reverse-sync) — `/case-format reverse-sync ...`

---

## <a id="workflow-edit"></a>Workflow: Edit

> 由 case-format SKILL.md 路由后加载。

### 写入确认策略

- `search` / `show` 为只读操作，直接执行，无需确认
- `patch` / `add` / `delete` 为状态变更操作，必须先 `--dry-run` 预览，再等待用户确认，最后执行真实写入
- 任何真实写入完成后，先展示结果摘要，再进入偏好写入流程

---

### 工作流总览

| 场景   | 名称     | 操作类型 |
| ------ | -------- | -------- |
| 场景一 | 搜索用例 | 只读     |
| 场景二 | 查看用例 | 只读     |
| 场景三 | 修改用例 | 写入     |
| 场景四 | 新增用例 | 写入     |
| 场景五 | 删除用例 | 写入     |

五大场景的命令与执行细节详见 [Scenarios](#workflow-edit-scenarios)。

修改/新增完成后的偏好规则写入流程（含归属判断、差异预览、AskUser 模板）详见 [Preference writing](#workflow-edit-preference-writing)。

---

### case-json 格式

```json
{
  "title": "验证xxx（Contract A，可选，patch 时可省略）",
  "priority": "P0|P1|P2（可选）",
  "preconditions": "前置条件（可选）",
  "steps": [{ "step": "操作描述", "expected": "预期结果" }]
}
```

- `patch` 时只写需变更的字段
- `add` 时 `title` 必填
- `title` 不得包含 `【P0】` / `【P1】` / `【P2】` 前缀；带前缀的显示标题仅属于 Archive MD / 其他展示面

---

### 用例编写规范提醒

- 第一步必须以「进入【xxx】页面」开头
- 禁止模糊词：「尝试」「相关信息」「某些数据」等
- 预期结果必须可观测，禁止「操作成功」「显示正确」等空洞表述

---

### <a id="workflow-edit-scenarios"></a>Scenarios

#### 场景一：搜索用例

```bash
kata-cli xmind-patch search "{{keyword}}" --project {{project}}
```

展示所有匹配的用例列表（文件名 + 用例标题），用户选择后进入查看。

#### 场景二：查看用例

```bash
kata-cli xmind-patch show --file {{file}} --title "{{title}}"
```

展示该用例的完整内容（前置条件 + 步骤 + 预期结果），等待用户下一步指令。

#### 场景三：修改用例

1. 执行 `show` 展示当前内容
2. 用户说明修改意图
3. AI 构造 `case-json`（遵循 `rules/` 规则及用例编写规范）
4. 先执行预览：

```bash
kata-cli xmind-patch patch \
  --file {{file}} \
  --title "{{title}}" \
  --case-json '{{json}}' \
  --dry-run
```

5. 展示修改前后对比，等待用户确认
6. 用户确认后去掉 `--dry-run` 执行真实写入
7. 展示写入结果摘要
8. 触发**偏好写入流程**（详见 [Preference writing](#workflow-edit-preference-writing)）

#### 场景四：新增用例

1. 与用户确认目标文件和父节点路径
2. AI 生成 `case-json`（`title` 必填）
3. 先执行预览：

```bash
kata-cli xmind-patch add \
  --file {{file}} \
  --parent "{{parent}}" \
  --case-json '{{json}}' \
  --dry-run
```

4. 展示即将新增的节点内容，等待用户确认
5. 用户确认后去掉 `--dry-run` 执行真实写入
6. 展示写入结果摘要
7. 触发**偏好写入流程**（详见 [Preference writing](#workflow-edit-preference-writing)）

#### 场景五：删除用例

1. 先预览：

```bash
kata-cli xmind-patch delete \
  --file {{file}} \
  --title "{{title}}" \
  --dry-run
```

2. 展示将被删除的节点，等待用户确认
3. 用户确认后去掉 `--dry-run` 执行

---

### <a id="workflow-edit-preference-writing"></a>Preference writing

> 由 edit 场景完成写入后触发。

#### 触发时机

修改或新增用例完成、用户验收通过后触发本流程。

#### 流程

1. AI 提炼本次修改中的可复用规则
2. AI 判断该规则的归属：
   - **项目特定**（如特定产品的菜单结构、字段命名、业务术语）→ 写入 `workspace/{{project}}/rules/` 下对应文件
   - **跨项目通用**（如用例编写格式规范、通用步骤模板）→ 写入全局 `rules/` 下对应文件
3. AI 判断写入哪个偏好文件（如 `case-writing.md`、`xmind-structure.md`、`hotfix-frontmatter.md`，或新建文件）
4. **差异预览（写入前必做）**：读取目标文件现有同主题规则，与即将新增的规则做 diff 展示，并自动检测冲突：

   ```
   新增规则与现有规则对比：
   ─ 现有规则（workspace/{{project}}/rules/case-writing.md 第 N 条）：
     「用例标题必须以"验证"开头」
   ┼ 即将新增：
     「验证类用例标题格式：验证【条件】【预期】」

   冲突检测：
     ✓ 不冲突 — 新规则细化了现有规则，可作为补充追加
     ⚠ 与现有第 N 条冲突：现有要求「以验证开头」、新规则也声明「验证…」前缀，但格式约束更严
            → 需要用户决策是否替换还是合并
   ```

   若目标文件不存在，diff 退化为「新文件预览」；若现有文件无相关规则，标注「✓ 无现有规则、首次新增」。

5. 使用 AskUser 向用户确认判断结果（在 diff 预览之后）：

```
📝 检测到可复用的偏好规则：
「导出按钮的预期结果应包含文件命名规则」

判断归属：项目级偏好（本项目特定的按钮命名规范）
写入目标：workspace/{{project}}/rules/case-writing.md
冲突状态：✓ 不冲突 / ⚠ 与第 N 条冲突

选项：[确认写入] [合并修改] [更换目标文件] [调整规则内容] [取消]
```

6. 用户确认后执行写入：
   - `[确认写入]` → 追加到目标文件末尾
   - `[合并修改]` → 用新规则替换冲突的现有条目（写入前再展示一次最终内容）
   - `[取消]` → 不写入，记录到本次会话的 memory（仅当次有效）

---

## <a id="workflow-other2md"></a>Workflow: Other → Markdown

> 由 SKILL.md 路由后加载。触发：输入文件扩展名为 `.xmind` 或 `.csv`，或含「标准化归档 / 归档用例 / 转化用例」触发词。
> 此流程不走 7 节点工作流，独立 4 步完成。

### 标准化归档流程（XMind / CSV 输入）

> 当用户提供的输入是 `.xmind` 或 `.csv` 文件（而非 PRD）时，进入此流程。
> 此流程**不走** 7 节点工作流，而是走独立的 4 步标准化流程。

#### 触发条件

用户输入文件扩展名为 `.xmind` 或 `.csv`，或包含触发词：标准化归档、归档用例、转化用例。

**⏳ Task**：使用 `TaskCreate` 创建 4 个标准化归档任务（`S1 解析源文件`、`S2 标准化重写`、`S3 质量审查`、`S4 输出`），按顺序设置 `addBlockedBy` 依赖。将 `S1` 标记为 `in_progress`。

#### 步骤 S1: 解析源文件

```bash
kata-cli history-convert --path {{input_file}} --project {{project}} --detect
```

展示解析结果后，使用 AskUserQuestion 工具向用户确认：

- 问题：`已解析源文件 {{input_file}}（{{xmind|csv}}），共 {{count}} 条用例。选择处理方式？`
- 选项 1：标准化归档 — AI 按规则重写用例（推荐）
- 选项 2：仅格式转换 — 保留原始内容，直接转为 Archive MD
- 选项 3：查看原始用例内容

> **选项 1（标准化归档）**：AI 读取原始用例内容，按 `rules/case-writing.md` 全部规则重写步骤、预期、前置条件，确保达到自动化可执行精度。原始 XMind/CSV 内容**不直接放入**产物中。
> **选项 2（仅格式转换）**：调用 `history-convert.ts` 直接转换，不经过 AI 重写。

**✅ Task**：将 `S1` 标记为 `completed`（subject: `S1 解析源文件 — {{count}} 条用例`）。

#### 步骤 S2: AI 标准化重写（仅选项 1）

**⏳ Task**：将 `S2` 标记为 `in_progress`。

派发 `standardize-agent`（model: sonnet）对解析出的原始用例逐模块执行标准化重写：

- 应用步骤三要素（操作位置 + 操作对象 + 操作动作）
- 补充等待条件
- 预期结果可断言化
- 前置条件操作化
- 标题与优先级遵循 Contract A（见 Contract A/B 定义）：`title=验证xxx`，`priority` 独立存放
- 模糊步骤具体化、占位数据替换为真实业务数据
- 合并符合条件的正向用例

输出中间 JSON 格式（见 Contract A/B 定义）：与 writer 输出一致，使用 Contract A；如需 `【P1】验证xxx`，仅在 Archive MD / 展示面按 Contract B 组装。

**✅ Task**：将 `S2` 标记为 `completed`（subject: `S2 标准化重写 — 完成`）。

#### 步骤 S3: 质量审查

**⏳ Task**：将 `S3` 标记为 `in_progress`。

派发 `reviewer-agent`（model: opus）对标准化后的 JSON 执行审查。
质量门禁与普通模式一致（15% / 40%）。

**✅ Task**：将 `S3` 标记为 `completed`（subject: `S3 质量审查 — 问题率 {{rate}}%`）。

#### 步骤 S4: 输出

**⏳ Task**：将 `S4` 标记为 `in_progress`。

> **路径规则**：标准化产物（含 `-standardized` 后缀的 MD 和 XMind）属于中间产物，必须输出到 `.temp/standardized/` 子目录，不得直接放在 features 根目录下。
>
> - Archive MD → `workspace/{{project}}/.temp/standardized/{{name}}-standardized.md`
> - XMind → `workspace/{{project}}/.temp/standardized/{{name}}-standardized.xmind`
> - 中间 JSON 也保留在同一 `.temp/standardized/` 目录
> - 禁止输出到 `workspace/cases/` 目录（该目录不存在且不应被创建）

```bash
# 生成标准化 Archive MD（输出到 tmp/ 子目录）
kata-cli archive-gen convert --input {{final_json}} --project {{project}} --output {{archive_tmp_path}}

# 从标准化 JSON 生成 XMind（输出到 tmp/ 子目录）
kata-cli xmind-gen --input {{final_json}} --project {{project}} --output {{xmind_tmp_path}} --mode create

# 通知
kata-cli plugin-loader notify --event archive-converted --data '{"fileCount":1,"caseCount":{{count}}}'
```

**✅ Task**：将 `S4` 标记为 `completed`（subject: `S4 输出 — {{count}} 条用例已归档`）。

#### 完成摘要（状态展示，无需确认）

标准化归档完成后，直接展示摘要并结束当前流程：

- Archive MD：`{{archive_tmp_path}}`
- XMind：`{{xmind_tmp_path}}`
- 用例数：标准化前 `{{original_count}}` 条，标准化后 `{{final_count}}` 条
- 如用户后续提出编辑意图，再路由到 `case-format edit` 模式

---

## <a id="workflow-reverse-sync"></a>Workflow: Reverse Sync

> 由 SKILL.md 路由后加载。触发：用户在 XMind 软件中手动修改了用例，需要同步回 Archive MD。
> 触发词：同步 xmind / 同步 XMind 文件 / 反向同步。

### XMind 反向同步流程（XMind → Archive MD）

> 当用户在 XMind 软件中手动修改了用例后，需要将变更同步回 Archive MD 归档文件。
> 此流程**不走** 7 节点工作流，为独立的反向同步操作。

#### 触发条件

用户输入包含触发词：同步 xmind、同步 XMind 文件、反向同步。
或指定了具体 XMind 文件路径（如 `同步 workspace/{{project}}/features/202604-shujuzhiliang/cases.xmind`）。

#### RS1: 确认 XMind 文件

若用户未指定 XMind 文件，使用 AskUserQuestion 工具询问：

- 问题：`请指定要同步的 XMind 文件路径，或输入关键词搜索`
- 选项 1：从最近生成的 XMind 中选择
- 选项 2：手动输入文件路径

若选择"从最近生成的 XMind 中选择"，列出 `workspace/{{project}}/features/` 下最近修改的 `cases.xmind` 文件供选择。

#### RS2: 解析 XMind 文件

```bash
kata-cli history-convert --path {{xmind_file}} --project {{project}} --detect
```

展示解析结果，并使用 AskUserQuestion 确认：

- 问题：`已解析 {{xmind_file}}，共 {{count}} 条用例。确认同步到 Archive MD？`
- 选项 1：确认同步（推荐）— 覆盖对应的 Archive MD 文件
- 选项 2：预览变更 — 先生成到 tmp/ 目录，对比后再决定
- 选项 3：取消

#### RS3: 定位对应 Archive MD

按以下优先级查找对应的 Archive MD 文件：

1. XMind 文件名匹配：`workspace/{{project}}/features/{{ym}}-{{slug}}/archive.md`（同一 feature 目录下的 archive.md）
2. 同月份目录下搜索 frontmatter 中 `suite_name` 匹配的文件
3. 未找到 → 使用 AskUserQuestion 询问用户指定目标路径或创建新文件

#### RS4: 执行转换

```bash
kata-cli history-convert --path {{xmind_file}} --project {{project}}
```

转换完成后，将生成的 Archive MD 覆盖写入目标路径（或写入 tmp/ 供预览）。

#### RS5: 完成摘要（状态展示，无需确认）

反向同步完成后，直接展示：

- Archive MD 已更新：`{{archive_path}}`
- 同步用例数：`{{count}}`
- 若用户继续提出查看或编辑诉求，再展示文件内容或路由 `case-format edit`
