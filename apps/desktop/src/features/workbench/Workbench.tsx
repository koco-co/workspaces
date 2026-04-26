import { useEffect } from "react";
import { StreamRenderer } from "./StreamRenderer";
import { Composer } from "./Composer";
import { useWorkbenchStore } from "@/stores/workbenchStore";
import { useProjectStore } from "@/stores/projectStore";

export function Workbench() {
  const project = useProjectStore((s) => s.current);
  const activeTask = useWorkbenchStore((s) => s.activeTask);
  const startListening = useWorkbenchStore((s) => s.startListening);
  const stopListening = useWorkbenchStore((s) => s.stopListening);

  useEffect(() => {
    startListening();
    return () => stopListening();
  }, [startListening, stopListening]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-60">
        请从左侧选择项目
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 min-h-0">
        <StreamRenderer
          events={activeTask?.events ?? []}
          status={activeTask?.status ?? null}
        />
      </div>
      <Composer />
    </div>
  );
}
