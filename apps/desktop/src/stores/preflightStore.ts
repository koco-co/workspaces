import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { ipc } from "@/lib/ipc";
import type { PreflightStatus } from "@/lib/types";

interface PreflightState {
  status: PreflightStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const usePreflightStore = create<PreflightState>((set) => {
  listen<{ status: PreflightStatus }>("preflight:changed", (e) => {
    set({ status: e.payload.status });
  });
  return {
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
  };
});
