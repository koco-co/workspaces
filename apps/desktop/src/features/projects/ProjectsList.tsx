import { useEffect } from "react";
import { List, ListItem } from "@/components/ui/List";
import { Spinner } from "@/components/ui/Spinner";
import { useProjectStore } from "@/stores/projectStore";

export function ProjectsList() {
  const { projects, current, loading, load, switchTo } = useProjectStore();

  useEffect(() => { load(); }, [load]);

  if (loading && projects.length === 0) {
    return <div className="p-3"><Spinner /></div>;
  }
  if (projects.length === 0) {
    return <div className="p-3 text-[13px] opacity-60">未找到项目</div>;
  }
  return (
    <List className="p-1.5">
      {projects.map((p) => (
        <ListItem
          key={p.name}
          selected={current === p.name}
          onClick={() => switchTo(p.name)}
        >
          <div className="flex items-center justify-between">
            <span className="truncate">{p.display_name ?? p.name}</span>
          </div>
        </ListItem>
      ))}
    </List>
  );
}
