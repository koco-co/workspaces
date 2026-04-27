import type { Plugin } from "vite";

export function tauriMockPlugin(): Plugin {
  const mockModules: Record<string, string> = {
    "@tauri-apps/api/core": `
      export function invoke(cmd, args) {
        return window.__TAURI_INTERNALS__.invoke(cmd, args);
      }
    `,
    "@tauri-apps/api/event": `
      export function listen(event, cb) {
        return window.__TAURI_INTERNALS__.events.listen(event, cb);
      }
      export async function emit(event, payload) {
        return window.__TAURI_INTERNALS__.events.emit(event, payload);
      }
    `,
    "@tauri-apps/api/window": `
      export function getCurrentWindow() {
        return { close: () => Promise.resolve() };
      }
    `,
    "@tauri-apps/plugin-shell": `
      export function open(url) { return Promise.resolve(); }
    `,
    "@tauri-apps/plugin-clipboard-manager": `
      export async function writeText(text) { return Promise.resolve(); }
    `,
    "@tauri-apps/plugin-dialog": `
      export async function open() { return null; }
    `,
    "@tauri-apps/plugin-fs": `
      export async function readTextFile() { return ''; }
    `,
  };

  return {
    name: "tauri-mock",
    resolveId(id) {
      if (mockModules[id]) return "\0" + id;
      return null;
    },
    load(id) {
      if (id.startsWith("\0")) {
        const realId = id.slice(1);
        if (mockModules[realId]) return mockModules[realId];
      }
      return null;
    },
  };
}
