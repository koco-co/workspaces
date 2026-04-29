#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || exit 1)

echo "=== 知识库主键检查 ==="

names=$(grep -r '^name:' "$ROOT/workspace" --include="*.md" -l 2>/dev/null || true)
if [ -z "$names" ]; then
  echo "  跳过（无 knowledge 文件）"
  exit 0
fi

dups=$(grep -rh '^name:' "$ROOT/workspace" 2>/dev/null | sort | uniq -d)
if [ -n "$dups" ]; then
  echo "⚠ 发现重复 name:"
  echo "$dups"
else
  echo "✅ 所有 name 唯一"
fi
