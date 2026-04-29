#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || exit 1)
cd "$ROOT"

echo "=== Workspace 结构检查 ==="

required_dirs=(
  "workspace"
  "engine/src"
  "engine/tests"
  "engine/hooks"
)

missing=0
for dir in "${required_dirs[@]}"; do
  if [ -d "$dir" ]; then
    echo "  ✅ $dir"
  else
    echo "  ❌ $dir: 缺失"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  echo "⚠ workspace 结构不完整，请检查仓库状态"
else
  echo "✅ workspace 结构正常"
fi
