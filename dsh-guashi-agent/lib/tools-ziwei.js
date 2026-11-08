// gua_ziwei —— 紫微斗数排盘。
//
// 输入出生公历时间与性别，输出与前端 `client/ziwei-chart` 数据契约同构的十二宫盘：
// 命宫/身宫、五行局、十四主星与庙旺、四化、辅星与六煞、十二宫干支、大限、流年命宫、
// 神煞、以及盘面提示（hints）。引擎不写断语；断法与格局见 skills（guashi-ziwei，待建）。

import { defineTool, fail, parseDateTime } from './tool-utils.js'

export function createZiweiTool(config) {
  const cfg = config ?? {}
  const defaultLocation = cfg.defaultLocation ?? {}

  const tool = defineTool({
    name: 'gua_ziwei',
    description:
      '紫微斗数排盘。给出生公历时间（datetime，必须）与性别（gender），可选地点/经度（真太阳时判界）、姓名、是否调整闰月（fixLeap，默认 true）。返回十二宫盘：命宫/身宫、五行局、命主/身主、十四主星（含庙旺与四化）、辅星六煞、宫干支、大限与流年命宫、神煞、hints。起盘前先 gua_now 取「此刻此地」；断法见 guashi-ziwei 技能（待建）。',
    parameters: {
      datetime: { type: 'string', description: '出生公历时刻，ISO 或 "YYYY-MM-DD HH:mm"；缺省按当前时间（不建议）。' },
      gender: { type: 'string', enum: ['男', '女'], description: '性别，必填（影响大限顺逆）。' },
      name: { type: 'string', description: '可选：盘主称呼。' },
      location: { type: 'object', description: '可选 { city?, longitude? }，用于真太阳时/子时判界；一般用 gua_now 的结果。' },
      fixLeap: { type: 'boolean', description: '闰月是否按通行口径调整（前半月算上月、后半月算下月），默认 true。' },
      now: { type: 'string', description: '可选：计算「当前大限/流年」的参照时间，缺省当下。' },
    },
    timeoutMs: 20_000,
    async execute(args) {
      if (!args.gender) return fail('紫微排盘需要性别（男/女）。')
      if (!args.datetime) return fail('紫微排盘需要出生公历时间（datetime）。')
      let date
      let now
      try {
        date = parseDateTime(args.datetime)
        now = args.now ? parseDateTime(args.now) : new Date()
      } catch (error) {
        return fail(error?.message ?? error)
      }
      try {
        const engine = await import('./engine/ziwei.js')
        const longitude = Number.isFinite(args.location?.longitude)
          ? Number(args.location.longitude)
          : (Number.isFinite(defaultLocation.longitude) ? Number(defaultLocation.longitude) : undefined)
        const chart = engine.castZiwei({
          date,
          gender: args.gender,
          name: args.name,
          longitude,
          fixLeap: args.fixLeap !== false,
          now,
        })
        const ming = chart.palaces.find((p) => p.isMing)
        const shen = chart.palaces.find((p) => p.isShen)
        try {
          const { saveChartSnapshot } = await import('./chart-snapshot.js')
          await saveChartSnapshot('ziwei', chart, cfg.chartSnapshotPath)
        } catch {
          // snapshot for the sidebar panel is optional
        }
        return {
          ok: true,
          summary: {
            mingGong: ming ? `${ming.name}在${ming.zhi}` : null,
            shenGong: shen ? shen.zhi : null,
            wuxingJu: chart.meta.wuxingJu,
            ziwei: chart.details.ziweiZhi,
            tianfu: chart.details.tianfuZhi,
            daxian: chart.meta.daxian,
            liunian: chart.meta.liunian,
          },
          ...chart,
          hints: [
            ...(chart.hints ?? []),
            '断法：先看命身与三方四正，再论四化与大限流年；本工具只出盘面，吉凶归 guashi-ziwei 技能。',
          ],
        }
      } catch (error) {
        return fail(`紫微排盘失败：${error?.message ?? error}`)
      }
    },
  })

  return tool
}
