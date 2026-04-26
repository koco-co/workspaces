import { PreflightGate } from "./features/preflight/PreflightGate";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  return (
    <PreflightGate>
      <div className="h-full flex bg-white/40 dark:bg-black/40">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-sm opacity-60">
            主工作区（M2 实现 Workbench；当前为占位）
          </p>
        </main>
      </div>
    </PreflightGate>
  );
}
