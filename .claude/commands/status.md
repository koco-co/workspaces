报告当前项目状态：

1. git branch（当前分支、是否有未提交变更）
2. 测试通过数（检查 .temp/last-test-result 或运行 bun test --cwd engine --reporter=summary 2>/dev/null | tail -3）
3. 最近的 git commit（SHA + message）
4. workspace 目录概览
