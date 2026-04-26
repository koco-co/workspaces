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
