#!/usr/bin/env bun
/**
 * report-to-pdf.ts — Convert monocart HTML/JSON report to a self-contained PDF.
 *
 * Reads the JSON data file (generated alongside HTML by monocart-reporter),
 * builds a printable HTML page with embedded screenshots, then uses Playwright
 * to export it as PDF.
 *
 * Usage:
 *   bun run .claude/scripts/report-to-pdf.ts <path-to-html-or-json>
 *   bun run .claude/scripts/report-to-pdf.ts workspace/reports/playwright/202604/xxx/xxx.html
 *
 * Output: PDF file alongside the source file (same name, .pdf extension).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, basename, join, extname } from "node:path";
import { Command } from "commander";

// ─── Types ───────────────────────────────────────────────────────────

interface Attachment {
  readonly name: string;
  readonly path: string;
  readonly contentType: string;
}

interface TestCase {
  readonly title: string;
  readonly status: string;
  readonly duration?: number;
  readonly attachments?: readonly Attachment[];
  readonly errorId?: string;
  readonly errorNum?: number;
}

interface TestRow {
  readonly title: string;
  readonly type: string;
  readonly subs?: readonly TestRow[];
  readonly status?: string;
  readonly duration?: number;
  readonly attachments?: readonly Attachment[];
  readonly errorId?: string;
  readonly errorNum?: number;
}

interface ReportSummaryItem {
  readonly name: string;
  readonly value: number;
  readonly color?: string;
}

interface ReportData {
  readonly name: string;
  readonly dateH?: string;
  readonly date: number;
  readonly durationH?: string;
  readonly summary: Record<string, ReportSummaryItem>;
  readonly rows: readonly TestRow[];
  readonly outputDir?: string;
}

interface ConvertOptions {
  readonly sourcePath: string;
  readonly outputPath?: string;
}

interface ConvertResult {
  readonly pdfPath: string;
  readonly success: boolean;
  readonly error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function findCases(rows: readonly TestRow[]): readonly TestCase[] {
  const cases: TestCase[] = [];
  for (const row of rows) {
    if (row.type === "case") {
      cases.push(row);
    }
    if (row.subs) {
      cases.push(...findCases(row.subs));
    }
  }
  return cases;
}

function findSuitePathForCase(
  rows: readonly TestRow[],
  targetTitle: string,
  path: readonly string[] = [],
): readonly string[] | null {
  for (const row of rows) {
    if (row.type === "case" && row.title === targetTitle) {
      return path;
    }
    if (row.subs) {
      const result = findSuitePathForCase(row.subs, targetTitle, [
        ...path,
        row.title,
      ]);
      if (result) return result;
    }
  }
  return null;
}

function imageToBase64DataUri(imagePath: string): string {
  const data = readFileSync(imagePath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

function readErrorMarkdown(mdPath: string): string {
  const content = readFileSync(mdPath, "utf8");
  // Extract the error details section
  const errorMatch = content.match(/# Error details\s*```([\s\S]*?)```/);
  return errorMatch ? errorMatch[1].trim() : content;
}

function statusIcon(status: string): string {
  switch (status) {
    case "passed":
      return "&#x2705;";
    case "failed":
      return "&#x274C;";
    case "skipped":
      return "&#x23ED;";
    case "flaky":
      return "&#x26A0;&#xFE0F;";
    default:
      return "&#x2753;";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "passed":
      return "#4caf50";
    case "failed":
      return "#d00";
    case "skipped":
      return "#999";
    case "flaky":
      return "#ff9800";
    default:
      return "#666";
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── HTML Builder ────────────────────────────────────────────────────

function buildPrintableHtml(
  data: ReportData,
  reportDir: string,
): string {
  const cases = findCases(data.rows);
  const { summary } = data;
  const dateStr = data.dateH ?? new Date(data.date).toLocaleString();

  const caseSections = cases.map((tc, idx) => {
    const suitePath = findSuitePathForCase(data.rows, tc.title) ?? [];
    const suiteLabel = suitePath.filter((s) => s !== "chromium").join(" &gt; ");

    // Separate screenshots and error markdown attachments
    const screenshots = (tc.attachments ?? []).filter(
      (a) => a.contentType.startsWith("image/"),
    );
    const errorMds = (tc.attachments ?? []).filter(
      (a) => a.contentType === "text/markdown",
    );

    let errorHtml = "";
    for (const md of errorMds) {
      const mdPath = join(reportDir, md.path);
      if (existsSync(mdPath)) {
        const errorText = readErrorMarkdown(mdPath);
        errorHtml += `<div class="error-block"><pre>${escapeHtml(errorText)}</pre></div>`;
      }
    }

    let screenshotHtml = "";
    for (const ss of screenshots) {
      const imgPath = join(reportDir, ss.path);
      if (existsSync(imgPath)) {
        const dataUri = imageToBase64DataUri(imgPath);
        screenshotHtml += `
          <div class="screenshot">
            <div class="screenshot-label">${escapeHtml(ss.name)}</div>
            <img src="${dataUri}" />
          </div>`;
      }
    }

    return `
      <div class="case-card">
        <div class="case-header" style="border-left-color: ${statusColor(tc.status)}">
          <span class="case-index">#${idx + 1}</span>
          <span class="case-status">${statusIcon(tc.status)}</span>
          <span class="case-title">${escapeHtml(tc.title)}</span>
          <span class="case-duration">${formatDuration(tc.duration)}</span>
        </div>
        ${suiteLabel ? `<div class="case-suite">${suiteLabel}</div>` : ""}
        ${errorHtml}
        ${screenshotHtml ? `<div class="screenshots">${screenshotHtml}</div>` : ""}
      </div>`;
  });

  const summaryItems = ["tests", "failed", "flaky", "skipped", "passed"]
    .filter((k) => summary[k])
    .map((k) => {
      const item = summary[k];
      const color = item.color ?? "#333";
      return `<span class="summary-item" style="color: ${color}"><b>${item.value}</b> ${item.name}</span>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; line-height: 1.5; padding: 20px; }
    .report-header { background: #1a1a2e; color: #fff; padding: 16px 20px; border-radius: 6px; margin-bottom: 20px; }
    .report-title { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
    .report-meta { font-size: 12px; color: #aaa; }
    .summary-bar { display: flex; gap: 16px; padding: 10px 0; border-bottom: 1px solid #e0e0e0; margin-bottom: 20px; font-size: 14px; }
    .summary-item { display: inline-flex; gap: 4px; align-items: center; }
    .case-card { border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
    .case-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fafafa; border-left: 4px solid; font-size: 14px; }
    .case-index { color: #999; font-size: 12px; min-width: 24px; }
    .case-title { flex: 1; font-weight: 500; }
    .case-duration { color: #999; font-size: 12px; }
    .case-suite { padding: 4px 14px 4px 18px; font-size: 11px; color: #888; background: #fafafa; border-top: 1px solid #f0f0f0; }
    .error-block { padding: 10px 14px; background: #fff5f5; border-top: 1px solid #fdd; }
    .error-block pre { font-size: 11px; color: #c00; white-space: pre-wrap; word-break: break-all; font-family: "SF Mono", Monaco, Consolas, monospace; }
    .screenshots { padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 12px; }
    .screenshot { flex: 1; min-width: 280px; max-width: 100%; }
    .screenshot-label { font-size: 11px; color: #666; margin-bottom: 4px; word-break: break-all; }
    .screenshot img { width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; }
    @media print {
      body { padding: 0; }
      .case-card { page-break-inside: avoid; }
      .screenshot img { max-height: 400px; object-fit: contain; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-title">${escapeHtml(data.name)}</div>
    <div class="report-meta">${dateStr} &nbsp;|&nbsp; ${data.durationH ?? "-"}</div>
  </div>
  <div class="summary-bar">${summaryItems}</div>
  ${caseSections.join("\n")}
</body>
</html>`;
}

// ─── Core ────────────────────────────────────────────────────────────

function resolveJsonPath(sourcePath: string): string {
  const absPath = resolve(sourcePath);
  if (extname(absPath) === ".json") return absPath;
  // HTML → JSON: same name, .json extension
  const dir = dirname(absPath);
  const name = basename(absPath, ".html");
  return join(dir, `${name}.json`);
}

function resolvePdfPath(sourcePath: string, outputPath?: string): string {
  if (outputPath) return resolve(outputPath);
  const absPath = resolve(sourcePath);
  const dir = dirname(absPath);
  const ext = extname(absPath);
  const name = basename(absPath, ext);
  return join(dir, `${name}.pdf`);
}

export async function convertReportToPdf(
  options: ConvertOptions,
): Promise<ConvertResult> {
  const jsonPath = resolveJsonPath(options.sourcePath);

  if (!existsSync(jsonPath)) {
    return {
      pdfPath: "",
      success: false,
      error: `JSON data file not found: ${jsonPath}`,
    };
  }

  const pdfPath = resolvePdfPath(options.sourcePath, options.outputPath);
  const reportDir = dirname(jsonPath);

  try {
    const data: ReportData = JSON.parse(readFileSync(jsonPath, "utf8"));
    const html = buildPrintableHtml(data, reportDir);

    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      });

      return { pdfPath, success: true };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (err) {
    return {
      pdfPath,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("report-to-pdf")
  .description("Convert monocart HTML/JSON report to self-contained PDF")
  .argument("<source-path>", "Path to the HTML or JSON report file")
  .option("-o, --output <path>", "Custom output PDF path")
  .helpOption("-h, --help", "Display help information")
  .action(async (sourcePath: string, opts: { output?: string }) => {
    const result = await convertReportToPdf({
      sourcePath,
      outputPath: opts.output,
    });

    if (result.success) {
      process.stdout.write(`PDF saved: ${result.pdfPath}\n`);
    } else {
      process.stderr.write(`Failed: ${result.error}\n`);
      process.exit(1);
    }
  });

program.parse(process.argv);
