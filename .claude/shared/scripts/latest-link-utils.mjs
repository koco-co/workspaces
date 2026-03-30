/**
 * latest-link-utils.mjs
 * 统一管理仓库根目录 latest-* 快捷链接
 * 链接文件名与实际输出文件 basename 保持一致
 */
import {
  existsSync,
  lstatSync,
  symlinkSync,
  unlinkSync,
} from "fs";
import { resolve, dirname, relative, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

function pathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 在仓库根目录创建或刷新符号链接，链接名与 targetPath 的 basename 相同
 * @param {string} targetPath - 实际输出文件的绝对或相对路径
 * @returns {string} 创建的链接绝对路径
 */
export function refreshLatestLink(targetPath) {
  const resolvedTargetPath = resolve(targetPath);
  if (!existsSync(resolvedTargetPath)) {
    throw new Error(`目标文件不存在：${resolvedTargetPath}`);
  }

  const linkPath = resolve(repoRoot, basename(resolvedTargetPath));
  if (pathExists(linkPath)) {
    unlinkSync(linkPath);
  }

  const linkTarget = relative(repoRoot, resolvedTargetPath) || basename(resolvedTargetPath);
  symlinkSync(linkTarget, linkPath);
  return linkPath;
}
