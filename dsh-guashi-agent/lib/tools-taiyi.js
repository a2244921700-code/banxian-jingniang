// gua_taiyi —— 太乙神数排盘。
//
// 太乙与奇门、六壬并称「三式」。这里只出盘面：太乙积年与局数、九宫行度、
// 十六神与八将（文昌、始击、计神、主客大将/参将等）、主客算与四神。
// 用神取法、主客算吉凶、格局克应属于 skills（guashi-taiyi），引擎不写断语。

import { defineTool, fail, parseDateTime } from './tool-utils.js'

const TAIYI_MODES = ['时计', '日计', '月计', '年计']

export function createTaiyiTool(config) {
  const cfg = config ?? {}

  const tool = defineTool({
    name: 'gua_taiyi',
    description:
      '太乙神数排盘（三式之一）。给时间（缺省为当前）与所问之事，按 mode 排 时计/日计/月计/年计 盘：返回太乙积年与局数、太乙与十六神/八将（文昌、始击、计神、主大将、主参将、客大将、客参将等）落宫、主客算与定算、九宫盘面、hints（只给盘面与神煞提示）。起盘前先 gua_now 取时取地；断法见 guashi-taiyi 技能。',
    parameters: {
      datetime: { type: 'string', description: '起盘时刻，ISO 格式；缺省用当前时间。' },
      question: { type: 'string', description: '所问何事（原样回显）。' },
      mode: { type: 'string', enum: TAIYI_MODES, description: '计式：时计/日计/月计/年计，默认时计。' },
      location: { type: 'object', description: '可选 { city?, longitude? }，用于真太阳时；一般用 gua_now 的结果。' },
    },
    timeoutMs: 20_000,
    async execute(args) {
      let date
      try {
        date = parseDateTime(args.datetime)
      } catch (error) {
        return fail(error?.message ?? error)
      }
      try {
        const engine = await import('./engine/taiyi.js')
        const mode = args.mode ?? '时计'
        const chart = engine.castTaiyi({ date, mode })
        if (!chart || typeof chart !== 'object') return fail('太乙引擎没有返回盘面。')
        let almanac = null
        try {
          const { getAlmanac } = await import('./engine/almanac.js')
          const longitude = Number.isFinite(args.location?.longitude) ? Number(args.location.longitude) : undefined
          almanac = getAlmanac(date, longitude != null ? { longitude } : {})
        } catch {
          almanac = null
        }
        return {
          ok: true,
          question: args.question ?? null,
          mode,
          time: chart.time ?? almanac,
          ...chart,
          hints: [...(chart.hints ?? []), '太乙以主客算、太乙与八将落宫、计神文昌始击为主，吉凶断法见 guashi-taiyi。'],
        }
      } catch (error) {
        return fail(`太乙排盘失败：${error?.message ?? error}`)
      }
    },
  })

  return tool
}
