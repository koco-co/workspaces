import { invoke } from "@tauri-apps/api/core";
import type { PreflightStatus, ProjectDto, SessionDto, TaskStarted, TaskDto, FileEntry } from "./types";

export const ipc = {
  getPreflightStatus: () => invoke<PreflightStatus>("get_preflight_status"),
  recheck: () => invoke<PreflightStatus>("recheck"),
  listProjects: () => invoke<ProjectDto[]>("list_projects_cmd"),
  switchProject: (name: string) => invoke<void>("switch_project_cmd", { name }),
};

export const workbenchIpc = {
  sendInput: (project: string, text: string) =>
    invoke<TaskStarted>("send_input", { project, text }),
  stopTask: (project: string) => invoke<void>("stop_task", { project }),
  listRecentTasks: (project: string, limit?: number) =>
    invoke<TaskDto[]>("list_recent_tasks_cmd", { project, limit }),
  pinTask: (project: string, taskId: string, pinned: boolean) =>
    invoke<void>("pin_task_cmd", { project, taskId, pinned }),
};

export const filesIpc = {
  listFiles: (project: string, sub?: string) =>
    invoke<FileEntry[]>("list_files", { project, sub }),
  readFileText: (path: string) => invoke<string>("read_file_text", { path }),
  openWithDefault: (path: string) => invoke<void>("open_with_default", { path }),
  openInFinder: (path: string) => invoke<void>("open_in_finder", { path }),
};

export const sessionsIpc = {
  list: (project: string, limit?: number) =>
    invoke<SessionDto[]>("list_sessions_cmd", { project, limit }),
  resume: (project: string, sessionId: string) =>
    invoke<void>("resume_session", { project, sessionId }),
};
