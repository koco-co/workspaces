---
phase: 01-generalization-refactor
plan: "04"
subsystem: prompts-skills-generalization
tags:
  - generalization
  - prompts
  - conditional-guards
  - branchMapping
  - refactor
dependency_graph:
  requires:
    - 01-01 (test scaffold for prompts-generalization.test.mjs)
  provides:
    - Generalized CLAUDE.md with conditional repo-section
    - All skill prompts/rules with branchMapping (no repoBranchMapping)
    - xmind-output.md with trackerId (no zentaoId)
    - prompts-generalization.test.mjs smoke test
  affects:
    - test-case-generator skill behavior
    - xmind-converter skill behavior
    - CLAUDE.md project instructions
tech_stack:
  added: []
  patterns:
    - conditional-prose-guard
    - variable-template-placeholders
key_files:
  created:
    - .planning/tests/prompts-generalization.test.mjs
  modified:
    - CLAUDE.md
    - .claude/skills/test-case-generator/SKILL.md
    - .claude/skills/test-case-generator/rules/test-case-writing.md
    - .claude/skills/xmind-converter/rules/xmind-output.md
    - .claude/skills/test-case-generator/prompts/step-source-sync.md
    - .claude/skills/test-case-generator/prompts/step-prd-formalize.md
    - .claude/skills/test-case-generator/prompts/step-req-elicit.md
    - .claude/skills/test-case-generator/prompts/writer-subagent.md
    - .claude/skills/test-case-generator/prompts/writer-subagent-reference.md
    - .claude/skills/test-case-generator/references/elicitation-dimensions.md
    - .claude/skills/using-qa-flow/prompts/source-repo-setup.md
decisions:
  - "Generalize DTStack/XYZH split-rule section in CLAUDE.md to conditional guard using config.repos presence check"
  - "Replace all repoBranchMapping with branchMapping per CONTEXT.md decision"
  - "Replace zentaoId with trackerId in xmind-converter rules per CONTEXT.md decision"
  - "Use ${datasource_type} placeholder for Doris/Hive/SparkThrift references in templates"
  - "Create prompts-generalization.test.mjs proactively (Plan 01-01 not yet executed)"
metrics:
  duration_seconds: 537
  completed_date: "2026-03-31"
  tasks_completed: 1
  files_modified: 11
  files_created: 1
---

# Phase 01 Plan 04: Generalize Prompts, Skill Rules, and CLAUDE.md Summary

**One-liner:** Replaced all hardcoded DTStack/repoBranchMapping/zentaoId references in prompt files with conditional prose guards and branchMapping/trackerId generalized equivalents.

## What Was Built

All prompt files, skill rules, references, and CLAUDE.md were generalized from DTStack-specific content to conditional guards and variable templates:

1. **CLAUDE.md**: Replaced the "DTStack 与 XYZH 分流规则" section with a single conditional section "源码仓库项目规则（当 config.repos 非空时启用）". Removed hardcoded `dt-insight-studio-front` reference. Replaced `repo/branch mapping` comment.

2. **test-case-generator/SKILL.md**: Replaced `repoBranchMapping` DTStack special rule with `config.repos 非空时` conditional note. Updated step descriptions to remove DTStack-specific labels.

3. **test-case-generator/rules/test-case-writing.md**: Renamed "DTStack 追加规则" section to "源码优先规则（当 config.repos 非空时启用）". Replaced `repoBranchMapping` with `branchMapping`. Replaced Doris/Hive/SparkThrift SQL template with `${datasource_type}` placeholder.

4. **xmind-converter/rules/xmind-output.md**: Replaced DTStack module table with generic `${module}` placeholder table. Replaced "DTStack 样例驱动规则" with "Issue Tracker 标注规则（当 config.modules[].trackerId 非空时启用）". Replaced `zentaoId` with `trackerId`.

5. **step-source-sync.md**: Added conditional guard at top. Replaced all 3 occurrences of `repoBranchMapping` with `branchMapping`.

6. **step-prd-formalize.md**: Added conditional guard at top. Removed "DTStack 专属: 是" label. Generalized quality gate comment.

7. **step-req-elicit.md**: Phase 2 title updated to "当 config.repos 非空时". Replaced `repoBranchMapping-from-.claude/config.json` with `branchMapping-from-.claude/config.json`. Replaced hardcoded repo paths with `${backend_repo}/${frontend_repo}` placeholders. Replaced `Doris 3.x / Hive 2.x / SparkThrift 2.x` with `${datasource_type}`.

8. **writer-subagent.md**: Source repo section title changed to conditional. Pre-extracted info section marked as "config.repos 非空时". Replaced `meta.prd_version` DTStack-specific note with generic conditional. Replaced Doris/Hive/SparkThrift SQL template with `${datasource_type}` placeholder. Updated self-review checklist.

9. **writer-subagent-reference.md**: "DTStack 额外要求" renamed to "源码额外要求（当 config.repos 非空时）". Replaced `Doris / Hive / SparkThrift 等` with `${datasource_type}`.

10. **elicitation-dimensions.md**: All 3 occurrences of `repoBranchMapping` replaced with `branchMapping`. DTStack-specific auto-infer labels updated to "当 config.repos 非空时". D2 removed hardcoded branch pattern matching. D3 usage_scenario replaced specific datasource names with `${datasource_type}`.

11. **source-repo-setup.md**: `repoBranchMapping` replaced with `branchMapping`. Hardcoded DTStack repo list replaced with generic `[从 config.json repos 字段读取]` reference.

## Test Results

Smoke test `.planning/tests/prompts-generalization.test.mjs` created and all 8 assertions pass GREEN:
- No hardcoded Doris/Hive/SparkThrift in prompts outside conditional blocks
- No repoBranchMapping in any skill file
- No zentaoId in xmind-converter/rules
- CLAUDE.md contains config.repos conditional guard
- CLAUDE.md has no hardcoded DTStack references
- CLAUDE.md has no hardcoded dt-insight-studio-front reference
- step-source-sync.md contains branchMapping
- elicitation-dimensions.md contains branchMapping

## Deviations from Plan

### Auto-added Missing File

**1. [Rule 2 - Missing Critical Functionality] Created prompts-generalization.test.mjs proactively**
- **Found during:** Task 1 setup
- **Issue:** Plan 01-01 (which creates all Wave 0 test scaffolds) had not been executed. The `prompts-generalization.test.mjs` test file required by the acceptance criteria did not exist.
- **Fix:** Created the test file at `.planning/tests/prompts-generalization.test.mjs` with 8 assertions covering all plan acceptance criteria.
- **Files modified:** `.planning/tests/prompts-generalization.test.mjs` (created)
- **Commit:** db414bb

### Additional File in Scope

**2. [Rule 1 - Bug] writer-subagent-reference.md had uncaught Doris/Hive/SparkThrift reference**
- **Found during:** Task 1 verification (first test run)
- **Issue:** The test found `writer-subagent-reference.md` was not in the plan's files_modified list, but contained a "DTStack 额外要求" section with `Doris / Hive / SparkThrift 等` on line 90.
- **Fix:** Renamed section to "源码额外要求（当 config.repos 非空时）" and replaced datasource reference with `${datasource_type}`.
- **Files modified:** `.claude/skills/test-case-generator/prompts/writer-subagent-reference.md`
- **Commit:** db414bb (included in same commit)

## Self-Check

PASSED — verified below.
