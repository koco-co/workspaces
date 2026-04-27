# 已迁移

本目录在 v3 架构重构（P1）中迁移到了 [`engine/`](../../engine/)。

- 入口脚本（kata-cli 子命令）→ `engine/src/`
- 公共库（lib/）→ `engine/src/lib/`（5 个旧抽屉子目录已打平）
- 单元测试（__tests__/）→ `engine/tests/`

CLI 命令未变：

```bash
kata-cli --help
bun test --cwd engine
```

详见 [docs/superpowers/specs/2026-04-27-architecture-redesign-design.md](../../docs/superpowers/specs/2026-04-27-architecture-redesign-design.md) §3。

本 README 在 6 个月后（约 2026-10）连同空目录一并删除。
