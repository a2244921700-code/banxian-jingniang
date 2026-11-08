// 卦师·鲸娘 —— 原生工具插件入口。
//
// 这个包提供 11 个工具，全部由本地代码/引擎计算，不依赖外部 API（IP 定位除外，
// 且有离线回退）：
//
//   gua_now     实时取时取地：农历、干支四柱、节气、真太阳时、城市经纬度
//   gua_cast    梅花易数 / 六爻起卦排盘
//   gua_hexagram 卦典：卦辞、彖象、爻辞、错综互卦
//   gua_qimen   时家奇门遁甲排盘
//   gua_liuren  大六壬排盘
//   gua_taiyi   太乙神数排盘（时计/日计/月计/年计）
//   gua_ziwei   紫微斗数排盘（十二宫、主星辅星四化、大限流年）
//   gua_bazi    八字（子平）排盘（四柱十神、藏干、大运流年流月）
//   gua_kb      古籍知识库检索
//   gua_history 读本工作区未归档的其它会话窗口
//   gua_case    卦案档案（记录 / 查询 / 复盘）
//
// 工具实现在同目录的 tools-*.js；排盘数值在 lib/engine/。工具定义形状与
// 其它 dsh 工具包一致：{ name, description, parameters, output, execute }。

import { createTimeTool } from './tools-time.js'
import { createCastTools } from './tools-cast.js'
import { createSanshiTools } from './tools-sanshi.js'
import { createTaiyiTool } from './tools-taiyi.js'
import { createBaziTool } from './tools-bazi.js'
import { createZiweiTool } from './tools-ziwei.js'
import { createKbTool } from './tools-kb.js'
import { createHistoryTools } from './tools-history.js'

export const name = 'guashi-tools'

// 只硬依赖工具注册表；sessionPersistence / sessionQuery 用 ctx.get 软取，
// 取不到时 gua_history 会给出明确说明，而不会让整个 preset 挂载失败。
export const inject = ['tools']

const DEFAULT_CONFIG = {
  workspacePath: 'D:/DSH_GuaShi',
  knowledgeBaseDir: 'D:/DSH_GuaShi/知识库',
  caseDir: 'D:/DSH_GuaShi/卦案',
  chartSnapshotPath: 'D:/DSH_GuaShi/client/chart-panel/latest.json',
  defaultLocation: {
    city: '上海',
    region: '上海',
    country: '中国',
    latitude: 31.2304,
    longitude: 121.4737,
  },
}

export { DEFAULT_CONFIG }

export function createTools(config, ctx) {
  const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) }
  return [
    createTimeTool(cfg),
    ...createCastTools(cfg),
    ...createSanshiTools(cfg),
    createTaiyiTool(cfg),
    createZiweiTool(cfg),
    createBaziTool(cfg),
    createKbTool(cfg),
    ...createHistoryTools(cfg, ctx),
  ]
}

export function apply(ctx, config) {
  for (const tool of createTools(config, ctx)) {
    ctx.tools.register(tool)
  }
}

// 供本地测试（无 Host 进程）使用。
export const testing = {
  createTools,
  DEFAULT_CONFIG,
}


