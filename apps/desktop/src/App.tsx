import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { PreflightGate } from "./features/preflight/PreflightGate";
import { Sidebar } from "./components/Sidebar";
import { Workbench } from "./features/workbench/Workbench";
import { Modal } from "./components/ui/Modal";
import { Button } from "./components/ui/Button";
import { useWorkbenchStore } from "./stores/workbenchStore";
import { useProjectStore } from "./stores/projectStore";

export default function App() {
  const [closeAsked, setCloseAsked] = useState(false);
  const stop = useWorkbenchStore((s) => s.stop);
  const project = useProjectStore((s) => s.current);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    listen("app:close-requested", () => setCloseAsked(true)).then((u) => { unsub = u; });
    return () => { unsub?.(); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "d") {
        e.preventDefault();
        invoke<string>("export_diagnostics").then((text) => writeText(text));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const confirmClose = async () => {
    if (project) await stop(project);
    await getCurrentWindow().close();
  };

  return (
    <>
      <PreflightGate>
        <div className="h-full flex bg-white/40 dark:bg-black/40">
          <Sidebar />
          <Workbench />
        </div>
      </PreflightGate>
      {closeAsked && (
        <Modal title="任务进行中" onClose={() => setCloseAsked(false)}>
          <p className="text-sm">有任务正在运行，强制退出会中断输出并标记为 cancelled。</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setCloseAsked(false)}>取消</Button>
            <Button variant="danger" onClick={confirmClose}>强制退出</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
