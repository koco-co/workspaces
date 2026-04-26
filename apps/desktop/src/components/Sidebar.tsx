import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ProjectsList } from "@/features/projects/ProjectsList";

interface SidebarProps {
  className?: string;
  bottomSlot?: ReactNode;
}

export function Sidebar({ className, bottomSlot }: SidebarProps) {
  return (
    <aside className={cn(
      "vibrancy-sidebar h-full w-[260px] flex flex-col",
      "border-r border-black/8 dark:border-white/10",
      className,
    )}>
      <div className="px-3 pt-12 pb-2 text-[11px] uppercase tracking-wider opacity-50">
        Projects
      </div>
      <div className="flex-1 overflow-y-auto">
        <ProjectsList />
      </div>
      {bottomSlot ? <div className="border-t border-black/8 dark:border-white/10">{bottomSlot}</div> : null}
    </aside>
  );
}
