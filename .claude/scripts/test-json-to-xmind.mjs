/**
 * test-json-to-xmind.mjs
 * 基础测试：验证 json-to-xmind.mjs 的 JSON 结构校验和转换逻辑
 *
 * 运行: node test-json-to-xmind.mjs
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

function runScript(args) {
  try {
    const result = execSync(`node ${resolve(__dirname, "json-to-xmind.mjs")} ${args}`, {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: result, stderr: "", code: 0 };
  } catch (err) {
    return { stdout: err.stdout || "", stderr: err.stderr || "", code: err.status };
  }
}

// ─── Test Data ──────────────────────────────────────────────

const validJson = {
  meta: {
    project_name: "测试项目",
    requirement_name: "测试需求",
    version: "v1.0",
    generated_at: new Date().toISOString(),
    agent_id: "test",
  },
  modules: [
    {
      name: "测试模块",
      pages: [
        {
          name: "列表页",
          sub_groups: [
            {
              name: "搜索功能",
              test_cases: [
                {
                  title: "验证搜索功能正常",
                  priority: "P0",
                  case_type: "正常用例",
                  precondition: "已登录系统",
                  steps: [
                    { step: "进入【测试模块-列表页】页面", expected: "页面正常加载" },
                    { step: "在「搜索框」输入\"测试\"", expected: "列表按关键字过滤" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const invalidJsonNoMeta = { modules: [{ name: "test" }] };
const invalidJsonNoModules = { meta: { project_name: "test", requirement_name: "test" } };
const invalidJsonEmptyModules = { meta: { project_name: "test", requirement_name: "test" }, modules: [] };

const tmpInput = resolve(__dirname, "_test_input.json");
const tmpOutput = resolve(__dirname, "_test_output.xmind");

function cleanup() {
  if (existsSync(tmpInput)) unlinkSync(tmpInput);
  if (existsSync(tmpOutput)) unlinkSync(tmpOutput);
}

// ─── Tests ──────────────────────────────────────────────────

console.log("\n=== Test: 有效 JSON 生成 XMind ===");
cleanup();
writeFileSync(tmpInput, JSON.stringify(validJson), "utf8");
const r1 = runScript(`${tmpInput} ${tmpOutput}`);
assert(r1.code === 0, "退出码为 0");
assert(existsSync(tmpOutput), "生成了 .xmind 文件");
assert(r1.stdout.includes("XMind 文件已生成"), "输出包含成功消息");

console.log("\n=== Test: 缺少 meta 的 JSON 应失败 ===");
cleanup();
writeFileSync(tmpInput, JSON.stringify(invalidJsonNoMeta), "utf8");
const r2 = runScript(`${tmpInput} ${tmpOutput}`);
assert(r2.code !== 0, "退出码非 0");
assert(r2.stderr.includes("meta") || r2.stdout.includes("meta"), "错误消息提及 meta");

console.log("\n=== Test: modules 为空应失败 ===");
cleanup();
writeFileSync(tmpInput, JSON.stringify(invalidJsonEmptyModules), "utf8");
const r3 = runScript(`${tmpInput} ${tmpOutput}`);
assert(r3.code !== 0, "退出码非 0");
assert(r3.stderr.includes("modules") || r3.stdout.includes("modules"), "错误消息提及 modules");

console.log("\n=== Test: 参数不足应报错 ===");
const r4 = runScript("");
assert(r4.code !== 0, "退出码非 0");
assert(r4.stderr.includes("Usage"), "输出使用说明");

// ─── Cleanup & Summary ──────────────────────────────────────

cleanup();

console.log(`\n══════════════════════════════════════`);
console.log(`总计: ${passed + failed} 测试, ✅ ${passed} 通过, ❌ ${failed} 失败`);
console.log(`══════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
