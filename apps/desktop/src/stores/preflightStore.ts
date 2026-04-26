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
