import type { Page } from "@playwright/test";
import type { DtStackClientLike } from "./client";
import { BrowserDtStackClient, extractCookieFromPage } from "./client";
import { metaFlow } from "./flows/meta-flow";

export interface PreconditionOptions {
  readonly type?: "meta" | "non-meta";
  readonly datasourceType: "Doris" | "MySQL" | "Hive" | "SparkThrift";
  readonly tables: ReadonlyArray<{
    readonly name: string;
    readonly sql: string;
  }>;
  readonly projectName?: string;
  readonly syncTimeout?: number;
}

export interface PreconditionResult {
  readonly flow: "meta" | "non-meta";
  readonly tablesCreated: ReadonlyArray<string>;
  readonly syncComplete: boolean;
}

function resolveBaseUrl(): string {
  return (
    process.env.UI_AUTOTEST_BASE_URL ??
    process.env.E2E_BASE_URL ??
    process.env.QA_BASE_URL_CI78 ??
    "http://172.16.122.52"
  );
}

export async function createClient(page: Page, baseUrl?: string): Promise<DtStackClientLike> {
  const resolvedBaseUrl = baseUrl ?? resolveBaseUrl();
  const targetOrigin = new URL(resolvedBaseUrl).origin;
  const currentUrl = page.url();
  const shouldBootstrap =
    currentUrl === "about:blank" ||
    (() => {
      try {
        return new URL(currentUrl).origin !== targetOrigin;
      } catch {
        return true;
      }
    })();

  if (shouldBootstrap) {
    const bootstrapUrl = new URL("/dataAssets/#/dataStandard", resolvedBaseUrl).toString();
    await page.goto(bootstrapUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
  }

  const cookie = await extractCookieFromPage(page);
  return new BrowserDtStackClient(page, {
    baseUrl: resolvedBaseUrl,
    cookie,
  });
}

export async function setupPreconditions(
  page: Page,
  options: PreconditionOptions,
): Promise<PreconditionResult> {
  const client = await createClient(page);
  const flowType = options.type ?? "meta";

  if (flowType === "meta") {
    const result = await metaFlow(client, {
      datasourceType: options.datasourceType,
      tables: options.tables,
      projectName: options.projectName,
      syncTimeout: options.syncTimeout ? options.syncTimeout * 1000 : undefined,
    });

    return {
      flow: "meta",
      tablesCreated: result.tablesCreated,
      syncComplete: result.syncComplete,
    };
  }

  throw new Error('Non-meta flow not yet implemented. Use type: "meta".');
}

export { AssetsApi } from "./api/assets";
// Re-export step APIs for fine-grained control
export { BatchApi } from "./api/batch";
export type { DtStackClientLike } from "./client";
export {
  BrowserDtStackClient,
  DtStackClient,
  extractCookieFromPage,
} from "./client";
export type { MetaFlowOptions, MetaFlowResult } from "./flows/meta-flow";
export { metaFlow } from "./flows/meta-flow";
