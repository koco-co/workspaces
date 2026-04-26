import { invoke } from "@tauri-apps/api/core";
import type { PreflightStatus, ProjectDto } from "./types";

export const ipc = {
  getPreflightStatus: () => invoke<PreflightStatus>("get_preflight_status"),
  recheck: () => invoke<PreflightStatus>("recheck"),
  listProjects: () => invoke<ProjectDto[]>("list_projects_cmd"),
  switchProject: (name: string) => invoke<void>("switch_project_cmd", { name }),
};
