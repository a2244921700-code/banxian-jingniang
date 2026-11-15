// 命盘快照桥：把最近一次 gua_bazi / gua_ziwei / gua_qimen 的盘面写到共享文件，
// 供 DSH 客户端插件「命盘侧栏」（guashi-chart-panel）读取并自动打开右侧栏。
//
// 只写快照，不参与排盘；写失败不影响工具本身返回。
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const DEFAULT_CHART_SNAPSHOT_PATH = 'D:/DSH_GuaShi/client/chart-panel/latest.json'

export async function saveChartSnapshot(type, chart, file) {
  const path = file || DEFAULT_CHART_SNAPSHOT_PATH
  await mkdir(dirname(path), { recursive: true })
  const payload = {
    type,
    at: new Date().toISOString(),
    chart,
  }
  await writeFile(path, JSON.stringify(payload), 'utf8')
  return path
}

