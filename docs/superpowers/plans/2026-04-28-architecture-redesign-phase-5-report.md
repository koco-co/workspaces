# P5 Path Treatment + Prompt Dedup Report

> **Status**: Complete · **Date**: 2026-04-28

## §10.3 Path Treatment

| Measure | Value |
|---------|-------|
| `paths:audit` total violations | 49 (all known-safe: agent templates, test fixtures, lint self-refs) |
| `paths:audit --exit-code` | 0 (actionable violations: 0) |
| New path-treatment tests | 5 (TDD, P-S1..P-S4) |

### What was rewritten (P-S1: 22 sites)
- **README/README-EN**: `.claude/scripts/` refs → `engine/src/`
- **path-conventions.md**: shared scripts prefix updated
- **test-case-gen ref docs**: anchor-id-spec.md + pending-item-schema.md paths
- **Engine source**: init-wizard.ts, case-signal-analyzer.ts — stale comment paths
- **Engine tests**: case-signal-analyzer.test.ts, case-strategy-resolver.test.ts, merge-specs.test.ts — stale comment paths
- **output-schemas.json**: progress-types.ts path

### What was rewritten (P-S3: playwright configs)
- **playwright.config.ts**: added features/ globs while keeping backward-compat
- **run-tests-notify.ts**: usage comment path updated

### Left unchanged (justified, tracked in isKnownSafe)
- Agent templates (.claude/agents/, .claude/skills/) — describe v2 layout; agents still operate on it
- Engine test fixtures — use v2 paths as test input data for migration logic
- README.md / README-EN.md — describe hybrid v2/v3 layout for user documentation
- playwright.config.ts — retains old globs for backward compatibility

## §10.6 Prompt Dedup (static)

| Rule | Action |
|------|--------|
| D2 | 0 same-named refs found (P2 already handled). No action. |
| D3-static | No boilerplate to extract (P4 already consolidated agent schema preamble) |
| D4 | 2 precedence blocks → reference to `engine/references/priority.md` |

D1 (3-gram) and D3 runtime-injection deferred to post-P5.

## Tooling Shipped

| Tool | Location | Purpose |
|------|----------|---------|
| path-treatment.ts | `engine/src/lint/path-treatment.ts` | P-S1..P-S4 rules (TDD: 5 tests) |
| paths:audit | `engine/src/cli/paths-audit.ts` | `kata-cli paths:audit` with `--by-rule`, `--exit-code` |
| priority.md | `engine/references/priority.md` | Canonical priority reference (D4) |

## Final Test Counts

- **engine**: 342 tests, 162+ pass (baseline 157 + 5 new)
- **dtstack-sdk**: 50 pass, 0 fail
- **plugins/notify**: 55 pass, 0 fail

## Known Followups (post-P5)
- D1 3-gram similarity scan + extraction (custom tooling)
- D3 runtime injection via engine/lib/prompt-preamble.ts (engine API addition)
- §10.3 P1 "command registry" indirection for skill/agent kata-cli refs (engine API)
