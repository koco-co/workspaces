import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const TMP_DIR = join(tmpdir(), `qa-flow-report-to-pdf-test-${process.pid}`);

function run(
  args: string[],
): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(
      "bun",
      ["run", ".claude/scripts/report-to-pdf.ts", ...args],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      code: e.status ?? 1,
    };
  }
}

function createMinimalReportJson(dir: string): string {
  const reportDir = join(dir, "test-report");
  const attachmentsDir = join(reportDir, "attachments");
  mkdirSync(attachmentsDir, { recursive: true });

  // Create a minimal 1x1 red PNG
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  writeFileSync(join(attachmentsDir, "screenshot.png"), pngHeader);

  // Create error markdown
  writeFileSync(
    join(attachmentsDir, "error.md"),
    "# Error details\n```\nError: test failed\n```\n",
  );

  const reportData = {
    name: "Test Report",
    date: Date.now(),
    dateH: "2026/4/7 12:00:00",
    durationH: "5.0s",
    summary: {
      tests: { name: "Tests", value: 1 },
      failed: { name: "Failed", value: 1, color: "#d00" },
      flaky: { name: "Flaky", value: 0, color: "orange" },
      skipped: { name: "Skipped", value: 0, color: "gray" },
      passed: { name: "Passed", value: 0, color: "green" },
    },
    rows: [
      {
        title: "chromium",
        type: "suite",
        subs: [
          {
            title: "test-file.spec.ts",
            type: "suite",
            subs: [
              {
                title: "Test Suite",
                type: "suite",
                subs: [
                  {
                    title: "should work correctly",
                    type: "case",
                    status: "failed",
                    duration: 5000,
                    errorNum: 1,
                    errorId: "err1",
                    attachments: [
                      {
                        name: "step-1 screenshot",
                        path: "attachments/screenshot.png",
                        contentType: "image/png",
                      },
                      {
                        name: "error-context",
                        path: "attachments/error.md",
                        contentType: "text/markdown",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    artifacts: [],
  };

  const jsonPath = join(reportDir, "report.json");
  writeFileSync(jsonPath, JSON.stringify(reportData));
  return jsonPath;
}

before(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

after(() => {
  try {
    rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("report-to-pdf --help", () => {
  it("outputs usage information", () => {
    const { stdout, stderr, code } = run(["--help"]);
    const output = stdout + stderr;
    assert.equal(code, 0);
    assert.match(output, /report-to-pdf/i);
    assert.match(output, /source-path/i);
  });
});

describe("report-to-pdf with missing file", () => {
  it("fails with error message for non-existent file", () => {
    const { stderr, code } = run(["/nonexistent/report.html"]);
    assert.notEqual(code, 0);
    assert.match(stderr, /not found/i);
  });
});

describe("report-to-pdf with minimal report", () => {
  it("generates PDF from JSON report data", () => {
    const jsonPath = createMinimalReportJson(TMP_DIR);
    const { stdout, code } = run([jsonPath]);
    assert.equal(code, 0, `Expected exit code 0, got ${code}`);
    assert.match(stdout, /PDF saved/);

    const expectedPdf = jsonPath.replace(/\.json$/, ".pdf");
    assert.ok(existsSync(expectedPdf), "PDF file should exist");

    const pdfContent = readFileSync(expectedPdf);
    assert.ok(pdfContent.length > 0, "PDF should not be empty");
    assert.ok(
      pdfContent.subarray(0, 5).toString() === "%PDF-",
      "File should start with PDF header",
    );
  });

  it("generates PDF with custom output path", () => {
    const jsonPath = createMinimalReportJson(
      join(TMP_DIR, "custom-output"),
    );
    const customOutput = join(TMP_DIR, "custom-output", "my-report.pdf");
    const { stdout, code } = run([jsonPath, "-o", customOutput]);
    assert.equal(code, 0);
    assert.match(stdout, /PDF saved/);
    assert.ok(existsSync(customOutput), "Custom PDF path should exist");
  });

  it("resolves JSON from HTML path", () => {
    const jsonPath = createMinimalReportJson(
      join(TMP_DIR, "html-resolve"),
    );
    // Create a dummy HTML file with same base name
    const htmlPath = jsonPath.replace(/\.json$/, ".html");
    writeFileSync(htmlPath, "<html></html>");

    const { stdout, code } = run([htmlPath]);
    assert.equal(code, 0);
    assert.match(stdout, /PDF saved/);
  });
});
