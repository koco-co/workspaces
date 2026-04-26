import { PreflightGate } from "./features/preflight/PreflightGate";

export default function App() {
  return (
    <PreflightGate>
      <div className="h-full p-8">主界面占位（待 Task 1.13 实现 Sidebar）</div>
    </PreflightGate>
  );
}
