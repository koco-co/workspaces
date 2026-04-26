import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { usePreflightStore } from "@/stores/preflightStore";
import type { ReactNode } from "react";

const CLAUDE_INSTALL_DOCS = "https://docs.claude.com/en/docs/claude-code";

interface GateProps { children: ReactNode }

export function PreflightGate({ children }: GateProps) {
  const { status, loading, refresh } = usePreflightStore();

  useEffect(() => {
    if (status === null) refresh();
  }, [status, refresh]);

  if (status === null) {
    return <Centered><Spinner /></Centered>;
  }
  if (status.kind === "ready") {
    return <>{children}</>;
  }
  if (status.kind === "cli_missing") {
    return (
      <Centered>
        <Card className="p-8 max-w-md space-y-4 text-center">
          <h2 className="text-xl font-semibold">Claude Code CLI 不可用</h2>
          <p className="text-sm opacity-70">
            kata Workbench 依赖 <code>claude</code> 命令。请先安装并确保它在 PATH 中。
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="primary" onClick={() => open(CLAUDE_INSTALL_DOCS)}>
              查看安装文档
            </Button>
            <Button onClick={refresh} loading={loading}>重新检测</Button>
          </div>
        </Card>
      </Centered>
    );
  }
  // not_logged_in
  return (
    <Centered>
      <Card className="p-8 max-w-md space-y-4 text-center">
        <h2 className="text-xl font-semibold">尚未登录 Claude</h2>
        <p className="text-sm opacity-70">
          已检测到 CLI（{status.version}），但还未登录。请在终端运行 <code>claude login</code>。
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="primary" onClick={() => open("x-terminal:")}>打开终端</Button>
          <Button onClick={refresh} loading={loading}>重新检测</Button>
        </div>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center bg-white/40 dark:bg-black/40">
      {children}
    </div>
  );
}
