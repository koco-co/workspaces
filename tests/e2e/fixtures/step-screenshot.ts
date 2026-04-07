/**
 * 自定义 Playwright fixture：每个 test.step 自动截图
 *
 * 每步生成一个附件，命名格式：
 *   ✅ 步骤-1 {{操作描述}} 预期-1 {{预期内容}}
 *   ❌ 步骤-2 {{操作描述}} 预期-2 {{预期内容}}
 *
 * 步骤名称约定格式：
 *   "步骤N: {{操作描述}} → {{预期描述}}"
 *
 * 用法：
 *   import { test, expect } from '../../fixtures/step-screenshot';
 *
 *   test('示例', async ({ page, step }) => {
 *     await step('步骤1: 打开页面 → 页面正常加载', async () => {
 *       await page.goto('https://example.com');
 *     });
 *
 *     const heading = page.getByRole('heading');
 *     await step('步骤2: 验证标题 → 标题可见', async () => {
 *       await expect(heading).toBeVisible();
 *     }, heading);  // 可选：对元素加红框高亮
 *   });
 */

import { test as base, type Locator } from "@playwright/test";

export type StepFn = (
  name: string,
  body: () => Promise<void>,
  highlight?: Locator,
) => Promise<void>;

const HIGHLIGHT_STYLE = "outline: 3px solid red !important; outline-offset: 2px !important;";

export const test = base.extend<{ step: StepFn }>({
  step: async ({ page }, use, testInfo) => {
    let stepIndex = 0;

    const stepFn: StepFn = async (name, body, highlight?) => {
      // 解析步骤名：格式 "步骤N: {{操作}} → {{预期}}"
      const arrowIdx = name.indexOf("→");
      const rawDesc = arrowIdx > 0 ? name.slice(0, arrowIdx) : name;
      const stepDesc = rawDesc.replace(/^步骤\d+[:：]\s*/, "").trim();
      const expected = arrowIdx > 0 ? name.slice(arrowIdx + 1).trim() : "";

      let stepError: unknown = null;

      await base.step(name, async () => {
        try {
          await body();
        } catch (err) {
          stepError = err;
          throw err;
        } finally {
          stepIndex++;
          const idx = stepIndex;
          const passed = stepError === null;
          const icon = passed ? "✅" : "❌";

          // 高亮目标元素（可选，元素不存在时静默跳过）
          if (highlight) {
            await highlight
              .evaluate((el, style) => {
                (el as HTMLElement).style.cssText += style;
              }, HIGHLIGHT_STYLE)
              .catch(() => {});
          }

          // 无论成功或失败都截图
          const screenshot = await page.screenshot({ fullPage: false }).catch(() => null);

          // 移除高亮
          if (highlight) {
            await highlight
              .evaluate((el) => {
                (el as HTMLElement).style.outline = "";
                (el as HTMLElement).style.outlineOffset = "";
              })
              .catch(() => {});
          }

          if (screenshot) {
            const label = expected
              ? `${icon} 步骤-${idx} ${stepDesc} 预期-${idx} ${expected}`
              : `${icon} 步骤-${idx} ${stepDesc}`;
            await testInfo.attach(label, {
              body: screenshot,
              contentType: "image/png",
            });
          }
        }
      });
    };

    await use(stepFn);
  },
});

export { expect } from "@playwright/test";
