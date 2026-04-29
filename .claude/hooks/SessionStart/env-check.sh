#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
cd "$ROOT"

echo "=== 环境依赖检查 ==="
missing=0

check_tool() {
  local name=$1 cmd=$2 version_flag=$3 min_version=$4
  if ! command -v "$cmd" &>/dev/null; then
    echo "  ❌ $name: 未安装"
    echo "     安装: $5"
    missing=1
    return
  fi
  local ver=$("$cmd" "$version_flag" 2>/dev/null | head -1)
  echo "  ✅ $name: $ver"
  if [ -n "$min_version" ]; then
    if ! echo "$ver" | grep -qE "^v?$min_version"; then
      echo "     ⚠ 最低版本要求: $min_version"
    fi
  fi
}

check_tool "Node.js" "node" "--version" "v22" "nvm install 22"
check_tool "Bun" "bun" "--version" "" "npm install -g bun"
check_tool "Git" "git" "--version" "" "brew install git"

if [ "$missing" -eq 1 ]; then
  echo "⚠ 部分工具缺失，请按提示安装后重试"
else
  echo "✅ 所有依赖已就绪"
fi
