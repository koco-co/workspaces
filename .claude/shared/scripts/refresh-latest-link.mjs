/**
 * refresh-latest-link.mjs
 * CLI 包装：在仓库根目录创建与实际文件同名的符号链接
 *
 * 用法:
 *   node refresh-latest-link.mjs <actual-path>
 */
import { refreshLatestLink } from "./latest-link-utils.mjs";

const [actualPath] = process.argv.slice(2);

if (!actualPath) {
  console.error("Usage: node refresh-latest-link.mjs <actual-path>");
  process.exit(1);
}

try {
  const linkPath = refreshLatestLink(actualPath);
  console.log(`最新快捷链接已刷新：${linkPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
