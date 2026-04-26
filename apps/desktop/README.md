# kata Workbench (Desktop)

Tauri 2.0 + React 18 desktop client for kata Workspace, wrapping `claude` CLI.

## Dev

```bash
bun install            # from repo root
cd apps/desktop
bun run dev            # opens Tauri dev window
```

## Test

```bash
cd apps/desktop/src-tauri && cargo test
cd apps/desktop && bun test
```

## Status

- M1 complete: Preflight gate, project switcher, Apple HIG base components
- M2 in progress: PTY + StreamRenderer
- M3 todo: sessions/resume, error matrix, packaging
