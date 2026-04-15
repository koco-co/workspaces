# Playwright 编码最佳实践

Playwright 自动化测试脚本的标准化编码模式和规范。

## 1. 定位器优先级

优先级从高到低，选择时遵循此顺序：

### 1.1 第一优先级：语义化定位器

使用 Playwright 的内置语义化定位器，最具可读性和可维护性：

- `page.getByRole('button', { name: '新增' })` — 按角色和名称
- `page.getByLabel('商品名称')` — 表单标签
- `page.getByPlaceholder('请输入商品名称')` — 占位符文本
- `page.getByText('确认')` — 精确文本匹配

### 1.2 第二优先级：测试 ID

当语义化定位器无法确定时，使用测试 ID（元素中的 `data-testid` 属性）：

```typescript
page.getByTestId('search-btn')
page.getByTestId('user-profile-avatar')
```

### 1.3 第三优先级：CSS 选择器

仅在前两种方式无法使用时采用 CSS 选择器：

```typescript
page.locator('.ant-btn-primary')
page.locator('table tbody tr').first()
```

### 1.4 无法确定时的处理

当无法通过源码或 DOM 确定选择器时：

```typescript
// TODO: 需通过 playwright-cli snapshot 获取实际选择器
page.locator('text={{按钮文本}}')
```

## 2. step() 函数规范

`step(name, body, highlight?)` 是一个自定义 fixture，会在每步执行后自动截图并附加到测试报告。

### 2.1 参数说明

- `name`：步骤名称，格式 `"步骤N: {{step描述}} → {{expected描述}}"`
- `body`：异步函数，包含该步骤的操作和断言
- `highlight`（可选）：一个 Locator，截图时会对该元素加红框高亮

### 2.2 使用示例

基础使用（无高亮）：

```typescript
await step("步骤1: 进入数据质量页面", async () => {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
});
```

带高亮（断言的目标元素）：

```typescript
const heading = page.getByRole("heading", { name: "质量问题台账" });
await step(
  "步骤2: 验证页面标题 → 显示质量问题台账",
  async () => {
    await expect(heading).toBeVisible();
  },
  heading,
);
```

### 2.3 highlight 使用原则

- 断言涉及**可见元素**时，传入该元素作为 `highlight`
- 断言为 URL 校验、非可视化验证时，**不传** `highlight`
- 优先高亮断言的**主要目标元素**（如验证表格 → 高亮首行）

## 3. 高频错误场景 UI 模式

### 3.1 表单填写与提交

```typescript
await step("步骤1: 填写表单 → 成功提交", async () => {
  // 填写文本输入框
  await page.getByLabel("商品名称").fill("2026春季新款运动鞋");
  
  // 选择下拉框
  await page.getByLabel("商品分类").selectOption("运动鞋");
  
  // 点击提交按钮
  await page.getByRole("button", { name: "提交" }).click();
  
  // 等待提交完成和响应消息
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("保存成功")).toBeVisible({ timeout: 5000 });
});
```

### 3.2 表格数据验证

```typescript
await step("步骤2: 查看列表数据 → 表格有数据", async () => {
  // 等待表格加载
  const tableRows = page.locator("table tbody tr");
  await expect(tableRows.first()).toBeVisible();
  
  // 验证表格有数据
  await expect(tableRows).not.toHaveCount(0);
  
  // 验证首行的特定列值
  const firstRow = tableRows.first();
  await expect(firstRow.locator("td").nth(0)).toContainText("期望值");
}, tableRows.first());
```

## 4. 等待策略

选择合适的等待方式，避免不必要的延迟：

### 4.1 页面导航后

```typescript
await page.goto(url);
await page.waitForLoadState("networkidle"); // 等待网络空闲
```

### 4.2 表单提交或删除操作后

```typescript
await page.getByRole("button", { name: "提交" }).click();
await page.waitForLoadState("networkidle");
// 或等待特定消息出现
await expect(page.getByText("操作成功")).toBeVisible({ timeout: 5000 });
```

### 4.3 弹窗出现与关闭

```typescript
// 等待弹窗出现
await expect(page.getByRole("dialog")).toBeVisible();

// 点击确认
await page.getByRole("button", { name: "确认" }).click();

// 等待弹窗关闭
await expect(page.getByRole("dialog")).not.toBeVisible();
```

### 4.4 其他策略

- **等待特定元素可见**：`await page.waitForSelector('.target', { state: 'visible' })`
- **等待 API 响应**：`await page.waitForResponse(url => url.includes('/api/'))`
- **固定等待（最后手段）**：`await page.waitForTimeout(500)` — 仅在其他方式无法工作时使用，不超过 2000ms

## 5. Meta 注释格式

每个 Playwright 脚本的文件头部必须包含 META 注释：

```typescript
// META: {"id":"t1","priority":"P0","title":"【P0】验证xxx"}
import { test, expect } from "../../fixtures/step-screenshot";

test.use({ storageState: ".auth/session.json" });

test.describe("功能名称 - 页面名", () => {
  test("【P0】验证xxx", async ({ page, step }) => {
    // 步骤内容
  });
});
```

### 5.1 META 字段说明

- `id`：测试用例 ID（如 `t1`, `t2`）
- `priority`：优先级（`P0`, `P1`, `P2`）
- `title`：完整的测试标题，包含优先级前缀

## 6. 完整脚本模板

```typescript
// META: {"id":"t1","priority":"P0","title":"【P0】验证xxx"}
import { test, expect } from "../../fixtures/step-screenshot";

test.use({ storageState: ".auth/session.json" });

test.describe("功能名称 - 页面名", () => {
  test("【P0】验证xxx", async ({ page, step }) => {
    // 步骤1：进入页面
    await step("步骤1: 进入页面 → 页面正常加载", async () => {
      await page.goto("https://xxx.dtstack.cn/path");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading")).toBeVisible();
    });

    // 步骤2：执行操作
    await step("步骤2: 填写表单 → 成功提交", async () => {
      await page.getByLabel("字段名").fill("输入值");
      const submitBtn = page.getByRole("button", { name: "提交" });
      await submitBtn.click();
      await expect(page.getByText("成功")).toBeVisible({ timeout: 5000 });
    }, submitBtn);
  });
});
```

---

## 参考

- 脚本编写：`.claude/agents/script-writer-agent.md`
- UI 自动化测试 Skill：`.claude/skills/ui-autotest/SKILL.md`
- 脚本调试：`.claude/agents/script-fixer-agent.md`
