# playwright-cli — Workflow

This skill is **reference-driven**, not workflow-driven. The sub-agent dispatch pattern is:

1. Read SKILL.md to understand trigger conditions.
2. Identify which reference document covers the user's question.
3. Read the relevant reference and extract concrete commands / patterns.
4. Apply.

## Reference index

| Question topic | Reference doc |
|----------------|---------------|
| Element selectors and attributes | `references/element-attributes.md` |
| Running Playwright tests | `references/playwright-tests.md` |
| Mocking network requests | `references/request-mocking.md` |
| Running custom Playwright code | `references/running-code.md` |
| Browser session management | `references/session-management.md` |
| Storage state (cookies, localStorage) | `references/storage-state.md` |
| Generating tests from recordings | `references/test-generation.md` |
| Tracing test runs | `references/tracing.md` |
| Recording test videos | `references/video-recording.md` |
