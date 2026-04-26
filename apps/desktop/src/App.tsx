import { PreflightGate } from "./features/preflight/PreflightGate";
import { Sidebar } from "./components/Sidebar";
import { Workbench } from "./features/workbench/Workbench";

export default function App() {
  return (
    <PreflightGate>
      <div className="h-full flex bg-white/40 dark:bg-black/40">
        <Sidebar />
        <Workbench />
      </div>
    </PreflightGate>
  );
}
