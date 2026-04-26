import { useState } from "react";
import { ChevronRight, CornerDownRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface Props {
  content: string;
  isError?: boolean;
}

export function ToolResultCard({ content, isError }: Props) {
  const [open, setOpen] = useState(false);
  const preview = content.length > 100 ? content.slice(0, 97) + "…" : content;
  return (
    <Card className={cn("my-2", isError && "border-danger-light dark:border-danger-dark")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[13px] hover:bg-black/3 dark:hover:bg-white/5"
      >
        <ChevronRight className={cn("size-3.5 transition-transform duration-fast", open && "rotate-90")} />
        <CornerDownRight className="size-3.5 opacity-70" />
        <span className={cn("opacity-70 truncate", isError && "text-danger-light dark:text-danger-dark")}>
          {isError ? "❌ " : ""}{preview}
        </span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[12px] font-mono opacity-80 border-t border-black/5 dark:border-white/10 overflow-auto max-h-72 whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </Card>
  );
}
