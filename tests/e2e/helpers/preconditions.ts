/**
 * 前置条件 API 封装
 *
 * 将跨产品的前置条件操作（离线开发建表、数据资产引入数据源、元数据同步）
 * 封装为纯 HTTP API 调用，供 Playwright 脚本调用。
 *
 * 调用方无需关注离线开发或其他产品的 UI，只需：
 *   import { setupOfflineTablesToAssets } from '../helpers/preconditions';
 *   test.beforeAll(async ({ browser }) => {
 *     const page = await browser.newPage();
 *     await setupOfflineTablesToAssets(page, { sqls: [SQL_DDL1, SQL_DDL2] });
 *     await page.close();
 *   });
 *
 * ── 内部流程 ──────────────────────────────────────────────────
 *
 * 建表（通过离线开发 Batch API）:
 *   1. GET  /api/rdos/common/project/getProjects  → 按名称找到 projectId
 *   2. POST /api/rdos/batch/batchDataSource/list  → 按类型找到 sourceId
 *   3. POST /api/rdos/batch/batchTableInfo/ddlCreateTableEncryption
 *          { sql: base64(ddl), sourceId, targetSchema, syncTask: true }
 *
 * 数据资产引入数据源:
 *   4. POST /dassets/v1/dataSource/listUnusedCenterDataSource → dtCenterSourceId
 *   5. POST /dassets/v1/dataSource/importDataSource          → 完成引入
 *
 * 元数据同步（数据资产）:
 *   6. POST /dassets/v1/dataSource/pageQuery     → 找到已引入数据源的 datasourceId
 *   7. POST /dmetadata/v1/syncTask/add           → 创建同步任务，得到 taskId
 *   8. POST /dmetadata/v1/syncTask/runJob        → 立即触发临时同步
 *   9. 轮询 /dmetadata/v1/syncJob/pageQuery      → 等待同步完成 (jobStatus=2)
 */

import type { Page } from "@playwright/test";
import { getEnv, normalizeBaseUrl } from "./test-setup";

// ── 类型定义 ──────────────────────────────────────────────────

export interface BatchTableOptions {
  /** 离线开发项目名称，默认读取 BATCH_PROJECT_NAME 环境变量 */
  batchProject?: string;
  /** 数据源类型（大小写不敏感），默认 "Doris" */
  datasourceType?: string;
  /** 目标 schema（数据库名），默认读取 BATCH_SCHEMA 环境变量 */
  schema?: string;
}

export interface DatasourceImportOptions {
  /** 数据资产中要引入的数据源名称，默认读取 ASSETS_DATASOURCE_NAME 环境变量 */
  datasourceName?: string;
  /** 是否跳过"已引入"检查直接引入（默认 false：已引入则跳过） */
  forceImport?: boolean;
}

export interface MetadataSyncOptions {
  /** 数据资产中已引入的数据源名称 */
  datasourceName?: string;
  /** 要同步的 database，不传则同步第一个 database */
  database?: string;
  /** 轮询超时（秒），默认 180 */
  timeoutSeconds?: number;
}

export interface SetupOptions {
  /**
   * DDL SQL 列表（每条可包含多个语句，用分号分隔）。
   * 若为空数组则跳过建表步骤。
   */
  sqls?: string[];
  batch?: BatchTableOptions;
  import?: DatasourceImportOptions;
  sync?: MetadataSyncOptions;
  /**
   * 控制各步骤是否执行，默认全开。
   * 若只需要建表，可传 { importDatasource: false, syncMetadata: false }
   */
  steps?: {
    createTables?: boolean;
    importDatasource?: boolean;
    syncMetadata?: boolean;
  };
}

// ── 内部工具 ──────────────────────────────────────────────────

/** 将字符串 base64 编码（兼容 Node.js & 浏览器） */
function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(str)));
}

/** 从环境变量或选项中解析 baseUrl */
function getBaseUrl(): string {
  return (
    getEnv("UI_AUTOTEST_BASE_URL") ??
    getEnv("E2E_BASE_URL") ??
    "http://172.16.122.52"
  );
}

/** 构造带 Cookie 的 fetch headers */
function buildHeaders(extraCookie?: string): Record<string, string> {
  const cookie = extraCookie ?? getEnv("UI_AUTOTEST_COOKIE") ?? "";
  return {
    "content-type": "application/json;charset=UTF-8",
    "Accept-Language": "zh-CN",
    ...(cookie ? { cookie } : {}),
  };
}

/**
 * 通过 page.evaluate() 在浏览器上下文内发起 HTTP POST
 * （自动携带已注入的浏览器 cookie，无需手动传 cookie 字符串）
 */
async function pagePost<T = unknown>(
  page: Page,
  url: string,
  body: unknown,
): Promise<T> {
  return page.evaluate(
    async ([fetchUrl, fetchBody]: [string, unknown]) => {
      const resp = await fetch(fetchUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json;charset=UTF-8",
          "Accept-Language": "zh-CN",
        },
        body: JSON.stringify(fetchBody),
      });
      return resp.json();
    },
    [url, body] as [string, unknown],
  ) as T;
}

/**
 * 通过 page.evaluate() 在浏览器上下文内发起 HTTP GET
 */
async function pageGet<T = unknown>(page: Page, url: string): Promise<T> {
  return page.evaluate(async (fetchUrl: string) => {
    const resp = await fetch(fetchUrl, {
      method: "GET",
      credentials: "same-origin",
      headers: { "Accept-Language": "zh-CN" },
    });
    return resp.json();
  }, url) as T;
}

// ── Step 1: 获取离线开发项目 ID ───────────────────────────────

async function getBatchProjectId(
  page: Page,
  projectName: string,
): Promise<number> {
  const baseUrl = getBaseUrl();
  const result = await pagePost<{
    data?: Array<{ projectId?: number; id?: number; name?: string; projectName?: string }>;
  }>(page, `${normalizeBaseUrl("batch")}/api/rdos/common/project/getProjects`, {});

  const list = result?.data ?? [];
  const found = list.find(
    (p) =>
      (p.name ?? p.projectName ?? "")
        .toLowerCase()
        .includes(projectName.toLowerCase()),
  );

  if (!found) {
    throw new Error(
      `[preconditions] 离线开发项目 "${projectName}" 未找到，请检查项目是否存在`,
    );
  }
  const id = found.projectId ?? found.id;
  if (!id) throw new Error(`[preconditions] 项目 "${projectName}" 未返回 ID`);
  return id;
}

// ── Step 2: 获取离线开发数据源 ID ─────────────────────────────

async function getBatchDatasourceId(
  page: Page,
  projectId: number,
  datasourceType: string,
): Promise<{ sourceId: number; schema: string }> {
  const result = await pagePost<{
    data?: Array<{
      id?: number;
      sourceId?: number;
      dataSourceType?: string | number;
      name?: string;
      schemaName?: string;
      schema?: string;
    }>;
  }>(
    page,
    `${normalizeBaseUrl("batch")}/api/rdos/batch/batchDataSource/list`,
    { projectId, syncTask: true },
  );

  const list = result?.data ?? [];
  const typeStr = datasourceType.toLowerCase();
  const found = list.find((ds) => {
    const dsType = String(ds.dataSourceType ?? "").toLowerCase();
    return dsType.includes(typeStr) || typeStr.includes(dsType);
  });

  if (!found) {
    throw new Error(
      `[preconditions] 项目(${projectId})中未找到类型为 "${datasourceType}" 的数据源`,
    );
  }

  const sourceId = found.id ?? found.sourceId;
  if (!sourceId) {
    throw new Error(`[preconditions] 数据源 "${found.name}" 未返回 sourceId`);
  }
  const schema = found.schemaName ?? found.schema ?? found.name ?? "";
  return { sourceId, schema };
}

// ── Step 3: 通过离线开发 API 执行 DDL ─────────────────────────

/**
 * 通过离线开发产品的 batchTableInfo API 执行 DDL 建表语句
 *
 * @param page          Playwright Page（需已通过 applyRuntimeCookies 注入 cookie）
 * @param ddlSql        DDL SQL 内容（支持多条语句，以分号分隔）
 * @param opts          批量配置选项
 */
export async function createTablesViaBatchApi(
  page: Page,
  ddlSql: string,
  opts: BatchTableOptions = {},
): Promise<void> {
  const projectName =
    opts.batchProject ??
    getEnv("BATCH_PROJECT_NAME") ??
    "env_rebuild_test";
  const dsType = opts.datasourceType ?? "Doris";
  const schemaOverride = opts.schema ?? getEnv("BATCH_SCHEMA");

  // 1. 获取项目 ID
  const projectId = await getBatchProjectId(page, projectName);

  // 2. 获取数据源 ID + schema
  const { sourceId, schema: detectedSchema } = await getBatchDatasourceId(
    page,
    projectId,
    dsType,
  );
  const schema = schemaOverride ?? detectedSchema;

  // 3. 执行 DDL（base64 编码）
  const sqlBase64 = toBase64(ddlSql);

  const result = await pagePost<{ code?: number; message?: string; data?: unknown }>(
    page,
    `${normalizeBaseUrl("batch")}/api/rdos/batch/batchTableInfo/ddlCreateTableEncryption`,
    {
      sql: sqlBase64,
      sourceId: String(sourceId),
      targetSchema: schema,
      syncTask: true,
    },
  );

  if (result?.code !== undefined && result.code !== 1) {
    console.warn(
      `[preconditions] 建表 API 返回非成功状态 code=${result.code}: ${result.message ?? ""}`,
    );
  }

  console.log(
    `[preconditions] 建表完成 project=${projectName} sourceId=${sourceId} schema=${schema}`,
  );
}

// ── Step 4: 数据资产引入数据源 ────────────────────────────────

/**
 * 将数据源引入到数据资产产品
 *
 * 先检查数据源是否已引入，未引入则执行引入操作。
 *
 * @param page  Playwright Page（需已注入 cookie）
 * @param opts  引入配置
 */
export async function importDatasourceToAssets(
  page: Page,
  opts: DatasourceImportOptions = {},
): Promise<void> {
  const datasourceName =
    opts.datasourceName ?? getEnv("ASSETS_DATASOURCE_NAME");
  if (!datasourceName) {
    throw new Error(
      "[preconditions] 未提供 datasourceName，请传入 opts.datasourceName 或设置 ASSETS_DATASOURCE_NAME 环境变量",
    );
  }
  const assetsBase = normalizeBaseUrl("dataAssets");

  // 检查是否已引入（避免重复操作）
  if (!opts.forceImport) {
    const checkResult = await pagePost<{
      data?: { contentList?: Array<{ id?: number; name?: string }> };
    }>(page, `${assetsBase}/dassets/v1/dataSource/pageQuery`, {
      current: 1,
      size: 10,
      search: datasourceName,
    });

    const already = (checkResult?.data?.contentList ?? []).some(
      (ds) =>
        (ds.name ?? "")
          .toLowerCase()
          .includes(datasourceName.toLowerCase()),
    );
    if (already) {
      console.log(`[preconditions] 数据源 "${datasourceName}" 已存在于数据资产，跳过引入`);
      return;
    }
  }

  // 获取待引入数据源列表（数据源中心中尚未引入的）
  const listResult = await pagePost<{
    data?: { contentList?: Array<{ dtCenterSourceId?: number; name?: string }> };
  }>(page, `${assetsBase}/dassets/v1/dataSource/listUnusedCenterDataSource`, {
    search: datasourceName,
    current: 1,
    size: 20,
  });

  const candidates = listResult?.data?.contentList ?? [];
  const target = candidates.find((ds) =>
    (ds.name ?? "").toLowerCase().includes(datasourceName.toLowerCase()),
  );

  if (!target?.dtCenterSourceId) {
    throw new Error(
      `[preconditions] 数据源中心中未找到待引入的数据源 "${datasourceName}"，请确认数据源已在数据源中心创建并授权给资产产品`,
    );
  }

  // 检查相似数据源（平台要求，不影响引入流程）
  await pagePost(
    page,
    `${assetsBase}/dassets/v1/dataSource/checkSimilarDatasource`,
    { dtCenterSourceIdList: [target.dtCenterSourceId] },
  ).catch(() => {
    // 相似数据源检查失败不阻断流程
  });

  // 执行引入
  const importResult = await pagePost<{
    data?: boolean;
    message?: string;
    code?: number;
  }>(page, `${assetsBase}/dassets/v1/dataSource/importDataSource`, {
    dtCenterSourceIdList: [target.dtCenterSourceId],
  });

  if (importResult?.data !== true) {
    throw new Error(
      `[preconditions] 数据资产引入数据源失败: ${importResult?.message ?? JSON.stringify(importResult)}`,
    );
  }

  console.log(`[preconditions] 数据源 "${datasourceName}" 引入数据资产成功`);
}

// ── Step 5-6: 元数据同步 ──────────────────────────────────────

/** 轮询元数据同步任务状态，jobStatus=2 为完成 */
async function pollSyncJobStatus(
  page: Page,
  taskId: number,
  assetsBase: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(5000);

    const result = await pagePost<{
      data?: {
        data?: Array<{ jobStatus?: number; syncStatus?: number }>;
      };
    }>(page, `${assetsBase}/dmetadata/v1/syncJob/pageQuery`, {
      current: 1,
      size: 5,
      taskId: String(taskId),
    });

    const jobs = result?.data?.data ?? [];
    const latest = jobs[0];
    const status = latest?.jobStatus ?? latest?.syncStatus;

    if (status === 2) {
      console.log(`[preconditions] 元数据同步任务(taskId=${taskId})已完成`);
      return;
    }
    if (status === 3 || status === -1) {
      console.warn(
        `[preconditions] 元数据同步任务(taskId=${taskId})失败，状态=${status}`,
      );
      return;
    }
  }
  console.warn(
    `[preconditions] 等待元数据同步超时(taskId=${taskId})，继续执行测试`,
  );
}

/**
 * 获取数据资产中已引入数据源的 datasourceId
 */
async function getAssetsImportedDatasourceId(
  page: Page,
  datasourceName: string,
  assetsBase: string,
): Promise<number> {
  const result = await pagePost<{
    data?: { contentList?: Array<{ id?: number; name?: string }> };
  }>(page, `${assetsBase}/dassets/v1/dataSource/pageQuery`, {
    current: 1,
    size: 10,
    search: datasourceName,
  });

  const list = result?.data?.contentList ?? [];
  const found = list.find((ds) =>
    (ds.name ?? "").toLowerCase().includes(datasourceName.toLowerCase()),
  );

  if (!found?.id) {
    throw new Error(
      `[preconditions] 数据资产中未找到已引入的数据源 "${datasourceName}"`,
    );
  }
  return found.id;
}

/**
 * 在数据资产产品中创建并执行元数据同步任务
 *
 * @param page  Playwright Page（需已注入 cookie）
 * @param opts  同步配置
 */
export async function createAndRunMetadataSync(
  page: Page,
  opts: MetadataSyncOptions = {},
): Promise<void> {
  const datasourceName =
    opts.datasourceName ?? getEnv("ASSETS_DATASOURCE_NAME");
  if (!datasourceName) {
    throw new Error(
      "[preconditions] 未提供 datasourceName，请传入 opts.datasourceName 或设置 ASSETS_DATASOURCE_NAME 环境变量",
    );
  }

  const assetsBase = normalizeBaseUrl("dataAssets");
  const timeoutMs = (opts.timeoutSeconds ?? 180) * 1000;

  // 1. 获取已引入数据源的 ID
  const datasourceId = await getAssetsImportedDatasourceId(
    page,
    datasourceName,
    assetsBase,
  );

  // 2. 查询该数据源下的 database 列表
  const dbListResult = await pagePost<{
    data?: Array<{ id?: number; name?: string; dbName?: string }>;
  }>(page, `${assetsBase}/dmetadata/v1/syncTask/dblistBySyncAllDb`, {
    datasourceId,
  });

  const dbList = dbListResult?.data ?? [];
  let targetDb: { id?: number; name?: string; dbName?: string } | undefined;
  if (opts.database) {
    targetDb = dbList.find(
      (db) =>
        (db.name ?? db.dbName ?? "")
          .toLowerCase()
          .includes(opts.database!.toLowerCase()),
    );
  }
  targetDb = targetDb ?? dbList[0];

  if (!targetDb) {
    throw new Error(
      `[preconditions] 数据源 "${datasourceName}"(id=${datasourceId}) 下未找到可用 database`,
    );
  }

  const dbId = targetDb.id;
  const dbName = targetDb.name ?? targetDb.dbName ?? "";

  // 3. 创建元数据同步任务（周期同步 + 支持临时触发）
  const taskName = `auto_sync_${datasourceName}_${Date.now().toString(36)}`;
  const addResult = await pagePost<{
    code?: number;
    data?: number | { id?: number; taskId?: number };
    message?: string;
  }>(page, `${assetsBase}/dmetadata/v1/syncTask/add`, {
    name: taskName,
    datasourceId,
    periodType: 2, // 周期同步（非实时）
    dbList: dbId ? [dbId] : undefined,
    dbNameList: [dbName],
    isAll: !dbId, // 如果没有 dbId，同步全部
    syncTableName: "",
  });

  if (addResult?.code !== undefined && addResult.code !== 1) {
    console.warn(
      `[preconditions] 创建元数据同步任务失败 code=${addResult.code}: ${addResult.message ?? ""}`,
    );
  }

  const taskId =
    typeof addResult?.data === "number"
      ? addResult.data
      : (addResult?.data as { id?: number; taskId?: number })?.id ??
        (addResult?.data as { id?: number; taskId?: number })?.taskId;

  if (!taskId) {
    throw new Error(
      `[preconditions] 创建元数据同步任务未返回 taskId: ${JSON.stringify(addResult)}`,
    );
  }

  // 4. 触发临时同步
  const runResult = await pagePost<{ code?: number; message?: string }>(
    page,
    `${assetsBase}/dmetadata/v1/syncTask/runJob`,
    { id: taskId },
  );

  if (runResult?.code !== undefined && runResult.code !== 1) {
    console.warn(
      `[preconditions] 触发元数据同步失败 code=${runResult.code}: ${runResult.message ?? ""}`,
    );
  }

  console.log(
    `[preconditions] 元数据同步任务(taskId=${taskId})已触发，等待完成...`,
  );

  // 5. 轮询等待完成
  await pollSyncJobStatus(page, taskId, assetsBase, timeoutMs);
}

// ── 主入口：一键完成所有前置条件 ──────────────────────────────

/**
 * 一键完成前置条件：离线建表 + 数据资产引入数据源 + 元数据同步
 *
 * 用法示例：
 * ```typescript
 * import { setupOfflineTablesToAssets } from '../helpers/preconditions';
 *
 * test.beforeAll(async ({ browser }) => {
 *   const page = await browser.newPage();
 *   await applyRuntimeCookies(page);
 *   await page.goto(normalizeBaseUrl('batch') + '/batch/');  // 需要先加载页面以激活 cookie
 *   await setupOfflineTablesToAssets(page, {
 *     sqls: [SQL_CREATE_TABLES],
 *     batch: { batchProject: 'env_rebuild_test', datasourceType: 'Doris' },
 *     import: { datasourceName: 'ci78_doris_auto' },
 *     sync:  { datasourceName: 'ci78_doris_auto', database: 'automation' },
 *   });
 *   await page.close();
 * });
 * ```
 *
 * @param page  已完成 cookie 注入并加载过页面的 Playwright Page
 * @param opts  配置选项
 */
export async function setupOfflineTablesToAssets(
  page: Page,
  opts: SetupOptions = {},
): Promise<void> {
  const steps = {
    createTables: opts.steps?.createTables ?? true,
    importDatasource: opts.steps?.importDatasource ?? true,
    syncMetadata: opts.steps?.syncMetadata ?? true,
  };

  // ── 步骤 1：离线开发建表 ────────────────────────────────────
  if (steps.createTables && opts.sqls && opts.sqls.length > 0) {
    console.log(
      `[preconditions] 开始建表，共 ${opts.sqls.length} 个 SQL 批次`,
    );
    for (let i = 0; i < opts.sqls.length; i++) {
      const sql = opts.sqls[i];
      console.log(`[preconditions] 执行 DDL [${i + 1}/${opts.sqls.length}]`);
      await createTablesViaBatchApi(page, sql, opts.batch ?? {});
    }
    console.log("[preconditions] ✅ 建表完成");
  } else if (steps.createTables) {
    console.log("[preconditions] 无 SQL 需要执行，跳过建表步骤");
  }

  // ── 步骤 2：数据资产引入数据源 ──────────────────────────────
  if (steps.importDatasource) {
    console.log("[preconditions] 开始引入数据源到数据资产...");
    await importDatasourceToAssets(page, opts.import ?? {});
    console.log("[preconditions] ✅ 数据源引入完成");
  }

  // ── 步骤 3：元数据同步 ──────────────────────────────────────
  if (steps.syncMetadata) {
    console.log("[preconditions] 开始触发元数据同步...");
    await createAndRunMetadataSync(page, opts.sync ?? {});
    console.log("[preconditions] ✅ 元数据同步完成");
  }

  console.log("[preconditions] 🎉 所有前置条件设置完成");
}
