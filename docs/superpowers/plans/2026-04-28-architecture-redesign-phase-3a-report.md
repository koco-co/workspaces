# P3-A Dry-Run Report

> **Status**: Active · **Date**: 2026-04-28
> **Scope**: Migration script TDD + shadow dry-run. Real forward migration is P3-B.

## Migration Scope Summary

| Scope | Status | Notes |
|-------|--------|-------|
| `prds/{ym}/{slug}/` → `features/{ym}-{slug}/` | ✅ Covered | Preserves all files inside prdDir (enhanced.md, images/, etc.) |
| `archive/{ym}/{slug}.md` → `features/{ym}-{slug}/archive.md` | ✅ Covered | Renamed to archive.md |
| `xmind/{ym}/{slug}.xmind` → `features/{ym}-{slug}/cases.xmind` | ✅ Covered | Renamed to cases.xmind |
| `tests/{ym}/{slug}/` → `features/{ym}-{slug}/tests/` | ✅ Covered | Internal structure unchanged (P3.5) |
| `tests/fixtures/` → `shared/fixtures/` | ✅ Covered | |
| `tests/helpers/` → `shared/helpers/` | ✅ Covered | |
| `.kata/{p}/sessions/{wf}/{slug}.json` → `features/{ym}-{slug}/.state/{wf}.json` | ✅ Covered | Attaches to all matching slugs |
| `issues/`, `reports/`, `knowledge/`, `rules/`, `history/`, `.repos/` | ❌ Deferred | Not PRD-keyed or already at correct level |

## Test Results

| Suite | Pass | Fail |
|-------|------|------|
| `bun test engine/` (all) | 113 | 193 (pre-existing Bun limitation) |
| `bun test engine/tests/migration/` | **8** | 0 |
| `bun test engine/tests/cli/migrate-workspace.smoke.test.ts` | **1** | 0 |

**Key metric**: Inverse property test (`apply(real) ∘ rollbackFromLog`) — **PASS** (byte-identical sha256 tree).

## Dry-Run Results

### dataAssets Project

| Metric | Value |
|--------|-------|
| Features discovered | **140** |
| Total operations | **579** |
| mkdir ops | 142 |
| mv ops | 295 |
| log ops | 142 |
| Warnings | **0** |

Shadow diff `workspace/dataAssets/` vs `workspace/dataAssets-shadow/` → **clean** (no content differences).

### xyzh Project

| Metric | Value |
|--------|-------|
| Features discovered | **20** |
| Total operations | **63** |
| Warnings | **0** |

### Spot-Check (5 Features Verified)

| # | Slug | Type | Artifacts | Status |
|---|------|------|-----------|--------|
| 1 | `202604-【内置规则丰富】完整性，json中key值范围校验` | Full PRD | prd + archive + xmind + tests + images | ✅ All dst correct |
| 2 | `202412-【元数据】支持DMDBforOracle类型的元数据采集` | Archive-only legacy | archive + xmind only | ✅ dst correct |
| 3 | `202604-（暂未排期）15530...` | Recent-only | prd + images only | ✅ dst correct |
| 4 | `202602-【内置规则丰富】合理性，单调递减、单调递增` | Chinese brackets | archive + xmind + prd | ✅ Brackets preserved |
| 5 | `202604-信永中和-20260408-数据目录管理...` | Complex slug | xmind only | ✅ dst correct |

### Edge Case Discovered: Cross-Month Duplicate Slugs

Same feature name (e.g., `【内置规则丰富】合理性，单调递减、单调递增`) appearing in both `202602/` and `202604/` date directories produces **two separate feature entries** (`features/202602-.../` and `features/202604-.../`). This is correct behavior — the migration uses `(yyyymm, slug)` as the composite key — but P3-B operators should verify that duplicate slugs across months are intentional.

## Data Safety Verification

| Guard | Result |
|-------|--------|
| `git diff refactor-v3-P3-snapshot..HEAD -- workspace/dataAssets/ workspace/xyzh/` | **Empty** — no real data touched |
| Snapshot tag `refactor-v3-P3-snapshot` exists | ✅ |
| Verify before each Task commit | ✅ All pass |

## Decisions for P3-B

1. **The migration script is ready for real forward.** 0 warnings on both projects, all 8 tests pass, inverse property verified.
2. **Cross-month duplicate slugs** should be verified during P3-B pre-forward snapshot review. If the same feature appears in two months, both get their own features/ directory.
3. **No changes to the script needed** before P3-B. The dry-run cleanly proves the plan is correct.
4. **P3-B must run `--mode real` on dataAssets first**, verify via `diff -rq` and smoke test, then repeat for xyzh.

## Script Artifacts

```
engine/src/migration/types.ts              — Feature, MigrationOp, MigrationLog types
engine/src/migration/v3-workspace.ts       — 4 exported functions (all TDD-built)
engine/src/cli/migrate-workspace.ts         — CLI handler (Commander)
engine/tests/migration/v3-workspace.test.ts — 8 tests (all pass)
engine/tests/cli/migrate-workspace.smoke.test.ts — 1 smoke test (passes)
engine/tests/migration/fixtures/mini-workspace/ — synthetic fixture (11 files)
```
