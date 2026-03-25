/**
 * json-to-xmind.mjs
 * 将中间 JSON 格式转换为 .xmind 文件
 *
 * 用法: node json-to-xmind.mjs <input.json> <output.xmind>
 *
 * XMind 层级结构:
 * Root (project_name)
 *   └── L1 (【version】requirement_name)
 *        └── L2 (modules[].name)
 *             └── [L3 (sub_groups[].name)] -- 可选
 *                  └── 用例标题 [marker=priority, note=precondition]
 *                       └── 步骤描述
 *                            └── 预期结果
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Topic, RootTopic, Marker, Workbook, writeLocalFile } from 'xmind-generator'

const PRIORITY_MAP = {
  P0: Marker.Priority.p1,
  P1: Marker.Priority.p2,
  P2: Marker.Priority.p3,
}

function buildCaseTopic(testCase) {
  const marker = PRIORITY_MAP[testCase.priority] ?? Marker.Priority.p3
  const steps = (testCase.steps ?? []).map(({ step, expected }) =>
    Topic(step).children([Topic(expected)])
  )

  const caseTopic = Topic(testCase.title)
    .markers([marker])

  if (testCase.precondition) {
    caseTopic.note(testCase.precondition)
  }

  if (steps.length > 0) {
    caseTopic.children(steps)
  }

  return caseTopic
}

function buildModuleTopic(mod) {
  // 含子分组结构
  if (mod.sub_groups && mod.sub_groups.length > 0) {
    const subGroupTopics = mod.sub_groups.map((group) => {
      const caseTopics = (group.test_cases ?? []).map(buildCaseTopic)
      return Topic(group.name).children(caseTopics)
    })
    return Topic(mod.name).children(subGroupTopics)
  }

  // 无子分组结构
  const caseTopics = (mod.test_cases ?? []).map(buildCaseTopic)
  return Topic(mod.name).children(caseTopics)
}

function buildXmind(data) {
  const { meta, modules } = data

  const l1Title = meta.version
    ? `【${meta.version}】${meta.requirement_name}`
    : meta.requirement_name

  const moduleTopics = (modules ?? []).map(buildModuleTopic)

  const workbook = Workbook(
    RootTopic(meta.project_name).children([
      Topic(l1Title).children(moduleTopics),
    ])
  )

  return workbook
}

function mergeJsonFiles(inputPaths) {
  const all = inputPaths.map((p) => {
    const content = readFileSync(resolve(p), 'utf-8')
    return JSON.parse(content)
  })

  if (all.length === 1) return all[0]

  // 多文件合并：保留第一个 meta，合并所有 modules
  const merged = {
    meta: all[0].meta,
    modules: all.flatMap((d) => d.modules ?? []),
  }
  return merged
}

// --- Main ---
const args = process.argv.slice(2)
if (args.length < 2) {
  console.error('Usage: node json-to-xmind.mjs <input1.json> [input2.json ...] <output.xmind>')
  console.error('Example: node json-to-xmind.mjs cases.json output.xmind')
  process.exit(1)
}

const outputPath = args[args.length - 1]
const inputPaths = args.slice(0, args.length - 1)

try {
  const data = mergeJsonFiles(inputPaths)
  const workbook = buildXmind(data)
  writeLocalFile(workbook, resolve(outputPath))
  console.log(`XMind file written to: ${resolve(outputPath)}`)
} catch (err) {
  console.error('Error generating XMind file:', err.message)
  process.exit(1)
}
