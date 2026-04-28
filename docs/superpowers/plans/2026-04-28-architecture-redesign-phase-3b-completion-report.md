# P3-B Completion Report

> **Status**: Active · **Date**: 2026-04-28
> **Scope**: P3-A fixups + real forward migration + path function redirect

## Migration Scope

| Scope | Status |
|-------|--------|
| `prds/{ym}/{slug}/` → `features/{ym}-{slug}/` | ✅ Done |
| `archive/{ym}/{slug}.md` → `features/{ym}-{slug}/archive.md` | ✅ Done |
| `xmind/{ym}/{slug}.xmind` → `features/{ym}-{slug}/cases.xmind` | ✅ Done |
| `tests/{ym}/{slug}/` → `features/{ym}-{slug}/tests/` | ✅ Done |
| `tests/fixtures/` → `shared/fixtures/` | ✅ Done |
| `tests/helpers/` → `shared/helpers/` | ✅ Done |
| Orphan reclassification (archive/数据资产-主流程用例/) | ✅ Relocated to archive/209901/ |
| Path function API (v3) | ✅ Added 5 new functions |
| Deprecated path redirects | ✅ 6 functions redirected |
| history-convert.ts path update | ✅ Routes to features/ |
| Empty directory cleanup | ✅ yyyymm subdirs removed, README markers added |

## Migration Numbers

| Project | Features | Operations | Warnings |
|---------|----------|------------|----------|
| dataAssets | **142** (140 + 2 orphan) | **585** | **0** |
| xyzh | **20** | **63** | **0** |

## Phase 0 Fixups (P3-A HIGH Issues)

| Issue | Description | Fix |
|-------|-------------|-----|
| HIGH-1 | xyzh shadow missing; dataAssets dry-run lacked skipped field | Created xyzh shadow + re-dry dataAssets with skipped tracking |
| HIGH-2 | Non-yyyymm subdirs silently ignored | discoverFeatures returns {features, skipped}; CLI warns on skipped |
| HIGH-3 | Log written only at end of applyMigration | Incremental flush every 10 mvs |

## Path API Surface

### New Functions (spec §4.3)

| Function | Returns |
|----------|---------|
| `featureDir(project, ym, slug)` | `workspace/{p}/features/{ym}-{slug}/` |
| `featureFile(project, ym, slug, ...seg)` | `featureDir(...)/{segments}` |
| `projectShared(project, kind, ...seg)` | `workspace/{p}/shared/{kind}/{segments}` |
| `incidentDir(project, ymd, slug)` | `workspace/{p}/incidents/{ymd}-{slug}/` |
| `regressionDir(project, ymd, batch)` | `workspace/{p}/regressions/{ymd}-{batch}/` |

### Deprecated Functions (redirect to features/, 6-month compat)

| Function | Redirects to |
|----------|-------------|
| `prdDir(p, ym, slug)` | `featureDir(p, ym, slug)` + console.warn |
| `prdImagesDir(p, ym, slug)` | `featureFile(p, ym, slug, "images")` + console.warn |
| `enhancedMd(p, ym, slug)` | `featureFile(p, ym, slug, "enhanced.md")` |
| `sourceFactsJson(p, ym, slug)` | `featureFile(p, ym, slug, "source-facts.json")` |
| `resolvedMd(p, ym, slug)` | `featureFile(p, ym, slug, "resolved.md")` |
| `originalPrdMd(p, ym, slug)` | `featureFile(p, ym, slug, "prd.md")` |

## Verification

| Check | Result |
|-------|--------|
| `bun test engine/` | **112 pass** (baseline maintained) |
| `bun test engine/tests/migration/` | 10 tests pass |
| `bun test engine/tests/cli/migrate-workspace.smoke.test.ts` | 1 test passes |
| `bun test engine/tests/lib/paths.test.ts` | 45 tests pass |
| dataAssets features count | 142 |
| xyzh features count | 20 |
| Git tags | P0.5, P1, P2, P3-snapshot, P3-A, P3-pre-forward, P3 |
| Rollback model | `git checkout refactor-v3-P3-pre-forward -- workspace/` restores pre-forward layout |

## Known Follow-ups

- **P3.5**: Internal reorganization of `features/{ym}-{slug}/tests/` per spec §4.5 (runners/cases/helpers/data/.debug split)
- **P5**: Skill / agent prompt path references update (path strings in agent prompts)
- **P10**: CLAUDE.md and README documentation updates to reflect v3 layout
- **P11**: Lint enforcement for new path API

## Rollback Model

- **Snapshot** (absolute floor): `git checkout refactor-v3-P3-snapshot -- workspace/` and reset to that tag
- **Pre-forward** (migration script + path API preserved, data moves reverted): `git checkout refactor-v3-P3-pre-forward -- workspace/`
- Workspace is fully git-tracked; no data loss possible through git operations
