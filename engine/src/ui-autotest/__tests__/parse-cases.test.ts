import { describe, it, expect } from "bun:test";
import {
  extractPriority,
  parseStepTable,
  extractPreconditions,
  parseArchiveMd,
} from "../parse-cases.ts";

describe("extractPriority", () => {
  it("extracts P0 from title", () => {
    expect(extractPriority("【P0】验证列表加载")).toBe("P0");
  });

  it("extracts P1 from title", () => {
    expect(extractPriority("【P1】验证搜索功能")).toBe("P1");
  });

  it("extracts P2 from title", () => {
    expect(extractPriority("【P2】验证排序功能")).toBe("P2");
  });

  it("defaults to P2 when no priority prefix", () => {
    expect(extractPriority("验证无前缀标题")).toBe("P2");
  });
});

describe("parseStepTable", () => {
  it("parses a standard step table", () => {
    const table = `| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1 | 进入列表页 | 页面正常加载 |
| 2 | 点击新增按钮 | 弹窗出现 |`;

    const steps = parseStepTable(table);
    expect(steps.length).toBe(2);
    expect(steps[0].step).toBe("进入列表页");
    expect(steps[0].expected).toBe("页面正常加载");
    expect(steps[1].step).toBe("点击新增按钮");
    expect(steps[1].expected).toBe("弹窗出现");
  });

  it("handles empty table", () => {
    const table = `| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |`;
    const steps = parseStepTable(table);
    expect(steps.length).toBe(0);
  });
});

describe("extractPreconditions", () => {
  it("extracts preconditions from code block under blockquote", () => {
    const block = `##### 【P0】验证xxx

> 前置条件

\`\`\`
1) 登录系统
2) 进入列表页
\`\`\`

> 用例步骤`;
    const result = extractPreconditions(block);
    expect(result.includes("登录系统").toBeTruthy());
    expect(result.includes("进入列表页").toBeTruthy());
  });

  it("extracts preconditions from code block format", () => {
    const block = `##### 【P0】验证xxx

> 前置条件

\`\`\`
1) 登录系统
2) 数据准备完成
\`\`\`

> 用例步骤`;
    const result = extractPreconditions(block);
    expect(result.includes("登录系统").toBeTruthy());
    expect(result.includes("数据准备完成").toBeTruthy());
  });

  it("handles preconditions containing letter z without truncation", () => {
    const block = `##### 【P0】验证xxx

> 前置条件

\`\`\`
1) 登录 zenith 系统
2) 配置 zookeeper 连接
\`\`\`

> 用例步骤`;
    const result = extractPreconditions(block);
    expect(result.includes("zenith").toBeTruthy(), "should not truncate at letter z");
    expect(result.includes("zookeeper").toBeTruthy(), "should include zookeeper");
  });
});

describe("parseArchiveMd", () => {
  const sampleMd = `---
suite_name: "测试套件"
case_count: 2
---

## 模块A

### 列表页

##### 【P0】验证列表默认加载

> 前置条件

\`\`\`
1) 使用 admin 账号登录系统
\`\`\`

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1 | 进入列表页 | 页面正常加载 |

##### 【P1】验证搜索功能

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1 | 输入关键词 | 列表更新 |
| 2 | 点击查询 | 显示筛选结果 |
`;

  it("parses archive MD into tasks", () => {
    const result = parseArchiveMd(sampleMd, "test.md");
    expect(result.suite_name).toBe("测试套件");
    expect(result.tasks.length).toBe(2);
    expect(result.stats.total).toBe(2);
    expect(result.stats.P0).toBe(1);
    expect(result.stats.P1).toBe(1);
  });

  it("extracts correct page from H3 heading", () => {
    const result = parseArchiveMd(sampleMd, "test.md");
    expect(result.tasks[0].page).toBe("列表页");
  });

  it("extracts steps correctly", () => {
    const result = parseArchiveMd(sampleMd, "test.md");
    expect(result.tasks[0].steps.length).toBe(1);
    expect(result.tasks[1].steps.length).toBe(2);
  });

  it("assigns sequential IDs", () => {
    const result = parseArchiveMd(sampleMd, "test.md");
    expect(result.tasks[0].id).toBe("t1");
    expect(result.tasks[1].id).toBe("t2");
  });

  it("extracts preconditions for cases that have them", () => {
    const result = parseArchiveMd(sampleMd, "test.md");
    expect(result.tasks[0].preconditions.includes("admin").toBeTruthy());
    expect(result.tasks[1].preconditions).toBe("");
  });
});
