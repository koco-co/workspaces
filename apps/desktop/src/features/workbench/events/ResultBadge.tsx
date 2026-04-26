import { cn } from "@/lib/cn";

interface Props {
  status: "running" | "success" | "failed" | "cancelled";
  durationMs?: number;
  costUsd?: number;
}

const statusClass: Record<Props["status"], string> = {
  running: "bg-accent-light/15 dark:bg-accent-dark/25 text-accent-light dark:text-accent-dark",
  success: "bg-success-light/15 dark:bg-success-dark/25 text-success-light dark:text-success-dark",
  failed: "bg-danger-light/15 dark:bg-danger-dark/25 text-danger-light dark:text-danger-dark",
  cancelled: "bg-warning-light/15 dark:bg-warning-dark/25 text-warning-light dark:text-warning-dark",
};

export function ResultBadge({ status, durationMs, costUsd }: Props) {
  return (
    <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px]", statusClass[status])}>
      <span className="font-medium uppercase tracking-wider">{status}</span>
      {durationMs ? <span>{(durationMs / 1000).toFixed(1)}s</span> : null}
      {costUsd ? <span>${costUsd.toFixed(4)}</span> : null}
    </div>
  );
}
