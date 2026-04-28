---
name: playwright-cli
description: Automate browser interactions, test web pages and work with Playwright tests.
allowed-tools: Bash(playwright-cli:*) Bash(bunx:*) Bash(bun run:*) Bash(bun test:*)
---

# Browser Automation with playwright-cli

## Safety policy

<confirmation_policy>
<read_only>
snapshot、eval、console、network、tab-list、list、goto 等只读/导航命令可直接执行，无需额外确认。
</read_only>
<stateful>
open、close、tab-new、tab-close、state-load、cookie/localStorage/sessionStorage 写操作会改变当前会话状态；在共享会话中应先说明目标 session。
</stateful>
<destructive>
delete-data、close-all、kill-all 会删除数据或影响多个浏览器进程。执行前必须先展示目标 session / 影响范围，并获得明确确认。优先使用会话级 close 或 delete-data，最后才使用全局 kill-all。
</destructive>
</confirmation_policy>

A browser automation skill based on playwright-cli CLI. Supports opening browsers, navigating pages, interacting with elements (click, type, fill, drag, etc.), managing tabs, cookies, localStorage, network interception, devtools, screenshots, PDFs, and more.

详见 [workflow.md](workflow.md) 查看完整命令参考、参数说明、示例和最佳实践。

## Trigger words

- browser automation, playwright, browser interaction, web testing, page interaction
- playwright-cli, browser session, screenshot, snapshot, eval
- open browser, close browser, click element, fill form, navigate to URL
- cookie, localStorage, sessionStorage, network mock, route intercept
- 浏览器操作、打开网页、点击元素、填写表单、截图、运行测试
