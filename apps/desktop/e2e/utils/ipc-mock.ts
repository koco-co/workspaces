import type { Page } from "@playwright/test";
import { resolve } from "path";

type IpcHandler = (...args: any[]) => any;

export async function mockIpc(page: Page, handlers: Record<string, IpcHandler>) {
  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = {
      invoke: (cmd: string, args?: any) => {
        const handler = (window as any).__MOCK_HANDLERS__?.[cmd];
        if (!handler) throw new Error(`unmocked IPC: ${cmd}`);
        return Promise.resolve(handler(args));
      },
      convertFileSrc: (path: string) => path,
      events: {
        listen: (event: string, cb: (e: any) => void) => {
          if (!window.__MOCK_EVENTS__) window.__MOCK_EVENTS__ = {};
          if (!window.__MOCK_EVENTS__[event]) window.__MOCK_EVENTS__[event] = [];
          window.__MOCK_EVENTS__[event].push(cb);
          return Promise.resolve(() => {
            window.__MOCK_EVENTS__[event] = window.__MOCK_EVENTS__[event]?.filter(
              (l: Function) => l !== cb,
            );
          });
        },
        emit: (event: string, payload: any) => {
          window.__MOCK_EVENTS__?.[event]?.forEach((cb: Function) =>
            cb({ payload, event }),
          );
          return Promise.resolve();
        },
      },
    };
  });
  await page.evaluate((h) => { (window as any).__MOCK_HANDLERS__ = h; }, handlers);
}

export async function emitTauriEvent(page: Page, event: string, payload: any) {
  await page.evaluate(
    ({ e, p }) => window.__TAURI_INTERNALS__.events.emit(e, p),
    { e: event, p: payload },
  );
}

export function tauriMockPluginPath() {
  return resolve(__dirname, "../fixtures/vite-tauri-mock-plugin.ts");
}
