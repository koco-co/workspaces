import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { sessionsIpc } from "@/lib/ipc";
import type { SessionDto } from "@/lib/types";
import { useProjectStore } from "@/stores/projectStore";
import { List, ListItem } from "@/components/ui/List";

export function SessionsList() {
  const project = useProjectStore((s) => s.current);
  const [sessions, setSessions] = useState<SessionDto[]>([]);

  useEffect(() => {
    if (!project) return;
    sessionsIpc.list(project).then(setSessions);
  }, [project]);

  if (!project) return null;
  if (sessions.length === 0) {
    return <div className="px-3 py-2 text-[12px] opacity-50">无历史 session</div>;
  }
  return (
    <List className="p-1.5">
      {sessions.map((s) => (
        <ListItem
          key={s.session_id}
          onClick={() => sessionsIpc.resume(project, s.session_id)}
        >
          <div className="flex items-start gap-2">
            <History className="size-3.5 mt-0.5 opacity-60 flex-shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-[12.5px]">
                {s.first_input_summary ?? s.session_id.slice(0, 8)}
              </div>
              <div className="text-[11px] opacity-50">
                {new Date(s.last_active_at * 1000).toLocaleString()} · {s.task_count} tasks
              </div>
            </div>
          </div>
        </ListItem>
      ))}
    </List>
  );
}
