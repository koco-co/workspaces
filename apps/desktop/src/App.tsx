import { useEffect, useState } from "react";
import { ipc } from "./lib/ipc";
import type { PreflightStatus, ProjectDto } from "./lib/types";

export default function App() {
  const [pf, setPf] = useState<PreflightStatus | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  useEffect(() => {
    ipc.getPreflightStatus().then(setPf);
    ipc.listProjects().then(setProjects);
  }, []);
  return (
    <div className="h-full p-8 bg-white/40 dark:bg-black/40">
      <pre className="text-sm">{JSON.stringify({ pf, projects }, null, 2)}</pre>
    </div>
  );
}
