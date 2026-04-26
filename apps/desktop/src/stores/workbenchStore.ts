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
