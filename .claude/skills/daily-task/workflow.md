# daily-task — Workflow

This skill dispatches by mode, declared in the user's slash invocation:

- [Mode: bug-report](#mode-bug-report) — `/daily-task bug ...`
- [Mode: conflict-report](#mode-conflict-report) — `/daily-task conflict ...`
- [Mode: hotfix-case-gen](#mode-hotfix-case-gen) — `/daily-task hotfix ...`

Pre-flight: see [skill-preamble.md](references/skill-preamble.md), [env-vs-code.md](references/env-vs-code.md), [unicode-symbols.md](references/unicode-symbols.md).

---

## <a id="mode-bug-report"></a>Mode: bug-report

Executor: direct (orchestration) + subagent (agent: backend-bug-agent / frontend-bug-agent, model: sonnet)

### Role

You are bug-report orchestration, routing backend Java exception stacks or frontend Console errors to the appropriate analysis agent (`backend-bug-agent` / `frontend-bug-agent`), and rendering JSON output as an HTML report.

### Inputs

- Error log text: Java exception stack, HTTP error response, curl request info; or frontend Console errors, React/Vue runtime warnings
- `workspace/{{project}}` output directory, `config.ts` config, read-only source copies (on-demand sync)
- Optional: `--template full` (switch to full-style HTML)

### Pre-guard

- **Hard required**: Error main stack/text cannot be empty; must contain recognizable exception keywords or explicit backend/frontend declaration
- **Soft**: Missing environment info still OK; mark as "not provided" in report
- **Blocking**: Single sentence "error occurred" with no stack → ask for required fields
- **Invalid**: Empty input, pure screenshot with no parseable text → return invalid input

### Routing signals

| Signal type | Indicators                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Backend     | `Exception`, `Caused by`, `java.lang`, `at com.xxx`, Spring/MyBatis/Hibernate, `SQLException`, HTTP 5xx            |
| Frontend    | `TypeError`, `ReferenceError`, `ChunkLoadError`, `SyntaxError`, `React error`, `Vue warn`, browser-specific errors |
| Ambiguous   | Neither or both signals → AskUserQuestion "backend or frontend?"                                                   |

### Confirmation policy

- Status-only: no confirmation needed for mode recognition, analysis summary, report generation
- Source sync and `.env` writeback are separate gates, never merged into one confirmation
- Reference sync: show repo/branch/path summary before asking permission
- Writeback: show preview and confirm separately; analysis can continue without writeback

### Sub-workflow: Source sync & agent dispatch

Both backend and frontend paths share the same double-gate source sync workflow:

1. Infer repo/branch from error context (package name, bundle path)
2. Show sync summary, ask permission
3. Execute sync: `kata-cli repo-sync --url {{repo_url}} --branch {{branch}}`
4. For new repo/branch info: show writeback preview, ask separately
5. If config.repos empty: ask user for source path, or fall back to log-only analysis

### Dispatch

- **Backend** → `backend-bug-agent` (model: sonnet), receives error log + source context + env info. Returns `backend_bug_json`.
- **Frontend** → `frontend-bug-agent` (model: sonnet), receives error info + source context + env info. Returns `frontend_bug_json`.

### Rendering & notification

1. Write HTML report to `workspace/{{project}}/reports/bugs/{{YYYYMMDD}}/{{BugTitle}}.html`
   - Templates: `bug-report-zentao.html.hbs` (default, Zentao-compatible), `bug-report-full.html.hbs` (full-style)
2. Notify: `kata-cli plugin-loader notify --event bug-report --data '{"reportFile":"...","summary":"..."}'`
3. Completion summary (status display, no confirmation)

### Routing error recovery

- Auto-inject "routing judgment tip" in HTML footer
- On user feedback "wrong route": provide re-trigger instructions with explicit backend/frontend prefix
- Old report kept; new report named `{{original}}-rerouted.html`

---

## <a id="mode-conflict-report"></a>Mode: conflict-report

Executor: direct (orchestration) + subagent (agent: conflict-agent, model: sonnet)

### Role

You are conflict-report orchestration, routing git merge conflict snippets to `conflict-agent` for independent analysis, and rendering results as an HTML report.

### Inputs

- Conflict code snippet (must contain `<<<<<<< HEAD` / `=======` / `>>>>>>>` markers)
- Optional: branch info (HEAD branch, incoming branch)
- `workspace/{{project}}` output, `config.ts`, report templates

### Pre-guard

- **Hard required**: Must contain all 3 git conflict markers; missing any → ask for complete block
- **Soft**: Branch info optional; mark as "not provided" if missing
- **Invalid**: Empty, non-conflict format text, or pure screenshot → return invalid

### Workflow

1. Ask for branch info (optional): HEAD branch, incoming branch
2. Dispatch `conflict-agent` (model: sonnet), receives conflict snippet + branch info. Returns `conflict_json`.
3. Render HTML report: `workspace/{{project}}/reports/conflicts/{{YYYYMMDD}}/{{description}}.html`
4. Notify: `kata-cli plugin-loader notify --event conflict-analyzed --data '{...}'`
5. Completion summary

---

## <a id="mode-hotfix-case-gen"></a>Mode: hotfix-case-gen

Executor: direct (orchestration) + subagent (agent: hotfix-case-agent, model: sonnet)

### Role

You are hotfix-case-gen orchestration, converting Zentao Bug links or Bug IDs into executable Hotfix Archive MD verification cases.

### Inputs

- Zentao Bug URL (`{{ZENTAO_BASE_URL}}/zentao/bug-view-{{bug_id}}.html`) or bare Bug ID
- `workspace/{{project}}` output, `config.ts` config, read-only source copies
- Optional: `fix_branch`, `repo_name`

### Input parsing

| Form            | Example                                           | Handling                     |
| --------------- | ------------------------------------------------- | ---------------------------- |
| Full Zentao URL | `{{ZENTAO_BASE_URL}}/zentao/bug-view-138845.html` | Extract `bug_id=138845`      |
| Bare Bug ID     | `138845`                                          | Use as `bug_id` directly     |
| Text with ID    | `this bug bug-view-138845`                        | Regex match `bug-view-(\d+)` |

### Pre-guard

- **Hard required**: Must be Zentao URL or numeric Bug ID
- **Soft**: `fix_branch` missing → AskUserQuestion; all missing → path B
- **Invalid**: Malformed link / cannot parse Bug ID → return invalid

### Workflow (E1-E6)

**E1 — Fetch Zentao info**: Run `bun run plugins/zentao/fetch.ts --bug-id {{bug_id}} --project {{project}}`. Extract: bug_id, title, severity, fix_branch, status.

**E2 — Source sync** (auto-first, confirm when needed):

- Path A (fix_branch available): Auto-sync without asking. Show one-line status.
- Path B (fix_branch null): Ask user for repo/branch via AskUserQuestion.

**E3 — AI analysis**: Dispatch `hotfix-case-agent` (model: sonnet). Before dispatch, load rules:

```bash
kata-cli rule-loader load --project {{project}} > workspace/{{project}}/.temp/rules-merged.json
```

**E4 — Output**: Write to `workspace/{{project}}/issues/{{YYYYMM}}/hotfix_{{version}}_{{bugId}}-{{summary}}.md`
Constraint: Use agent's case content directly — orchestration layer must NOT append, split, or rewrite.

**E5 — Notify**: `kata-cli plugin-loader notify --event hotfix-case-generated --data '{...}'`

**E6 — Completion summary**
