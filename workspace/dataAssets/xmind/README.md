# Migrated to features/

All PRD-derived artifacts (PRDs, archives, xmind cases, test scripts)
now live under `../features/{yyyymm}-{slug}/`. This bucket directory is preserved
empty as a documentation marker; legacy callers using `prdDir()` / `archiveDir()` /
etc. now redirect to the new location via `engine/src/lib/paths.ts`.

See also:
- spec: docs/superpowers/specs/2026-04-27-architecture-redesign-design.md §4.2
- migration log: refactor-v3-P3-{project}-real.log.json
