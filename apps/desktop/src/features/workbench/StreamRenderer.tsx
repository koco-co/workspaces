import { useEffect, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import type { StreamEvent, AssistantContent } from "@/lib/types";
import { AssistantText } from "./events/AssistantText";
import { ToolUseCard } from "./events/ToolUseCard";
import { ToolResultCard } from "./events/ToolResultCard";
import { ResultBadge } from "./events/ResultBadge";

interface Props {
  events: StreamEvent[];
  status: "running" | "success" | "failed" | "cancelled" | null;
}

export function StreamRenderer({ events, status }: Props) {
  const ref = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    if (events.length > 0) {
      ref.current?.scrollToIndex({ index: events.length - 1, behavior: "smooth" });
    }
  }, [events.length]);

  return (
    <div className="h-full flex flex-col">
      <Virtuoso
        ref={ref}
        data={events}
        className="flex-1"
        itemContent={(idx, ev) => <Item key={idx} event={ev} />}
      />
      {status && (
        <div className="border-t border-black/5 dark:border-white/10 px-4 py-2">
          <ResultBadge status={status} />
        </div>
      )}
    </div>
  );
}

function Item({ event }: { event: StreamEvent }) {
  if (event.type === "assistant") {
    const msg = (event as Extract<StreamEvent, { type: "assistant" }>).message;
    const blocks = msg?.content ?? [];
    return (
      <div className="px-4 py-1">
        {blocks.map((b: AssistantContent, i: number) => (
          <AssistantBlock key={i} block={b} />
        ))}
      </div>
    );
  }
  if (event.type === "user") {
    const msg = (event as Extract<StreamEvent, { type: "user" }>).message;
    const blocks = msg?.content ?? [];
    return (
      <div className="px-4 py-1">
        {blocks.map((b, i: number) => {
          if (b.type === "tool_result") {
            const content = typeof b.content === "string"
              ? b.content
              : (b.content || []).map((c: { text?: string }) => c.text ?? "").join("\n");
            return <ToolResultCard key={i} content={content} isError={b.is_error} />;
          }
          return null;
        })}
      </div>
    );
  }
  if (event.type === "system") return null;
  if (event.type === "result") return null;
  return null;
}

function AssistantBlock({ block }: { block: AssistantContent }) {
  if (block.type === "text") return <AssistantText text={block.text} />;
  if (block.type === "tool_use") return <ToolUseCard name={block.name} input={block.input} />;
  return null;
}
