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
