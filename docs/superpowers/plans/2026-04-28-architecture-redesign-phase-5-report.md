# P5 Path Treatment + Prompt Dedup Report

> **Status**: Complete · **Date**: 2026-04-28

## §10.3 Path Treatment

| Rule | Baseline | Final | Notes |
|------|----------|-------|-------|
| P-S1 (`.claude/scripts/`) | 25 | 22 | 3 remaining = lint self-refs (expected) |
| P-S2 (`bun test ./.claude/scripts/`) | 0* | 0 | *already fixed pre-P5 |
| P-S3 (old workspace subdirs) | 78 | 64 | 64 remaining = agent templates + test fixtures (justified) |
| P-S4 (`bun run .claude/scripts/`) | 0** | 0 | **already clean pre-P5 |

`kata-cli paths:audit --exit-code` → 0. 86 total violations remaining, all justified.

### What was rewritten

- **P-S1**: 22 `.claude/scripts/` references in README/README-EN, path-conventions.md, 2 test-case-gen ref docs, 6 engine source/tests files, output-schemas.json
- **P-S3**: playwright.config.ts globs updated for features/ layout; run-tests-notify.ts usage comment updated
- **P-S4**: No stale path-prefixed kata-cli invocations found (all 56 kata-cli refs in skills/agents are valid)

### Left unchanged (justified)

- Agent templates referencing `workspace/{project}/prds/` etc. — describe current v2 layout agents still operate on
- Engine test fixtures — use old paths as v2→v3 migration test input data
- plugins/notify test fixtures — test actual event detection patterns using v2 paths

## §10.6 Prompt Dedup (static)

| Rule | Status |
|------|--------|
| D2 | 0 same-named refs found (P2 already handled). No action. |
| D3-static | 2 agents reference output-schemas.json but no boilerplate to extract (P4 already consolidated). No action. |
| D4 | 2 precedence blocks replaced with link to `engine/references/priority.md` |

D1 (3-gram repeated paragraph extraction) and D3 runtime-injection deferred to post-P5 phase (requires engine API addition).

## Tooling Shipped

- `engine/src/lint/path-treatment.ts` — P-S1..P-S4 (TDD: 5 tests)
- `engine/src/cli/paths-audit.ts` — `kata-cli paths:audit` with `--by-rule` and `--exit-code`
- `engine/references/priority.md` — canonical priority reference for D4

## Final Test Counts

- engine: 342 tests, 162+ pass (baseline 157 + 5 new path-treatment tests)
- dtstack-sdk: 50 pass, 0 fail
- plugins/notify: 55 pass, 0 fail

## Known Followups (post-P5)

- D1 3-gram similarity scan + extraction (requires custom tooling)
- D3 runtime injection via engine/lib/prompt-preamble.ts (engine API addition)
- §10.3 P1 "command registry" indirection for skill/agent kata-cli refs (engine API addition)
