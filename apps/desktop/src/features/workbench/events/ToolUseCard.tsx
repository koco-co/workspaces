import { useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface Props {
  name: string;
  input: Record<string, unknown>;
}

function summarize(input: Record<string, unknown>): string {
  const candidates = ["file_path", "path", "command", "pattern", "description"];
  for (const k of candidates) {
    const v = input[k];
    if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "…" : v;
  }
  const keys = Object.keys(input);
  if (keys.length === 0) return "(no args)";
  return keys.join(", ");
}

export function ToolUseCard({ name, input }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="my-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[13px] hover:bg-black/3 dark:hover:bg-white/5"
      >
        <ChevronRight className={cn("size-3.5 transition-transform duration-fast", open && "rotate-90")} />
        <Wrench className="size-3.5 opacity-70" />
        <span className="font-medium">{name}</span>
        <span className="opacity-60 truncate">{summarize(input)}</span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[12px] font-mono opacity-80 border-t border-black/5 dark:border-white/10 overflow-auto max-h-72">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </Card>
  );
}
