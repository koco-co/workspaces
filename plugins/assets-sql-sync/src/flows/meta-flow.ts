import type { DtStackClient } from '../client'
import { BatchApi } from '../api/batch'
import { AssetsApi } from '../api/assets'

export interface MetaFlowOptions {
  readonly datasourceType: string
  readonly tables: ReadonlyArray<{ readonly name: string; readonly sql: string }>
  readonly projectName?: string
  readonly syncTimeout?: number
}

export interface MetaFlowResult {
  readonly projectId: number
  readonly projectName: string
  readonly datasourceId: number
  readonly tablesCreated: ReadonlyArray<string>
  readonly syncComplete: boolean
}

export async function metaFlow(
  client: DtStackClient,
  options: MetaFlowOptions,
): Promise<MetaFlowResult> {
  const batchApi = new BatchApi(client)
  const assetsApi = new AssetsApi(client)

  const projectName = options.projectName ?? 'env_rebuild_test'
  const syncTimeout = options.syncTimeout ?? 180_000

  // Step 1: Find project
  console.log(`[meta-flow] Looking for project: ${projectName}`)
  const project = await batchApi.findProject(projectName)
  if (!project) {
    throw new Error(`Project "${projectName}" not found in offline development`)
  }
  console.log(`[meta-flow] Found project: ${project.projectName} (id=${project.id})`)

  // Step 2: Find datasource in project
  console.log(`[meta-flow] Looking for ${options.datasourceType} datasource...`)
  const datasource = await batchApi.getProjectDatasource(
    project.id,
    options.datasourceType,
  )
  if (!datasource) {
    throw new Error(
      `Datasource type "${options.datasourceType}" not found in project "${projectName}"`,
    )
  }
  console.log(`[meta-flow] Found datasource: ${datasource.dataName} (id=${datasource.id})`)

  // Step 3: Execute DDL for each table
  const tablesCreated: string[] = []
  for (const table of options.tables) {
    console.log(`[meta-flow] Creating table: ${table.name}`)
    try {
      await batchApi.executeDDL(project.id, datasource, table.sql)
      tablesCreated.push(table.name)
      console.log(`[meta-flow] Table ${table.name} created successfully`)
    } catch (error) {
      console.error(`[meta-flow] Failed to create table ${table.name}:`, (error as Error).message)
      throw error
    }
  }

  // Step 4: Import datasource to assets (if not already imported)
  console.log(`[meta-flow] Checking if datasource is imported to assets...`)
  const imported = await assetsApi.findImportedDatasource(datasource.dataName)
  if (!imported) {
    console.log(`[meta-flow] Importing datasource to assets...`)
    const unusedList = await assetsApi.listUnusedDatasources(datasource.dataName)
    const target = unusedList.find((ds) => {
      const dsName = ds.dtCenterSourceName ?? ds.dataSourceName ?? ds.name ?? ''
      return dsName.toLowerCase().includes(datasource.dataName.toLowerCase())
    })

    if (target) {
      const centerId = target.dtCenterSourceId ?? target.id
      await assetsApi.importDatasource(centerId)
      console.log(`[meta-flow] Datasource imported successfully`)
    } else {
      console.warn(`[meta-flow] Datasource not found in unused list, may already be imported`)
    }
  } else {
    console.log(`[meta-flow] Datasource already imported (id=${imported.id})`)
  }

  // Step 5: Trigger metadata sync and poll
  console.log(`[meta-flow] Triggering metadata sync...`)
  const metaSource = await assetsApi.findMetadataDatasource(datasource.dataName)
  let syncComplete = false

  if (metaSource) {
    await assetsApi.triggerSync(metaSource.dataSourceId, metaSource.dataSourceType)
    console.log(`[meta-flow] Sync triggered, polling for completion...`)

    const expectedTableNames = options.tables.map((t) => t.name)
    syncComplete = await assetsApi.pollSyncComplete(
      metaSource.dataSourceId,
      expectedTableNames,
      syncTimeout,
    )
    console.log(`[meta-flow] Sync ${syncComplete ? 'complete' : 'timed out (continuing)'}`)
  } else {
    console.warn(`[meta-flow] Metadata datasource not found, skipping sync`)
  }

  return {
    projectId: project.id,
    projectName: project.projectName,
    datasourceId: datasource.id,
    tablesCreated,
    syncComplete,
  }
}
