import type { Feature, MigrationLog, MigrationOp } from "./types.ts";

export function discoverFeatures(projectDir: string, kataRoot?: string): Feature[] {
  throw new Error("not implemented");
}

export function planMigration(features: Feature[], projectDir: string): MigrationOp[] {
  throw new Error("not implemented");
}

export function applyMigration(
  ops: MigrationOp[],
  options: { mode: "dry" | "real"; project: string; logPath: string },
): MigrationLog {
  throw new Error("not implemented");
}

export function rollbackFromLog(logPath: string): MigrationLog {
  throw new Error("not implemented");
}
