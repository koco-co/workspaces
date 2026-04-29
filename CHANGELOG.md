# Changelog

## 3.0.0-alpha.1 (2026-04-29)

### v3 Architecture Redesign

- **Engine lift**: `.claude/scripts/` → `engine/` as npm workspace package
- **Workspace reorg**: `prds/archive/xmind/` → `features/{ym}-{slug}/` aggregation
- **Testing**: migrated from `node:test` to `bun:test`, 966 pass / 0 fail / 0 errors
- **CLI tools**: bucket-audit, fix-truthy codemod, skill:audit, paths:audit, cases:lint
- **Hooks**: 5 Claude Code hooks (pre-bash, pre-edit, post-edit × 3)
- **Skills**: 7 skills on 4-file contract (SKILL/workflow/rules/references)
- **Docs**: README/CLAUDE.md updated for v3 workspace layout

## 2.0.0 (2026-04-01)

- Initial release with Claude Code Skills integration
- QA workflow engine with test-case-gen, ui-autotest, case-format skills
- Plugin system (lanhu, zentao, notify)
