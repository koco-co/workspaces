# kata Workbench Shell (Spec 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a distributable macOS desktop app (`apps/desktop/`) that wraps the `claude` CLI, provides a project switcher, streams `stream-json` output as Apple-styled UI, supports session resume, and persists task logs to `.kata/{project}/tasks/`.

**Architecture:** Tauri 2.0 desktop app. Rust backend manages PTY long sessions (one per project), parses `claude --output-format=stream-json` output line-by-line, and persists to per-project SQLite + JSONL log files under `.kata/`. React 18 + Tailwind frontend renders events as folding cards (assistant text / tool_use / tool_result / result), with a project sidebar, file tree pane, and Composer input. All UI follows Apple HIG: SF Pro fonts, vibrancy backgrounds, 8pt grid, SF Blue accents.

**Tech Stack:**
- Backend: Rust 2021 edition, Tauri 2.0, `portable-pty`, `rusqlite` + `r2d2`, `tokio`, `serde_json`, `walkdir`, `notify`
- Frontend: React 18, TypeScript 5, Vite, Tailwind CSS 3, shadcn/ui (Radix primitives), Zustand, `react-markdown`, `shiki`, `lucide-react`, `react-virtuoso`
- Plugins: `tauri-plugin-window-vibrancy`, `tauri-plugin-shell`, `tauri-plugin-fs`, `tauri-plugin-dialog`
- Tooling: Bun (workspaces), Biome (lint/format), Storybook 8, Playwright (E2E), `cargo test`, `bun test`

**Reference:** Spec — [`docs/superpowers/specs/2026-04-26-desktop-shell-spec1-design.md`](../specs/2026-04-26-desktop-shell-spec1-design.md)

---

## File Structure

### apps/desktop/ (new package)

```
apps/desktop/
├── package.json                  # bun workspace member, scripts
├── tsconfig.json                 # extends root, strict
├── biome.json                    # extends root
├── vite.config.ts                # React + Tauri plugin
├── tailwind.config.js            # Apple HIG tokens
├── postcss.config.js
├── index.html                    # Vite entry
├── README.md                     # dev usage
├── INSTALL.md                    # end-user first-run guide
├── scripts/
│   └── clear-quarantine.sh       # xattr fallback for first launch
├── .storybook/
│   ├── main.ts
│   └── preview.tsx
├── e2e/
│   ├── playwright.config.ts
│   └── *.spec.ts                 # 3 smoke flows
├── src/                          # React frontend
│   ├── main.tsx                  # ReactDOM root
│   ├── App.tsx                   # router (preflight gate vs main)
│   ├── index.css                 # Tailwind + tokens
│   ├── lib/
│   │   ├── ipc.ts                # invoke wrappers (typed)
│   │   ├── types.ts              # shared types matching Rust serde
│   │   └── format.ts             # time, byte, summary helpers
│   ├── stores/
│   │   ├── preflightStore.ts     # status + recheck
│   │   ├── projectStore.ts       # current project + list
│   │   └── workbenchStore.ts     # active task + events buffer
│   ├── components/
│   │   ├── ui/                   # base components (Apple HIG themed)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── List.tsx
│   │   │   ├── TextField.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Modal.tsx
│   │   └── Sidebar.tsx           # left rail (Projects + Sessions + FileTree)
│   └── features/
│       ├── preflight/
│       │   └── PreflightGate.tsx # 3-state gate
│       ├── projects/
│       │   └── ProjectsList.tsx
│       ├── workbench/
│       │   ├── Workbench.tsx     # main pane composition
│       │   ├── StreamRenderer.tsx
│       │   ├── Composer.tsx
│       │   └── events/
│       │       ├── AssistantText.tsx
│       │       ├── ToolUseCard.tsx
│       │       ├── ToolResultCard.tsx
│       │       └── ResultBadge.tsx
│       ├── sessions/
│       │   └── SessionsList.tsx
│       └── filetree/
│           ├── FileTree.tsx
│           └── TextPreview.tsx
└── src-tauri/                    # Rust backend
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json
    ├── icons/                    # generated from 1024×1024 PNG
    ├── src/
    │   ├── main.rs               # tauri::Builder::default()...run()
    │   ├── lib.rs                # mod exports
    │   ├── state.rs              # AppState (RwLock-protected)
    │   ├── errors.rs             # AppError enum + IPC serialization
    │   ├── preflight.rs          # claude detect + login check
    │   ├── projects.rs           # workspace scan + config metadata
    │   ├── db.rs                 # rusqlite pools, migrations
    │   ├── pty.rs                # PTY manager + state machine
    │   ├── stream.rs             # stream-json parser
    │   ├── log.rs                # task_log jsonl I/O
    │   ├── sessions.rs           # session list + resume
    │   ├── gc.rs                 # idle GC + log GC
    │   ├── diagnostics.rs        # export diagnostics
    │   └── commands/             # IPC command handlers
    │       ├── mod.rs
    │       ├── preflight.rs
    │       ├── projects.rs
    │       ├── workbench.rs      # send_input, stop_task, list_recent_tasks
    │       ├── sessions.rs
    │       ├── files.rs          # list_files, read_file, open_*
    │       └── diagnostics.rs
    └── tests/
        ├── integration_preflight.rs
        ├── integration_projects.rs
        └── integration_pty.rs
```

### Root files modified

- `package.json` — add `"apps/*"` to `workspaces`
- `bun.lock` — auto-updated by `bun install`
- `.gitignore` — confirm `apps/desktop/src-tauri/target/` is covered by existing rules; add `apps/desktop/dist/` if absent

---

## Phase 0 — Common Setup

### Task 0.1: Tauri 2.0 scaffold + bun workspace integration

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/biome.json`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src/index.css`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/build.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `package.json` (root) — workspaces field

- [ ] **Step 1: Add `apps/*` to root workspaces**

Edit `/Users/poco/Projects/kata/package.json`:

```json
{
  "workspaces": ["tools/dtstack-cli", "apps/*"]
}
```

- [ ] **Step 2: Create `apps/desktop/package.json`**

```json
{
  "name": "@kata/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "tauri": "tauri",
    "test": "bun test src/",
    "type-check": "tsc --noEmit",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@tauri-apps/api": "^2.1.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.0",
    "react-virtuoso": "^4.10.0",
    "shiki": "^1.20.0",
    "tailwind-merge": "^2.5.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.59.1",
    "@storybook/react-vite": "^8.4.0",
    "@tauri-apps/cli": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "happy-dom": "^15.0.0",
    "postcss": "^8.4.0",
    "storybook": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create `apps/desktop/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", ".storybook"]
}
```

- [ ] **Step 4: Create `apps/desktop/biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["../../biome.json"]
}
```

- [ ] **Step 5: Create `apps/desktop/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
  },
});
```

- [ ] **Step 6: Create `apps/desktop/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>kata Workbench</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `apps/desktop/src/main.tsx`**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 8: Create `apps/desktop/src/App.tsx` (placeholder)**

```typescript
export default function App() {
  return <div className="p-8">kata Workbench — bootstrap</div>;
}
```

- [ ] **Step 9: Create `apps/desktop/src/index.css` (placeholder)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Create `apps/desktop/src-tauri/Cargo.toml`**

```toml
[package]
name = "kata-workbench"
version = "0.1.0"
description = "kata Workbench desktop app"
edition = "2021"
rust-version = "1.77"

[lib]
name = "kata_workbench_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
anyhow = "1"
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = "0.3"

[dev-dependencies]
tempfile = "3"

[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

- [ ] **Step 11: Create `apps/desktop/src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 12: Create `apps/desktop/src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "kata Workbench",
  "version": "0.1.0",
  "identifier": "com.kata.workbench",
  "build": {
    "beforeDevCommand": "bun run --filter @kata/desktop dev:vite",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "bun run --filter @kata/desktop build:vite",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "kata Workbench",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 640,
        "decorations": true,
        "transparent": true,
        "titleBarStyle": "Overlay",
        "hiddenTitle": true
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "11.0",
      "frameworks": [],
      "exceptionDomain": ""
    }
  }
}
```

Add `dev:vite` and `build:vite` scripts to `apps/desktop/package.json`:

```json
"dev:vite": "vite",
"build:vite": "tsc --noEmit && vite build"
```

- [ ] **Step 13: Create `apps/desktop/src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kata_workbench_lib::run();
}
```

- [ ] **Step 14: Create `apps/desktop/src-tauri/src/lib.rs`**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 15: Install dependencies**

Run: `bun install`
Expected: `apps/desktop/node_modules/` populated; `bun.lock` updated.

- [ ] **Step 16: Verify Rust build**

Run: `cd apps/desktop/src-tauri && cargo build`
Expected: `Compiling kata-workbench v0.1.0` → `Finished` with no errors. (~3-5 min first time.)

- [ ] **Step 17: Verify dev mode launches**

Run: `cd apps/desktop && bun run dev`
Expected: Tauri window opens showing "kata Workbench — bootstrap". Close window to stop.

- [ ] **Step 18: Commit**

```bash
git add package.json bun.lock apps/desktop/
git commit -m "feat(desktop): scaffold Tauri 2.0 app with bun workspace integration"
```

---

### Task 0.2: Tailwind config + Apple HIG design tokens

**Files:**
- Create: `apps/desktop/tailwind.config.js`
- Create: `apps/desktop/postcss.config.js`
- Modify: `apps/desktop/src/index.css`

- [ ] **Step 1: Create `apps/desktop/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 2: Create `apps/desktop/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "system-ui",
          '"PingFang SC"',
          "sans-serif",
        ],
        mono: ['"SF Mono"', "Menlo", "Consolas", "monospace"],
      },
      colors: {
        accent: { light: "#007AFF", dark: "#0A84FF" },
        success: { light: "#34C759", dark: "#32D74B" },
        warning: { light: "#FF9500", dark: "#FF9F0A" },
        danger: { light: "#FF3B30", dark: "#FF453A" },
      },
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
      },
      transitionTimingFunction: {
        "apple-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "240ms",
        page: "320ms",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Replace `apps/desktop/src/index.css` with token-driven base**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: light dark;
  }
  html, body, #root { height: 100%; }
  body {
    @apply font-sans antialiased text-[15px] leading-[1.4];
    background: transparent; /* allow vibrancy */
  }
  ::selection {
    background-color: rgba(10, 132, 255, 0.25);
  }
}

@layer components {
  .vibrancy-sidebar { background: transparent; }
  .vibrancy-window { background: transparent; }
}
```

- [ ] **Step 4: Update `App.tsx` to verify tokens render**

```typescript
export default function App() {
  return (
    <div className="h-full flex items-center justify-center bg-white/30 dark:bg-black/30">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">kata Workbench</h1>
        <p className="text-sm opacity-70">Apple HIG token verification</p>
        <button className="px-4 py-2 rounded bg-accent-light dark:bg-accent-dark text-white transition-all duration-base ease-apple-out hover:opacity-90 active:scale-[0.97]">
          Test button
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run dev and verify visually**

Run: `cd apps/desktop && bun run dev`
Expected: Centered card; SF Pro font visible (Mac); button SF Blue; press effect smooth.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/
git commit -m "feat(desktop): add Tailwind config with Apple HIG design tokens"
```

---

### Task 0.3: Vibrancy plugin + window setup

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml` — add `window-vibrancy`
- Modify: `apps/desktop/src-tauri/src/lib.rs` — apply vibrancy on window create
- Modify: `apps/desktop/src-tauri/tauri.conf.json` — adjust window config

- [ ] **Step 1: Add `window-vibrancy` dependency**

Edit `apps/desktop/src-tauri/Cargo.toml`, append under `[dependencies]`:

```toml
window-vibrancy = "0.5"
```

- [ ] **Step 2: Update `lib.rs` to apply vibrancy**

```rust
use tauri::Manager;
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").expect("main window missing");
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::UnderWindowBackground,
                    Some(NSVisualEffectState::Active),
                    Some(12.0),
                )
                .expect("vibrancy unsupported on this macOS version");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Update window config in `tauri.conf.json`**

Replace the window block with:

```json
{
  "title": "kata Workbench",
  "width": 1280,
  "height": 800,
  "minWidth": 1024,
  "minHeight": 640,
  "decorations": true,
  "transparent": true,
  "titleBarStyle": "Overlay",
  "hiddenTitle": true,
  "shadow": true
}
```

- [ ] **Step 4: Update `App.tsx` to expose backdrop**

```typescript
export default function App() {
  return (
    <div className="h-full bg-white/40 dark:bg-black/40 backdrop-blur-md">
      <div className="h-full flex items-center justify-center">
        <h1 className="text-2xl font-semibold">kata Workbench (vibrancy)</h1>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run dev mode and visually verify**

Run: `cd apps/desktop && bun run dev`
Expected: Window background appears translucent (vibrancy); dragging window over colored desktop wallpaper shows blur. Traffic lights visible top-left.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/src/lib.rs apps/desktop/src-tauri/tauri.conf.json apps/desktop/src/App.tsx
git commit -m "feat(desktop): apply NSVisualEffectView vibrancy to main window"
```

---

## Phase M1 — Foundation (Week 1)

**Milestone:** App launches, preflight gate guides users through CLI/login setup, sidebar lists workspace projects, switching persists state. No PTY/conversation yet.

### Task 1.1: Rust db module — schema + migrations

**Files:**
- Create: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml` — add `rusqlite`, `r2d2`, `r2d2_sqlite`
- Modify: `apps/desktop/src-tauri/src/lib.rs` — register db module

- [ ] **Step 1: Add sqlite deps**

Append to `apps/desktop/src-tauri/Cargo.toml` `[dependencies]`:

```toml
rusqlite = { version = "0.32", features = ["bundled"] }
r2d2 = "0.8"
r2d2_sqlite = "0.25"
dirs = "5"
```

- [ ] **Step 2: Write failing test for migration runs idempotently**

Create `apps/desktop/src-tauri/src/db.rs`:

```rust
use anyhow::Result;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn open_pool(path: &Path) -> Result<DbPool> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let manager = SqliteConnectionManager::file(path);
    let pool = Pool::builder().max_size(8).build(manager)?;
    run_migrations(&pool)?;
    Ok(pool)
}

pub fn run_migrations(pool: &DbPool) -> Result<()> {
    let conn = pool.get()?;
    conn.execute_batch(include_str!("db/migrations/0001_init.sql"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn migrations_run_idempotently() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("ui.db");
        let pool = open_pool(&db_path).unwrap();
        run_migrations(&pool).unwrap(); // second run = no-op
        let conn = pool.get().unwrap();
        let count: i64 = conn
            .query_row("SELECT count(*) FROM projects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
```

Create `apps/desktop/src-tauri/src/db/migrations/0001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS projects (
  name TEXT PRIMARY KEY,
  display_name TEXT,
  path TEXT NOT NULL,
  last_active_at INTEGER,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

Append `pub mod db;` to `apps/desktop/src-tauri/src/lib.rs`.

- [ ] **Step 3: Run test — should fail (or pass on bundled sqlite first build)**

Run: `cd apps/desktop/src-tauri && cargo test db::tests::migrations_run_idempotently`
Expected: First time may compile rusqlite (~1 min). Test passes.

- [ ] **Step 4: Add tasks.db migration template (per-project schema)**

Create `apps/desktop/src-tauri/src/db/migrations/0001_tasks.sql`:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  session_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL,
  log_path TEXT NOT NULL,
  retain_until INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  first_task_id TEXT NOT NULL,
  first_input_summary TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at DESC);
```

Add helper to `db.rs`:

```rust
pub fn open_project_pool(path: &Path) -> Result<DbPool> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let manager = SqliteConnectionManager::file(path);
    let pool = Pool::builder().max_size(4).build(manager)?;
    let conn = pool.get()?;
    conn.execute_batch(include_str!("db/migrations/0001_tasks.sql"))?;
    Ok(pool)
}
```

- [ ] **Step 5: Add test for project pool migrations**

Append to `db.rs` `tests` mod:

```rust
#[test]
fn project_pool_creates_tasks_schema() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("tasks.db");
    let pool = open_project_pool(&db_path).unwrap();
    let conn = pool.get().unwrap();
    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .unwrap()
        .query_map([], |r| r.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    assert!(tables.contains(&"tasks".to_string()));
    assert!(tables.contains(&"sessions".to_string()));
}
```

- [ ] **Step 6: Run all db tests**

Run: `cd apps/desktop/src-tauri && cargo test db::`
Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "feat(desktop/db): add sqlite pools with schema migrations"
```

---

### Task 1.2: Rust db module — projects CRUD

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Write failing test for upsert_project + list_projects**

Append to `db.rs` (above `#[cfg(test)]`):

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRow {
    pub name: String,
    pub display_name: Option<String>,
    pub path: String,
    pub last_active_at: Option<i64>,
    pub metadata: Option<String>,
}

pub fn upsert_project(pool: &DbPool, row: &ProjectRow) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO projects (name, display_name, path, last_active_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(name) DO UPDATE SET
           display_name = excluded.display_name,
           path = excluded.path,
           metadata = excluded.metadata",
        rusqlite::params![row.name, row.display_name, row.path, row.last_active_at, row.metadata],
    )?;
    Ok(())
}

pub fn list_projects(pool: &DbPool) -> Result<Vec<ProjectRow>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT name, display_name, path, last_active_at, metadata
         FROM projects
         ORDER BY last_active_at DESC NULLS LAST, name ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ProjectRow {
            name: r.get(0)?,
            display_name: r.get(1)?,
            path: r.get(2)?,
            last_active_at: r.get(3)?,
            metadata: r.get(4)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn touch_project_active(pool: &DbPool, name: &str, when: i64) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE projects SET last_active_at = ?1 WHERE name = ?2",
        rusqlite::params![when, name],
    )?;
    Ok(())
}
```

Add tests:

```rust
#[test]
fn upsert_then_list_returns_project() {
    let dir = tempdir().unwrap();
    let pool = open_pool(&dir.path().join("ui.db")).unwrap();
    upsert_project(&pool, &ProjectRow {
        name: "demo".into(),
        display_name: Some("Demo".into()),
        path: "/tmp/demo".into(),
        last_active_at: None,
        metadata: None,
    }).unwrap();
    let list = list_projects(&pool).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].name, "demo");
}

#[test]
fn touch_active_updates_ordering() {
    let dir = tempdir().unwrap();
    let pool = open_pool(&dir.path().join("ui.db")).unwrap();
    upsert_project(&pool, &ProjectRow {
        name: "a".into(), display_name: None, path: "/tmp/a".into(),
        last_active_at: None, metadata: None,
    }).unwrap();
    upsert_project(&pool, &ProjectRow {
        name: "b".into(), display_name: None, path: "/tmp/b".into(),
        last_active_at: None, metadata: None,
    }).unwrap();
    touch_project_active(&pool, "b", 1000).unwrap();
    let list = list_projects(&pool).unwrap();
    assert_eq!(list[0].name, "b");
}
```

- [ ] **Step 2: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test db::`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/db.rs
git commit -m "feat(desktop/db): add project upsert/list/touch helpers"
```

---

### Task 1.3: Rust preflight — claude version detection

**Files:**
- Create: `apps/desktop/src-tauri/src/preflight.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing test that mocks `which claude`**

Create `apps/desktop/src-tauri/src/preflight.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PreflightStatus {
    Ready { version: String },
    CliMissing,
    NotLoggedIn { version: String },
}

pub fn detect_cli_version() -> Option<String> {
    let output = Command::new("claude").arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() { None } else { Some(raw) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_returns_none_when_command_absent() {
        // Override PATH to empty for this thread/test
        let saved = std::env::var("PATH").ok();
        std::env::set_var("PATH", "");
        let result = detect_cli_version();
        if let Some(v) = saved { std::env::set_var("PATH", v); }
        assert!(result.is_none());
    }
}
```

Append `pub mod preflight;` to `lib.rs`.

- [ ] **Step 2: Run test**

Run: `cd apps/desktop/src-tauri && cargo test preflight::tests::detect_returns_none_when_command_absent`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/preflight.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop/preflight): detect claude CLI version"
```

---

### Task 1.4: Rust preflight — login state + status aggregation

**Files:**
- Modify: `apps/desktop/src-tauri/src/preflight.rs`

- [ ] **Step 1: Write failing test for `check()` aggregation**

Append to `preflight.rs` (above `#[cfg(test)]`):

```rust
use std::path::PathBuf;

pub fn detect_login_state(home: Option<PathBuf>) -> bool {
    let home = match home.or_else(dirs::home_dir) {
        Some(h) => h,
        None => return false,
    };
    let config = home.join(".claude").join("config.json");
    if !config.exists() {
        return false;
    }
    // login is considered established if config.json contains an "oauth" or "apiKey" field
    let contents = std::fs::read_to_string(&config).unwrap_or_default();
    contents.contains("\"oauth\"") || contents.contains("\"apiKey\"")
}

pub fn check() -> PreflightStatus {
    match detect_cli_version() {
        None => PreflightStatus::CliMissing,
        Some(version) => {
            if detect_login_state(None) {
                PreflightStatus::Ready { version }
            } else {
                PreflightStatus::NotLoggedIn { version }
            }
        }
    }
}
```

Append tests:

```rust
#[test]
fn login_state_false_when_no_config() {
    let dir = tempfile::tempdir().unwrap();
    assert!(!detect_login_state(Some(dir.path().to_path_buf())));
}

#[test]
fn login_state_true_when_config_has_oauth() {
    let dir = tempfile::tempdir().unwrap();
    let config_dir = dir.path().join(".claude");
    std::fs::create_dir_all(&config_dir).unwrap();
    std::fs::write(
        config_dir.join("config.json"),
        r#"{"oauth": {"token": "abc"}}"#,
    ).unwrap();
    assert!(detect_login_state(Some(dir.path().to_path_buf())));
}
```

Add `tempfile = "3"` to `[dev-dependencies]` (already added in 0.1).

- [ ] **Step 2: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test preflight::`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/preflight.rs
git commit -m "feat(desktop/preflight): add login-state detection and check() aggregation"
```

---

### Task 1.5: Rust projects — workspace scan

**Files:**
- Create: `apps/desktop/src-tauri/src/projects.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml` — add `walkdir`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add walkdir dep**

Append to `Cargo.toml` `[dependencies]`:

```toml
walkdir = "2"
```

- [ ] **Step 2: Write failing test for `scan(workspace_root)`**

Create `apps/desktop/src-tauri/src/projects.rs`:

```rust
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectInfo {
    pub name: String,
    pub display_name: Option<String>,
    pub path: PathBuf,
}

pub fn scan(workspace_root: &Path) -> Result<Vec<ProjectInfo>> {
    if !workspace_root.exists() {
        return Ok(Vec::new());
    }
    let mut projects = Vec::new();
    for entry in std::fs::read_dir(workspace_root)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if !metadata.is_dir() { continue; }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') { continue; }
        projects.push(ProjectInfo {
            name: name.clone(),
            display_name: None,
            path: entry.path(),
        });
    }
    projects.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(projects)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn scan_empty_workspace_returns_empty_list() {
        let dir = tempdir().unwrap();
        assert!(scan(dir.path()).unwrap().is_empty());
    }

    #[test]
    fn scan_lists_project_subdirs() {
        let dir = tempdir().unwrap();
        std::fs::create_dir(dir.path().join("foo")).unwrap();
        std::fs::create_dir(dir.path().join("bar")).unwrap();
        let projects = scan(dir.path()).unwrap();
        assert_eq!(projects.len(), 2);
        assert_eq!(projects[0].name, "bar");
        assert_eq!(projects[1].name, "foo");
    }

    #[test]
    fn scan_skips_dotfiles_and_files() {
        let dir = tempdir().unwrap();
        std::fs::create_dir(dir.path().join(".kata")).unwrap();
        std::fs::write(dir.path().join("README.md"), "x").unwrap();
        std::fs::create_dir(dir.path().join("real")).unwrap();
        let projects = scan(dir.path()).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "real");
    }
}
```

Append `pub mod projects;` to `lib.rs`.

- [ ] **Step 3: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test projects::`
Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/src/projects.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop/projects): scan workspace dir for project subdirs"
```

---

### Task 1.6: Rust projects — config metadata merge

**Files:**
- Modify: `apps/desktop/src-tauri/src/projects.rs`

- [ ] **Step 1: Write failing test for `load_metadata(config_path)`**

Append to `projects.rs`:

```rust
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct ProjectMetadata {
    pub display_name: Option<String>,
    pub raw: Option<String>,
}

pub fn load_metadata(config_path: &Path) -> Result<HashMap<String, ProjectMetadata>> {
    if !config_path.exists() {
        return Ok(HashMap::new());
    }
    let raw = std::fs::read_to_string(config_path)?;
    let json: serde_json::Value = serde_json::from_str(&raw)?;
    let projects = json.get("projects").and_then(|v| v.as_object());
    let mut out = HashMap::new();
    if let Some(map) = projects {
        for (name, value) in map.iter() {
            let display_name = value
                .get("displayName")
                .and_then(|v| v.as_str())
                .map(String::from);
            out.insert(
                name.clone(),
                ProjectMetadata {
                    display_name,
                    raw: Some(value.to_string()),
                },
            );
        }
    }
    Ok(out)
}

pub fn scan_with_metadata(
    workspace_root: &Path,
    config_path: &Path,
) -> Result<Vec<ProjectInfo>> {
    let mut projects = scan(workspace_root)?;
    let metadata = load_metadata(config_path)?;
    for p in &mut projects {
        if let Some(meta) = metadata.get(&p.name) {
            p.display_name = meta.display_name.clone();
        }
    }
    Ok(projects)
}
```

Append tests:

```rust
#[test]
fn load_metadata_returns_empty_when_file_absent() {
    let dir = tempdir().unwrap();
    let metadata = load_metadata(&dir.path().join("nope.json")).unwrap();
    assert!(metadata.is_empty());
}

#[test]
fn load_metadata_extracts_displayName() {
    let dir = tempdir().unwrap();
    let cfg = dir.path().join("config.json");
    std::fs::write(&cfg, r#"{"projects": {"foo": {"displayName": "Foo Project"}}}"#).unwrap();
    let metadata = load_metadata(&cfg).unwrap();
    assert_eq!(metadata.get("foo").unwrap().display_name.as_deref(), Some("Foo Project"));
}

#[test]
fn scan_with_metadata_merges_displayName() {
    let dir = tempdir().unwrap();
    std::fs::create_dir(dir.path().join("foo")).unwrap();
    let cfg = dir.path().join("config.json");
    std::fs::write(&cfg, r#"{"projects": {"foo": {"displayName": "Foo"}}}"#).unwrap();
    let projects = scan_with_metadata(dir.path(), &cfg).unwrap();
    assert_eq!(projects[0].display_name.as_deref(), Some("Foo"));
}
```

- [ ] **Step 2: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test projects::`
Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/projects.rs
git commit -m "feat(desktop/projects): merge config.json metadata into project list"
```

---

### Task 1.7: AppState + paths helper

**Files:**
- Create: `apps/desktop/src-tauri/src/state.rs`
- Create: `apps/desktop/src-tauri/src/paths.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create `paths.rs`**

```rust
use std::path::PathBuf;

pub fn kata_root() -> PathBuf {
    if let Ok(v) = std::env::var("KATA_ROOT") {
        return PathBuf::from(v);
    }
    if let Some(home) = dirs::home_dir() {
        return home.join("Projects").join("kata");
    }
    PathBuf::from(".")
}

pub fn workspace_root() -> PathBuf {
    kata_root().join("workspace")
}

pub fn kata_data_root() -> PathBuf {
    kata_root().join(".kata")
}

pub fn config_json_path() -> PathBuf {
    kata_root().join("config.json")
}

pub fn desktop_state_dir() -> PathBuf {
    kata_data_root().join("_desktop")
}

pub fn ui_db_path() -> PathBuf {
    desktop_state_dir().join("ui.db")
}

pub fn project_data_dir(project: &str) -> PathBuf {
    kata_data_root().join(project)
}

pub fn project_tasks_dir(project: &str) -> PathBuf {
    project_data_dir(project).join("tasks")
}

pub fn project_db_path(project: &str) -> PathBuf {
    project_data_dir(project).join("tasks.db")
}

pub fn errors_log_path() -> PathBuf {
    desktop_state_dir().join("errors.log")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kata_root_uses_env_when_set() {
        std::env::set_var("KATA_ROOT", "/tmp/test-kata");
        assert_eq!(kata_root(), PathBuf::from("/tmp/test-kata"));
        std::env::remove_var("KATA_ROOT");
    }

    #[test]
    fn project_paths_resolve_under_kata_data_root() {
        std::env::set_var("KATA_ROOT", "/tmp/x");
        assert_eq!(project_data_dir("foo"), PathBuf::from("/tmp/x/.kata/foo"));
        assert_eq!(project_db_path("foo"), PathBuf::from("/tmp/x/.kata/foo/tasks.db"));
        std::env::remove_var("KATA_ROOT");
    }
}
```

- [ ] **Step 2: Create `state.rs`**

```rust
use crate::db::DbPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub ui_db: DbPool,
    pub project_dbs: RwLock<HashMap<String, DbPool>>,
    pub current_project: RwLock<Option<String>>,
}

impl AppState {
    pub fn new(ui_db: DbPool) -> Arc<Self> {
        Arc::new(Self {
            ui_db,
            project_dbs: RwLock::new(HashMap::new()),
            current_project: RwLock::new(None),
        })
    }

    pub async fn project_db(&self, project: &str) -> anyhow::Result<DbPool> {
        {
            let map = self.project_dbs.read().await;
            if let Some(p) = map.get(project) {
                return Ok(p.clone());
            }
        }
        let path = crate::paths::project_db_path(project);
        let pool = crate::db::open_project_pool(&path)?;
        let mut map = self.project_dbs.write().await;
        map.insert(project.to_string(), pool.clone());
        Ok(pool)
    }
}
```

- [ ] **Step 3: Wire AppState in `lib.rs`**

```rust
pub mod db;
pub mod paths;
pub mod preflight;
pub mod projects;
pub mod state;

use std::sync::Arc;
use tauri::Manager;
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").expect("main window missing");
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::UnderWindowBackground,
                    Some(NSVisualEffectState::Active),
                    Some(12.0),
                ).expect("vibrancy unsupported");
            }
            let ui_db_path = paths::ui_db_path();
            let ui_db = db::open_pool(&ui_db_path).expect("ui.db open failed");
            let state = state::AppState::new(ui_db);
            app.manage(state);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test paths::`
Expected: 2 tests pass.

- [ ] **Step 5: Run dev mode and verify ui.db is created**

Run: `cd apps/desktop && bun run dev` (then quit)
Expected: `~/Projects/kata/.kata/_desktop/ui.db` exists.

```bash
ls -la ~/Projects/kata/.kata/_desktop/ui.db
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat(desktop/state): add paths helper and AppState with sqlite pools"
```

---

### Task 1.8: IPC — preflight + projects commands

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/mod.rs`
- Create: `apps/desktop/src-tauri/src/commands/preflight.rs`
- Create: `apps/desktop/src-tauri/src/commands/projects.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create `commands/mod.rs`**

```rust
pub mod preflight;
pub mod projects;
```

- [ ] **Step 2: Create `commands/preflight.rs`**

```rust
use crate::preflight::{check, PreflightStatus};

#[tauri::command]
pub fn get_preflight_status() -> PreflightStatus {
    check()
}

#[tauri::command]
pub fn recheck() -> PreflightStatus {
    check()
}
```

- [ ] **Step 3: Create `commands/projects.rs`**

```rust
use crate::db::{list_projects, touch_project_active, upsert_project, ProjectRow};
use crate::paths::{config_json_path, workspace_root};
use crate::projects::scan_with_metadata;
use crate::state::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct ProjectDto {
    pub name: String,
    pub display_name: Option<String>,
    pub path: String,
    pub last_active_at: Option<i64>,
}

#[tauri::command]
pub async fn list_projects_cmd(state: State<'_, Arc<AppState>>) -> Result<Vec<ProjectDto>, String> {
    let scanned = scan_with_metadata(&workspace_root(), &config_json_path())
        .map_err(|e| e.to_string())?;
    for info in &scanned {
        upsert_project(&state.ui_db, &ProjectRow {
            name: info.name.clone(),
            display_name: info.display_name.clone(),
            path: info.path.to_string_lossy().into_owned(),
            last_active_at: None,
            metadata: None,
        }).map_err(|e| e.to_string())?;
    }
    let rows = list_projects(&state.ui_db).map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| ProjectDto {
        name: r.name,
        display_name: r.display_name,
        path: r.path,
        last_active_at: r.last_active_at,
    }).collect())
}

#[tauri::command]
pub async fn switch_project_cmd(
    state: State<'_, Arc<AppState>>,
    name: String,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;
    touch_project_active(&state.ui_db, &name, now).map_err(|e| e.to_string())?;
    *state.current_project.write().await = Some(name);
    Ok(())
}
```

- [ ] **Step 4: Register commands in `lib.rs`**

Add `pub mod commands;` to module list. Update `run()`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::preflight::get_preflight_status,
    commands::preflight::recheck,
    commands::projects::list_projects_cmd,
    commands::projects::switch_project_cmd,
])
```

- [ ] **Step 5: Verify `cargo check`**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat(desktop/ipc): add preflight + projects commands"
```

---

### Task 1.9: Frontend — IPC wrapper + types

**Files:**
- Create: `apps/desktop/src/lib/types.ts`
- Create: `apps/desktop/src/lib/ipc.ts`

- [ ] **Step 1: Create `src/lib/types.ts`**

```typescript
export type PreflightStatus =
  | { kind: "ready"; version: string }
  | { kind: "cli_missing" }
  | { kind: "not_logged_in"; version: string };

export interface ProjectDto {
  name: string;
  display_name: string | null;
  path: string;
  last_active_at: number | null;
}

export type PtyState = "NotSpawned" | "Spawning" | "Idle" | "Active" | "Closed";
export type TaskStatus = "running" | "success" | "failed" | "cancelled";
```

- [ ] **Step 2: Create `src/lib/ipc.ts`**

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { PreflightStatus, ProjectDto } from "./types";

export const ipc = {
  getPreflightStatus: () => invoke<PreflightStatus>("get_preflight_status"),
  recheck: () => invoke<PreflightStatus>("recheck"),
  listProjects: () => invoke<ProjectDto[]>("list_projects_cmd"),
  switchProject: (name: string) =>
    invoke<void>("switch_project_cmd", { name }),
};
```

- [ ] **Step 3: Smoke-test by adding a test page in App.tsx**

Replace `App.tsx` temporarily:

```typescript
import { useEffect, useState } from "react";
import { ipc } from "./lib/ipc";
import type { PreflightStatus, ProjectDto } from "./lib/types";

export default function App() {
  const [pf, setPf] = useState<PreflightStatus | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  useEffect(() => {
    ipc.getPreflightStatus().then(setPf);
    ipc.listProjects().then(setProjects);
  }, []);
  return (
    <div className="h-full p-8 bg-white/40 dark:bg-black/40">
      <pre className="text-sm">{JSON.stringify({ pf, projects }, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 4: Run dev and verify**

Run: `cd apps/desktop && bun run dev`
Expected: Window shows preflight status and projects array (likely scanning real `~/Projects/kata/workspace/`).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop/ipc): add typed IPC wrapper for preflight + projects"
```

---

### Task 1.10: Frontend — base UI components (Button/Card/List/etc.)

**Files:**
- Create: `apps/desktop/src/components/ui/Button.tsx`
- Create: `apps/desktop/src/components/ui/Card.tsx`
- Create: `apps/desktop/src/components/ui/List.tsx`
- Create: `apps/desktop/src/components/ui/TextField.tsx`
- Create: `apps/desktop/src/components/ui/Spinner.tsx`
- Create: `apps/desktop/src/components/ui/Toast.tsx`
- Create: `apps/desktop/src/lib/cn.ts`

- [ ] **Step 1: Create `src/lib/cn.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create `Button.tsx`**

```typescript
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: "bg-accent-light dark:bg-accent-dark text-white hover:opacity-90",
  secondary: "bg-black/5 dark:bg-white/10 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/15",
  ghost: "bg-transparent text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10",
  danger: "bg-danger-light dark:bg-danger-dark text-white hover:opacity-90",
};

const sizeClass: Record<Size, string> = {
  sm: "h-7 px-3 text-[13px] rounded-sm",
  md: "h-9 px-4 text-[14px] rounded",
  lg: "h-11 px-5 text-[15px] rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading, disabled, children, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium",
        "transition-all duration-base ease-apple-out",
        "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {loading ? <span className="opacity-70">…</span> : children}
    </button>
  ),
);
Button.displayName = "Button";
```

- [ ] **Step 3: Create `Card.tsx`**

```typescript
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-md bg-white/60 dark:bg-black/40 backdrop-blur-sm",
        "border border-black/5 dark:border-white/10",
        className,
      )}
      {...rest}
    />
  ),
);
Card.displayName = "Card";
```

- [ ] **Step 4: Create `List.tsx`**

```typescript
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ListItemProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function ListItem({ selected, onClick, children, className }: ListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left px-3 py-2 text-[14px] rounded",
        "transition-all duration-fast ease-apple-out",
        "hover:bg-black/5 dark:hover:bg-white/10",
        selected && "bg-black/8 dark:bg-white/15",
        className,
      )}
    >
      {selected && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent-light dark:bg-accent-dark" />
      )}
      {children}
    </button>
  );
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-0.5", className)}>{children}</div>;
}
```

- [ ] **Step 5: Create `TextField.tsx`**

```typescript
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextField = forwardRef<HTMLTextAreaElement, TextFieldProps>(
  ({ className, invalid, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-3 py-2 text-[14px] rounded resize-none",
        "bg-white/70 dark:bg-black/30 border",
        invalid ? "border-danger-light dark:border-danger-dark" : "border-black/10 dark:border-white/15",
        "focus:outline-none focus:ring-2 focus:ring-accent-light/50 dark:focus:ring-accent-dark/50",
        "transition-all duration-fast ease-apple-out",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    />
  ),
);
TextField.displayName = "TextField";
```

- [ ] **Step 6: Create `Spinner.tsx`**

```typescript
import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-4 h-4 border-2 rounded-full",
        "border-current border-r-transparent animate-spin",
        className,
      )}
      role="status"
      aria-label="loading"
    />
  );
}
```

- [ ] **Step 7: Create `Toast.tsx`**

```typescript
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type ToastKind = "info" | "success" | "warning" | "danger";

interface ToastProps {
  kind?: ToastKind;
  message: string;
  durationMs?: number;
  onDismiss?: () => void;
}

const kindClass: Record<ToastKind, string> = {
  info: "bg-black/80 dark:bg-white/15 text-white",
  success: "bg-success-light dark:bg-success-dark text-white",
  warning: "bg-warning-light dark:bg-warning-dark text-white",
  danger: "bg-danger-light dark:bg-danger-dark text-white",
};

export function Toast({ kind = "info", message, durationMs = 3200, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  if (!visible) return null;
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-[14px] shadow-lg",
        "transition-all duration-base ease-apple-out",
        kindClass[kind],
      )}
      role="status"
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 8: Visual verify by replacing App.tsx temporarily**

```typescript
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { List, ListItem } from "./components/ui/List";
import { TextField } from "./components/ui/TextField";
import { Spinner } from "./components/ui/Spinner";

export default function App() {
  return (
    <div className="h-full p-8 bg-white/40 dark:bg-black/40 space-y-4">
      <div className="space-x-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button loading>Loading</Button>
      </div>
      <Card className="p-4">Card body</Card>
      <List>
        <ListItem>List item 1</ListItem>
        <ListItem selected>Selected item</ListItem>
        <ListItem>List item 3</ListItem>
      </List>
      <TextField placeholder="Type here…" rows={3} />
      <div><Spinner /> Loading…</div>
    </div>
  );
}
```

Run: `cd apps/desktop && bun run dev`
Expected: All variants render with Apple HIG aesthetic; press effects smooth.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop/ui): add Apple HIG base components (Button/Card/List/TextField/Spinner/Toast)"
```

---

### Task 1.11: Frontend — Zustand stores

**Files:**
- Create: `apps/desktop/src/stores/preflightStore.ts`
- Create: `apps/desktop/src/stores/projectStore.ts`

- [ ] **Step 1: Create `preflightStore.ts`**

```typescript
import { create } from "zustand";
import { ipc } from "@/lib/ipc";
import type { PreflightStatus } from "@/lib/types";

interface PreflightState {
  status: PreflightStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const usePreflightStore = create<PreflightState>((set) => ({
  status: null,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const status = await ipc.recheck();
      set({ status, loading: false });
    } catch (e) {
      console.error("preflight refresh failed", e);
      set({ loading: false });
    }
  },
}));
```

- [ ] **Step 2: Create `projectStore.ts`**

```typescript
import { create } from "zustand";
import { ipc } from "@/lib/ipc";
import type { ProjectDto } from "@/lib/types";

interface ProjectState {
  projects: ProjectDto[];
  current: string | null;
  loading: boolean;
  load: () => Promise<void>;
  switchTo: (name: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  current: null,
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const projects = await ipc.listProjects();
      const current = get().current ?? projects[0]?.name ?? null;
      set({ projects, current, loading: false });
    } catch (e) {
      console.error("load projects failed", e);
      set({ loading: false });
    }
  },
  switchTo: async (name) => {
    await ipc.switchProject(name);
    set({ current: name });
  },
}));
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/stores/
git commit -m "feat(desktop/stores): add Zustand stores for preflight + project state"
```

---

### Task 1.12: Frontend — PreflightGate (3-state)

**Files:**
- Create: `apps/desktop/src/features/preflight/PreflightGate.tsx`

- [ ] **Step 1: Create `PreflightGate.tsx`**

```typescript
import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { usePreflightStore } from "@/stores/preflightStore";
import type { ReactNode } from "react";

const CLAUDE_INSTALL_DOCS = "https://docs.claude.com/en/docs/claude-code";

interface GateProps { children: ReactNode }

export function PreflightGate({ children }: GateProps) {
  const { status, loading, refresh } = usePreflightStore();

  useEffect(() => {
    if (status === null) refresh();
  }, [status, refresh]);

  if (status === null) {
    return <Centered><Spinner /></Centered>;
  }
  if (status.kind === "ready") {
    return <>{children}</>;
  }
  if (status.kind === "cli_missing") {
    return (
      <Centered>
        <Card className="p-8 max-w-md space-y-4 text-center">
          <h2 className="text-xl font-semibold">Claude Code CLI 不可用</h2>
          <p className="text-sm opacity-70">
            kata Workbench 依赖 <code>claude</code> 命令。请先安装并确保它在 PATH 中。
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="primary" onClick={() => open(CLAUDE_INSTALL_DOCS)}>
              查看安装文档
            </Button>
            <Button onClick={refresh} loading={loading}>重新检测</Button>
          </div>
        </Card>
      </Centered>
    );
  }
  // not_logged_in
  return (
    <Centered>
      <Card className="p-8 max-w-md space-y-4 text-center">
        <h2 className="text-xl font-semibold">尚未登录 Claude</h2>
        <p className="text-sm opacity-70">
          已检测到 CLI（{status.version}），但还未登录。请在终端运行 <code>claude login</code>。
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="primary" onClick={() => open("x-terminal:")}>打开终端</Button>
          <Button onClick={refresh} loading={loading}>重新检测</Button>
        </div>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center bg-white/40 dark:bg-black/40">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx**

```typescript
import { PreflightGate } from "./features/preflight/PreflightGate";

export default function App() {
  return (
    <PreflightGate>
      <div className="h-full p-8">主界面占位（待 Task 1.13 实现 Sidebar）</div>
    </PreflightGate>
  );
}
```

- [ ] **Step 3: Run dev mode**

Run: `cd apps/desktop && bun run dev`
Expected: If logged in, see "主界面占位"; if not, see appropriate gate. Click "重新检测" works.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop/preflight): add PreflightGate with 3-state guidance"
```

---

### Task 1.13: Frontend — Sidebar + ProjectsList

**Files:**
- Create: `apps/desktop/src/components/Sidebar.tsx`
- Create: `apps/desktop/src/features/projects/ProjectsList.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create `ProjectsList.tsx`**

```typescript
import { useEffect } from "react";
import { List, ListItem } from "@/components/ui/List";
import { Spinner } from "@/components/ui/Spinner";
import { useProjectStore } from "@/stores/projectStore";

export function ProjectsList() {
  const { projects, current, loading, load, switchTo } = useProjectStore();

  useEffect(() => { load(); }, [load]);

  if (loading && projects.length === 0) {
    return <div className="p-3"><Spinner /></div>;
  }
  if (projects.length === 0) {
    return <div className="p-3 text-[13px] opacity-60">未找到项目</div>;
  }
  return (
    <List className="p-1.5">
      {projects.map((p) => (
        <ListItem
          key={p.name}
          selected={current === p.name}
          onClick={() => switchTo(p.name)}
        >
          <div className="flex items-center justify-between">
            <span className="truncate">{p.display_name ?? p.name}</span>
          </div>
        </ListItem>
      ))}
    </List>
  );
}
```

- [ ] **Step 2: Create `Sidebar.tsx`**

```typescript
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ProjectsList } from "@/features/projects/ProjectsList";

interface SidebarProps {
  className?: string;
  bottomSlot?: ReactNode;
}

export function Sidebar({ className, bottomSlot }: SidebarProps) {
  return (
    <aside className={cn(
      "vibrancy-sidebar h-full w-[260px] flex flex-col",
      "border-r border-black/8 dark:border-white/10",
      className,
    )}>
      <div className="px-3 pt-12 pb-2 text-[11px] uppercase tracking-wider opacity-50">
        Projects
      </div>
      <div className="flex-1 overflow-y-auto">
        <ProjectsList />
      </div>
      {bottomSlot ? <div className="border-t border-black/8 dark:border-white/10">{bottomSlot}</div> : null}
    </aside>
  );
}
```

- [ ] **Step 3: Update `App.tsx`**

```typescript
import { PreflightGate } from "./features/preflight/PreflightGate";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  return (
    <PreflightGate>
      <div className="h-full flex bg-white/40 dark:bg-black/40">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-sm opacity-60">
            主工作区（M2 实现 Workbench；当前为占位）
          </p>
        </main>
      </div>
    </PreflightGate>
  );
}
```

- [ ] **Step 4: Run dev and verify**

Run: `cd apps/desktop && bun run dev`
Expected: Sidebar with project list; clicking switches selection (left bar indicator); state persists across restart.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop/projects): add Sidebar + ProjectsList wired to project store"
```

---

### Task 1.14: M1 manual smoke test + handoff

**Files:**
- Create: `apps/desktop/README.md`

- [ ] **Step 1: Create `apps/desktop/README.md`**

```markdown
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
```

- [ ] **Step 2: Run M1 manual smoke checklist**

Verify:
- [ ] `bun run dev` opens window
- [ ] Vibrancy effect visible (drag window over colored desktop)
- [ ] Preflight gate shows correct state
- [ ] After login, sidebar lists `workspace/*/`
- [ ] Switching project highlights left accent bar
- [ ] Restart app: last selected project remains
- [ ] `cargo test` passes (db, preflight, projects, paths)
- [ ] No console errors in DevTools

- [ ] **Step 3: Run all tests**

Run:
```bash
cd apps/desktop/src-tauri && cargo test
cd apps/desktop && bun run type-check
```
Expected: all green.

- [ ] **Step 4: Commit M1 milestone**

```bash
git add apps/desktop/README.md
git commit -m "docs(desktop): add README and complete M1 (foundation) milestone"
```

---

## Phase M2 — Conversation Flow (Week 2)

**Milestone:** User selects a project, types a slash command in Composer, sees full stream-json events render with folding cards. File tree shows `workspace/{project}/`; dragging a file injects `@relative-path` into Composer.

### Task 2.1: Rust stream parser

**Files:**
- Create: `apps/desktop/src-tauri/src/stream.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing tests for parse_line**

Create `apps/desktop/src-tauri/src/stream.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "system")]
    System { subtype: String, #[serde(flatten)] payload: serde_json::Value },
    #[serde(rename = "assistant")]
    Assistant { message: serde_json::Value },
    #[serde(rename = "user")]
    User { message: serde_json::Value },
    #[serde(rename = "result")]
    Result { #[serde(flatten)] payload: serde_json::Value },
    #[serde(other)]
    Unknown,
}

#[derive(Debug)]
pub enum ParseOutcome {
    Event(StreamEvent),
    Skip { reason: String, raw: String },
}

pub fn parse_line(line: &str) -> ParseOutcome {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return ParseOutcome::Skip { reason: "empty".into(), raw: line.into() };
    }
    match serde_json::from_str::<StreamEvent>(trimmed) {
        Ok(ev) => ParseOutcome::Event(ev),
        Err(e) => ParseOutcome::Skip { reason: e.to_string(), raw: line.into() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_system_init() {
        let line = r#"{"type":"system","subtype":"init","session_id":"abc"}"#;
        match parse_line(line) {
            ParseOutcome::Event(StreamEvent::System { subtype, .. }) => assert_eq!(subtype, "init"),
            _ => panic!("expected system event"),
        }
    }

    #[test]
    fn parses_assistant_message() {
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}"#;
        match parse_line(line) {
            ParseOutcome::Event(StreamEvent::Assistant { .. }) => {}
            _ => panic!("expected assistant event"),
        }
    }

    #[test]
    fn parses_result() {
        let line = r#"{"type":"result","total_cost_usd":0.1,"duration_ms":4200}"#;
        assert!(matches!(parse_line(line), ParseOutcome::Event(StreamEvent::Result { .. })));
    }

    #[test]
    fn skips_non_json() {
        match parse_line("not json") {
            ParseOutcome::Skip { reason, .. } => assert!(!reason.is_empty()),
            _ => panic!("expected skip"),
        }
    }

    #[test]
    fn skips_empty_line() {
        assert!(matches!(parse_line(""), ParseOutcome::Skip { .. }));
    }

    #[test]
    fn unknown_type_falls_through() {
        let line = r#"{"type":"weird"}"#;
        match parse_line(line) {
            ParseOutcome::Event(StreamEvent::Unknown) => {}
            _ => panic!("expected unknown variant"),
        }
    }
}
```

Append `pub mod stream;` to `lib.rs`.

- [ ] **Step 2: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test stream::`
Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/stream.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop/stream): add stream-json line parser with skip-on-error"
```

---

### Task 2.2: Rust task_log module

**Files:**
- Create: `apps/desktop/src-tauri/src/log.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing test for append + close**

Create `apps/desktop/src-tauri/src/log.rs`:

```rust
use anyhow::Result;
use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use tokio::sync::Mutex;

pub struct TaskLog {
    pub path: PathBuf,
    writer: Mutex<Option<BufWriter<File>>>,
}

impl TaskLog {
    pub fn open(path: PathBuf) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file = OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Self {
            path,
            writer: Mutex::new(Some(BufWriter::new(file))),
        })
    }

    pub async fn append_line(&self, line: &str) -> Result<()> {
        let mut guard = self.writer.lock().await;
        if let Some(w) = guard.as_mut() {
            w.write_all(line.as_bytes())?;
            if !line.ends_with('\n') {
                w.write_all(b"\n")?;
            }
            w.flush()?;
        }
        Ok(())
    }

    pub async fn close(&self) -> Result<()> {
        let mut guard = self.writer.lock().await;
        guard.take(); // drops the BufWriter, flushes on drop
        Ok(())
    }

    pub fn size_bytes(path: &Path) -> u64 {
        std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
    }
}

pub const MAX_LOG_SIZE_BYTES: u64 = 50 * 1024 * 1024;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn append_and_read_back() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("task.jsonl");
        let log = TaskLog::open(path.clone()).unwrap();
        log.append_line(r#"{"type":"x"}"#).await.unwrap();
        log.append_line(r#"{"type":"y"}"#).await.unwrap();
        log.close().await.unwrap();
        let contents = std::fs::read_to_string(&path).unwrap();
        assert_eq!(contents, "{\"type\":\"x\"}\n{\"type\":\"y\"}\n");
    }

    #[tokio::test]
    async fn size_bytes_reflects_content() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("size.jsonl");
        let log = TaskLog::open(path.clone()).unwrap();
        log.append_line("hello").await.unwrap();
        log.close().await.unwrap();
        assert_eq!(TaskLog::size_bytes(&path), 6); // "hello\n"
    }
}
```

Append `pub mod log;` to `lib.rs`.

- [ ] **Step 2: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test log::`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/log.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop/log): add jsonl task log with async append + flush-on-close"
```

---

### Task 2.3: Rust pty module — spawn + state machine

**Files:**
- Create: `apps/desktop/src-tauri/src/pty.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml` — add `portable-pty`, `bytes`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add deps**

Append to `Cargo.toml` `[dependencies]`:

```toml
portable-pty = "0.8"
bytes = "1"
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 2: Write pty manager skeleton with state machine**

Create `apps/desktop/src-tauri/src/pty.rs`:

```rust
use anyhow::{anyhow, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PtyState {
    NotSpawned,
    Spawning,
    Idle,
    Active,
    Closed,
}

pub struct PtyHandle {
    pub project: String,
    pub state: RwLock<PtyState>,
    pub stdin: Mutex<Option<Box<dyn std::io::Write + Send>>>,
    pub session_id: RwLock<Option<String>>,
    pub child_killer: Mutex<Option<Box<dyn portable_pty::ChildKiller + Send + Sync>>>,
}

impl PtyHandle {
    pub fn new(project: String) -> Arc<Self> {
        Arc::new(Self {
            project,
            state: RwLock::new(PtyState::NotSpawned),
            stdin: Mutex::new(None),
            session_id: RwLock::new(None),
            child_killer: Mutex::new(None),
        })
    }

    pub async fn write_input(&self, text: &str) -> Result<()> {
        let mut guard = self.stdin.lock().await;
        let stdin = guard.as_mut().ok_or_else(|| anyhow!("PTY stdin not available"))?;
        stdin.write_all(text.as_bytes())?;
        if !text.ends_with('\n') {
            stdin.write_all(b"\n")?;
        }
        stdin.flush()?;
        Ok(())
    }

    pub async fn kill(&self) -> Result<()> {
        let mut guard = self.child_killer.lock().await;
        if let Some(killer) = guard.as_mut() {
            let _ = killer.kill();
        }
        *self.state.write().await = PtyState::Closed;
        Ok(())
    }
}

pub struct PtyManager {
    handles: RwLock<HashMap<String, Arc<PtyHandle>>>,
}

impl PtyManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self { handles: RwLock::new(HashMap::new()) })
    }

    pub async fn get_or_spawn(
        &self,
        project: &str,
        cwd: PathBuf,
        resume_session: Option<&str>,
    ) -> Result<(Arc<PtyHandle>, mpsc::UnboundedReceiver<String>)> {
        {
            let map = self.handles.read().await;
            if let Some(h) = map.get(project) {
                let state = h.state.read().await.clone();
                if state == PtyState::Idle || state == PtyState::Active {
                    let (_tx, rx) = mpsc::unbounded_channel();
                    return Ok((h.clone(), rx));
                }
            }
        }

        let handle = PtyHandle::new(project.to_string());
        *handle.state.write().await = PtyState::Spawning;

        let pair = native_pty_system().openpty(PtySize {
            rows: 40, cols: 120, pixel_width: 0, pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new("claude");
        cmd.cwd(&cwd);
        cmd.arg("--output-format=stream-json");
        cmd.arg("--print");
        if let Some(sid) = resume_session {
            cmd.arg("--resume").arg(sid);
        }

        let mut child = pair.slave.spawn_command(cmd)?;
        let killer = child.clone_killer();
        *handle.child_killer.lock().await = Some(killer);

        let stdin = pair.master.take_writer()?;
        *handle.stdin.lock().await = Some(stdin);

        let mut reader = pair.master.try_clone_reader()?;
        let (tx, rx) = mpsc::unbounded_channel::<String>();
        let handle_for_task = handle.clone();
        tokio::task::spawn_blocking(move || {
            use std::io::BufRead;
            let mut buf = std::io::BufReader::new(&mut reader);
            let mut line = String::new();
            loop {
                line.clear();
                match buf.read_line(&mut line) {
                    Ok(0) => break,
                    Ok(_) => {
                        let _ = tx.send(line.clone());
                    }
                    Err(_) => break,
                }
            }
        });

        let handle_for_wait = handle.clone();
        tokio::task::spawn_blocking(move || {
            let _ = child.wait();
            let h = handle_for_wait;
            let _ = futures::executor::block_on(async move {
                *h.state.write().await = PtyState::Closed;
            });
        });

        *handle.state.write().await = PtyState::Idle;
        let _ = handle_for_task; // hold ref via stdin/state

        let mut map = self.handles.write().await;
        map.insert(project.to_string(), handle.clone());
        Ok((handle, rx))
    }

    pub async fn get(&self, project: &str) -> Option<Arc<PtyHandle>> {
        self.handles.read().await.get(project).cloned()
    }

    pub async fn kill(&self, project: &str) -> Result<()> {
        if let Some(h) = self.get(project).await {
            h.kill().await?;
        }
        Ok(())
    }

    pub async fn shutdown_all(&self) {
        let map = self.handles.read().await;
        for h in map.values() {
            let _ = h.kill().await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn pty_handle_starts_in_not_spawned() {
        let h = PtyHandle::new("test".into());
        assert_eq!(*h.state.read().await, PtyState::NotSpawned);
    }

    #[tokio::test]
    async fn pty_manager_get_returns_none_for_unknown() {
        let m = PtyManager::new();
        assert!(m.get("ghost").await.is_none());
    }
}
```

Append to `Cargo.toml` `[dependencies]`:

```toml
futures = "0.3"
```

Append `pub mod pty;` to `lib.rs`.

- [ ] **Step 3: Run unit tests**

Run: `cd apps/desktop/src-tauri && cargo test pty::tests::`
Expected: 2 tests pass.

- [ ] **Step 4: Wire PtyManager into AppState**

Modify `state.rs`:

```rust
use crate::db::DbPool;
use crate::pty::PtyManager;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub ui_db: DbPool,
    pub project_dbs: RwLock<HashMap<String, DbPool>>,
    pub current_project: RwLock<Option<String>>,
    pub pty_manager: Arc<PtyManager>,
}

impl AppState {
    pub fn new(ui_db: DbPool) -> Arc<Self> {
        Arc::new(Self {
            ui_db,
            project_dbs: RwLock::new(HashMap::new()),
            current_project: RwLock::new(None),
            pty_manager: PtyManager::new(),
        })
    }

    pub async fn project_db(&self, project: &str) -> anyhow::Result<DbPool> {
        {
            let map = self.project_dbs.read().await;
            if let Some(p) = map.get(project) {
                return Ok(p.clone());
            }
        }
        let path = crate::paths::project_db_path(project);
        let pool = crate::db::open_project_pool(&path)?;
        let mut map = self.project_dbs.write().await;
        map.insert(project.to_string(), pool.clone());
        Ok(pool)
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "feat(desktop/pty): add PTY manager with state machine and spawn lifecycle"
```

---

### Task 2.4: Tasks table CRUD helpers

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Add tasks helpers + tests**

Append to `db.rs` (above `#[cfg(test)]`):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRow {
    pub id: String,
    pub command: String,
    pub session_id: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub status: String,
    pub log_path: String,
    pub retain_until: Option<i64>,
    pub pinned: bool,
}

pub fn create_task(pool: &DbPool, row: &TaskRow) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO tasks (id, command, session_id, started_at, ended_at, status, log_path, retain_until, pinned)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            row.id, row.command, row.session_id, row.started_at,
            row.ended_at, row.status, row.log_path, row.retain_until,
            if row.pinned { 1 } else { 0 },
        ],
    )?;
    Ok(())
}

pub fn finish_task(pool: &DbPool, id: &str, status: &str, ended_at: i64) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE tasks SET status = ?1, ended_at = ?2 WHERE id = ?3",
        rusqlite::params![status, ended_at, id],
    )?;
    Ok(())
}

pub fn list_recent_tasks(pool: &DbPool, limit: usize) -> Result<Vec<TaskRow>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, command, session_id, started_at, ended_at, status, log_path, retain_until, pinned
         FROM tasks ORDER BY started_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit as i64], |r| {
        Ok(TaskRow {
            id: r.get(0)?,
            command: r.get(1)?,
            session_id: r.get(2)?,
            started_at: r.get(3)?,
            ended_at: r.get(4)?,
            status: r.get(5)?,
            log_path: r.get(6)?,
            retain_until: r.get(7)?,
            pinned: r.get::<_, i64>(8)? != 0,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn pin_task(pool: &DbPool, id: &str, pinned: bool) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "UPDATE tasks SET pinned = ?1 WHERE id = ?2",
        rusqlite::params![if pinned { 1 } else { 0 }, id],
    )?;
    Ok(())
}
```

Append tests:

```rust
#[test]
fn create_and_list_tasks() {
    let dir = tempdir().unwrap();
    let pool = open_project_pool(&dir.path().join("tasks.db")).unwrap();
    create_task(&pool, &TaskRow {
        id: "t1".into(), command: "cmd".into(), session_id: None,
        started_at: 100, ended_at: None, status: "running".into(),
        log_path: "/tmp/log".into(), retain_until: None, pinned: false,
    }).unwrap();
    let list = list_recent_tasks(&pool, 10).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, "t1");
}

#[test]
fn finish_task_sets_status_and_end() {
    let dir = tempdir().unwrap();
    let pool = open_project_pool(&dir.path().join("tasks.db")).unwrap();
    create_task(&pool, &TaskRow {
        id: "t1".into(), command: "cmd".into(), session_id: None,
        started_at: 100, ended_at: None, status: "running".into(),
        log_path: "/tmp/log".into(), retain_until: None, pinned: false,
    }).unwrap();
    finish_task(&pool, "t1", "success", 200).unwrap();
    let list = list_recent_tasks(&pool, 10).unwrap();
    assert_eq!(list[0].status, "success");
    assert_eq!(list[0].ended_at, Some(200));
}

#[test]
fn pin_task_toggles_field() {
    let dir = tempdir().unwrap();
    let pool = open_project_pool(&dir.path().join("tasks.db")).unwrap();
    create_task(&pool, &TaskRow {
        id: "t1".into(), command: "x".into(), session_id: None,
        started_at: 1, ended_at: None, status: "running".into(),
        log_path: "/tmp/log".into(), retain_until: None, pinned: false,
    }).unwrap();
    pin_task(&pool, "t1", true).unwrap();
    let list = list_recent_tasks(&pool, 10).unwrap();
    assert!(list[0].pinned);
}
```

- [ ] **Step 2: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test db::`
Expected: 7 tests pass total.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/db.rs
git commit -m "feat(desktop/db): add tasks CRUD helpers (create/finish/list/pin)"
```

---

### Task 2.5: IPC — send_input + stop_task with event emission

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/workbench.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create `commands/workbench.rs`**

```rust
use crate::db::{create_task, finish_task, list_recent_tasks, TaskRow};
use crate::log::TaskLog;
use crate::paths::{project_tasks_dir, workspace_root};
use crate::pty::{PtyHandle, PtyState};
use crate::state::AppState;
use crate::stream::{parse_line, ParseOutcome, StreamEvent};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct TaskStarted {
    pub task_id: String,
    pub session_id: Option<String>,
}

fn now_secs() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

#[tauri::command]
pub async fn send_input(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    project: String,
    text: String,
) -> Result<TaskStarted, String> {
    let cwd: PathBuf = workspace_root().join(&project);
    if !cwd.exists() {
        return Err(format!("project path missing: {}", cwd.display()));
    }

    let task_id = Uuid::new_v4().to_string();
    let log_dir = project_tasks_dir(&project);
    let log_path = log_dir.join(format!("{}.jsonl", task_id));

    let project_db = state.project_db(&project).await.map_err(|e| e.to_string())?;
    create_task(&project_db, &TaskRow {
        id: task_id.clone(),
        command: text.clone(),
        session_id: None,
        started_at: now_secs(),
        ended_at: None,
        status: "running".into(),
        log_path: log_path.to_string_lossy().into(),
        retain_until: None,
        pinned: false,
    }).map_err(|e| e.to_string())?;

    let task_log = Arc::new(TaskLog::open(log_path).map_err(|e| e.to_string())?);

    let (handle, mut rx) = state
        .pty_manager
        .get_or_spawn(&project, cwd, None)
        .await
        .map_err(|e| e.to_string())?;

    *handle.state.write().await = PtyState::Active;
    handle.write_input(&text).await.map_err(|e| e.to_string())?;

    let app_for_task = app.clone();
    let task_id_for_task = task_id.clone();
    let project_for_task = project.clone();
    let project_db_clone = project_db.clone();
    let log_clone = task_log.clone();
    let handle_clone = handle.clone();

    tokio::spawn(async move {
        while let Some(line) = rx.recv().await {
            let _ = log_clone.append_line(&line).await;
            match parse_line(&line) {
                ParseOutcome::Event(ev) => {
                    if let StreamEvent::System { ref payload, .. } = ev {
                        if let Some(sid) = payload.get("session_id").and_then(|v| v.as_str()) {
                            *handle_clone.session_id.write().await = Some(sid.to_string());
                        }
                    }
                    let is_result = matches!(ev, StreamEvent::Result { .. });
                    let _ = app_for_task.emit(
                        "task:event",
                        serde_json::json!({ "task_id": task_id_for_task, "event": ev }),
                    );
                    if is_result {
                        let _ = finish_task(&project_db_clone, &task_id_for_task, "success", now_secs());
                        *handle_clone.state.write().await = PtyState::Idle;
                        let _ = app_for_task.emit(
                            "task:status",
                            serde_json::json!({
                                "task_id": task_id_for_task,
                                "status": "success",
                                "project": project_for_task,
                            }),
                        );
                        let _ = log_clone.close().await;
                        break;
                    }
                }
                ParseOutcome::Skip { reason, .. } => {
                    eprintln!("[stream] skipped line: {reason}");
                }
            }
        }
    });

    Ok(TaskStarted { task_id, session_id: None })
}

#[tauri::command]
pub async fn stop_task(
    state: State<'_, Arc<AppState>>,
    project: String,
) -> Result<(), String> {
    state.pty_manager.kill(&project).await.map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskDto {
    pub id: String,
    pub command: String,
    pub session_id: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub status: String,
    pub pinned: bool,
}

#[tauri::command]
pub async fn list_recent_tasks_cmd(
    state: State<'_, Arc<AppState>>,
    project: String,
    limit: Option<usize>,
) -> Result<Vec<TaskDto>, String> {
    let project_db = state.project_db(&project).await.map_err(|e| e.to_string())?;
    let rows = list_recent_tasks(&project_db, limit.unwrap_or(50)).map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| TaskDto {
        id: r.id, command: r.command, session_id: r.session_id,
        started_at: r.started_at, ended_at: r.ended_at, status: r.status,
        pinned: r.pinned,
    }).collect())
}
```

- [ ] **Step 2: Register module + handlers**

Edit `commands/mod.rs`:

```rust
pub mod preflight;
pub mod projects;
pub mod workbench;
```

Update `lib.rs` `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::preflight::get_preflight_status,
    commands::preflight::recheck,
    commands::projects::list_projects_cmd,
    commands::projects::switch_project_cmd,
    commands::workbench::send_input,
    commands::workbench::stop_task,
    commands::workbench::list_recent_tasks_cmd,
])
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "feat(desktop/ipc): add send_input/stop_task/list_recent_tasks with event emission"
```

---

### Task 2.6: IPC — files (list_files / read_file / open_*)

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/files.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create `commands/files.rs`**

```rust
use crate::paths::workspace_root;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

fn safe_join(project: &str, sub: Option<&str>) -> Result<PathBuf, String> {
    let base = workspace_root().join(project);
    let target = match sub {
        Some(s) => base.join(s),
        None => base.clone(),
    };
    let canon_base = base.canonicalize().map_err(|e| e.to_string())?;
    let canon_target = target.canonicalize().or_else(|_| Ok::<PathBuf, String>(target.clone())).unwrap();
    if !canon_target.starts_with(&canon_base) {
        return Err("path escapes project root".into());
    }
    Ok(target)
}

#[tauri::command]
pub async fn list_files(project: String, sub: Option<String>) -> Result<Vec<FileEntry>, String> {
    let dir = safe_join(&project, sub.as_deref())?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for e in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let metadata = e.metadata().map_err(|e| e.to_string())?;
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') { continue; }
        entries.push(FileEntry {
            name,
            path: e.path().to_string_lossy().into_owned(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(entries)
}

#[tauri::command]
pub async fn read_file_text(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() { return Err("file not found".into()); }
    let max = 5 * 1024 * 1024; // 5MB cap for preview
    let metadata = std::fs::metadata(p).map_err(|e| e.to_string())?;
    if metadata.len() > max {
        return Err(format!("file too large ({} bytes); use system open", metadata.len()));
    }
    std::fs::read_to_string(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_with_default(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.shell().open(&path, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_in_finder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let parent = Path::new(&path).parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or(path.clone());
    app.shell().open(&parent, None).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Register module**

Edit `commands/mod.rs`:

```rust
pub mod files;
pub mod preflight;
pub mod projects;
pub mod workbench;
```

Update `lib.rs` `invoke_handler` to add:

```rust
commands::files::list_files,
commands::files::read_file_text,
commands::files::open_with_default,
commands::files::open_in_finder,
```

- [ ] **Step 3: Verify**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "feat(desktop/ipc): add file tree IPC (list/read/open)"
```

---

### Task 2.7: Frontend — IPC wrappers + types extension

**Files:**
- Modify: `apps/desktop/src/lib/types.ts`
- Modify: `apps/desktop/src/lib/ipc.ts`

- [ ] **Step 1: Extend types**

Append to `src/lib/types.ts`:

```typescript
export interface TaskStarted {
  task_id: string;
  session_id: string | null;
}

export interface TaskDto {
  id: string;
  command: string;
  session_id: string | null;
  started_at: number;
  ended_at: number | null;
  status: TaskStatus;
  pinned: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export type StreamEvent =
  | { type: "system"; subtype: string; [key: string]: unknown }
  | { type: "assistant"; message: AssistantMessage }
  | { type: "user"; message: UserMessage }
  | { type: "result"; total_cost_usd?: number; duration_ms?: number; [k: string]: unknown }
  | { type: string; [k: string]: unknown }; // unknown fallback

export interface AssistantMessage {
  content: AssistantContent[];
}
export type AssistantContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export interface UserMessage {
  content: UserContent[];
}
export type UserContent =
  | { type: "text"; text: string }
  | { type: "tool_result"; tool_use_id: string; content: string | Array<{ type: string; text?: string }>; is_error?: boolean };

export interface TaskEventPayload {
  task_id: string;
  event: StreamEvent;
}

export interface TaskStatusPayload {
  task_id: string;
  status: TaskStatus;
  project: string;
}
```

- [ ] **Step 2: Extend ipc wrapper**

Append to `src/lib/ipc.ts`:

```typescript
import type { TaskStarted, TaskDto, FileEntry } from "./types";

export const workbenchIpc = {
  sendInput: (project: string, text: string) =>
    invoke<TaskStarted>("send_input", { project, text }),
  stopTask: (project: string) => invoke<void>("stop_task", { project }),
  listRecentTasks: (project: string, limit?: number) =>
    invoke<TaskDto[]>("list_recent_tasks_cmd", { project, limit }),
};

export const filesIpc = {
  listFiles: (project: string, sub?: string) =>
    invoke<FileEntry[]>("list_files", { project, sub }),
  readFileText: (path: string) => invoke<string>("read_file_text", { path }),
  openWithDefault: (path: string) => invoke<void>("open_with_default", { path }),
  openInFinder: (path: string) => invoke<void>("open_in_finder", { path }),
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/
git commit -m "feat(desktop/ipc): extend IPC wrappers and types for workbench + files"
```

---

### Task 2.8: Frontend — workbench Zustand store

**Files:**
- Create: `apps/desktop/src/stores/workbenchStore.ts`

- [ ] **Step 1: Create store**

```typescript
import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { workbenchIpc } from "@/lib/ipc";
import type {
  StreamEvent,
  TaskEventPayload,
  TaskStatusPayload,
  TaskStatus,
} from "@/lib/types";

export interface ActiveTaskBuffer {
  taskId: string;
  events: StreamEvent[];
  status: TaskStatus;
  startedAt: number;
}

interface WorkbenchState {
  activeTask: ActiveTaskBuffer | null;
  history: ActiveTaskBuffer[];
  unlisten: Array<() => void>;
  send: (project: string, text: string) => Promise<void>;
  stop: (project: string) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  reset: () => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  activeTask: null,
  history: [],
  unlisten: [],

  send: async (project, text) => {
    const started = await workbenchIpc.sendInput(project, text);
    set({
      activeTask: {
        taskId: started.task_id,
        events: [],
        status: "running",
        startedAt: Date.now(),
      },
    });
  },

  stop: async (project) => {
    await workbenchIpc.stopTask(project);
    const t = get().activeTask;
    if (t) {
      set({
        activeTask: { ...t, status: "cancelled" },
        history: [...get().history, { ...t, status: "cancelled" }],
      });
      set({ activeTask: null });
    }
  },

  startListening: async () => {
    const off1 = await listen<TaskEventPayload>("task:event", (e) => {
      const t = get().activeTask;
      if (!t || t.taskId !== e.payload.task_id) return;
      set({ activeTask: { ...t, events: [...t.events, e.payload.event] } });
    });
    const off2 = await listen<TaskStatusPayload>("task:status", (e) => {
      const t = get().activeTask;
      if (!t || t.taskId !== e.payload.task_id) return;
      const finished = { ...t, status: e.payload.status };
      set({
        activeTask: null,
        history: [...get().history, finished],
      });
    });
    set({ unlisten: [off1, off2] });
  },

  stopListening: () => {
    get().unlisten.forEach((fn) => fn());
    set({ unlisten: [] });
  },

  reset: () => set({ activeTask: null, history: [] }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/stores/workbenchStore.ts
git commit -m "feat(desktop/stores): add workbench store with task event subscription"
```

---

### Task 2.9: Frontend — StreamRenderer event subcomponents

**Files:**
- Create: `apps/desktop/src/features/workbench/events/AssistantText.tsx`
- Create: `apps/desktop/src/features/workbench/events/ToolUseCard.tsx`
- Create: `apps/desktop/src/features/workbench/events/ToolResultCard.tsx`
- Create: `apps/desktop/src/features/workbench/events/ResultBadge.tsx`

- [ ] **Step 1: Create `AssistantText.tsx`**

```typescript
import ReactMarkdown from "react-markdown";

export function AssistantText({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-2">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Create `ToolUseCard.tsx`**

```typescript
import { useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface Props {
  name: string;
  input: Record<string, unknown>;
}

function summarize(input: Record<string, unknown>): string {
  const candidates = ["file_path", "path", "command", "pattern", "description"];
  for (const k of candidates) {
    const v = input[k];
    if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  }
  const keys = Object.keys(input);
  if (keys.length === 0) return "(no args)";
  return keys.join(", ");
}

export function ToolUseCard({ name, input }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="my-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[13px] hover:bg-black/3 dark:hover:bg-white/5"
      >
        <ChevronRight className={cn("size-3.5 transition-transform duration-fast", open && "rotate-90")} />
        <Wrench className="size-3.5 opacity-70" />
        <span className="font-medium">{name}</span>
        <span className="opacity-60 truncate">{summarize(input)}</span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[12px] font-mono opacity-80 border-t border-black/5 dark:border-white/10 overflow-auto max-h-72">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Create `ToolResultCard.tsx`**

```typescript
import { useState } from "react";
import { ChevronRight, CornerDownRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface Props {
  content: string;
  isError?: boolean;
}

export function ToolResultCard({ content, isError }: Props) {
  const [open, setOpen] = useState(false);
  const preview = content.length > 100 ? content.slice(0, 97) + "…" : content;
  return (
    <Card className={cn("my-2", isError && "border-danger-light dark:border-danger-dark")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[13px] hover:bg-black/3 dark:hover:bg-white/5"
      >
        <ChevronRight className={cn("size-3.5 transition-transform duration-fast", open && "rotate-90")} />
        <CornerDownRight className="size-3.5 opacity-70" />
        <span className={cn("opacity-70 truncate", isError && "text-danger-light dark:text-danger-dark")}>
          {isError ? "❌ " : ""}{preview}
        </span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[12px] font-mono opacity-80 border-t border-black/5 dark:border-white/10 overflow-auto max-h-72 whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Create `ResultBadge.tsx`**

```typescript
import { cn } from "@/lib/cn";

interface Props {
  status: "running" | "success" | "failed" | "cancelled";
  durationMs?: number;
  costUsd?: number;
}

const statusClass: Record<Props["status"], string> = {
  running: "bg-accent-light/15 dark:bg-accent-dark/25 text-accent-light dark:text-accent-dark",
  success: "bg-success-light/15 dark:bg-success-dark/25 text-success-light dark:text-success-dark",
  failed: "bg-danger-light/15 dark:bg-danger-dark/25 text-danger-light dark:text-danger-dark",
  cancelled: "bg-warning-light/15 dark:bg-warning-dark/25 text-warning-light dark:text-warning-dark",
};

export function ResultBadge({ status, durationMs, costUsd }: Props) {
  return (
    <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px]", statusClass[status])}>
      <span className="font-medium uppercase tracking-wider">{status}</span>
      {durationMs ? <span>{(durationMs / 1000).toFixed(1)}s</span> : null}
      {costUsd ? <span>${costUsd.toFixed(4)}</span> : null}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/features/workbench/events/
git commit -m "feat(desktop/workbench): add stream event subcomponents (text/tool_use/tool_result/result)"
```

---

### Task 2.10: Frontend — StreamRenderer composition

**Files:**
- Create: `apps/desktop/src/features/workbench/StreamRenderer.tsx`

- [ ] **Step 1: Create `StreamRenderer.tsx`**

```typescript
import { useEffect, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import type { StreamEvent, AssistantContent } from "@/lib/types";
import { AssistantText } from "./events/AssistantText";
import { ToolUseCard } from "./events/ToolUseCard";
import { ToolResultCard } from "./events/ToolResultCard";
import { ResultBadge } from "./events/ResultBadge";

interface Props {
  events: StreamEvent[];
  status: "running" | "success" | "failed" | "cancelled" | null;
}

export function StreamRenderer({ events, status }: Props) {
  const ref = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    if (events.length > 0) {
      ref.current?.scrollToIndex({ index: events.length - 1, behavior: "smooth" });
    }
  }, [events.length]);

  return (
    <div className="h-full flex flex-col">
      <Virtuoso
        ref={ref}
        data={events}
        className="flex-1"
        itemContent={(idx, ev) => <Item key={idx} event={ev} />}
      />
      {status && (
        <div className="border-t border-black/5 dark:border-white/10 px-4 py-2">
          <ResultBadge status={status} />
        </div>
      )}
    </div>
  );
}

function Item({ event }: { event: StreamEvent }) {
  if (event.type === "assistant") {
    const msg = (event as Extract<StreamEvent, { type: "assistant" }>).message;
    const blocks = msg?.content ?? [];
    return (
      <div className="px-4 py-1">
        {blocks.map((b: AssistantContent, i: number) => (
          <AssistantBlock key={i} block={b} />
        ))}
      </div>
    );
  }
  if (event.type === "user") {
    const msg = (event as Extract<StreamEvent, { type: "user" }>).message;
    const blocks = msg?.content ?? [];
    return (
      <div className="px-4 py-1">
        {blocks.map((b, i: number) => {
          if (b.type === "tool_result") {
            const content = typeof b.content === "string"
              ? b.content
              : (b.content || []).map((c: { text?: string }) => c.text ?? "").join("\n");
            return <ToolResultCard key={i} content={content} isError={b.is_error} />;
          }
          return null;
        })}
      </div>
    );
  }
  if (event.type === "system") return null;
  if (event.type === "result") return null;
  return null;
}

function AssistantBlock({ block }: { block: AssistantContent }) {
  if (block.type === "text") return <AssistantText text={block.text} />;
  if (block.type === "tool_use") return <ToolUseCard name={block.name} input={block.input} />;
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/features/workbench/StreamRenderer.tsx
git commit -m "feat(desktop/workbench): add StreamRenderer with virtualized event list"
```

---

### Task 2.11: Frontend — Composer

**Files:**
- Create: `apps/desktop/src/features/workbench/Composer.tsx`

- [ ] **Step 1: Create `Composer.tsx`**

```typescript
import { useState, useEffect, useRef, type DragEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useWorkbenchStore } from "@/stores/workbenchStore";
import { useProjectStore } from "@/stores/projectStore";

export function Composer() {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const project = useProjectStore((s) => s.current);
  const activeTask = useWorkbenchStore((s) => s.activeTask);
  const send = useWorkbenchStore((s) => s.send);
  const stop = useWorkbenchStore((s) => s.stop);

  useEffect(() => { ref.current?.focus(); }, [project]);

  const isActive = activeTask?.status === "running";
  const disabled = !project || isActive;

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = async () => {
    if (!project || !text.trim()) return;
    await send(project, text);
    setText("");
  };

  const onStop = async () => {
    if (project) await stop(project);
  };

  const onDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const path = e.dataTransfer.getData("text/x-kata-relpath");
    if (path) {
      setText((t) => (t ? `${t} @${path}` : `@${path}`));
      ref.current?.focus();
    }
  };

  const onDragOver = (e: DragEvent<HTMLTextAreaElement>) => {
    if (e.dataTransfer.types.includes("text/x-kata-relpath")) {
      e.preventDefault();
    }
  };

  return (
    <div className="border-t border-black/8 dark:border-white/10 p-3 flex gap-2 items-end">
      <TextField
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onDrop={onDrop}
        onDragOver={onDragOver}
        rows={3}
        disabled={disabled}
        placeholder={project ? "输入命令或自然语言（Enter 发送，Shift+Enter 换行）" : "请先选择项目"}
      />
      {isActive ? (
        <Button variant="danger" size="md" onClick={onStop} className="self-end">
          <Square className="size-4" />
        </Button>
      ) : (
        <Button variant="primary" size="md" onClick={submit} disabled={disabled || !text.trim()} className="self-end">
          <ArrowUp className="size-4" />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/features/workbench/Composer.tsx
git commit -m "feat(desktop/workbench): add Composer with submit/stop and drag-drop path injection"
```

---

### Task 2.12: Frontend — Workbench layout

**Files:**
- Create: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create `Workbench.tsx`**

```typescript
import { useEffect } from "react";
import { StreamRenderer } from "./StreamRenderer";
import { Composer } from "./Composer";
import { useWorkbenchStore } from "@/stores/workbenchStore";
import { useProjectStore } from "@/stores/projectStore";

export function Workbench() {
  const project = useProjectStore((s) => s.current);
  const activeTask = useWorkbenchStore((s) => s.activeTask);
  const startListening = useWorkbenchStore((s) => s.startListening);
  const stopListening = useWorkbenchStore((s) => s.stopListening);

  useEffect(() => {
    startListening();
    return () => stopListening();
  }, [startListening, stopListening]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-60">
        请从左侧选择项目
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 min-h-0">
        <StreamRenderer
          events={activeTask?.events ?? []}
          status={activeTask?.status ?? null}
        />
      </div>
      <Composer />
    </div>
  );
}
```

- [ ] **Step 2: Update `App.tsx`**

```typescript
import { PreflightGate } from "./features/preflight/PreflightGate";
import { Sidebar } from "./components/Sidebar";
import { Workbench } from "./features/workbench/Workbench";

export default function App() {
  return (
    <PreflightGate>
      <div className="h-full flex bg-white/40 dark:bg-black/40">
        <Sidebar />
        <Workbench />
      </div>
    </PreflightGate>
  );
}
```

- [ ] **Step 3: Run dev and verify end-to-end stream**

Run: `cd apps/desktop && bun run dev`
Steps:
1. Select dataAssets project.
2. Type `hello` and press Enter.
3. Expected: assistant text appears streaming; result badge appears.
4. Open `~/Projects/kata/.kata/dataAssets/tasks/` and confirm a `.jsonl` file was created.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/features/workbench/Workbench.tsx apps/desktop/src/App.tsx
git commit -m "feat(desktop/workbench): wire Workbench layout end-to-end"
```

---

### Task 2.13: Frontend — FileTree + drag source

**Files:**
- Create: `apps/desktop/src/features/filetree/FileTree.tsx`
- Create: `apps/desktop/src/features/filetree/TextPreview.tsx`
- Modify: `apps/desktop/src/components/Sidebar.tsx`

- [ ] **Step 1: Create `FileTree.tsx`**

```typescript
import { useEffect, useState, type DragEvent } from "react";
import { ChevronRight, File, Folder } from "lucide-react";
import { filesIpc } from "@/lib/ipc";
import { useProjectStore } from "@/stores/projectStore";
import type { FileEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

interface NodeProps {
  entry: FileEntry;
  project: string;
  sub: string;
  onPreview: (path: string) => void;
}

function relPathFor(project: string, fullPath: string): string {
  const marker = `/workspace/${project}/`;
  const idx = fullPath.indexOf(marker);
  return idx >= 0 ? fullPath.slice(idx + 1) : fullPath;
}

function Node({ entry, project, sub, onPreview }: NodeProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);

  const onClick = async () => {
    if (entry.is_dir) {
      const next = !open;
      setOpen(next);
      if (next && children === null) {
        const subPath = sub ? `${sub}/${entry.name}` : entry.name;
        const items = await filesIpc.listFiles(project, subPath);
        setChildren(items);
      }
    } else {
      onPreview(entry.path);
    }
  };

  const onDoubleClick = async () => {
    if (!entry.is_dir) await filesIpc.openWithDefault(entry.path);
  };

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (entry.is_dir) return;
    const rel = relPathFor(project, entry.path);
    e.dataTransfer.setData("text/x-kata-relpath", rel);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div>
      <div
        draggable={!entry.is_dir}
        onDragStart={onDragStart}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className="px-2 py-1 text-[12.5px] hover:bg-black/5 dark:hover:bg-white/10 rounded cursor-pointer flex items-center gap-1.5 select-none"
      >
        {entry.is_dir
          ? <ChevronRight className={cn("size-3.5 transition-transform duration-fast", open && "rotate-90")} />
          : <span className="w-3.5" />
        }
        {entry.is_dir
          ? <Folder className="size-3.5 opacity-70" />
          : <File className="size-3.5 opacity-70" />
        }
        <span className="truncate">{entry.name}</span>
      </div>
      {open && children && (
        <div className="ml-4">
          {children.map((c) => (
            <Node key={c.path} entry={c} project={project} sub={sub ? `${sub}/${entry.name}` : entry.name} onPreview={onPreview} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  onPreview: (path: string) => void;
}

export function FileTree({ onPreview }: FileTreeProps) {
  const project = useProjectStore((s) => s.current);
  const [entries, setEntries] = useState<FileEntry[]>([]);

  useEffect(() => {
    if (!project) { setEntries([]); return; }
    filesIpc.listFiles(project).then(setEntries);
  }, [project]);

  if (!project) return null;
  return (
    <div className="p-1.5">
      {entries.length === 0
        ? <div className="px-2 py-1 text-[12px] opacity-50">空目录</div>
        : entries.map((e) => (
            <Node key={e.path} entry={e} project={project} sub="" onPreview={onPreview} />
          ))
      }
    </div>
  );
}
```

- [ ] **Step 2: Create `TextPreview.tsx`**

```typescript
import { useEffect, useState } from "react";
import { filesIpc } from "@/lib/ipc";

export function TextPreview({ path }: { path: string | null }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setText(null); setError(null); return; }
    filesIpc.readFileText(path).then(setText).catch((e) => setError(String(e)));
  }, [path]);

  if (!path) return null;
  return (
    <div className="border-t border-black/8 dark:border-white/10 max-h-64 overflow-auto p-3">
      <div className="text-[11px] opacity-50 mb-1.5 font-mono truncate">{path}</div>
      {error
        ? <div className="text-[12px] text-danger-light dark:text-danger-dark">{error}</div>
        : <pre className="text-[12px] font-mono whitespace-pre-wrap">{text ?? "…"}</pre>
      }
    </div>
  );
}
```

- [ ] **Step 3: Update `Sidebar.tsx` to host FileTree + Preview**

```typescript
import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ProjectsList } from "@/features/projects/ProjectsList";
import { FileTree } from "@/features/filetree/FileTree";
import { TextPreview } from "@/features/filetree/TextPreview";

interface SidebarProps {
  className?: string;
  bottomSlot?: ReactNode;
}

export function Sidebar({ className, bottomSlot }: SidebarProps) {
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  return (
    <aside className={cn(
      "vibrancy-sidebar h-full w-[280px] flex flex-col",
      "border-r border-black/8 dark:border-white/10",
      className,
    )}>
      <div className="px-3 pt-12 pb-2 text-[11px] uppercase tracking-wider opacity-50">Projects</div>
      <div className="flex-shrink-0"><ProjectsList /></div>
      <div className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider opacity-50">Files</div>
      <div className="flex-1 overflow-y-auto"><FileTree onPreview={setPreviewPath} /></div>
      <TextPreview path={previewPath} />
      {bottomSlot}
    </aside>
  );
}
```

- [ ] **Step 4: Run dev and verify**

Run: `cd apps/desktop && bun run dev`
Verify:
- File tree renders project files
- Click folder = expand/collapse
- Click file = inline text preview
- Double-click file = system open
- Drag a file → drop on Composer → text becomes `@workspace/{project}/path`
- Submit → claude sees the @-reference and processes it

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop/filetree): add FileTree, TextPreview and drag-drop @path injection"
```

---

### Task 2.14: M2 manual smoke + tests

- [ ] **Step 1: Run all Rust + frontend type checks**

```bash
cd apps/desktop/src-tauri && cargo test
cd apps/desktop && bun run type-check
```
Expected: all tests pass; tsc 0 errors.

- [ ] **Step 2: Manual smoke checklist**

- [ ] App launches, preflight passes
- [ ] Select dataAssets project
- [ ] Drag `archive/*/full.spec.ts` onto Composer → `@workspace/dataAssets/archive/...`
- [ ] Type a brief command → press Enter → see streaming
- [ ] tool_use cards expand/collapse
- [ ] tool_result links to its tool_use
- [ ] result badge shows on completion
- [ ] `.kata/dataAssets/tasks/<uuid>.jsonl` exists with full event log
- [ ] Click a `.md` in file tree → text preview shows
- [ ] Double-click → opens in system app

- [ ] **Step 3: Commit M2 milestone**

```bash
git commit --allow-empty -m "feat(desktop): complete M2 (PTY + StreamRenderer + FileTree)"
```

---

## Phase M3 — Sessions, Error Matrix, Packaging (Week 3)

**Milestone:** ad-hoc signed dmg distributable. Sessions list with replay. All 11 error paths handled. GC (idle PTY + log retention) running. Diagnostics export menu.

### Task 3.1: Rust sessions module

**Files:**
- Create: `apps/desktop/src-tauri/src/sessions.rs`
- Modify: `apps/desktop/src-tauri/src/db.rs` (sessions helpers)
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add db helpers for sessions**

Append to `db.rs` (above `#[cfg(test)]`):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRow {
    pub session_id: String,
    pub first_task_id: String,
    pub first_input_summary: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub task_count: i64,
}

pub fn upsert_session(pool: &DbPool, row: &SessionRow) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO sessions (session_id, first_task_id, first_input_summary, created_at, last_active_at, task_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(session_id) DO UPDATE SET
           last_active_at = excluded.last_active_at,
           task_count = sessions.task_count + 1",
        rusqlite::params![
            row.session_id, row.first_task_id, row.first_input_summary,
            row.created_at, row.last_active_at, row.task_count,
        ],
    )?;
    Ok(())
}

pub fn list_sessions(pool: &DbPool, limit: usize) -> Result<Vec<SessionRow>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT session_id, first_task_id, first_input_summary, created_at, last_active_at, task_count
         FROM sessions ORDER BY last_active_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit as i64], |r| {
        Ok(SessionRow {
            session_id: r.get(0)?,
            first_task_id: r.get(1)?,
            first_input_summary: r.get(2)?,
            created_at: r.get(3)?,
            last_active_at: r.get(4)?,
            task_count: r.get(5)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}
```

Append tests:

```rust
#[test]
fn upsert_and_list_sessions() {
    let dir = tempdir().unwrap();
    let pool = open_project_pool(&dir.path().join("tasks.db")).unwrap();
    upsert_session(&pool, &SessionRow {
        session_id: "s1".into(),
        first_task_id: "t1".into(),
        first_input_summary: Some("hi".into()),
        created_at: 100,
        last_active_at: 100,
        task_count: 1,
    }).unwrap();
    let list = list_sessions(&pool, 10).unwrap();
    assert_eq!(list[0].session_id, "s1");
}
```

- [ ] **Step 2: Create `sessions.rs` glue**

```rust
use crate::db::{list_sessions, upsert_session, SessionRow};
use crate::db::DbPool;
use anyhow::Result;

pub fn record_session(pool: &DbPool, row: &SessionRow) -> Result<()> {
    upsert_session(pool, row)
}

pub fn fetch_sessions(pool: &DbPool, limit: usize) -> Result<Vec<SessionRow>> {
    list_sessions(pool, limit)
}
```

Append `pub mod sessions;` to `lib.rs`.

- [ ] **Step 3: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test db::tests::upsert_and_list_sessions`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat(desktop/sessions): add session row CRUD and module"
```

---

### Task 3.2: Wire sessions on first stream event + IPC

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands/workbench.rs` (record session on system.init)
- Create: `apps/desktop/src-tauri/src/commands/sessions.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Update workbench.rs to record session_id on system.init**

In the `tokio::spawn` block of `send_input`, after detecting `session_id`, also persist:

```rust
if let StreamEvent::System { ref payload, ref subtype, .. } = ev {
    if subtype == "init" {
        if let Some(sid) = payload.get("session_id").and_then(|v| v.as_str()) {
            *handle_clone.session_id.write().await = Some(sid.to_string());
            // persist to sessions table
            let summary: String = text_for_summary(&command_for_session);
            let _ = crate::sessions::record_session(&project_db_clone, &crate::db::SessionRow {
                session_id: sid.to_string(),
                first_task_id: task_id_for_task.clone(),
                first_input_summary: Some(summary),
                created_at: now_secs(),
                last_active_at: now_secs(),
                task_count: 1,
            });
            // also update tasks.session_id
            if let Ok(conn) = project_db_clone.get() {
                let _ = conn.execute(
                    "UPDATE tasks SET session_id = ?1 WHERE id = ?2",
                    rusqlite::params![sid, task_id_for_task],
                );
            }
        }
    }
}
```

Add helper at top of file:

```rust
fn text_for_summary(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() > 80 {
        let truncated: String = trimmed.chars().take(77).collect();
        format!("{}…", truncated)
    } else {
        trimmed.to_string()
    }
}
```

Capture `command_for_session = text.clone()` before the spawn block, and reference it inside.

- [ ] **Step 2: Create `commands/sessions.rs`**

```rust
use crate::sessions::fetch_sessions;
use crate::state::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct SessionDto {
    pub session_id: String,
    pub first_task_id: String,
    pub first_input_summary: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub task_count: i64,
}

#[tauri::command]
pub async fn list_sessions_cmd(
    state: State<'_, Arc<AppState>>,
    project: String,
    limit: Option<usize>,
) -> Result<Vec<SessionDto>, String> {
    let pool = state.project_db(&project).await.map_err(|e| e.to_string())?;
    let rows = fetch_sessions(&pool, limit.unwrap_or(50)).map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| SessionDto {
        session_id: r.session_id,
        first_task_id: r.first_task_id,
        first_input_summary: r.first_input_summary,
        created_at: r.created_at,
        last_active_at: r.last_active_at,
        task_count: r.task_count,
    }).collect())
}
```

- [ ] **Step 3: Register and verify**

Edit `commands/mod.rs` to add `pub mod sessions;`. Add to `invoke_handler`:
```rust
commands::sessions::list_sessions_cmd,
```

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "feat(desktop/sessions): persist session on system.init and add list IPC"
```

---

### Task 3.3: resume_session IPC + replay

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands/workbench.rs` (add `resume_session`)
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/lib/ipc.ts`
- Modify: `apps/desktop/src/lib/types.ts`

- [ ] **Step 1: Add `resume_session` to workbench.rs**

```rust
use crate::log::TaskLog as _; // not needed; using path directly

#[tauri::command]
pub async fn resume_session(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    project: String,
    session_id: String,
) -> Result<(), String> {
    state.pty_manager.kill(&project).await.map_err(|e| e.to_string())?;
    let cwd: PathBuf = workspace_root().join(&project);
    if !cwd.exists() {
        return Err(format!("project missing: {}", cwd.display()));
    }

    // Replay events from the session's tasks logs
    let pool = state.project_db(&project).await.map_err(|e| e.to_string())?;
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT log_path FROM tasks WHERE session_id = ?1 ORDER BY started_at ASC")
        .map_err(|e| e.to_string())?;
    let log_paths: Vec<String> = stmt
        .query_map([&session_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut events: Vec<serde_json::Value> = Vec::new();
    for path in log_paths {
        if let Ok(content) = std::fs::read_to_string(&path) {
            for line in content.lines() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                    events.push(v);
                }
            }
        }
    }
    let _ = app.emit("session:resumed", serde_json::json!({
        "project": project, "session_id": session_id, "events": events,
    }));

    // Spawn fresh PTY with --resume
    state.pty_manager.get_or_spawn(&project, cwd, Some(&session_id))
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

Register in `lib.rs` `invoke_handler`:
```rust
commands::workbench::resume_session,
```

- [ ] **Step 2: Extend frontend types & ipc**

Append to `src/lib/types.ts`:

```typescript
export interface SessionDto {
  session_id: string;
  first_task_id: string;
  first_input_summary: string | null;
  created_at: number;
  last_active_at: number;
  task_count: number;
}

export interface SessionResumedPayload {
  project: string;
  session_id: string;
  events: StreamEvent[];
}
```

Append to `src/lib/ipc.ts`:

```typescript
import type { SessionDto } from "./types";

export const sessionsIpc = {
  list: (project: string, limit?: number) =>
    invoke<SessionDto[]>("list_sessions_cmd", { project, limit }),
  resume: (project: string, sessionId: string) =>
    invoke<void>("resume_session", { project, sessionId }),
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/ apps/desktop/src/
git commit -m "feat(desktop/sessions): add resume_session IPC with event replay"
```

---

### Task 3.4: Frontend SessionsList

**Files:**
- Create: `apps/desktop/src/features/sessions/SessionsList.tsx`
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Modify: `apps/desktop/src/stores/workbenchStore.ts` (handle session:resumed)

- [ ] **Step 1: Create `SessionsList.tsx`**

```typescript
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { sessionsIpc } from "@/lib/ipc";
import type { SessionDto } from "@/lib/types";
import { useProjectStore } from "@/stores/projectStore";
import { List, ListItem } from "@/components/ui/List";

export function SessionsList() {
  const project = useProjectStore((s) => s.current);
  const [sessions, setSessions] = useState<SessionDto[]>([]);

  useEffect(() => {
    if (!project) return;
    sessionsIpc.list(project).then(setSessions);
  }, [project]);

  if (!project) return null;
  if (sessions.length === 0) {
    return <div className="px-3 py-2 text-[12px] opacity-50">无历史 session</div>;
  }
  return (
    <List className="p-1.5">
      {sessions.map((s) => (
        <ListItem
          key={s.session_id}
          onClick={() => sessionsIpc.resume(project, s.session_id)}
        >
          <div className="flex items-start gap-2">
            <History className="size-3.5 mt-0.5 opacity-60 flex-shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-[12.5px]">
                {s.first_input_summary ?? s.session_id.slice(0, 8)}
              </div>
              <div className="text-[11px] opacity-50">
                {new Date(s.last_active_at * 1000).toLocaleString()} · {s.task_count} tasks
              </div>
            </div>
          </div>
        </ListItem>
      ))}
    </List>
  );
}
```

- [ ] **Step 2: Wire SessionsList into Sidebar**

Update `Sidebar.tsx` to insert sessions section between Projects and Files:

```typescript
import { SessionsList } from "@/features/sessions/SessionsList";

// inside Sidebar:
<div className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider opacity-50">Sessions</div>
<div className="max-h-48 overflow-y-auto"><SessionsList /></div>
```

- [ ] **Step 3: Handle `session:resumed` in workbench store**

Modify `startListening` in `workbenchStore.ts`:

```typescript
const off3 = await listen<{ project: string; session_id: string; events: StreamEvent[] }>(
  "session:resumed",
  (e) => {
    set({
      activeTask: {
        taskId: `replay-${e.payload.session_id}`,
        events: e.payload.events,
        status: "success",
        startedAt: Date.now(),
      },
    });
  },
);
set({ unlisten: [off1, off2, off3] });
```

- [ ] **Step 4: Run dev and verify resume**

Run: `cd apps/desktop && bun run dev`
Steps:
1. Run a task, wait for completion
2. Restart app
3. Click historical session → workbench shows replayed events
4. Type new input → continues that session

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop/sessions): add SessionsList with click-to-resume"
```

---

### Task 3.5: Error matrix — broken pipe + crashed PTY

**Files:**
- Modify: `apps/desktop/src-tauri/src/pty.rs` (emit `pty:status` on state change)
- Modify: `apps/desktop/src-tauri/src/commands/workbench.rs`

- [ ] **Step 1: Emit pty:status events**

Add to `pty.rs`:

```rust
pub async fn set_state(&self, app: &tauri::AppHandle, new_state: PtyState) {
    *self.state.write().await = new_state.clone();
    use tauri::Emitter;
    let _ = app.emit("pty:status", serde_json::json!({
        "project": self.project, "state": new_state,
    }));
}
```

- [ ] **Step 2: Update workbench.rs send_input to mark cancelled on broken pipe**

Wrap `handle.write_input(&text)` in error handling:

```rust
match handle.write_input(&text).await {
    Ok(()) => {}
    Err(e) => {
        // mark task as cancelled
        let _ = finish_task(&project_db, &task_id, "cancelled", now_secs());
        *handle.state.write().await = PtyState::Closed;
        return Err(format!("PTY write failed (will respawn on next input): {e}"));
    }
}
```

- [ ] **Step 3: Add unit test for kill → state Closed**

Append to `pty.rs` `tests`:

```rust
#[tokio::test]
async fn kill_transitions_to_closed() {
    let h = PtyHandle::new("test".into());
    *h.state.write().await = PtyState::Active;
    h.kill().await.unwrap();
    assert_eq!(*h.state.read().await, PtyState::Closed);
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test pty::`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat(desktop/pty): emit pty:status events and handle broken pipe gracefully"
```

---

### Task 3.6: Error matrix — 401 detection from result events

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands/workbench.rs`

- [ ] **Step 1: Detect auth errors in result event**

In the result branch of the spawn loop:

```rust
if let StreamEvent::Result { ref payload } = ev {
    let is_error = payload.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
    let result_text = payload.get("result").and_then(|v| v.as_str()).unwrap_or("");
    let likely_auth = result_text.to_lowercase().contains("unauthorized")
        || result_text.contains("401")
        || result_text.to_lowercase().contains("login");

    let final_status = if is_error || likely_auth { "failed" } else { "success" };
    let _ = finish_task(&project_db_clone, &task_id_for_task, final_status, now_secs());

    if likely_auth {
        let _ = app_for_task.emit("preflight:changed", serde_json::json!({
            "status": { "kind": "not_logged_in", "version": "" }
        }));
    }
    *handle_clone.state.write().await = PtyState::Idle;
    let _ = app_for_task.emit("task:status", serde_json::json!({
        "task_id": task_id_for_task, "status": final_status, "project": project_for_task,
    }));
    let _ = log_clone.close().await;
    break;
}
```

- [ ] **Step 2: Frontend listen for preflight:changed**

Modify `preflightStore.ts`:

```typescript
import { listen } from "@tauri-apps/api/event";
import type { PreflightStatus } from "@/lib/types";

// after store creation
listen<{ status: PreflightStatus }>("preflight:changed", (e) => {
  usePreflightStore.setState({ status: e.payload.status });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/commands/workbench.rs apps/desktop/src/stores/preflightStore.ts
git commit -m "feat(desktop/error): detect auth invalidation in result events and reroute to preflight gate"
```

---

### Task 3.7: Error matrix — sqlite corruption recovery

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add corruption detection + reset helper**

Append to `db.rs`:

```rust
pub fn open_pool_with_recovery(path: &Path) -> Result<DbPool> {
    match open_pool(path) {
        Ok(pool) => {
            // Verify integrity
            let conn = pool.get()?;
            let result: rusqlite::Result<String> = conn.query_row("PRAGMA integrity_check", [], |r| r.get(0));
            match result {
                Ok(s) if s == "ok" => Ok(pool),
                _ => {
                    drop(conn);
                    let backup = path.with_extension("db.corrupted");
                    let _ = std::fs::rename(path, &backup);
                    open_pool(path)
                }
            }
        }
        Err(_) => {
            let backup = path.with_extension("db.corrupted");
            if path.exists() {
                let _ = std::fs::rename(path, &backup);
            }
            open_pool(path)
        }
    }
}
```

- [ ] **Step 2: Use recovery variant in lib.rs**

Replace `db::open_pool(&ui_db_path)` with `db::open_pool_with_recovery(&ui_db_path)`.

- [ ] **Step 3: Add test**

Append to `db.rs` tests:

```rust
#[test]
fn recovery_creates_pool_when_file_corrupt() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("ui.db");
    std::fs::write(&path, b"this is not sqlite").unwrap();
    let pool = open_pool_with_recovery(&path).unwrap();
    let conn = pool.get().unwrap();
    let count: i64 = conn.query_row("SELECT count(*) FROM projects", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);
    assert!(path.with_extension("db.corrupted").exists());
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/desktop/src-tauri && cargo test db::tests::recovery_creates_pool_when_file_corrupt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat(desktop/db): add corruption recovery (rename corrupted file + reinit)"
```

---

### Task 3.8: Error matrix — app close with active task

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Add Tauri close-requested handler in lib.rs**

In the `setup` block, add after window vibrancy:

```rust
let window_handle = window.clone();
window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let app_state: tauri::State<Arc<state::AppState>> = window_handle.state();
        let pty = app_state.pty_manager.clone();
        let win = window_handle.clone();
        api.prevent_close();
        tauri::async_runtime::spawn(async move {
            // Check if any project has Active state
            let map = pty.handles.read().await;
            let mut has_active = false;
            for h in map.values() {
                if *h.state.read().await == pty::PtyState::Active {
                    has_active = true; break;
                }
            }
            drop(map);
            if has_active {
                let _ = win.emit("app:close-requested", ());
            } else {
                pty.shutdown_all().await;
                let _ = win.close();
            }
        });
    }
});
```

Make `pty_manager.handles` field `pub` (or add public accessor):

In `pty.rs`:
```rust
pub struct PtyManager {
    pub handles: RwLock<HashMap<String, Arc<PtyHandle>>>,
}
```

- [ ] **Step 2: Frontend handles `app:close-requested`**

Add to `App.tsx`:

```typescript
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Modal } from "./components/ui/Modal";
import { Button } from "./components/ui/Button";
import { useWorkbenchStore } from "./stores/workbenchStore";
import { useProjectStore } from "./stores/projectStore";

// inside App component:
const [closeAsked, setCloseAsked] = useState(false);
const stop = useWorkbenchStore((s) => s.stop);
const project = useProjectStore((s) => s.current);

useEffect(() => {
  let unsub: (() => void) | undefined;
  listen("app:close-requested", () => setCloseAsked(true)).then((u) => { unsub = u; });
  return () => { unsub?.(); };
}, []);

const confirmClose = async () => {
  if (project) await stop(project);
  await getCurrentWindow().close();
};
```

Add modal markup (within JSX):

```typescript
{closeAsked && (
  <Modal title="任务进行中" onClose={() => setCloseAsked(false)}>
    <p className="text-sm">有任务正在运行，强制退出会中断输出并标记为 cancelled。</p>
    <div className="flex justify-end gap-2 mt-4">
      <Button onClick={() => setCloseAsked(false)}>取消</Button>
      <Button variant="danger" onClick={confirmClose}>强制退出</Button>
    </div>
  </Modal>
)}
```

- [ ] **Step 3: Create Modal component**

`apps/desktop/src/components/ui/Modal.tsx`:

```typescript
import type { ReactNode } from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <Card className="p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>
        {children}
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run dev and verify**

Run: `cd apps/desktop && bun run dev`
Steps: trigger long task → close window → confirm modal appears.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/ apps/desktop/src/
git commit -m "feat(desktop/error): intercept window close when active task running"
```

---

### Task 3.9: idle GC for PTY

**Files:**
- Create: `apps/desktop/src-tauri/src/gc.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/src/pty.rs` (track `last_activity`)

- [ ] **Step 1: Add last_activity field to PtyHandle**

In `pty.rs`:

```rust
pub struct PtyHandle {
    pub project: String,
    pub state: RwLock<PtyState>,
    pub stdin: Mutex<Option<Box<dyn std::io::Write + Send>>>,
    pub session_id: RwLock<Option<String>>,
    pub child_killer: Mutex<Option<Box<dyn portable_pty::ChildKiller + Send + Sync>>>,
    pub last_activity: RwLock<i64>,
}

impl PtyHandle {
    pub fn new(project: String) -> Arc<Self> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        Arc::new(Self {
            project,
            state: RwLock::new(PtyState::NotSpawned),
            stdin: Mutex::new(None),
            session_id: RwLock::new(None),
            child_killer: Mutex::new(None),
            last_activity: RwLock::new(now),
        })
    }
    pub async fn touch(&self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        *self.last_activity.write().await = now;
    }
}
```

In `write_input` and the spawn loop, call `self.touch()` (or `handle.touch()`) on each I/O.

- [ ] **Step 2: Create gc.rs**

```rust
use crate::pty::{PtyManager, PtyState};
use std::sync::Arc;
use std::time::Duration;

pub const IDLE_TIMEOUT_SECS: i64 = 30 * 60;

pub fn spawn_idle_gc(manager: Arc<PtyManager>) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let map = manager.handles.read().await;
            let to_close: Vec<String> = {
                let mut v = Vec::new();
                for (name, h) in map.iter() {
                    let state = h.state.read().await.clone();
                    let last = *h.last_activity.read().await;
                    if state == PtyState::Idle && now - last > IDLE_TIMEOUT_SECS {
                        v.push(name.clone());
                    }
                }
                v
            };
            drop(map);
            for name in to_close {
                let _ = manager.kill(&name).await;
            }
        }
    });
}
```

- [ ] **Step 3: Wire in lib.rs**

In `setup`:

```rust
crate::gc::spawn_idle_gc(state.pty_manager.clone());
```

Append `pub mod gc;` to `lib.rs`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat(desktop/gc): spawn idle GC closing PTYs after 30 min inactivity"
```

---

### Task 3.10: Task log GC + pin

**Files:**
- Modify: `apps/desktop/src-tauri/src/gc.rs`
- Create: `apps/desktop/src-tauri/src/commands/diagnostics.rs` (also pin)
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add log retention sweep to gc.rs**

```rust
use crate::db::DbPool;
use crate::paths::{kata_data_root, project_db_path};

pub const DEFAULT_RETENTION_DAYS: i64 = 30;

pub async fn sweep_task_logs() -> anyhow::Result<usize> {
    let kata_root = kata_data_root();
    if !kata_root.exists() { return Ok(0); }
    let mut deleted = 0;
    let now_sec = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;
    let cutoff = now_sec - DEFAULT_RETENTION_DAYS * 86_400;

    for entry in std::fs::read_dir(&kata_root)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('_') || !entry.metadata()?.is_dir() { continue; }
        let db_path = project_db_path(&name);
        if !db_path.exists() { continue; }

        let pool = crate::db::open_project_pool(&db_path)?;
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, log_path FROM tasks
             WHERE pinned = 0
               AND COALESCE(retain_until, started_at + ?1) < ?2",
        )?;
        let candidates: Vec<(String, String)> = stmt
            .query_map([DEFAULT_RETENTION_DAYS * 86_400, cutoff], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();

        for (id, log_path) in candidates {
            let _ = std::fs::remove_file(&log_path);
            let _ = conn.execute("DELETE FROM tasks WHERE id = ?1", [&id]);
            deleted += 1;
        }
    }
    Ok(deleted)
}

pub fn spawn_log_gc_on_startup() {
    tokio::spawn(async move {
        let _ = sweep_task_logs().await;
    });
}
```

- [ ] **Step 2: Wire startup sweep**

In `lib.rs` `setup`:
```rust
crate::gc::spawn_log_gc_on_startup();
```

- [ ] **Step 3: Add pin_task IPC**

`commands/workbench.rs`:

```rust
#[tauri::command]
pub async fn pin_task_cmd(
    state: State<'_, Arc<AppState>>,
    project: String,
    task_id: String,
    pinned: bool,
) -> Result<(), String> {
    let pool = state.project_db(&project).await.map_err(|e| e.to_string())?;
    crate::db::pin_task(&pool, &task_id, pinned).map_err(|e| e.to_string())
}
```

Register in `lib.rs`:
```rust
commands::workbench::pin_task_cmd,
```

- [ ] **Step 4: Frontend ipc + types**

Append to `src/lib/ipc.ts`:

```typescript
pinTask: (project: string, taskId: string, pinned: boolean) =>
  invoke<void>("pin_task_cmd", { project, taskId, pinned }),
```

(inside `workbenchIpc` object)

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/ apps/desktop/src/
git commit -m "feat(desktop/gc): add 30d task log sweep and pin_task IPC"
```

---

### Task 3.11: Diagnostics export + errors.log

**Files:**
- Create: `apps/desktop/src-tauri/src/diagnostics.rs`
- Create: `apps/desktop/src-tauri/src/commands/diagnostics.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (init logging)

- [ ] **Step 1: Create `diagnostics.rs`**

```rust
use crate::paths::{errors_log_path, desktop_state_dir};
use anyhow::Result;
use std::fs::OpenOptions;
use std::io::{Read, Seek, SeekFrom, Write};

pub fn append_error(line: &str) -> Result<()> {
    std::fs::create_dir_all(desktop_state_dir())?;
    let mut f = OpenOptions::new().create(true).append(true).open(errors_log_path())?;
    writeln!(f, "{}\t{}", chrono_like_now(), line)?;
    enforce_size_cap(10 * 1024 * 1024)?;
    Ok(())
}

fn chrono_like_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("ts={}", secs)
}

fn enforce_size_cap(max: u64) -> Result<()> {
    let path = errors_log_path();
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    if size > max {
        let mut f = OpenOptions::new().read(true).write(true).open(&path)?;
        let cut = size / 2;
        f.seek(SeekFrom::Start(cut))?;
        let mut tail = String::new();
        f.read_to_string(&mut tail)?;
        std::fs::write(&path, tail)?;
    }
    Ok(())
}

pub fn read_recent_errors(lines: usize) -> Result<String> {
    let path = errors_log_path();
    if !path.exists() { return Ok(String::new()); }
    let content = std::fs::read_to_string(&path)?;
    let collected: Vec<&str> = content.lines().rev().take(lines).collect();
    Ok(collected.into_iter().rev().collect::<Vec<_>>().join("\n"))
}
```

- [ ] **Step 2: Create `commands/diagnostics.rs`**

```rust
use crate::diagnostics::read_recent_errors;
use crate::preflight::check;

#[tauri::command]
pub async fn export_diagnostics() -> Result<String, String> {
    let pf = check();
    let errors = read_recent_errors(100).unwrap_or_default();
    let info = serde_json::json!({
        "preflight": pf,
        "tauri_version": env!("CARGO_PKG_VERSION"),
        "errors_tail": errors,
    });
    Ok(serde_json::to_string_pretty(&info).unwrap_or_default())
}
```

- [ ] **Step 3: Register in lib.rs**

`pub mod diagnostics;`
Add `commands::diagnostics::export_diagnostics` to handlers.
Add `pub mod commands::diagnostics;` to `commands/mod.rs`.

- [ ] **Step 4: Frontend menu wiring**

Add to `App.tsx` keyboard shortcut (Cmd+Shift+D):

```typescript
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "d") {
      e.preventDefault();
      invoke<string>("export_diagnostics").then((text) => writeText(text));
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

Add `@tauri-apps/plugin-clipboard-manager` to package.json deps and to Cargo.toml + lib.rs:

```toml
tauri-plugin-clipboard-manager = "2"
```

```rust
.plugin(tauri_plugin_clipboard_manager::init())
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/
git commit -m "feat(desktop/diagnostics): add errors.log and Cmd+Shift+D copy diagnostic info"
```

---

### Task 3.12: macOS app icon

**Files:**
- Create: `apps/desktop/src-tauri/icons/icon.png` (1024×1024 source)
- Generate: `apps/desktop/src-tauri/icons/{32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico}`

- [ ] **Step 1: Provide a 1024×1024 source PNG**

Save your design (or initial placeholder) to `apps/desktop/src-tauri/icons/icon.png` (1024×1024, transparent background).

If lacking a real design, use a simple "K" placeholder (created via Sketch/Figma/etc.) — this is replaceable.

- [ ] **Step 2: Generate icon set via tauri CLI**

Run:

```bash
cd apps/desktop && bunx @tauri-apps/cli icon src-tauri/icons/icon.png
```

Expected: outputs `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` into `src-tauri/icons/`.

- [ ] **Step 3: Verify build picks up icons**

Run: `cd apps/desktop && bun run build` (slow ~5 min, full release build)
Expected: `src-tauri/target/release/bundle/dmg/kata Workbench_0.1.0_aarch64.dmg` exists.

- [ ] **Step 4: Commit (without large binary if needed)**

```bash
git add apps/desktop/src-tauri/icons/
git commit -m "chore(desktop): add app icons (1024px source + generated set)"
```

---

### Task 3.13: ad-hoc codesign + dmg packaging

**Files:**
- Create: `apps/desktop/scripts/codesign-adhoc.sh`
- Create: `apps/desktop/scripts/clear-quarantine.sh`
- Modify: `apps/desktop/src-tauri/tauri.conf.json` (signing identity = "-")

- [ ] **Step 1: Update tauri.conf.json macOS bundle**

```json
"macOS": {
  "minimumSystemVersion": "11.0",
  "signingIdentity": "-",
  "frameworks": [],
  "exceptionDomain": ""
}
```

- [ ] **Step 2: Create `scripts/codesign-adhoc.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
APP_PATH="${1:-src-tauri/target/release/bundle/macos/kata Workbench.app}"
echo "ad-hoc signing $APP_PATH"
codesign --force --deep --sign - "$APP_PATH"
codesign -dv "$APP_PATH" 2>&1 | head -5
```

Make executable:

```bash
chmod +x apps/desktop/scripts/codesign-adhoc.sh
```

- [ ] **Step 3: Create `scripts/clear-quarantine.sh`**

```bash
#!/usr/bin/env bash
# Run this once after first launch if Gatekeeper blocks the app:
#   ./clear-quarantine.sh
# OR right-click the .app in Finder and choose "Open" instead.
APP="${1:-/Applications/kata Workbench.app}"
xattr -dr com.apple.quarantine "$APP" || true
echo "Cleared quarantine attribute on $APP"
```

```bash
chmod +x apps/desktop/scripts/clear-quarantine.sh
```

- [ ] **Step 4: Run release build with ad-hoc signing**

```bash
cd apps/desktop && bun run build
bash scripts/codesign-adhoc.sh
ls -la src-tauri/target/release/bundle/dmg/
codesign -dv src-tauri/target/release/bundle/macos/kata\ Workbench.app
```

Expected: Signature info shows `Signature=adhoc`. dmg is in bundle/dmg/.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/
git commit -m "chore(desktop/packaging): add ad-hoc codesign script + clear-quarantine fallback"
```

---

### Task 3.14: INSTALL.md + first-run doc

**Files:**
- Create: `apps/desktop/INSTALL.md`

- [ ] **Step 1: Write INSTALL.md**

```markdown
# Installing kata Workbench (macOS)

## Requirements

- macOS 11+
- `claude` CLI installed and logged in (run `claude login` in terminal first)

## Install

1. Download `kata Workbench_0.1.0_aarch64.dmg`
2. Open the dmg, drag the app into `/Applications/`

## First Launch (Gatekeeper)

The app is **ad-hoc signed** (no Apple Developer account yet). Gatekeeper will warn the first time:

**Option A — Right-click open (recommended)**
1. In `/Applications/`, right-click `kata Workbench.app` → **Open**
2. Click **Open** in the prompt
3. Done. Subsequent launches will not warn.

**Option B — Clear quarantine attribute**
```bash
xattr -dr com.apple.quarantine "/Applications/kata Workbench.app"
```

Or use the bundled script (if you cloned this repo):
```bash
apps/desktop/scripts/clear-quarantine.sh
```

## Troubleshooting

- "App can't be verified" → Use Option A or B above.
- "Claude CLI not found" → Install per https://docs.claude.com/en/docs/claude-code, then click "重新检测" in the app.
- "Not logged in" → Run `claude login` in a terminal, then click "重新检测".

## Uninstall

```bash
rm -rf "/Applications/kata Workbench.app"
rm -rf ~/Projects/kata/.kata/_desktop
```

(Project task logs at `~/Projects/kata/.kata/<project>/` are preserved.)
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/INSTALL.md
git commit -m "docs(desktop): add INSTALL.md with Gatekeeper bypass instructions"
```

---

### Task 3.15: E2E smoke tests

**Files:**
- Create: `apps/desktop/e2e/playwright.config.ts`
- Create: `apps/desktop/e2e/preflight.spec.ts`
- Create: `apps/desktop/e2e/conversation.spec.ts`
- Create: `apps/desktop/e2e/resume.spec.ts`

- [ ] **Step 1: Create playwright config**

```typescript
// apps/desktop/e2e/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  timeout: 120_000,
  fullyParallel: false,
  use: {
    headless: false,
    actionTimeout: 30_000,
  },
});
```

- [ ] **Step 2: Create `preflight.spec.ts`**

```typescript
import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";

test.describe("preflight gate", () => {
  test("shows main UI when claude logged in", async () => {
    const appPath = path.resolve(__dirname, "../src-tauri/target/release/bundle/macos/kata Workbench.app/Contents/MacOS/kata Workbench");
    const electronApp = await electron.launch({ executablePath: appPath });
    const window = await electronApp.firstWindow();
    await expect(window.locator("text=Projects")).toBeVisible({ timeout: 30_000 });
    await electronApp.close();
  });
});
```

- [ ] **Step 3: Create `conversation.spec.ts`**

```typescript
import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";

test("can submit input and see streaming output", async () => {
  const appPath = path.resolve(__dirname, "../src-tauri/target/release/bundle/macos/kata Workbench.app/Contents/MacOS/kata Workbench");
  const app = await electron.launch({ executablePath: appPath });
  const win = await app.firstWindow();

  await win.locator('button:has-text("dataAssets")').first().click();
  const composer = win.locator('textarea');
  await composer.fill("hello");
  await composer.press("Enter");

  // wait for assistant text or tool use
  await expect(win.locator(".prose, [class*='Card']")).toBeVisible({ timeout: 60_000 });
  await app.close();
});
```

- [ ] **Step 4: Create `resume.spec.ts`**

```typescript
import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";

test("can resume historical session", async () => {
  const appPath = path.resolve(__dirname, "../src-tauri/target/release/bundle/macos/kata Workbench.app/Contents/MacOS/kata Workbench");
  const app = await electron.launch({ executablePath: appPath });
  const win = await app.firstWindow();

  // assumes previous session exists
  const sessionItem = win.locator('text=/.*tasks$/').first();
  if (await sessionItem.count()) {
    await sessionItem.click();
    await expect(win.locator(".prose, [class*='Card']")).toBeVisible({ timeout: 30_000 });
  }
  await app.close();
});
```

- [ ] **Step 5: Document local-only execution**

Append to `apps/desktop/README.md`:

```markdown
## E2E (local only)

```bash
cd apps/desktop
bun run build  # need ad-hoc signed bundle first
bunx playwright test --config=e2e/playwright.config.ts
```

CI does NOT run E2E (avoids Anthropic API cost).
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/e2e/ apps/desktop/README.md
git commit -m "test(desktop/e2e): add 3 smoke flows (preflight, conversation, resume)"
```

---

### Task 3.16: M3 manual acceptance + final commit

**Files:**
- (no new files; run all checks)

- [ ] **Step 1: Run full test suite**

```bash
cd apps/desktop/src-tauri && cargo test
cd apps/desktop && bun run type-check
cd apps/desktop && bun test src/
```
Expected: all green.

- [ ] **Step 2: Run M3 manual acceptance checklist**

- [ ] dmg installs cleanly on a fresh mac (or a fresh user account)
- [ ] Right-click → Open works on first launch
- [ ] `codesign -dv kata\ Workbench.app` shows `Signature=adhoc`
- [ ] Preflight gate handles all 3 states (CLI missing / not logged in / ready)
- [ ] Project switcher persists last selection
- [ ] Drag file from FileTree → composer injects @relpath
- [ ] Long task (30s+): stream renders smoothly, no UI freeze
- [ ] Long task → close window → confirm modal appears
- [ ] Run task, restart app, click historical session → events replay
- [ ] Cmd+Shift+D → diagnostic info copied to clipboard
- [ ] Kill `claude` from Activity Monitor → next input respawns PTY
- [ ] Wait 30 minutes idle → PTY auto-closes (status bar updates)
- [ ] Manually delete `~/Projects/kata/.kata/_desktop/ui.db` → app starts fresh, no crash
- [ ] Corrupt `ui.db` (`echo garbage > ui.db`) → app recovers (renames to `ui.db.corrupted`, starts fresh)
- [ ] All 3 E2E specs pass locally

- [ ] **Step 3: Tag release**

```bash
git commit --allow-empty -m "feat(desktop): Spec 1 complete — kata Workbench Shell M3 ready for release"
git tag desktop-spec1-mvp
```

---

### Task 3.17: Frontend component tests (per spec §9.3)

**Files:**
- Create: `apps/desktop/src/components/ui/__tests__/Button.test.tsx`
- Create: `apps/desktop/src/features/preflight/__tests__/PreflightGate.test.tsx`
- Create: `apps/desktop/src/features/workbench/__tests__/Composer.test.tsx`
- Create: `apps/desktop/src/features/workbench/events/__tests__/ToolUseCard.test.tsx`
- Create: `apps/desktop/src/features/filetree/__tests__/FileTree.test.tsx`

- [ ] **Step 1: Install RTL + happy-dom (already in devDeps from Task 0.1) and create test setup**

Create `apps/desktop/src/test-setup.ts`:

```typescript
import "@testing-library/react";
```

Add to `apps/desktop/tsconfig.json` `include`: `"src/test-setup.ts"`.

Add `bun test` config to `apps/desktop/package.json` (bun's test runner uses `bunfig.toml`):

Create `apps/desktop/bunfig.toml`:

```toml
[test]
preload = ["./src/test-setup.ts"]
```

- [ ] **Step 2: Test Button**

`apps/desktop/src/components/ui/__tests__/Button.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, mock } from "bun:test";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click</Button>);
    expect(screen.getByText("Click")).toBeDefined();
  });
  it("calls onClick when not disabled", () => {
    const fn = mock();
    render(<Button onClick={fn}>X</Button>);
    fireEvent.click(screen.getByText("X"));
    expect(fn).toHaveBeenCalled();
  });
  it("does not call onClick when loading", () => {
    const fn = mock();
    render(<Button loading onClick={fn}>X</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Test PreflightGate (mock IPC)**

`apps/desktop/src/features/preflight/__tests__/PreflightGate.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, mock } from "bun:test";
import { PreflightGate } from "../PreflightGate";

mock.module("@/lib/ipc", () => ({
  ipc: {
    getPreflightStatus: async () => ({ kind: "ready", version: "1.0" }),
    recheck: async () => ({ kind: "ready", version: "1.0" }),
  },
}));

describe("PreflightGate", () => {
  it("renders children when status is ready", async () => {
    render(<PreflightGate><div>main</div></PreflightGate>);
    await waitFor(() => expect(screen.getByText("main")).toBeDefined());
  });
});
```

- [ ] **Step 4: Test Composer (Enter to submit, Shift+Enter newline)**

```typescript
// apps/desktop/src/features/workbench/__tests__/Composer.test.tsx
import { render, fireEvent, screen } from "@testing-library/react";
import { describe, it, expect, mock } from "bun:test";
import { Composer } from "../Composer";

mock.module("@/stores/projectStore", () => ({
  useProjectStore: (s: any) => s({ current: "test", projects: [], load: () => {}, switchTo: () => {} }),
}));
mock.module("@/stores/workbenchStore", () => ({
  useWorkbenchStore: (s: any) => s({ activeTask: null, send: async () => {}, stop: async () => {} }),
}));

describe("Composer", () => {
  it("renders textarea", () => {
    render(<Composer />);
    expect(screen.getByPlaceholderText(/输入命令/)).toBeDefined();
  });
});
```

- [ ] **Step 5: Test ToolUseCard expand/collapse**

```typescript
// apps/desktop/src/features/workbench/events/__tests__/ToolUseCard.test.tsx
import { render, fireEvent, screen } from "@testing-library/react";
import { describe, it, expect } from "bun:test";
import { ToolUseCard } from "../ToolUseCard";

describe("ToolUseCard", () => {
  it("toggles details on click", () => {
    render(<ToolUseCard name="Read" input={{ file_path: "/tmp/x" }} />);
    const button = screen.getByText("Read");
    expect(screen.queryByText('"file_path"')).toBeNull();
    fireEvent.click(button);
    expect(screen.getByText(/file_path/)).toBeDefined();
  });
});
```

- [ ] **Step 6: Test FileTree (mock listFiles)**

```typescript
// apps/desktop/src/features/filetree/__tests__/FileTree.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, mock } from "bun:test";
import { FileTree } from "../FileTree";

mock.module("@/lib/ipc", () => ({
  filesIpc: {
    listFiles: async () => [{ name: "a.md", path: "/x/a.md", is_dir: false, size: 10 }],
  },
}));
mock.module("@/stores/projectStore", () => ({
  useProjectStore: (s: any) => s({ current: "test" }),
}));

describe("FileTree", () => {
  it("renders files", async () => {
    render(<FileTree onPreview={() => {}} />);
    await waitFor(() => expect(screen.getByText("a.md")).toBeDefined());
  });
});
```

- [ ] **Step 7: Run tests**

```bash
cd apps/desktop && bun test src/
```
Expected: 5 component test files pass.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/
git commit -m "test(desktop/ui): add component tests for Button/PreflightGate/Composer/ToolUseCard/FileTree"
```

---

### Task 3.18: Tauri command integration tests (per spec §9.2)

**Files:**
- Create: `apps/desktop/src-tauri/tests/integration_projects.rs`
- Create: `apps/desktop/src-tauri/tests/integration_pty.rs`

- [ ] **Step 1: Test project list happy + error paths**

`apps/desktop/src-tauri/tests/integration_projects.rs`:

```rust
use kata_workbench_lib::db::{open_pool, list_projects};
use kata_workbench_lib::projects::scan;
use tempfile::tempdir;

#[test]
fn scan_then_list_returns_consistent_order() {
    let dir = tempdir().unwrap();
    let workspace = dir.path().join("workspace");
    std::fs::create_dir_all(workspace.join("alpha")).unwrap();
    std::fs::create_dir_all(workspace.join("beta")).unwrap();

    let scanned = scan(&workspace).unwrap();
    assert_eq!(scanned.len(), 2);
    assert_eq!(scanned[0].name, "alpha");

    let pool = open_pool(&dir.path().join("ui.db")).unwrap();
    assert_eq!(list_projects(&pool).unwrap().len(), 0); // not yet upserted
}

#[test]
fn scan_handles_nonexistent_workspace() {
    let dir = tempdir().unwrap();
    let result = scan(&dir.path().join("does-not-exist")).unwrap();
    assert_eq!(result.len(), 0);
}
```

- [ ] **Step 2: Test PtyManager get/kill behavior**

`apps/desktop/src-tauri/tests/integration_pty.rs`:

```rust
use kata_workbench_lib::pty::{PtyManager, PtyState, PtyHandle};

#[tokio::test]
async fn get_unknown_returns_none() {
    let m = PtyManager::new();
    assert!(m.get("ghost").await.is_none());
}

#[tokio::test]
async fn kill_unknown_is_noop() {
    let m = PtyManager::new();
    assert!(m.kill("ghost").await.is_ok());
}

#[tokio::test]
async fn handle_starts_in_not_spawned() {
    let h = PtyHandle::new("p".into());
    assert_eq!(*h.state.read().await, PtyState::NotSpawned);
}
```

- [ ] **Step 3: Run integration tests**

```bash
cd apps/desktop/src-tauri && cargo test --test integration_projects --test integration_pty
```
Expected: 5 integration tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/tests/
git commit -m "test(desktop): add Tauri integration tests for projects + pty modules"
```

---

## References

- Spec: [`docs/superpowers/specs/2026-04-26-desktop-shell-spec1-design.md`](../specs/2026-04-26-desktop-shell-spec1-design.md)
- Tauri 2.0: https://tauri.app/
- portable-pty: https://crates.io/crates/portable-pty
- tauri-plugin-window-vibrancy: https://github.com/tauri-apps/tauri-plugin-window-vibrancy
- React Markdown: https://github.com/remarkjs/react-markdown
- shadcn/ui: https://ui.shadcn.com/
- Apple HIG (macOS): https://developer.apple.com/design/human-interface-guidelines/macos
- CLAUDE.md (project rules): `/CLAUDE.md`



