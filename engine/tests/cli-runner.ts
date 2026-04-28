import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

export const KATA_CLI = resolve(import.meta.dirname, "../bin/kata-cli");

export function runKataCli(args: string[], opts: { cwd?: string } = {}): string {
  return execFileSync(KATA_CLI, args, {
    encoding: "utf8",
    cwd: opts.cwd,
  }) as string;
}

export function spawnKataCli(args: string[], opts: { cwd?: string } = {}) {
  return spawnSync(KATA_CLI, args, {
    encoding: "utf8",
    cwd: opts.cwd,
  });
}
